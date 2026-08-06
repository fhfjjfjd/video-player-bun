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
import { createSession, createUser, deleteSession, findUserByEmail, findUserByIdentifier, findUserByUsername } from "../db";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const GMAIL_RE = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const MIN_PASSWORD_LENGTH = 6;

interface RegisterBody {
  username?: unknown;
  email?: unknown;
  password?: unknown;
}

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

const jsonError = (status: number, message: string): Response =>
  Response.json({ error: message }, { status });

const respondWithSession = (user: User): Response => {
  const token = crypto.randomUUID();
  createSession(user.id, token, new Date(Date.now() + SESSION_TTL_MS).toISOString());
  const response = Response.json({ user });
  setSessionCookie(response, token);
  return response;
};

export async function register(req: BunRequest): Promise<Response> {
  const body = (await req.json().catch(() => null)) as RegisterBody | null;
  if (!body) return jsonError(400, "Body JSON không hợp lệ.");

  const { username, email, password } = body;
  if (typeof username !== "string" || typeof password !== "string") {
    return jsonError(400, "Thiếu username hoặc password.");
  }

  const trimmedUsername = username.trim();
  if (!USERNAME_RE.test(trimmedUsername)) {
    return jsonError(400, "Username phải gồm 3–32 ký tự chữ, số hoặc gạch dưới.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return jsonError(400, `Password phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }
  if (typeof email !== "string" || !GMAIL_RE.test(email.trim())) {
    return jsonError(400, "Email phải là tài khoản Gmail hợp lệ (…@gmail.com).");
  }
  const gmail = email.trim().toLowerCase();

  if (findUserByUsername(trimmedUsername)) {
    return jsonError(409, "Username đã tồn tại.");
  }
  if (findUserByEmail(gmail)) {
    return jsonError(409, "Email Gmail này đã được dùng để đăng ký.");
  }

  const passwordHash = await hashPassword(password);
  createUser(trimmedUsername, gmail, passwordHash);
  return Response.json({ ok: true });
}

export async function login(req: BunRequest): Promise<Response> {
  const body = (await req.json().catch(() => null)) as LoginBody | null;
  if (!body) return jsonError(400, "Body JSON không hợp lệ.");

  const { username, password } = body;
  if (typeof username !== "string" || typeof password !== "string") {
    return jsonError(400, "Thiếu Gmail/username hoặc password.");
  }
  const identifier = username.trim();
  if (!identifier) return jsonError(400, "Nhập Gmail hoặc username của bạn.");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return jsonError(400, `Password phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }

  const userRow = findUserByIdentifier(identifier);
  if (!userRow || !(await verifyPassword(password, userRow.password_hash))) {
    return jsonError(401, "Sai Gmail/username hoặc password.");
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
