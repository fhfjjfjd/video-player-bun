import type { BunRequest } from "bun";
import type { User } from "../types";
import { findUserBySession } from "./db";
import path from "node:path";
import { dlopen } from "bun:ffi";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const libPath = path.join(process.cwd(), "bin", `${process.platform}-${process.arch}`, `libauth${process.platform === "win32" ? ".dll" : process.platform === "darwin" ? ".dylib" : ".so"}`);
const lib = dlopen(libPath, {
  auth_create_session: {
    returns: "pointer",
    arguments: ["int32", "pointer", "pointer", "size"],
  },
  auth_validate_session: {
    returns: "int32",
    arguments: ["pointer", "pointer", "pointer"],
  },
});

export const hashPassword = (password: string): Promise<string> => Bun.password.hash(password);

export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  Bun.password.verify(password, hash);

export function getSessionToken(req: BunRequest): string | null {
  const cookies = new Bun.CookieMap(req.headers.get("cookie") ?? "");
  return cookies.get(SESSION_COOKIE);
}

export function getAuthenticatedUser(req: BunRequest): User | null {
  const token = getSessionToken(req);
  return token ? findUserBySession(token) : null;
}

export function createSessionToken(userId: number): string {
  const output = Buffer.alloc(1024);
  const secret = process.env.MEDIA_URL_SECRET ?? "";
  const ptr = lib.symbols.auth_create_session(
    userId,
    Buffer.from(secret),
    output,
    output.length,
  );
  if (!ptr) throw new Error("Failed to create session token");
  return output.toString("utf8").split("\0")[0];
}

export function validateSessionToken(token: string): number | null {
  const secret = process.env.MEDIA_URL_SECRET ?? "";
  const userIdBuf = Buffer.alloc(4);
  const result = lib.symbols.auth_validate_session(
    Buffer.from(token),
    Buffer.from(secret),
    userIdBuf,
  );
  if (result !== 0) return null;
  const userId = userIdBuf.readInt32LE(0);
  return userId > 0 ? userId : null;
}

export function setSessionCookie(response: Response, token: string): void {
  const cookies = new Bun.CookieMap();
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("set-cookie", cookies.toSetCookieHeaders()[0]!);
}

export function clearSessionCookie(response: Response): void {
  const cookies = new Bun.CookieMap();
  cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  response.headers.set("set-cookie", cookies.toSetCookieHeaders()[0]!);
}