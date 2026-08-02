import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { spawnSync } from 'child_process';
import db, { UPLOAD_DIR } from './db';
import { transcodeVideo } from './transcode';

declare global {
  namespace Express {
    interface Request {
      cookies?: Record<string, string>;
      userId?: number;
      token?: string;
    }
  }
}

const ROOT = path.resolve(__dirname, '../..');
const PORT = process.env.PORT || 3000;
const STATIC_DIR = path.join(ROOT, 'dist', 'public');
const MAX_SIZE = 500 * 1024 * 1024;
const SUBTITLE_DIR = path.join(UPLOAD_DIR, 'subtitles');
const HLS_DIR = path.join(UPLOAD_DIR, 'hls');
const EXT_MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
  '.mov': 'video/quicktime', '.ogv': 'video/ogg', '.ogg': 'video/ogg',
  '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.3gp': 'video/3gpp',
};

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});
app.use(express.static(STATIC_DIR));
app.use(express.static(path.join(ROOT, 'public'), { maxAge: '7d' }));

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(test));
}

const RATE_MAX = 5;
const RATE_WINDOW = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; until: number }>();

function clientKey(req: Request) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

async function authUser(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  try {
    const rows = await db.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
    if (!rows.rows.length) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
    req.userId = rows.rows[0].user_id;
    req.token = token;
    next();
  } catch (e) {
    next(e as Error);
  }
}

async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (token) {
    try {
      const rows = await db.query('SELECT user_id FROM sessions WHERE token = $1', [token]);
      if (rows.rows.length) req.userId = rows.rows[0].user_id;
    } catch (e) {
      next(e as Error);
      return;
    }
  }
  next();
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  const cookie = req.headers.cookie || '';
  req.cookies = Object.fromEntries(
    cookie.split(';').map(c => c.trim().split(/=(.*)/s).slice(0, 2))
  ) as Record<string, string>;
  next();
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  defParamCharset: 'utf8',
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const videoExt = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.ogv', '.m4v', '.3gp'];
    if (file.mimetype.startsWith('video/') || (file.mimetype === 'application/octet-stream' && videoExt.includes(ext))) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận file video'));
  },
});

const subtitleUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(SUBTITLE_DIR, String(req.params.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname).toLowerCase());
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.srt' || ext === '.vtt') return cb(null, true);
    cb(new Error('Chỉ chấp nhận file phụ đề .srt hoặc .vtt'));
  },
});

const VIDEO_SIGNATURES: { exts: string[]; match: (head: Buffer) => boolean }[] = [
  { exts: ['.mp4', '.m4v', '.mov', '.3gp'], match: b => b.subarray(4, 8).toString('latin1') === 'ftyp' },
  { exts: ['.webm', '.mkv'], match: b => b.subarray(0, 4).toString('hex') === '1a45dfa3' },
  { exts: ['.avi'], match: b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'AVI ' },
  { exts: ['.ogv', '.ogg'], match: b => b.subarray(0, 4).toString('latin1') === 'OggS' },
];

async function findVideo(id: string | string[]) {
  const rows = await db.query(
    'SELECT v.*, u.username AS uploader FROM videos v LEFT JOIN users u ON v.uploader_id = u.id WHERE v.id = $1',
    [String(id)],
  );
  return rows.rows[0] || null;
}

function canView(video: any, userId: number | undefined, shareToken?: string) {
  if (video.visibility !== 'private') return true;
  if (userId && Number(video.uploader_id) === Number(userId)) return true;
  if (shareToken && video.share_token && shareToken === video.share_token) return true;
  return false;
}

function safeHlsFile(name: string | string[]) {
  const base = path.basename(String(name));
  if (base !== String(name) || base.includes('..') || !/^[A-Za-z0-9._-]+$/.test(base)) return null;
  return base;
}

function srtToVtt(srt: string): string {
  const clean = srt.replace(/\r/g, '').trim();
  return 'WEBVTT\n\n' + clean.replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4') + '\n';
}

app.get('/api/videos', optionalAuth, async (_req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT v.id, v.title, v.description, v.original_name, v.views, v.duration,
              v.created_at, v.transcode_status, v.visibility, v.uploader_id,
              u.username AS uploader
       FROM videos v LEFT JOIN users u ON v.uploader_id = u.id
       WHERE v.visibility = 'public' OR v.uploader_id = $1
       ORDER BY v.created_at DESC`,
      [_req.userId ?? null],
    );
    res.json(rows.rows);
  } catch (e) {
    next(e as Error);
  }
});

app.get('/api/videos/:id', optionalAuth, async (req, res, next) => {
  try {
    const video = await findVideo(req.params.id);
    if (!video) return res.status(404).json({ error: 'Không tìm thấy video' });
    if (!canView(video, req.userId, typeof req.query.t === 'string' ? req.query.t : undefined)) {
      return res.status(403).json({ error: 'Video riêng tư, vui lòng dùng link chia sẻ' });
    }
    res.json(video);
  } catch (e) {
    next(e as Error);
  }
});

app.post('/api/videos/:id/view', async (req, res, next) => {
  try {
    const result = await db.query('UPDATE videos SET views = views + 1 WHERE id = $1 RETURNING views', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Không tìm thấy video' });
    res.json({ views: result.rows[0].views });
  } catch (e) {
    next(e as Error);
  }
});

app.post('/api/videos', authUser, upload.single('video'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn file video' });
  const { title, description } = req.body as { title?: string; description?: string };
  const head = Buffer.alloc(12);
  try {
    const fd = fs.openSync(req.file.path, 'r');
    fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (e2) {}
    return res.status(400).json({ error: 'Không thể đọc file upload' });
  }
  if (!VIDEO_SIGNATURES.some(sig => sig.match(head))) {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    return res.status(400).json({ error: 'File không phải video hợp lệ' });
  }
  try {
    const result = await db.query(
      `INSERT INTO videos (title, description, filename, original_name, size, uploader_id, transcode_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING id`,
      [title || req.file.originalname, description || '', req.file.filename, req.file.originalname, req.file.size, req.userId!],
    );
    const id = Number(result.rows[0].id);
    transcodeVideo(id, req.file.filename);
    res.json({ id, message: 'Upload thành công' });
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch (e2) {}
    next(e as Error);
  }
});

app.delete('/api/videos/:id', authUser, async (req, res, next) => {
  try {
    const video = await db.query('SELECT * FROM videos WHERE id = $1', [req.params.id]);
    const row = video.rows[0] as any;
    if (!row) return res.status(404).json({ error: 'Không tìm thấy video' });
    if (Number(row.uploader_id) !== Number(req.userId)) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa video này' });
    }
    await db.query('DELETE FROM videos WHERE id = $1', [req.params.id]);
    try { fs.unlinkSync(path.join(UPLOAD_DIR, row.filename)); } catch (e) {}
    try { fs.rmSync(path.join(HLS_DIR, String(req.params.id)), { recursive: true, force: true }); } catch (e) {}
    try { fs.rmSync(path.join(SUBTITLE_DIR, String(req.params.id)), { recursive: true, force: true }); } catch (e) {}
    res.json({ message: 'Đã xóa video' });
  } catch (e) {
    next(e as Error);
  }
});

app.get('/api/videos/:id/stream', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM videos WHERE id = $1', [req.params.id]);
    const video = result.rows[0] as any;
    if (!video) return res.status(404).json({ error: 'Không tìm thấy video' });
    const filePath = path.join(UPLOAD_DIR, video.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File không tồn tại' });

    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', EXT_MIME[path.extname(video.filename || video.original_name || '').toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const fileName = video.original_name || 'video.mp4';
    res.setHeader('Content-Disposition', `inline; filename="video.mp4"; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        return res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
      }
      let start: number;
      let end: number;
      if (match[1] === '') {
        const suffix = parseInt(match[2], 10);
        if (isNaN(suffix) || suffix <= 0) {
          return res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
        }
        start = Math.max(stat.size - suffix, 0);
        end = stat.size - 1;
      } else {
        start = parseInt(match[1], 10);
        end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (isNaN(start) || start < 0 || start >= stat.size || end < start) {
          return res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
        }
        if (isNaN(end) || end >= stat.size) end = stat.size - 1;
      }
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', end - start + 1);
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader('Content-Length', stat.size);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (e) {
    next(e as Error);
  }
});

app.get('/api/videos/:id/hls/:file', async (req, res, next) => {
  try {
    const file = safeHlsFile(req.params.file);
    if (!file) return res.status(400).json({ error: 'Đường dẫn không hợp lệ' });
    const result = await db.query('SELECT hls_dir, hls_master, transcode_status FROM videos WHERE id = $1', [req.params.id]);
    const video = result.rows[0] as any;
    if (!video || video.transcode_status !== 'ready' || !video.hls_dir) {
      return res.status(404).json({ error: 'Video chưa sẵn sàng HLS' });
    }
    const filePath = path.resolve(path.join(UPLOAD_DIR, video.hls_dir), file);
    if (!filePath.startsWith(path.join(UPLOAD_DIR, video.hls_dir))) {
      return res.status(400).json({ error: 'Đường dẫn không hợp lệ' });
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File không tồn tại' });
    if (file.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    next(e as Error);
  }
});

function buildPlayerScript(videoId: string | number) {
  const key = 0xa5;
  const url = `/api/videos/${videoId}/stream`;
  const bytes = Buffer.from(url, 'utf8');
  const scrambled: number[] = [];
  for (let i = bytes.length - 1; i >= 0; i--) scrambled.push(bytes[i] ^ key);
  const data = Buffer.from(scrambled).toString('base64');
  const [k, d, b, s, i, n] = ['_k', '_d', '_b', '_s', '_i', '_n'];
  return `(function(){var ${k}=${key},${d}="${data}",${b}=atob(${d}),${s}="",${i},${n}=${b}.length-1;for(${i}=${n};${i}>=0;${i}--){${s}+=String.fromCharCode(${b}.charCodeAt(${i})^${k});}window.__videoUrl=${s};})();`;
}

app.get('/api/videos/:id/player.js', async (req, res, next) => {
  try {
    const result = await db.query('SELECT id FROM videos WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Không tìm thấy video' });
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buildPlayerScript(result.rows[0].id));
  } catch (e) {
    next(e as Error);
  }
});

app.get('/api/videos/:id/comments', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT c.id, c.content, c.created_at, u.username
       FROM comments c JOIN users u ON c.user_id = u.id
       WHERE c.video_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.id],
    );
    res.json(rows.rows);
  } catch (e) {
    next(e as Error);
  }
});

app.post('/api/videos/:id/comments', authUser, async (req, res, next) => {
  try {
    const content = ((req.body as { content?: string }).content || '').trim();
    if (!content) return res.status(400).json({ error: 'Nội dung bình luận trống' });
    const video = await db.query('SELECT id FROM videos WHERE id = $1', [String(req.params.id)]);
    if (!video.rows.length) return res.status(404).json({ error: 'Không tìm thấy video' });
    const result = await db.query(
      'INSERT INTO comments (video_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [String(req.params.id), req.userId!, content],
    );
    const comment = await db.query(
      `SELECT c.id, c.content, c.created_at, u.username
       FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = $1`,
      [result.rows[0].id],
    );
    res.json(comment.rows[0]);
  } catch (e) {
    next(e as Error);
  }
});

app.post('/api/history', authUser, async (req, res, next) => {
  try {
    const { videoId, progress } = req.body as { videoId?: number; progress?: number };
    if (!videoId || typeof videoId !== 'number') return res.status(400).json({ error: 'Thiếu videoId hợp lệ' });
    const video = await db.query('SELECT id FROM videos WHERE id = $1', [String(videoId)]);
    if (!video.rows.length) return res.status(404).json({ error: 'Không tìm thấy video' });
    const p = typeof progress === 'number' && isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    await db.query(
      `INSERT INTO history (user_id, video_id, progress) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, video_id) DO UPDATE SET progress = EXCLUDED.progress, watched_at = now()`,
      [req.userId!, String(videoId), p],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e as Error);
  }
});

app.get('/api/history', authUser, async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT h.progress, h.watched_at, v.id AS video_id, v.title, v.original_name, v.views
       FROM history h JOIN videos v ON h.video_id = v.id
       WHERE h.user_id = $1
       ORDER BY h.watched_at DESC`,
      [req.userId!],
    );
    res.json(rows.rows);
  } catch (e) {
    next(e as Error);
  }
});

app.post('/api/register', async (req, res, next) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password || password.length < 4) {
      return res.status(400).json({ error: 'Tên đăng nhập và mật khẩu (tối thiểu 4 ký tự) là bắt buộc' });
    }
    await db.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hashPassword(password)]);
    res.json({ message: 'Đăng ký thành công' });
  } catch (e) {
    res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
  }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) return res.status(400).json({ error: 'Tên đăng nhập và mật khẩu là bắt buộc' });
    const key = clientKey(req);
    const now = Date.now();
    const entry = loginAttempts.get(key);
    if (entry && entry.until > now) {
      return res.status(429).json({ error: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút' });
    }
    if (entry && now > entry.until) loginAttempts.delete(key);
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0] as any;
    if (!user || !verifyPassword(password, user.password_hash)) {
      const cur = loginAttempts.get(key) || { count: 0, until: 0 };
      cur.count += 1;
      if (cur.count >= RATE_MAX) cur.until = now + RATE_WINDOW;
      loginAttempts.set(key, cur);
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
    }
    loginAttempts.delete(key);
    if (loginAttempts.size > 5000) {
      for (const [k, v] of loginAttempts) if (v.until < now) loginAttempts.delete(k);
    }
    const token = crypto.randomBytes(24).toString('hex');
    await db.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);
    await db.query("DELETE FROM sessions WHERE created_at < now() - interval '7 days'").catch(() => {});
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}`);
    res.json({ username: user.username });
  } catch (e) {
    next(e as Error);
  }
});

app.post('/api/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (token) await db.query('DELETE FROM sessions WHERE token = $1', [token]);
    res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; Max-Age=0');
    res.json({ ok: true });
  } catch (e) {
    next(e as Error);
  }
});

app.get('/api/me', authUser, async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, username FROM users WHERE id = $1', [req.userId!]);
    res.json(result.rows[0]);
  } catch (e) {
    next(e as Error);
  }
});

async function requireOwner(req: Request, res: Response): Promise<any | null> {
  const video = await db.query('SELECT * FROM videos WHERE id = $1', [req.params.id]);
  const row = video.rows[0] as any;
  if (!row) {
    res.status(404).json({ error: 'Không tìm thấy video' });
    return null;
  }
  if (Number(row.uploader_id) !== Number(req.userId)) {
    res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' });
    return null;
  }
  return row;
}

app.post('/api/videos/:id/share', authUser, async (req, res, next) => {
  try {
    const video = await requireOwner(req, res);
    if (!video) return;
    let token = video.share_token as string | null;
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      await db.query('UPDATE videos SET share_token = $1 WHERE id = $2', [token, req.params.id]);
    }
    res.json({ token, url: `/player.html?id=${video.id}&t=${token}` });
  } catch (e) {
    next(e as Error);
  }
});

app.post('/api/videos/:id/visibility', authUser, async (req, res, next) => {
  try {
    const video = await requireOwner(req, res);
    if (!video) return;
    const { visibility } = req.body as { visibility?: string };
    if (visibility !== 'public' && visibility !== 'private') {
      return res.status(400).json({ error: 'visibility phải là public hoặc private' });
    }
    let token = video.share_token as string | null;
    if (visibility === 'private' && !token) {
      token = crypto.randomBytes(16).toString('hex');
      await db.query('UPDATE videos SET visibility = $1, share_token = $2 WHERE id = $3', [visibility, token, req.params.id]);
    } else {
      await db.query('UPDATE videos SET visibility = $1 WHERE id = $2', [visibility, req.params.id]);
    }
    res.json({ visibility, token });
  } catch (e) {
    next(e as Error);
  }
});

app.get('/share/:token', async (req, res, next) => {
  try {
    const rows = await db.query('SELECT id FROM videos WHERE share_token = $1', [req.params.token]);
    if (!rows.rows.length) return res.status(404).json({ error: 'Link chia sẻ không hợp lệ' });
    const id = rows.rows[0].id;
    res.redirect(`/player.html?id=${id}&t=${encodeURIComponent(req.params.token)}`);
  } catch (e) {
    next(e as Error);
  }
});

app.get('/api/videos/:id/subtitles', async (req, res, next) => {
  try {
    const rows = await db.query(
      'SELECT id, label, language, original_name, created_at FROM subtitles WHERE video_id = $1 ORDER BY created_at DESC',
      [req.params.id],
    );
    res.json(rows.rows);
  } catch (e) {
    next(e as Error);
  }
});

app.post('/api/videos/:id/subtitles', authUser, subtitleUpload.single('subtitle'), async (req, res, next) => {
  try {
    const video = await requireOwner(req, res);
    if (!video) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return;
    }
    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn file phụ đề' });
    const { label, language } = req.body as { label?: string; language?: string };
    const originalName = req.file.originalname;
    const result = await db.query(
      `INSERT INTO subtitles (video_id, label, language, filename, original_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, label, language, original_name, created_at`,
      [req.params.id, (label || originalName.replace(/\.(srt|vtt)$/i, '')).slice(0, 100), language || '', req.file.filename, originalName],
    );
    res.json(result.rows[0]);
  } catch (e) {
    try { if (req.file) fs.unlinkSync(req.file.path); } catch (e2) {}
    next(e as Error);
  }
});

app.get('/api/videos/:id/subtitles/:sid/file', async (req, res, next) => {
  try {
    const rows = await db.query(
      'SELECT filename, original_name FROM subtitles WHERE id = $1 AND video_id = $2',
      [req.params.sid, req.params.id],
    );
    const sub = rows.rows[0] as any;
    if (!sub) return res.status(404).json({ error: 'Không tìm thấy phụ đề' });
    const filePath = path.join(SUBTITLE_DIR, String(req.params.id), sub.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File không tồn tại' });
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (sub.filename.toLowerCase().endsWith('.srt')) {
      res.send(srtToVtt(fs.readFileSync(filePath, 'utf8')));
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (e) {
    next(e as Error);
  }
});

app.delete('/api/videos/:id/subtitles/:sid', authUser, async (req, res, next) => {
  try {
    const video = await requireOwner(req, res);
    if (!video) return;
    const rows = await db.query(
      'SELECT filename FROM subtitles WHERE id = $1 AND video_id = $2',
      [req.params.sid, req.params.id],
    );
    const sub = rows.rows[0] as any;
    if (!sub) return res.status(404).json({ error: 'Không tìm thấy phụ đề' });
    await db.query('DELETE FROM subtitles WHERE id = $1', [req.params.sid]);
    try { fs.unlinkSync(path.join(SUBTITLE_DIR, String(req.params.id), sub.filename)); } catch (e) {}
    res.json({ message: 'Đã xóa phụ đề' });
  } catch (e) {
    next(e as Error);
  }
});

const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const PG_DATA = path.join(PREFIX, 'var', 'lib', 'postgresql');
const PG_LOG = path.join(PREFIX, 'var', 'log', 'postgresql.log');

async function ensureDatabase() {
  if (process.env.DATABASE_URL) {
    await db.initDb();
    return;
  }
  const status = spawnSync('pg_ctl', ['-D', PG_DATA, 'status'], { encoding: 'utf8' });
  if (status.status !== 0) {
    console.log('PostgreSQL chưa chạy, đang khởi động...');
    const start = spawnSync('pg_ctl', ['-D', PG_DATA, '-l', PG_LOG, 'start'], { encoding: 'utf8' });
    if (start.status !== 0) {
      console.error('Không thể khởi động PostgreSQL:', (start.stderr || start.stdout || '').trim().slice(0, 300));
      return;
    }
  }
  let ok = false;
  for (let i = 0; i < 10 && !ok; i++) {
    try {
      await db.initDb();
      ok = true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  if (!ok) console.error('Không kết nối được database, hãy kiểm tra PostgreSQL');
}

function startWatchdog() {
  if (process.env.DATABASE_URL) return;
  setInterval(() => {
    const status = spawnSync('pg_ctl', ['-D', PG_DATA, 'status'], { encoding: 'utf8', timeout: 5000 });
    if (status.status !== 0) {
      console.log('PostgreSQL bị dừng, đang khởi động lại...');
      spawnSync('pg_ctl', ['-D', PG_DATA, '-l', PG_LOG, 'start'], { encoding: 'utf8', timeout: 10000 });
    }
  }, 20000);
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: err.message || 'Có lỗi xảy ra' });
});

app.listen(Number(PORT), () => {
  console.log(`Video player đang chạy tại http://localhost:${PORT}`);
  ensureDatabase().catch((err: Error) => {
    console.error('Lỗi kết nối database:', err.message);
  });
  startWatchdog();
});
