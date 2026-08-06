# Video Player

**English** | [Tiếng Việt](./README.vi.md)

Một web video player: đăng ký, đăng nhập, tải video lên, xem video trực tuyến, tìm kiếm và chia sẻ video qua URL riêng.

## Tính năng

- Xem video công khai mà không cần đăng nhập
- Đăng ký / đăng nhập để tải video lên và quản lý video của mình (đăng ký bắt buộc có email Gmail; đăng nhập nhận Gmail hoặc username)
- Chỉ chủ sở hữu mới xóa được video của mình
- Tìm kiếm video theo tên
- Mỗi video có URL riêng (`/video/:id`) để chia sẻ
- Server không bao giờ lộ URL media trực tiếp — API trả token media ký HMAC có thời hạn ngắn, client phát video qua `/api/media?t=<token>` (hỗ trợ Range request)
- Tăng cường bảo mật: Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options` và các header bảo mật khác trên mọi request
- Player đầy đủ: phát/tạm dừng, tua, âm lượng, tốc độ phát, toàn màn hình, phím tắt
- Hỗ trợ HLS (`.m3u8`) qua hls.js
- Người dùng đã đăng nhập có thể gửi góp ý (tính năng mới, báo lỗi hoặc ý kiến khác) từ hộp thoại "Góp ý" trên trang chủ; mỗi góp ý được lưu thành một file Markdown trong thư mục `feedback/` kèm trạng thái `open`/`closed` và phản hồi khi được đóng

## Công nghệ

- Bun 1.3 (runtime + bundler)
- React 19 + TypeScript + Tailwind 4 + shadcn/ui
- SQLite (lưu trữ), không cần cài database riêng
- hls.js cho phát HLS

## Cài đặt

```bash
bun install
```

> **Trình quản lý gói chính thức: chỉ có Bun.** npm và pnpm KHÔNG được hỗ trợ.
> Đừng dùng chúng và đừng mở issue về lỗi do npm hoặc pnpm gây ra — chúng
> không được coi là chính thức. Chỉ Bun được hỗ trợ.

## Chạy

```bash
# chạy cả frontend (3000) và API (3001) — tự khởi động lại khi sửa file trong src/
bun dev

# chỉ API
bun devb

# chỉ frontend (dùng server API đang chạy sẵn)
bun devf

# chia sẻ ra mạng LAN (bind 0.0.0.0, tự in IP)
bun devs

# production
bun start
```

`bun dev` dùng một script nhỏ (`dev.ts`) theo dõi thư mục `src/` và tự khởi
động lại server khi bạn sửa file — không cần restart thủ công.

## Truy cập công khai qua HTTPS (Cloudflare Tunnel)

Để đưa ứng dụng ra ngoài với link HTTPS an toàn, dùng Cloudflare Tunnel:

```bash
# cài cloudflared, sau đó mở tunnel nhanh tới frontend local
cloudflared tunnel --url http://localhost:3000
```

Cloudflared in ra URL `https://…trycloudflare.com`. Muốn địa chỉ cố định, trỏ
một named tunnel vào ứng dụng hoặc dùng custom domain. `bun dev` chạy cả hai
cổng trong một process, nên tunnel tới cổng 3000 là truy cập được toàn app.

## Cấu trúc

- `src/index.ts` — server frontend (port 3000), proxy `/api/*` sang API và phục vụ SPA
- `dev.ts` — runner cho dev: theo dõi `src/` và tự khởi động lại server khi có thay đổi
- `src/server/api.ts` — server API độc lập (port 3001)
- `src/server/` — routes, handlers, db (SQLite), auth (session cookie), storage (upload), media token (`mediaToken.ts`), security headers (`security.ts`)
- `src/App.tsx` — routing (trang chủ `/` và trang xem `/video/:id`)
- `src/HomePage.tsx` — trang chủ: tìm kiếm, tải lên, danh sách video, hộp thoại góp ý
- `src/FeedbackDialog.tsx` — hộp thoại "Góp ý": gửi và xem danh sách góp ý (mở/đóng)
- `src/VideoPage.tsx` — trang xem video
- `src/VideoPlayer.tsx` — player (video element + controls + HLS)
- `src/server/feedback.ts` — lưu trữ góp ý (mỗi góp ý một file Markdown trong `feedback/`, có thể ghi đè qua biến `FEEDBACK_DIR`)
