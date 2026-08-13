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
- Backend PHP (PHP 8.1+, SQLite qua PDO), không cần cài database riêng
- hls.js cho phát HLS

## Cài đặt nhanh (một lệnh duy nhất)

Không cần cấu hình thủ công. Chạy script cài đặt cho hệ điều hành của bạn —
script sẽ tự cài PHP (runtime backend) nếu chưa có, clone mã nguồn, build
frontend và tạo lệnh `videohub`:

- **Linux / macOS / Android (Termux):**

  ```bash
  curl -fsSL https://raw.githubusercontent.com/fhfjjfjd/video-player-bun/main/install.sh | bash
  ```

- **Windows (PowerShell):**

  ```powershell
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fhfjjfjd/video-player-bun/main/install.bat" -OutFile install.bat
  .\install.bat
  ```

Khi hoàn tất, mở terminal mới và chỉ cần gõ:

```bash
videohub
```

Ứng dụng được cài vào `~/videohub` (đặt biến `VIDEOHUB_DIR` để đổi vị trí).
Quản lý từ mọi nơi:

```bash
videohub           # khởi động ứng dụng
videohub update    # cập nhật mã nguồn tại chỗ
videohub reinstall # cài lại từ đầu (hỏi có giữ uploads/ + data.db không)
videohub uninstall # gỡ bỏ lệnh, PATH và ứng dụng (hỏi có giữ uploads/ + data.db không)
```

`videohub reinstall` và `videohub uninstall` luôn hỏi bạn có muốn giữ video
đã upload (`uploads/` và `data.db`) hay không. Gõ `y` để giữ dữ liệu, gõ bất
kỳ phím nào khác để xóa toàn bộ. Các thao tác này cũng tương đương
`bash install.sh reinstall|uninstall` (Unix) hoặc `install.bat reinstall|uninstall`
(Windows).

**Khóa đúng phiên bản:** cài đặt và cập nhật luôn lấy **release GitHub mới
nhất** — mã nguồn được checkout đúng tag release nên frontend và backend luôn
khớp nhau (không bao giờ bị `main` mới hơn trộn với bản cũ).

## Cài đặt

```bash
bun install
```

> **Trình quản lý gói chính thức: chỉ có Bun.** npm và pnpm KHÔNG được hỗ trợ.
> Đừng dùng chúng và đừng mở issue về lỗi do npm hoặc pnpm gây ra — chúng
> không được coi là chính thức. Chỉ Bun được hỗ trợ.

## Chạy

```bash
bun run build   # build frontend vào thư mục dist/
bun start       # khởi động backend PHP (SPA + API, http://127.0.0.1:3000)
```

`bun dev` cũng làm tương tự ở chế độ development. Mặc định server bind vào
`127.0.0.1:3000`; đặt biến `HOST=0.0.0.0` để chia sẻ qua mạng LAN.

### Backend (PHP)

Backend là router PHP trong `src/server/php/`, được `bin/detect.ts` khởi động
bằng web server tích hợp của PHP (`php -S`). Không cần biên dịch và không cần
tải binary nào — server chạy trực tiếp từ mã nguồn.

Yêu cầu:

- PHP 8.1+ có extension `pdo_sqlite` (SQLite được nhúng sẵn, không cần cài
  database riêng)
- `ffmpeg` trong PATH để tự động trích xuất thumbnail (tùy chọn — vẫn tải
  thumbnail tùy chỉnh được nếu không có ffmpeg)

Installer (`install.sh` / `install.bat`) sẽ cài PHP và ffmpeg nếu chưa có và
kiểm tra extension `pdo_sqlite` trước khi cài đặt.

## Cấu trúc

- `src/server/php/` — backend PHP: `server.php` (router HTTP, handler API,
  phát media hỗ trợ Range, file tĩnh), `db.php` (lưu trữ SQLite qua PDO),
  `crypto.php` (media token ký HMAC, session, băm mật khẩu PBKDF2/bcrypt)
- `bin/detect.ts` — khởi động backend PHP qua `php -S`
- `src/App.tsx` — routing (trang chủ `/` và trang xem `/video/:id`)
- `src/HomePage.tsx` — trang chủ: tìm kiếm, tải lên, danh sách video, nút góp ý mở GitHub Issues
- `src/UploadModal.tsx` — modal tải lên video và ảnh thu nhỏ với thanh tiến trình
- `src/VideoPage.tsx` — trang xem video
