import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function loadSecret(): string {
  const fromEnv = process.env.MEDIA_URL_SECRET;
  if (fromEnv) return fromEnv;
  const file = process.env.MEDIA_SECRET_FILE ?? path.join(process.cwd(), ".media-secret");
  if (existsSync(file)) {
    const existing = readFileSync(file, "utf8").trim();
    if (existing) return existing;
  }
  const generated = randomBytes(32).toString("hex");
  writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

const SECRET = loadSecret();

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function createMediaToken(filename: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ f: filename, e: expiry })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyMediaToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^[0-9a-f]{64}$/.test(signature)) return null;

  const expected = Buffer.from(sign(payload), "hex");
  const provided = Buffer.from(signature, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      f?: string;
      e?: number;
    };
    if (typeof data.f !== "string" || data.f.length === 0) return null;
    if (typeof data.e !== "number" || data.e < Date.now()) return null;
    if (/[\\/]|\.\./.test(data.f)) return null;
    return data.f;
  } catch {
    return null;
  }
}
