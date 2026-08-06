import { serve } from "bun";
import { createApiRoutes } from "./routes";

export const API_PORT = Number(process.env.API_PORT ?? 3001);

export function startApiServer() {
  return serve({
    hostname: "127.0.0.1",
    port: API_PORT,
    routes: createApiRoutes(),
    development: process.env.NODE_ENV !== "production" ? { console: true } : undefined,
  });
}

if (import.meta.main) {
  const server = startApiServer();
  console.log(`[api] 🚀 API server running at ${server.url}`);

  const shutdown = (signal: string) => {
    console.log(`[api] Received ${signal}, shutting down…`);
    server.stop(true);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}
