import { execSync } from "node:child_process";
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

function getExt(): string {
  const platform = process.platform;
  if (platform === "win32") return ".dll";
  if (platform === "darwin") return ".dylib";
  return ".so";
}

const ARCH = getArch();
const PLATFORM = getPlatform();
const EXT = getExt();
const SRC_DIR = path.join(process.cwd(), "src", "server", "cpp", "lib");
const BIN_DIR = path.join(process.cwd(), "bin", `${PLATFORM}-${ARCH}`);

const LIB_NAMES = [
  `libmediatoken${EXT}`,
  `libsecurity${EXT}`,
  `libauth${EXT}`,
  `libdb${EXT}`,
  `libvideos${EXT}`,
];

console.log(`Detected platform: ${PLATFORM}-${ARCH}`);
console.log(`Looking for binaries in: ${SRC_DIR}`);

if (!existsSync(BIN_DIR)) {
  mkdirSync(BIN_DIR, { recursive: true });
}

for (const libName of LIB_NAMES) {
  const srcPath = path.join(SRC_DIR, libName);
  const dstPath = path.join(BIN_DIR, libName);

  if (existsSync(srcPath)) {
    try {
      cpSync(srcPath, dstPath, { force: true });
      console.log(`  [OK] Copied ${libName} → ${dstPath}`);
    } catch (e) {
      console.warn(`  [WARN] Failed to copy ${libName}: ${e}`);
    }
  } else {
    console.warn(`  [WARN] Source not found: ${srcPath}`);
  }
}

console.log(`\nBinary directory: ${BIN_DIR}`);
console.log("Setup complete.");