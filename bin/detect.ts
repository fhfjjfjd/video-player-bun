import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const ROUTER = path.join(ROOT, "src", "server", "php", "server.php");

console.log("Starting backend with PHP's built-in web server...");

const port = process.env.PORT ?? "3000";
const hostname = process.env.HOSTNAME ?? "127.0.0.1";

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
