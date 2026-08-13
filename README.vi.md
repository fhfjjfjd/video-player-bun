# Video Player

**English** | [Tiếng Việt](./README.vi.md)

Một web video player: đăng ký, đăng nhập, tải video lên, xem video trực tuyến, tìm kiếm và chia sẻ video qua URL riêng.

## Tính năng

- Xem video công khai mà không cần đăng nhập
- Đăng ký / đăng nhập để tải video lên và quản lý video của mình (đăng ký bắt buộc có email Gmail — email phải kết thúc bằng `@gmail.com`; đăng nhập nhận Gmail hoặc username)
- Xác thực email khi đăng ký: đăng ký sẽ gửi một mã xác thực gồm 6 chữ số tới địa chỉ Gmail, phải nhập mã này trên màn hình xác nhận trước khi tài khoản được tạo — email Gmail viết thủ công, không tồn tại hay sắp xếp ký tự lộn xộn sẽ không qua được nữa (mã có hiệu lực 10 phút, hỗ trợ gửi lại mã)
- Sau khi tải video lên bạn quay lại thư viện và video mới hiện trong danh sách — không tự mở hay phát video
- Chỉ chủ sở hữu mới xóa được video của mình
- Hỗ trợ hình ảnh thu nhỏ (thumbnail) tùy chỉnh hoặc tự động trích xuất bằng FFmpeg khi tải video lên
- Tối ưu hóa giao diện di động hoàn chỉnh và lưới thẻ video responsive trực quan
- Giao diện dark kiểu streaming hiện đại: nhận diện thương hiệu gradient (emerald → teal → cyan), header kính mờ (glassy), banner hero video nổi bật, thẻ video hiệu ứng hover phong phú, và các màn hình player, đăng nhập, tải lên được thiết kế lại
- Mỗi video có URL riêng (`/video/:id`) để chia sẻ
- Server không bao giờ lộ URL media trực tiếp — API trả token media ký HMAC có thời hạn ngắn, client phát video qua `/api/media?t=<token>` (hỗ trợ Range request)
- Tăng cường bảo mật: Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options` và các header bảo mật khác trên mọi request
- Giới hạn số lượng yêu cầu (rate limiting) theo IP cho mọi API (cửa sổ thời gian cố định, dùng Symfony Rate Limiter): bảo vệ đăng nhập, đăng ký và tải lên khỏi bị lạm dụng; client bị giới hạn sẽ nhận HTTP 429 kèm header `Retry-After` và `X-RateLimit-*`
- Xác thực dữ liệu ở cả 2 phía: client React xác thực form tức thì bằng Zod (hiện lỗi ngay theo từng trường), và server PHP xác thực lại mọi payload bằng Symfony Validator — cùng quy tắc và thông báo tiếng Việt ở cả 2 đầu
- Player đầy đủ: phát/tạm dừng, tua, âm lượng, tốc độ phát, toàn màn hình, phím tắt
- Hỗ trợ HLS (`.m3u8`) qua hls.js
- Người dùng đã đăng nhập có thể gửi góp ý (tính năng mới, báo lỗi hoặc ý kiến khác) bằng nút "Góp ý" trên giao diện, sẽ mở trang GitHub Issues của dự án
- Nút "Nguồn" trên thanh đầu trang (hiển thị cho tất cả mọi người) liên kết tới kho chứa GitHub của dự án để khách truy cập có thể tìm thấy mã nguồn

## Công nghệ

- Bun 1.3 (runtime + bundler)
- React 19 + TypeScript + Tailwind 4 + shadcn/ui (hệ thống thiết kế dark tùy chỉnh với token thương hiệu gradient); xác thực form bằng Zod
- Backend PHP (PHP 8.1+, SQLite qua PDO), không cần cài database riêng; xác thực dữ liệu bằng Symfony Validator và giới hạn yêu cầu theo IP bằng Symfony Rate Limiter
- hls.js cho phát HLS

## Cài đặt nhanh (một lệnh duy nhất)

Không cần cấu hình thủ công. Chạy script cài đặt cho hệ điều hành của bạn —
script sẽ tự cài PHP (runtime backend) nếu chưa có, clone mã nguồn, build
frontend và tạo lệnh `videohub`:

- **Linux / macOS / Android (Termux):**

  ```bash
  curl -fsSL https://raw.githubusercontent.com/fhfjjfjd/video-player-bun/main/scripts/install.sh | bash
  ```

- **Windows (PowerShell):**

  ```powershell
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fhfjjfjd/video-player-bun/main/scripts/install.bat" -OutFile install.bat
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
`bash scripts/install.sh reinstall|uninstall` (Unix) hoặc
`scripts/install.bat reinstall|uninstall` (Windows).

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
`127.0.0.1:3000`; đặt biến `HOST=0.0.0.0` để chia sẻ qua mạng LAN (địa chỉ bind
được đọc từ `HOST`, nếu không có thì dùng `HOSTNAME`). Khi bind vào địa chỉ
wildcard, lúc khởi động server sẽ tự phát hiện IP LAN của máy và in ra — ví dụ
`Network: http://192.168.1.2:3000` — để các thiết bị trong cùng mạng mở player
mà không cần đi tìm IP.

### Backend (PHP)

Backend là router PHP trong `src/server/php/`, được `scripts/start.ts` khởi động
bằng web server tích hợp của PHP (`php -S`). Không cần biên dịch và không cần
tải binary nào — server chạy trực tiếp từ mã nguồn. Mọi API đều được giới hạn
số lượng yêu cầu theo IP bằng `symfony/rate-limiter`; trạng thái đếm được lưu
trong bộ đệm cục bộ `cache/` (tự tạo lại khi chạy).

Yêu cầu:

- PHP 8.1+ có extension `pdo_sqlite` (SQLite được nhúng sẵn, không cần cài
  database riêng)
- `ffmpeg` trong PATH để tự động trích xuất thumbnail (tùy chọn — vẫn tải
  thumbnail tùy chỉnh được nếu không có ffmpeg)
- Các dependency PHP (`symfony/rate-limiter`, `symfony/cache`) được đóng sẵn
  trong `src/server/php/vendor/` — không cần Composer khi cài đặt

Installer (`scripts/install.sh` / `scripts/install.bat`) sẽ cài PHP và ffmpeg
nếu chưa có và kiểm tra extension `pdo_sqlite` trước khi cài đặt.

### Xác thực email / SMTP

Đăng ký bắt buộc phải cấu hình SMTP — mã xác thực gồm 6 chữ số được gửi qua
SMTP và phải nhập trên màn hình xác nhận trước khi tài khoản được tạo. Nếu
không cấu hình SMTP, đăng ký sẽ báo lỗi và không gửi mã. Cấu hình bằng biến môi
trường trước khi khởi động:

```bash
export MAIL_HOST=smtp.gmail.com
export MAIL_PORT=587
export MAIL_USER=youraccount@gmail.com
export MAIL_PASS=your-gmail-app-password
export MAIL_FROM=youraccount@gmail.com   # tùy chọn, mặc định là MAIL_USER
export MAIL_ENCRYPTION=tls               # tls (STARTTLS) hoặc ssl
bun start
```

Mã có hiệu lực trong 10 phút; người dùng có thể yêu cầu gửi lại mã khi đăng ký
còn đang chờ xác thực.

## Cấu trúc

- `src/server/php/` — backend PHP: `server.php` (router HTTP, handler API,
  giới hạn yêu cầu theo IP bằng `symfony/rate-limiter`, phát media hỗ trợ
  Range, file tĩnh), `validation.php` (xác thực request bằng `symfony/validator`),
  `db.php` (lưu trữ SQLite qua PDO),
  `crypto.php` (media token ký HMAC, session, băm mật khẩu PBKDF2/bcrypt),
  `mailer.php` (gửi email qua PHPMailer dùng SMTP),
  `composer.json` + `vendor/` (dependency PHP đóng sẵn)
- `src/lib/validation.ts` — schema Zod cho đăng nhập/đăng ký dùng cho xác thực form phía client
- `scripts/start.ts` — khởi động backend PHP qua `php -S`
- `src/App.tsx` — routing (trang chủ `/` và trang xem `/video/:id`)
- `src/HomePage.tsx` — trang chủ: tìm kiếm, tải lên, danh sách video, nút góp ý mở GitHub Issues, nút "Nguồn" mở kho chứa GitHub của dự án
- `src/BrandLogo.tsx` — logo thương hiệu gradient dùng chung (cũng được dùng làm favicon, `src/logo.svg`)
- `src/UploadModal.tsx` — modal tải lên video và ảnh thu nhỏ với thanh tiến trình
- `src/VideoPage.tsx` — trang xem video
