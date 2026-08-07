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
- Backend native (hiện là C++ với SQLite), không cần cài database riêng
- Build backend **không phụ thuộc ngôn ngữ** (`build.sh`): chuyển sang Rust, Go, Python hoặc Node không cần sửa CI hay Release
- hls.js cho phát HLS

## Cài đặt nhanh (một lệnh duy nhất)

Không cần cấu hình thủ công. Chạy script cài đặt cho hệ điều hành của bạn —
script sẽ tự clone mã nguồn, tải binary backend phù hợp với CPU/OS của bạn,
build frontend và tạo lệnh `videohub`:

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
videohub update    # cập nhật mã nguồn và binary tại chỗ
videohub reinstall # cài lại từ đầu (hỏi có giữ uploads/ + data.db không)
videohub uninstall # gỡ bỏ lệnh, PATH và ứng dụng (hỏi có giữ uploads/ + data.db không)
```

`videohub reinstall` và `videohub uninstall` luôn hỏi bạn có muốn giữ video
đã upload (`uploads/` và `data.db`) hay không. Gõ `y` để giữ dữ liệu, gõ bất
kỳ phím nào khác để xóa toàn bộ. Các thao tác này cũng tương đương
`bash install.sh reinstall|uninstall`.

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
bun start       # khởi động server native (SPA + API, http://127.0.0.1:3000)
```

`bun dev` cũng làm tương tự ở chế độ development. Mặc định server bind vào
`127.0.0.1:3000`; đặt biến `HOST=0.0.0.0` để chia sẻ qua mạng LAN.

### Binary backend

Backend là một executable native (`video-server`) được biên dịch sẵn. Nó
**không bao giờ được biên dịch trên máy người dùng** — GitHub Actions sẽ biên
dịch cho mọi nền tảng/kiến trúc (Linux, macOS, Windows, Android; x86 và ARM)
và file binary được đính kèm vào mỗi Release.

Các build này **chỉ chạy thủ công**: chúng không bao giờ tự động chạy khi
push. Người quản trị phải tự kích hoạt từng build (tab Actions → Run
workflow), nên Release chỉ được phát hành sau khi cả 8 build
nền tảng/kiến trúc đều pass. Mỗi Release đính kèm đủ 8 binary.

1. Tải binary cho nền tảng của bạn từ trang Release.
2. Đặt nó vào đúng đường dẫn, ví dụ `bin/linux-x64/video-server`
   (trên Windows: `bin/windows-x64/video-server.exe`).
3. Chạy ứng dụng như trên. `bin/detect.ts` tự động chọn binary đúng cho
   hệ điều hành và kiến trúc của bạn.

Các đường dẫn được hỗ trợ: `bin/linux-x64`, `bin/linux-arm64`,
`bin/darwin-x64`, `bin/darwin-arm64`, `bin/windows-x64`,
`bin/windows-arm64`, `bin/android-arm64`, `bin/android-x64`.

## Cấu trúc

- `src/server/` — mã nguồn backend; `build.sh` tự phát hiện ngôn ngữ qua các marker file (`Cargo.toml`, `go.mod`, `pyproject.toml`, `package.json` hoặc `cpp/`)
- `src/server/cpp/` — bản triển khai backend hiện tại bằng C++ (HTTP server, SQLite, auth/session, media token, SHA-256/HMAC/PBKDF2)
- `src/server/cpp/vendor/` — SQLite nhúng sẵn (amalgamation, không cần thư viện hệ thống)
- `build.sh` — script build backend không phụ thuộc ngôn ngữ (tự phát hiện ngôn ngữ, luôn xuất ra `src/server/out/video-server`; dùng cho GitHub Actions, không chạy trên máy thường)
- `.github/workflows/build-<os>.yml` — các workflow CI manual-only build backend cho Linux, macOS, Windows và Android qua `build.sh`
- `bin/` — các executable `video-server` biên dịch sẵn cho từng nền tảng/kiến trúc (tải từ Release, không commit vào repo)
- `bin/detect.ts` — phát hiện nền tảng/kiến trúc hiện tại và chạy binary tương ứng
- `src/App.tsx` — routing (trang chủ `/` và trang xem `/video/:id`)
- `src/HomePage.tsx` — trang chủ: tìm kiếm, tải lên, danh sách video, nút góp ý mở GitHub Issues
- `src/UploadModal.tsx` — modal tải lên video và ảnh thu nhỏ với thanh tiến trình
- `src/VideoPage.tsx` — trang xem video
