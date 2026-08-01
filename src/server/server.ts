import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import db from './db';

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
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const STATIC_DIR = path.join(ROOT, 'dist', 'public');
const MAX_SIZE = 500 * 1024 * 1024;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(STATIC_DIR));
app.use(express.static(path.join(ROOT, 'public')));

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

function authUser(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token) as any;
  if (!session) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  req.userId = session.user_id;
  req.token = token;
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

const VIDEO_SIGNATURES: { exts: string[]; match: (head: Buffer) => boolean }[] = [
  { exts: ['.mp4', '.m4v', '.mov', '.3gp'], match: b => b.subarray(4, 8).toString('latin1') === 'ftyp' },
  { exts: ['.webm', '.mkv'], match: b => b.subarray(0, 4).toString('hex') === '1a45dfa3' },
  { exts: ['.avi'], match: b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'AVI ' },
  { exts: ['.ogv', '.ogg'], match: b => b.subarray(0, 4).toString('latin1') === 'OggS' },
];

app.get('/api/videos', (_req, res) => {
  const videos = db.prepare(`
    SELECT v.*, u.username AS uploader
    FROM videos v LEFT JOIN users u ON v.uploader_id = u.id
    ORDER BY v.created_at DESC
  `).all() as any[];
  res.json(videos);
});

app.get('/api/videos/:id', (req, res) => {
  const video = db.prepare(`
    SELECT v.*, u.username AS uploader
    FROM videos v LEFT JOIN users u ON v.uploader_id = u.id
    WHERE v.id = ?
  `).get(req.params.id) as any;
  if (!video) return res.status(404).json({ error: 'Không tìm thấy video' });
  db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(String(req.params.id));
  video.views += 1;
  res.json(video);
});

app.post('/api/videos', authUser, upload.single('video'), (req, res) => {
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
  const result = db.prepare(`
    INSERT INTO videos (title, description, filename, original_name, size, uploader_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title || req.file.originalname, description || '', req.file.filename, req.file.originalname, req.file.size, req.userId!);
  res.json({ id: result.lastInsertRowid, message: 'Upload thành công' });
});

app.delete('/api/videos/:id', authUser, (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(String(req.params.id)) as any;
  if (!video) return res.status(404).json({ error: 'Không tìm thấy video' });
  if (Number(video.uploader_id) !== Number(req.userId)) {
    return res.status(403).json({ error: 'Bạn không có quyền xóa video này' });
  }
  db.prepare('DELETE FROM comments WHERE video_id = ?').run(String(req.params.id));
  db.prepare('DELETE FROM history WHERE video_id = ?').run(String(req.params.id));
  db.prepare('DELETE FROM videos WHERE id = ?').run(String(req.params.id));
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, video.filename));
  } catch (e) {}
  res.json({ message: 'Đã xóa video' });
});

app.get('/api/videos/:id/stream', (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(String(req.params.id)) as any;
  if (!video) return res.status(404).json({ error: 'Không tìm thấy video' });
  const filePath = path.join(UPLOAD_DIR, video.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File không tồn tại' });

  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  const mimeMap: Record<string, string> = {
    '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
    '.mov': 'video/quicktime', '.ogv': 'video/ogg', '.ogg': 'video/ogg',
    '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.3gp': 'video/3gpp',
  };
  const ext = path.extname(video.filename || video.original_name || '').toLowerCase();
  const fileName = video.original_name || 'video' + ext;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="video${ext}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);

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

app.get('/api/videos/:id/player.js', (req, res) => {
  const video = db.prepare('SELECT id FROM videos WHERE id = ?').get(req.params.id) as any;
  if (!video) return res.status(404).json({ error: 'Không tìm thấy video' });
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buildPlayerScript(video.id));
});

app.get('/api/videos/:id/comments', (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, u.username
    FROM comments c JOIN users u ON c.user_id = u.id
    WHERE c.video_id = ?
    ORDER BY c.created_at DESC
  `).all(req.params.id) as any[];
  res.json(comments);
});

app.post('/api/videos/:id/comments', authUser, (req, res) => {
  const content = ((req.body as { content?: string }).content || '').trim();
  if (!content) return res.status(400).json({ error: 'Nội dung bình luận trống' });
  const video = db.prepare('SELECT id FROM videos WHERE id = ?').get(String(req.params.id)) as any;
  if (!video) return res.status(404).json({ error: 'Không tìm thấy video' });
  const result = db.prepare(`
    INSERT INTO comments (video_id, user_id, content) VALUES (?, ?, ?)
  `).run(String(req.params.id), req.userId!, content);
  const comment = db.prepare(`
    SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?
  `).get(result.lastInsertRowid) as any;
  res.json(comment);
});

app.post('/api/history', authUser, (req, res) => {
  const { videoId, progress } = req.body as { videoId?: number; progress?: number };
  if (!videoId || typeof videoId !== 'number') return res.status(400).json({ error: 'Thiếu videoId hợp lệ' });
  const video = db.prepare('SELECT id FROM videos WHERE id = ?').get(String(videoId)) as any;
  if (!video) return res.status(404).json({ error: 'Không tìm thấy video' });
  const p = typeof progress === 'number' && isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  db.prepare(`
    INSERT INTO history (user_id, video_id, progress) VALUES (?, ?, ?)
    ON CONFLICT(user_id, video_id) DO UPDATE SET progress = excluded.progress, watched_at = datetime('now')
  `).run(req.userId!, String(videoId), p);
  res.json({ ok: true });
});

app.get('/api/history', authUser, (req, res) => {
  const history = db.prepare(`
    SELECT h.progress, h.watched_at, v.id AS video_id, v.title, v.original_name, v.views
    FROM history h JOIN videos v ON h.video_id = v.id
    WHERE h.user_id = ?
    ORDER BY h.watched_at DESC
  `).all(req.userId!) as any[];
  res.json(history);
});

app.post('/api/register', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password || password.length < 4) {
    return res.status(400).json({ error: 'Tên đăng nhập và mật khẩu (tối thiểu 4 ký tự) là bắt buộc' });
  }
  try {
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hashPassword(password));
    res.json({ message: 'Đăng ký thành công' });
  } catch (e) {
    res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ error: 'Tên đăng nhập và mật khẩu là bắt buộc' });
  const key = clientKey(req);
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (entry && entry.until > now) {
    return res.status(429).json({ error: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút' });
  }
  if (entry && now > entry.until) loginAttempts.delete(key);
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
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
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  db.prepare("DELETE FROM sessions WHERE created_at < datetime('now', '-7 days')").run();
  res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}`);
  res.json({ username: user.username });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies?.token;
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', authUser, (req, res) => {
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.userId!) as any;
  res.json(user);
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: err.message || 'Có lỗi xảy ra' });
});

app.listen(PORT, () => {
  console.log(`Video player đang chạy tại http://localhost:${PORT}`);
});
