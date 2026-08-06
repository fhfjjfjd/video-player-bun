import type { BunRequest } from "bun";
import type { User } from "../types";
import { findUserBySession } from "./db";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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
