import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync, mkdirSync, cpSync } from "node:fs";

function getArch(): string {
  const raw = process.arch;
  if (raw === "x64") return "x64";
  if (raw === "arm64") return "arm64";
  return raw;
}

function getPlatform(): string {
  const platform = process.platform;
  if (platform === "linux") return "linux";
  if (platform === "darwin") return "darwin";
  if (platform === "win32") return "windows";
  if (platform === "android") return "android";
  return platform;
}

const ARCH = getArch();
const PLATFORM = getPlatform();
const BIN_DIR = path.join(process.cwd(), "bin", `${PLATFORM}-${ARCH}`);
const SRC_LIB = path.join(process.cwd(), "src", "server", "cpp", "lib", "video-server");
const BIN_NAME = PLATFORM === "windows" ? "video-server.exe" : "video-server";
const BIN_PATH = path.join(BIN_DIR, BIN_NAME);

console.log(`Detected platform: ${PLATFORM}-${ARCH}`);

// Dev convenience: if the C++ server was built locally (src/server/cpp/lib),
// copy it into place so the app runs without a manual download.
if (!existsSync(BIN_PATH) && existsSync(SRC_LIB)) {
  mkdirSync(BIN_DIR, { recursive: true });
  try {
    cpSync(SRC_LIB, BIN_PATH, { force: true });
    console.log(`  [OK] Copied ${BIN_NAME} → ${BIN_PATH}`);
  } catch (e) {
    console.warn(`  [WARN] Failed to copy ${BIN_NAME}: ${e}`);
  }
}

if (!existsSync(BIN_PATH)) {
  console.error("");
  console.error(`  C++ server binary not found: ${BIN_PATH}`);
  console.error("");
  console.error(`  The backend is a native C++ binary and is NEVER compiled on this machine.`);
  console.error(`  Download the pre-built "${BIN_NAME}" for ${PLATFORM}-${ARCH} from the`);
  console.error(`  GitHub release page (or Actions artifacts) and place it at:`);
  console.error(`      ${BIN_PATH}`);
  console.error("");
  process.exit(1);
}

const port = process.env.PORT ?? "3000";
const hostname = process.env.HOSTNAME ?? "127.0.0.1";

const child = spawn(BIN_PATH, [port, hostname], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    DIST_DIR: process.env.DIST_DIR ?? path.join(process.cwd(), "dist"),
    UPLOAD_DIR: process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"),
    DATABASE_PATH: process.env.DATABASE_PATH ?? path.join(process.cwd(), "data.db"),
  },
});

child.on("error", (err) => {
  console.error(`Failed to launch C++ server: ${err.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
