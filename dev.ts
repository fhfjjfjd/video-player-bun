import { spawn, type Subprocess } from "bun";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Dev runner — auto-restarts the dev server whenever a file under `src/`
 * changes, so you never have to restart it manually.
 *
 * Why not `bun --watch` / `bun --hot`? On this device their filesystem
 * watchers are unreliable and `bun --hot` does not re-bundle the frontend
 * (the strict CSP keeps `development: false`, which disables on-demand
 * bundling). A plain polling loop works everywhere.
 */
const ROOT = import.meta.dir;
const SRC = path.join(ROOT, "src");
const POLL_MS = 500;

let child: Subprocess | null = null;
let changed = false;

function snapshot(): Map<string, number> {
  const map = new Map<string, number>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else map.set(full, stat.mtimeMs);
    }
  };
  walk(SRC);
  return map;
}

async function stop() {
  if (!child) return;
  child.kill();
  await child.exited.catch(() => {});
  child = null;
}

function start() {
  console.log("[dev] starting server…");
  child = spawn(["bun", "--hot", "src/index.ts"], {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  child.exited.then(() => {
    console.log("[dev] server exited.");
  });
}

let previous = snapshot();
start();

setInterval(async () => {
  const current = snapshot();
  if (current.size !== previous.size) {
    changed = true;
  } else {
    for (const [file, mtime] of current) {
      if (previous.get(file) !== mtime) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) return;
  changed = false;
  previous = current;
  console.log("[dev] change detected — restarting…");
  await stop();
  start();
}, POLL_MS);
