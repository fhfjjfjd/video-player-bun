import { Pool } from 'pg';
import os from 'os';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(__dirname, '../..');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const HLS_DIR = path.join(UPLOAD_DIR, 'hls');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

const DEFAULT_URL = `postgresql://${os.userInfo().username}@localhost:5432/video_player`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size BIGINT NOT NULL,
    duration REAL DEFAULT 0,
    uploader_id INTEGER,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    hls_dir TEXT,
    hls_master TEXT,
    transcode_status TEXT DEFAULT 'none',
    visibility TEXT DEFAULT 'public',
    share_token TEXT,
    FOREIGN KEY (uploader_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_videos_created ON videos (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_videos_uploader ON videos (uploader_id);
  CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos (visibility);

  CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_comments_video ON comments (video_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    video_id INTEGER NOT NULL,
    watched_at TIMESTAMPTZ DEFAULT now(),
    progress REAL DEFAULT 0,
    UNIQUE (user_id, video_id),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_history_user ON history (user_id, watched_at DESC);

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

  CREATE TABLE IF NOT EXISTS subtitles (
    id SERIAL PRIMARY KEY,
    video_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    language TEXT DEFAULT '',
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_subtitles_video ON subtitles (video_id);
`;

export async function initDb(): Promise<void> {
  await pool.query(SCHEMA);
}

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params as any[]);
}

export { UPLOAD_DIR, HLS_DIR };

export default { query, initDb };
