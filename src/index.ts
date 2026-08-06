import { serve } from "bun";
import os from "node:os";
import index from "./index.html";
import { loadConfig } from "./server/config";
import { API_PORT, startApiServer } from "./server/api";
import { applySecurityHeaders } from "./server/security";

const config = loadConfig();
const apiBaseUrl = `http://127.0.0.1:${API_PORT}`;

function displayUrl(hostname: string, port: number): string {
  if (hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost") {
    return `http://localhost:${port}/`;
  }
  if (hostname === "0.0.0.0" || hostname === "::") {
    const lan = Object.values(os.networkInterfaces())
      .flat()
      .find(iface => iface && iface.family === "IPv4" && !iface.internal);
    return `http://${lan ? lan.address : "localhost"}:${port}/`;
  }
  return `http://${hostname}:${port}/`;
}

let apiServer: ReturnType<typeof startApiServer> | null = null;

// By default the frontend process also starts the API server so a single
// `bun dev` runs the whole stack. Set WEB_ONLY=1 (or have the API already
// running standalone on API_PORT) to run frontend-only.
if (process.env.WEB_ONLY !== "1") {
  try {
    apiServer = startApiServer();
  } catch {
    console.warn(
      `[web] API server not started — port ${API_PORT} may be in use by a standalone instance. Running frontend-only.`,
    );
  }
}

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

async function proxyToApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = `${apiBaseUrl}${url.pathname}${url.search}`;
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: req.headers,
      body: BODYLESS_METHODS.has(req.method) ? undefined : req.body,
    });
    const headers = new Headers(upstream.headers);
    // Strip hop-by-hop headers so the proxy chain stays valid.
    headers.delete("connection");
    headers.delete("keep-alive");
    headers.delete("transfer-encoding");
    headers.delete("upgrade");
    return applySecurityHeaders(new Response(upstream.body, { status: upstream.status, headers }));
  } catch {
    return applySecurityHeaders(Response.json({ error: "Không thể kết nối máy chủ API." }, { status: 502 }));
  }
}

const server = serve({
  hostname: config.hostname,
  port: config.port,
  routes: {
    "/api/*": proxyToApi,
    "/*": index,
  },
  // Dev features (HMR, console relay) are disabled: Bun's HMR injects an inline
  // bootstrap script that conflicts with the strict Content-Security-Policy.
  development: false,
});

const log = (message: string) => console.log(`[web] ${message}`);

log(`🚀 Frontend running at ${displayUrl(config.hostname, config.port)} (${config.isDevelopment ? "development" : "production"})`);
if (apiServer) log(`API running at ${apiServer.url}`);

function shutdown(signal: string) {
  log(`Received ${signal}, shutting down…`);
  server.stop(true);
  apiServer?.stop(true);
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
