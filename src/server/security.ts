export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function secureRoutes<T extends Record<string, unknown>>(routes: T): T {
  const walk = (node: unknown): unknown => {
    if (typeof node === "function") {
      // File routes (e.g. media streaming) must be returned directly so Bun can
      // auto-handle Range/ETag requests; reading `.body` would sever that link.
      if ((node as { skipSecurity?: boolean }).skipSecurity) return node;
      return async (req: Request) => applySecurityHeaders(await (node as (req: Request) => Response | Promise<Response>)(req));
    }
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        out[key] = walk(value);
      }
      return out;
    }
    return node;
  };
  return walk(routes) as T;
}
