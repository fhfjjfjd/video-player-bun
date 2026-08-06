import type { BunRequest } from "bun";
import type { User } from "../../types";
import {
  SESSION_TTL_MS,
  clearSessionCookie,
  getAuthenticatedUser,
  getSessionToken,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "../auth";
import { createSession, createUser, deleteSession, findUserByUsername } from "../db";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const MIN_PASSWORD_LENGTH = 6;

interface AuthBody {
  username?: unknown;
  password?: unknown;
}

const jsonError = (status: number, message: string): Response =>
  Response.json({ error: message }, { status });

const parseCredentials = (body: AuthBody): { username: string; password: string } | Response => {
  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string") {
    return jsonError(400, "Thiếu username hoặc password.");
  }
  if (!USERNAME_RE.test(username)) {
    return jsonError(400, "Username phải gồm 3–32 ký tự chữ, số hoặc gạch dưới.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return jsonError(400, `Password phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }
  return { username: username.trim(), password };
};

const respondWithSession = (user: User): Response => {
  const token = crypto.randomUUID();
  createSession(user.id, token, new Date(Date.now() + SESSION_TTL_MS).toISOString());
  const response = Response.json({ user });
  setSessionCookie(response, token);
  return response;
};

export async function register(req: BunRequest): Promise<Response> {
  const body = (await req.json().catch(() => null)) as AuthBody | null;
  if (!body) return jsonError(400, "Body JSON không hợp lệ.");

  const parsed = parseCredentials(body);
  if (parsed instanceof Response) return parsed;

  if (findUserByUsername(parsed.username)) {
    return jsonError(409, "Username đã tồn tại.");
  }

  const passwordHash = await hashPassword(parsed.password);
  createUser(parsed.username, passwordHash);
  return Response.json({ ok: true });
}

export async function login(req: BunRequest): Promise<Response> {
  const body = (await req.json().catch(() => null)) as AuthBody | null;
  if (!body) return jsonError(400, "Body JSON không hợp lệ.");

  const parsed = parseCredentials(body);
  if (parsed instanceof Response) return parsed;

  const userRow = findUserByUsername(parsed.username);
  if (!userRow || !(await verifyPassword(parsed.password, userRow.password_hash))) {
    return jsonError(401, "Sai username hoặc password.");
  }

  return respondWithSession({ id: userRow.id, username: userRow.username });
}

export function logout(req: BunRequest): Response {
  const token = getSessionToken(req);
  if (token) deleteSession(token);
  const response = Response.json({ ok: true });
  clearSessionCookie(response);
  return response;
}

export function me(req: BunRequest): Response {
  const user = getAuthenticatedUser(req);
  if (!user) return jsonError(401, "Chưa đăng nhập.");
  return Response.json({ user });
}
