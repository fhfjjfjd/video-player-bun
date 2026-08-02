# Video Player

[English](./README.md) | **Tiếng Việt**

Trình phát video chạy trên web: người dùng đăng ký, upload video, xem video (stream), bình luận và lưu lịch sử xem. Video được lưu nguyên định dạng trên máy chủ, không chuyển đổi.

## Công nghệ

- Backend: Node.js (>= 24) + Express 5 + TypeScript
- Database: SQLite (module có sẵn `node:sqlite`)
- Frontend: TypeScript + Vite (multi-page), XGPlayer
- Upload: multer (tối đa 500MB, định dạng video)
- Dev: nodemon + tsx (không cần biên dịch khi phát triển)

## Cài đặt

```bash
npm install
```

## Lệnh

| Lệnh | Mô tả |
| --- | --- |
| `npm run build` | Biên dịch server, build frontend, kiểm tra HTML/CSS/JS, load test server |
| `npm start` | Chạy bản đã build (`node dist/server/server.js`) |
| `npm run dev` | Chạy backend (nodemon + tsx, cổng 3000) và frontend (Vite + HMR, cổng 5173) cùng lúc |

Lưu ý môi trường Termux: các lệnh gọi qua `node` trực tiếp do thiếu `/usr/bin/env`.

## Chạy

1. `npm run build` — biên dịch lần đầu
2. `npm start` — chạy server tại http://localhost:3000
3. Mở trình duyệt, đăng ký tài khoản, upload và xem video

Khi phát triển: `npm run dev` chạy cả backend (tự tải lại qua nodemon) và Vite dev server (HMR). Mở http://localhost:5173 — không cần build. Vite proxy `/api` sang backend ở cổng 3000.

## Cấu trúc

```
src/server/        # Server TypeScript (Express + SQLite)
src/client/        # Frontend TypeScript (module Vite)
public/            # CSS + vendor (XGPlayer, disable-devtool)
scripts/build.js   # Build + kiểm tra toàn bộ dự án
dist/              # Kết quả build (server + public)
uploads/           # Video người dùng upload (không commit)
data.db            # Database SQLite (không commit)
```

## API chính

- `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/videos`, `GET /api/videos/:id`
- `POST /api/videos` — upload (multipart, cần đăng nhập)
- `DELETE /api/videos/:id` — xóa video (cần đăng nhập, chỉ chủ video)
- `GET /api/videos/:id/stream` — phát video, hỗ trợ HTTP Range
- `GET/POST /api/videos/:id/comments`
- `GET/POST /api/history` — lịch sử xem (tiến độ 0–1)

## Quy tắc phát triển

Mỗi lần thay đổi code phải tăng phiên bản trong `package.json` và ghi `CHANGELOG.md` (phiên bản mới + danh sách thay đổi).
