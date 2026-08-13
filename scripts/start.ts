import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const ROUTER = path.join(ROOT, "src", "server", "php", "server.php");

const port = process.env.PORT ?? "3000";
const hostname = process.env.HOST ?? process.env.HOSTNAME ?? "127.0.0.1";

const parsedWorkers = Number.parseInt(process.env.PHP_WORKERS ?? "4", 10);
const workers = Number.isFinite(parsedWorkers) && parsedWorkers > 0 ? String(parsedWorkers) : "4";

function getLanIp(): string | undefined {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] ?? []) {
      if (net.internal) continue;
      if (net.family === "IPv4" || net.family === 4) return net.address;
    }
  }
  return undefined;
}

function printAccessUrls(): void {
  const wildcard = hostname === "0.0.0.0" || hostname === "::" || hostname === "";
  const localHost = wildcard ? "127.0.0.1" : hostname;
  console.log("Starting backend with PHP's built-in web server...");
  console.log(`  Local:   http://${localHost}:${port}`);
  if (wildcard) {
    const lanIp = getLanIp();
    if (lanIp) {
      console.log(`  Network: http://${lanIp}:${port}  (other devices on the same network)`);
    }
  }
}

printAccessUrls();

const child = spawn(
  "php",
  [
    "-d",
    "upload_max_filesize=1100M",
    "-d",
    "post_max_size=1100M",
    "-d",
    "memory_limit=512M",
    "-d",
    "max_execution_time=600",
    "-S",
    `${hostname}:${port}`,
    ROUTER,
  ],
  {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      DIST_DIR: process.env.DIST_DIR ?? path.join(ROOT, "dist"),
      UPLOAD_DIR: process.env.UPLOAD_DIR ?? path.join(ROOT, "uploads"),
      DATABASE_PATH: process.env.DATABASE_PATH ?? path.join(ROOT, "data.db"),
      ...(process.platform !== "win32" ? { PHP_CLI_SERVER_WORKERS: workers } : {}),
    },
  },
);

child.on("error", (err) => {
  console.error(`Failed to launch backend server: ${err.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
