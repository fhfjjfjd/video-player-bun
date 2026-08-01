# Changelog

## 1.9.1

**EN:** Fixed "Cannot GET /index.html": the server previously chose the static directory once at startup. If the server started before the build, it fell back to `public/` (vendor only) and returned 404 for all pages. It now tries `dist/public` first and falls back to `public` per request.

**VI:** Sửa lỗi "Cannot GET /index.html": server trước đây chọn thư mục static một lần lúc khởi động. Nếu server chạy trước khi build, nó rơi vào fallback `public/` (chỉ có vendor) và trả 404 mọi trang. Giờ thử `dist/public` trước, rồi mới fallback `public` mỗi request.

## 1.9.0

**EN:** Added autoplay: the video now plays automatically (muted) when the player page opens. A floating button appears while muted so the viewer can tap to unmute.

**VI:** Thêm autoplay: video tự phát (tắt tiếng) ngay khi mở trang xem. Hiện nút nổi cho phép bật âm thanh khi đang phát tắt tiếng.

## 1.8.1
- Thay hộp thoại xác nhận xóa video bằng modal tùy chỉnh (`src/client/confirm.ts`): bỏ `confirm()` mặc định của trình duyệt (xấu, hiện cả địa chỉ http://localhost:3000). Modal mới theo đúng giao diện dark của app, có nút Hủy / Xóa, bấm ra ngoài hoặc phím Esc để đóng, dùng trên cả trang chủ và trang xem video.

## 1.8.0

**EN:** Added "Delete video" button for the uploader only: new `DELETE /api/videos/:id` endpoint, delete confirmation on homepage and player page, `api.del()` helper in `api.ts`.

**VI:** Thêm nút **Xóa video** chỉ dành cho người đã đăng video đó: endpoint mới `DELETE /api/videos/:id`, xác nhận xóa trên trang chủ và trang xem, thêm hàm `api.del()` trong `api.ts`.

## 1.7.2

**EN:** Fixed page being locked ("DevTools detected") when long-pressing to copy text on mobile: disabled hard-block on touch devices, kept only keyboard shortcuts and debugger loop.

**VI:** Sửa lỗi trang bị khóa ("Đã phát hiện DevTools") khi giữ để sao chép text trên mobile: tắt hard-block trên thiết bị cảm ứng, chỉ giữ phím tắt và vòng lặp debugger.

## 1.7.1

**EN:** Fixed crash on iOS Safari player (SQLite date format), upload button stuck, Range request issues, false positive in antidev detection, login form toggle state, session persistence in DB, password hash crash protection, magic bytes validation for uploads, login rate limiting, history validation, `.3gp` format support.

**VI:** Sửa lỗi crash trang xem video trên iOS Safari, nút Upload kẹt, lỗi Range request, false positive antidev, trạng thái form đăng nhập, lưu session vào DB, bảo vệ verifyPassword, kiểm tra magic bytes upload, rate limit đăng nhập, validate history, hỗ trợ `.3gp`.

## 1.7.0

**EN:** Migrated UI from custom CSS to Tailwind CSS v4: rewrote all HTML with utility classes, added shared UI component file, `npm run dev` no longer needs compilation (tsx + nodemon).

**VI:** Chuyển giao diện từ CSS tự viết sang Tailwind CSS v4: viết lại HTML bằng utility class, thêm file UI dùng chung, `npm run dev` không cần biên dịch (tsx + nodemon).

## 1.6.1

**EN:** Added nodemon for auto-restart on server code changes. `npm run dev` now only runs the server via nodemon; frontend uses built version.

**VI:** Thêm nodemon tự khởi động lại khi sửa code server. `npm run dev` giờ chỉ chạy server bằng nodemon; frontend dùng bản build.

## 1.6.0

**EN:** Migrated entire project to TypeScript + Vite. Server and client code converted to TS, multi-page Vite setup, build script with 5-step verification.

**VI:** Chuyển toàn bộ dự án sang TypeScript + Vite. Server và client thành TS, Vite multi-page, build script 5 bước kiểm tra.

## 1.5.2

**EN:** Upgraded build script: added runtime load test (child process) for server files to catch runtime errors, not just syntax.

**VI:** Nâng cấp build script: thêm load test runtime (tiến trình con) cho file server để bắt lỗi runtime, không chỉ cú pháp.

## 1.5.1

**EN:** Upgraded build script to check HTML (IDs, references) and CSS (brace balance) in addition to JS.

**VI:** Nâng cấp build script kiểm tra HTML (id, tham chiếu) và CSS (cân bằng ngoặc) ngoài JS.

## 1.5.0

**EN:** Complete UI redesign: dark theme with gradient, blur header, gradient buttons, hero banner, footer, progress indicator.

**VI:** Đập toàn bộ giao diện: dark theme gradient, header blur, nút gradient, hero banner, footer, thanh tiến độ.

## 1.4.0

**EN:** DevTools blocking on all pages: combined `disable-devtool` library with custom script, hard block on detection.

**VI:** Chặn DevTools trên toàn trang: kết hợp thư viện `disable-devtool` với script tự viết, chặn cứng khi phát hiện.

## 1.3.0

**EN:** Obfuscated video stream URL: server generates scrambled player script, browser decodes before playing.

**VI:** Xáo trộn URL phát video: server tạo script player bị đảo, trình duyệt tự giải mã trước khi phát.

## 1.2.1

**EN:** Disabled XGPlayer download button in the player.

**VI:** Tắt nút tải video của XGPlayer.

## 1.2.0

**EN:** Switched video player to XGPlayer 3.0.26 (self-hosted), replaced native `<video>` with XGPlayer while keeping watch progress.

**VI:** Chuyển trình phát sang XGPlayer 3.0.26 (tự-host), thay `<video>` bằng XGPlayer, giữ tiến độ xem.

## 1.1.2

**EN:** Build script now auto-discovers all JS files instead of hardcoding the list.

**VI:** Build script tự dò tìm mọi file JS thay vì liệt kê cứng.

## 1.1.1

**EN:** Fixed upload button not working on mobile: removed top-level `await` in classic scripts (SyntaxError on mobile), wrapped in async IIFE.

**VI:** Sửa lỗi nút Upload không hoạt động trên mobile: bỏ top-level `await` trong script classic, bọc trong async IIFE.

## 1.1.0

**EN:** No video format conversion: store original file, stream with correct Content-Type per extension. Mobile-friendly file picker using `<label>`. Extended fileFilter for `application/octet-stream`.

**VI:** Không chuyển đổi định dạng video: lưu nguyên file gốc, stream đúng Content-Type theo đuôi. Chọn file thân thiện mobile bằng `<label>`. Mở rộng fileFilter cho `application/octet-stream`.

## 1.0.1

**EN:** Added `build` (syntax check) and `dev` (watch mode) scripts.

**VI:** Thêm scripts `build` (kiểm tra cú pháp) và `dev` (chạy watch).
