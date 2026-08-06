import { Database } from "bun:sqlite";
import path from "node:path";
import type { User } from "../types";

const db = new Database(process.env.DATABASE_PATH ?? path.join(process.cwd(), "data.db"));

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    filename TEXT NOT NULL UNIQUE,
    size INTEGER NOT NULL,
    content_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

interface SessionRow {
  id: number;
  username: string;
  expires_at: string;
}

export function createUser(username: string, passwordHash: string): User {
  const result = db
    .query("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .run(username, passwordHash);

  return {
    id: Number(result.lastInsertRowid),
    username,
  };
}

export function findUserByUsername(username: string): UserRow | null {
  return db.query("SELECT * FROM users WHERE username = ?").get(username) as UserRow | null;
}

export function createSession(userId: number, token: string, expiresAt: string): void {
  db.query("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
}

export function findUserBySession(token: string): User | null {
  const row = db
    .query(
      `SELECT u.id, u.username, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as SessionRow | null;

  if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;
  return { id: row.id, username: row.username };
}

export function deleteSession(token: string): void {
  db.query("DELETE FROM sessions WHERE token = ?").run(token);
}

interface VideoRow {
  id: number;
  user_id: number;
  title: string;
  filename: string;
  size: number;
  content_type: string;
  created_at: string;
}

export function createVideo(userId: number, title: string, filename: string, size: number, contentType: string): VideoRow {
  const result = db
    .query("INSERT INTO videos (user_id, title, filename, size, content_type) VALUES (?, ?, ?, ?, ?)")
    .run(userId, title, filename, size, contentType);

  return {
    id: Number(result.lastInsertRowid),
    user_id: userId,
    title,
    filename,
    size,
    content_type: contentType,
    created_at: new Date().toISOString(),
  };
}

export function listAllVideos(query?: string): VideoRow[] {
  if (query) {
    const escaped = query.replace(/[\\%_]/g, match => `\\${match}`);
    return db
      .query(`SELECT * FROM videos WHERE title LIKE ?1 ESCAPE '\\' ORDER BY created_at DESC, id DESC`)
      .all(`%${escaped}%`) as VideoRow[];
  }
  return db.query("SELECT * FROM videos ORDER BY created_at DESC, id DESC").all() as VideoRow[];
}

export function findVideoById(id: number): VideoRow | null {
  return db.query("SELECT * FROM videos WHERE id = ?").get(id) as VideoRow | null;
}

export function findVideoByIdAndUser(id: number, userId: number): VideoRow | null {
  return db.query("SELECT * FROM videos WHERE id = ? AND user_id = ?").get(id, userId) as VideoRow | null;
}

export function findVideoByFilename(filename: string): VideoRow | null {
  return db.query("SELECT * FROM videos WHERE filename = ?").get(filename) as VideoRow | null;
}

export function deleteVideoRecord(id: number): void {
  db.query("DELETE FROM videos WHERE id = ?").run(id);
}
