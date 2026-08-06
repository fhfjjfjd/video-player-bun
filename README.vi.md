# Video Player

**English** | [Tiếng Việt](./README.vi.md)

Một web video player: đăng ký, đăng nhập, tải video lên, xem video trực tuyến, tìm kiếm và chia sẻ video qua URL riêng.

## Tính năng

- Xem video công khai mà không cần đăng nhập
- Đăng ký / đăng nhập để tải video lên và quản lý video của mình (đăng ký bắt buộc có email Gmail; đăng nhập nhận Gmail hoặc username)
- Chỉ chủ sở hữu mới xóa được video của mình
- Hỗ trợ hình ảnh thu nhỏ (thumbnail) tùy chỉnh hoặc tự động trích xuất bằng FFmpeg khi tải video lên
- Tối ưu hóa giao diện di động hoàn chỉnh và lưới thẻ video responsive trực quan
- Mỗi video có URL riêng (`/video/:id`) để chia sẻ
- Server không bao giờ lộ URL media trực tiếp — API trả token media ký HMAC có thời hạn ngắn, client phát video qua `/api/media?t=<token>` (hỗ trợ Range request)
- Tăng cường bảo mật: Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options` và các header bảo mật khác trên mọi request
- Player đầy đủ: phát/tạm dừng, tua, âm lượng, tốc độ phát, toàn màn hình, phím tắt
- Hỗ trợ HLS (`.m3u8`) qua hls.js
 - Người dùng đã đăng nhập có thể gửi góp ý (tính năng mới, báo lỗi hoặc ý kiến khác) bằng nút "Góp ý" trên giao diện, sẽ mở trang GitHub Issues của dự án

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

## Cấu trúc

- `src/index.ts` — server frontend (port 3000), proxy `/api/*` sang API và phục vụ SPA
- `dev.ts` — runner cho dev: theo dõi `src/` và tự khởi động lại server khi có thay đổi
- `src/server/api.ts` — server API độc lập (port 3001)
- `src/server/` — routes, handlers, db (SQLite), auth (session cookie), storage (upload), media tokens (`mediaToken.ts`), security headers (`security.ts`)
- `bin/` — các binary C++ native theo nền tảng (linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64, android-arm64). Server tự động phát hiện kiến trúc hiện tại và tải binary đúng từ thư mục này. Đây là bắt buộc — server sẽ không khởi động nếu thiếu binary đúng.
- `src/server/cpp/` — mã nguồn C++ cho các module native (mediatoken, security, auth, db, videos)
- `build_cpp.sh` — biên dịch C++ thành shared library cho nền tảng hiện tại
- `bin/detect.ts` — phát hiện nền tảng kiến trúc và sao chép binary đúng vào `bin/`
- `src/App.tsx` — routing (trang chủ `/` và trang xem `/video/:id`)
- `src/HomePage.tsx` — trang chủ: tìm kiếm, tải lên, danh sách video, nút góp ý mở GitHub Issues
- `src/UploadModal.tsx` — modal tải lên video và ảnh thu nhỏ với thanh tiến trình
- `src/VideoPage.tsx` — trang xem video
