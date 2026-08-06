import path from "node:path";
import { dlopen, ffi } from "bun:ffi";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const libPath = path.join(process.cwd(), "bin", `${process.platform}-${process.arch}`, `libmediatoken${process.platform === "win32" ? ".dll" : process.platform === "darwin" ? ".dylib" : ".so"}`);
const lib = dlopen(libPath, {
  mediatoken_sign: {
    returns: "pointer",
    arguments: ["pointer", "pointer", "pointer", "size"],
  },
  mediatoken_verify: {
    returns: "int32",
    arguments: ["pointer", "pointer", "pointer", "size"],
  },
});

function loadSecret(): string {
  const fromEnv = process.env.MEDIA_URL_SECRET;
  if (fromEnv) return fromEnv;
  const file = process.env.MEDIA_SECRET_FILE ?? path.join(process.cwd(), ".media-secret");
  try {
    const { readFileSync } = require("node:fs");
    const existing = readFileSync(file, "utf8").trim();
    if (existing) return existing;
  } catch {}
  const { randomBytes } = require("node:crypto");
  const generated = randomBytes(32).toString("hex");
  try {
    const { writeFileSync } = require("node:fs");
    writeFileSync(file, generated, { mode: 0o600 });
  } catch {}
  return generated;
}

const SECRET = loadSecret();

export function createMediaToken(filename: string): string {
  const output = Buffer.alloc(2048);
  const ptr = lib.symbols.mediatoken_sign(
    Buffer.from(filename),
    Buffer.from(SECRET),
    output,
    output.length,
  );
  if (!ptr) throw new Error("Failed to create media token");
  return output.toString("utf8").split("\0")[0];
}

export function verifyMediaToken(token: string): string | null {
  const output = Buffer.alloc(512);
  const result = lib.symbols.mediatoken_verify(
    Buffer.from(token),
    Buffer.from(SECRET),
    output,
    output.length,
  );
  if (result !== 0) return null;
  const filename = output.toString("utf8").split("\0")[0];
  return filename || null;
}