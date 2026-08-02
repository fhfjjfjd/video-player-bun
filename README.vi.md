# Video Player

[English](./README.md) | **Tiếng Việt**

Trình phát video chạy trên web: người dùng đăng ký, upload video, xem video (phát HLS với chất lượng thích ứng), bình luận và lưu lịch sử xem. Video upload mới được ffmpeg chuyển sang HLS (`.m3u8` + `.ts`) với nhiều độ phân giải; chủ video thêm được phụ đề và đặt video ở chế độ công khai hoặc riêng tư (chia sẻ theo link).

## Công nghệ

- Backend: Node.js (>= 24) + Express 5 + TypeScript
- Database: PostgreSQL 18 (client: `pg`), server tự khởi động
- Frontend: TypeScript + Vite (multi-page), trình phát hls.js
- Chuyển mã: ffmpeg/ffprobe → HLS với nhiều mức độ phân giải thích ứng
- Upload: multer (tối đa 500MB, định dạng video), phụ đề `.srt`/`.vtt` (tối đa 2MB)
- Dev: nodemon + tsx (không cần biên dịch khi phát triển)

## Cài đặt

```bash
pkg install postgresql ffmpeg   # Termux: server DB + bộ chuyển mã
npm install
npm run db:migrate              # tùy chọn: sao chép dữ liệu data.db cũ sang PostgreSQL
```

Server kết nối `DATABASE_URL` nếu được đặt, mặc định dùng database nội bộ `video_player` (`postgresql://<user>@localhost:5432/video_player`). Nếu PostgreSQL chưa chạy, server tự khởi động khi mở và khởi động lại nếu tiến trình bị giết.

## Lệnh

| Lệnh | Mô tả |
| --- | --- |
| `npm run build` | Biên dịch server, build frontend, kiểm tra HTML/CSS/JS, load test server |
| `npm start` | Chạy bản đã build (`node dist/server/server.js`) |
| `npm run dev` | Chạy backend (nodemon + tsx, cổng 3000) và frontend (Vite + HMR, cổng 5173) cùng lúc |
| `npm run db:start` | Khởi động PostgreSQL (`pg_ctl`) |
| `npm run db:stop` | Dừng PostgreSQL |
| `npm run db:migrate` | Di trú dữ liệu `data.db` (SQLite) sang PostgreSQL |

Lưu ý môi trường Termux: các lệnh gọi qua `node` trực tiếp do thiếu `/usr/bin/env`.

## Chạy

1. `npm run build` — biên dịch lần đầu
2. `npm start` — chạy server tại http://localhost:3000 (PostgreSQL tự khởi động)
3. Mở trình duyệt, đăng ký tài khoản, upload và xem video

Khi phát triển: `npm run dev` chạy cả backend (tự tải lại qua nodemon) và Vite dev server (HMR). Mở http://localhost:5173 — không cần build. Vite proxy `/api` sang backend ở cổng 3000.

## Cấu trúc

```
src/server/        # Server TypeScript (Express + PostgreSQL, ffmpeg HLS)
src/client/        # Frontend TypeScript (module Vite, hls.js)
public/            # CSS + vendor (disable-devtool)
scripts/build.js   # Build + kiểm tra toàn bộ dự án
scripts/migrate-db.js  # Di trú SQLite → PostgreSQL
dist/              # Kết quả build (server + public)
uploads/           # Video gốc người dùng upload (không commit)
uploads/hls/       # Đầu ra HLS từng video (không commit)
uploads/subtitles/ # File phụ đề (không commit)
```

## API chính

- `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/videos`, `GET /api/videos/:id` (video riêng tư cần token `?t=...`)
- `POST /api/videos` — upload (multipart, cần đăng nhập, tự động chuyển mã HLS)
- `POST /api/videos/:id/view` — đếm lượt xem
- `DELETE /api/videos/:id` — xóa video (cần đăng nhập, chỉ chủ video)
- `GET /api/videos/:id/stream` — phát tuần tự, hỗ trợ HTTP Range (dự phòng)
- `GET /api/videos/:id/hls/:file` — manifest + segment HLS (`.m3u8`/`.ts`)
- `POST /api/videos/:id/share` — tạo/lấy link chia sẻ (chỉ chủ video)
- `POST /api/videos/:id/visibility` — chuyển `public`/`private` (chỉ chủ video)
- `GET /share/:token` — mở link chia sẻ
- `GET/POST/DELETE /api/videos/:id/subtitles(...)` — danh sách, upload (chủ video), xóa (chủ video)
- `GET/POST /api/videos/:id/comments`
- `GET/POST /api/history` — lịch sử xem (tiến độ 0–1)

## Quy tắc phát triển

Mỗi lần thay đổi code phải tăng phiên bản trong `package.json` và ghi `CHANGELOG.md` (phiên bản mới + danh sách thay đổi).
