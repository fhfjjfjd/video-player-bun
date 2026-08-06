# Video Player

**English** | [Tiếng Việt](./README.vi.md)

Một web video player: đăng ký, đăng nhập, tải video lên, xem video trực tuyến, tìm kiếm và chia sẻ video qua URL riêng.

## Tính năng

- Xem video công khai mà không cần đăng nhập
- Đăng ký / đăng nhập để tải video lên và quản lý video của mình
- Chỉ chủ sở hữu mới xóa được video của mình
- Tìm kiếm video theo tên
- Mỗi video có URL riêng (`/video/:id`) để chia sẻ
- Player đầy đủ: phát/tạm dừng, tua, âm lượng, tốc độ phát, toàn màn hình, phím tắt
- Hỗ trợ HLS (`.m3u8`) qua hls.js

## Công nghệ

- Bun 1.3 (runtime + bundler)
- React 19 + TypeScript + Tailwind 4 + shadcn/ui
- SQLite (lưu trữ), không cần cài database riêng
- hls.js cho phát HLS

## Cài đặt

```bash
bun install
```

## Chạy

```bash
# chạy cả frontend (3000) và API (3001)
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

## Cấu trúc

- `src/index.ts` — server frontend (port 3000), proxy `/api/*` và `/uploads/*` sang API
- `src/server/api.ts` — server API độc lập (port 3001)
- `src/server/` — routes, handlers, db (SQLite), auth (session cookie), storage (upload)
- `src/App.tsx` — routing (trang chủ `/` và trang xem `/video/:id`)
- `src/HomePage.tsx` — trang chủ: tìm kiếm, tải lên, danh sách video
- `src/VideoPage.tsx` — trang xem video
- `src/VideoPlayer.tsx` — player (video element + controls + HLS)
