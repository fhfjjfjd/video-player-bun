import path from "node:path";
import { dlopen } from "bun:ffi";
import type { User } from "../types";

const libPath = path.join(process.cwd(), "bin", `${process.platform}-${process.arch}`, `libdb${process.platform === "win32" ? ".dll" : process.platform === "darwin" ? ".dylib" : ".so"}`);
const lib = dlopen(libPath, {
  db_init: {
    returns: "pointer",
    arguments: ["pointer"],
  },
  db_close: {
    returns: "void",
    arguments: ["pointer"],
  },
  db_create_user: {
    returns: "int32",
    arguments: ["pointer", "pointer", "pointer", "pointer"],
  },
  db_find_user_by_username: {
    returns: "int32",
    arguments: ["pointer", "pointer", "size", "pointer", "size"],
  },
  db_find_user_by_email: {
    returns: "int32",
    arguments: ["pointer", "pointer", "size", "pointer", "size"],
  },
  db_find_user_by_identifier: {
    returns: "int32",
    arguments: ["pointer", "pointer", "size", "pointer", "size", "pointer", "size"],
  },
  db_create_session: {
    returns: "int32",
    arguments: ["int32", "pointer", "pointer"],
  },
  db_find_user_by_session_token: {
    returns: "int32",
    arguments: ["pointer", "pointer"],
  },
  db_delete_session: {
    returns: "int32",
    arguments: ["pointer"],
  },
  db_create_video: {
    returns: "int32",
    arguments: ["int32", "pointer", "pointer", "int64", "pointer", "pointer", "pointer"],
  },
  db_list_all_videos: {
    returns: "int32",
    arguments: ["pointer", "pointer", "size"],
  },
  db_find_video_by_id: {
    returns: "int32",
    arguments: ["int32", "pointer", "size"],
  },
  db_find_video_by_id_and_user: {
    returns: "int32",
    arguments: ["int32", "int32", "pointer", "size"],
  },
  db_find_video_by_filename: {
    returns: "int32",
    arguments: ["pointer", "pointer", "size"],
  },
  db_delete_video: {
    returns: "int32",
    arguments: ["int32"],
  },
});

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data.db");
const dbHandle = lib.symbols.db_init(Buffer.from(DB_PATH));

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  email: string | null;
}

interface SessionRow {
  id: number;
  username: string;
  expires_at: string;
}

export function createUser(username: string, email: string, passwordHash: string): User {
  const userIdBuf = Buffer.alloc(4);
  const result = lib.symbols.db_create_user(
    Buffer.from(username),
    Buffer.from(email),
    Buffer.from(passwordHash),
    userIdBuf,
  );
  if (result !== 0) throw new Error("Failed to create user");
  return {
    id: userIdBuf.readInt32LE(0),
    username,
  };
}

export function findUserByUsername(username: string): UserRow | null {
  const emailBuf = Buffer.alloc(256);
  const hashBuf = Buffer.alloc(256);
  const result = lib.symbols.db_find_user_by_username(
    Buffer.from(username),
    emailBuf,
    emailBuf.length,
    hashBuf,
    hashBuf.length,
  );
  if (result !== 0) return null;
  const email = emailBuf.toString("utf8").split("\0")[0] || null;
  return {
    id: 0,
    username,
    password_hash: hashBuf.toString("utf8").split("\0")[0],
    email,
  };
}

export function findUserByEmail(email: string): UserRow | null {
  const usernameBuf = Buffer.alloc(256);
  const hashBuf = Buffer.alloc(256);
  const result = lib.symbols.db_find_user_by_email(
    Buffer.from(email),
    usernameBuf,
    usernameBuf.length,
    hashBuf,
    hashBuf.length,
  );
  if (result !== 0) return null;
  const username = usernameBuf.toString("utf8").split("\0")[0];
  return {
    id: 0,
    username,
    password_hash: hashBuf.toString("utf8").split("\0")[0],
    email,
  };
}

export function findUserByIdentifier(identifier: string): UserRow | null {
  const usernameBuf = Buffer.alloc(256);
  const emailBuf = Buffer.alloc(256);
  const hashBuf = Buffer.alloc(256);
  const result = lib.symbols.db_find_user_by_identifier(
    Buffer.from(identifier),
    usernameBuf,
    usernameBuf.length,
    emailBuf,
    emailBuf.length,
    hashBuf,
    hashBuf.length,
  );
  if (result !== 0) return null;
  const username = usernameBuf.toString("utf8").split("\0")[0];
  const email = emailBuf.toString("utf8").split("\0")[0] || null;
  return {
    id: 0,
    username,
    password_hash: hashBuf.toString("utf8").split("\0")[0],
    email,
  };
}

export function createSession(userId: number, token: string, expiresAt: string): void {
  const result = lib.symbols.db_create_session(userId, Buffer.from(token), Buffer.from(expiresAt));
  if (result !== 0) throw new Error("Failed to create session");
}

export function findUserBySession(token: string): User | null {
  const userIdBuf = Buffer.alloc(4);
  const result = lib.symbols.db_find_user_by_session_token(Buffer.from(token), userIdBuf);
  if (result !== 0) return null;
  const userId = userIdBuf.readInt32LE(0);
  if (userId <= 0) return null;
  return { id: userId, username: "" };
}

export function deleteSession(token: string): void {
  lib.symbols.db_delete_session(Buffer.from(token));
}

interface VideoRow {
  id: number;
  user_id: number;
  title: string;
  filename: string;
  size: number;
  content_type: string;
  thumbnail_filename: string | null;
  created_at: string;
}

export function createVideo(userId: number, title: string, filename: string, size: number, contentType: string, thumbnailFilename?: string | null): VideoRow {
  const videoIdBuf = Buffer.alloc(4);
  const result = lib.symbols.db_create_video(
    userId,
    Buffer.from(title),
    Buffer.from(filename),
    BigInt(size),
    Buffer.from(contentType),
    thumbnailFilename ? Buffer.from(thumbnailFilename) : Buffer.alloc(0),
    videoIdBuf,
  );
  if (result !== 0) throw new Error("Failed to create video");
  return {
    id: videoIdBuf.readInt32LE(0),
    user_id: userId,
    title,
    filename,
    size,
    content_type: contentType,
    thumbnail_filename: thumbnailFilename ?? null,
    created_at: new Date().toISOString(),
  };
}

export function listAllVideos(query?: string): VideoRow[] {
  const output = Buffer.alloc(65536);
  const result = lib.symbols.db_list_all_videos(
    query ? Buffer.from(query) : Buffer.alloc(0),
    output,
    output.length,
  );
  if (result !== 0) return [];
  const jsonStr = output.toString("utf8").split("\0")[0];
  if (!jsonStr || jsonStr === "[]") return [];
  try {
    return JSON.parse(jsonStr).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      filename: row.filename,
      size: row.size,
      content_type: row.content_type,
      thumbnail_filename: row.thumbnail_filename || null,
      created_at: row.created_at,
    }));
  } catch {
    return [];
  }
}

export function findVideoById(id: number): VideoRow | null {
  const output = Buffer.alloc(4096);
  const result = lib.symbols.db_find_video_by_id(id, output, output.length);
  if (result !== 0) return null;
  const jsonStr = output.toString("utf8").split("\0")[0];
  if (!jsonStr) return null;
  try {
    const row = JSON.parse(jsonStr);
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      filename: row.filename,
      size: row.size,
      content_type: row.content_type,
      thumbnail_filename: row.thumbnail_filename || null,
      created_at: row.created_at,
    };
  } catch {
    return null;
  }
}

export function findVideoByIdAndUser(id: number, userId: number): VideoRow | null {
  const output = Buffer.alloc(4096);
  const result = lib.symbols.db_find_video_by_id_and_user(id, userId, output, output.length);
  if (result !== 0) return null;
  const jsonStr = output.toString("utf8").split("\0")[0];
  if (!jsonStr) return null;
  try {
    const row = JSON.parse(jsonStr);
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      filename: row.filename,
      size: row.size,
      content_type: row.content_type,
      thumbnail_filename: row.thumbnail_filename || null,
      created_at: row.created_at,
    };
  } catch {
    return null;
  }
}

export function findVideoByFilename(filename: string): VideoRow | null {
  const output = Buffer.alloc(4096);
  const result = lib.symbols.db_find_video_by_filename(Buffer.from(filename), output, output.length);
  if (result !== 0) return null;
  const jsonStr = output.toString("utf8").split("\0")[0];
  if (!jsonStr) return null;
  try {
    const row = JSON.parse(jsonStr);
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      filename: row.filename,
      size: row.size,
      content_type: row.content_type,
      thumbnail_filename: row.thumbnail_filename || null,
      created_at: row.created_at,
    };
  } catch {
    return null;
  }
}

export function deleteVideoRecord(id: number): void {
  lib.symbols.db_delete_video(id);
}