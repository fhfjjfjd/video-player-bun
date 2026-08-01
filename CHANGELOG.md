# Changelog

## 1.7.2
- Sửa lỗi trang bị khóa ("Đã phát hiện DevTools") khi giữ để sao chép text trên mobile: thao tác long-press kích hoạt sự kiện `contextmenu` → `hardBlock()` xóa sạch trang. Tắt toàn bộ hard-block trên thiết bị cảm ứng (`antidev.ts`): bỏ chặn `contextmenu`, bỏ kiểm tra kích thước cửa sổ, bỏ gọi thư viện `DisableDevtool` khi `isTouch`. Trên mobile chỉ còn giữ phím tắt (F12/Ctrl+U...), vòng lặp `debugger` và ngụy trang console — không làm ảnh hưởng đến thao tác bình thường.

## 1.7.1
- Sửa lỗi crash trang xem video trên iOS Safari: `new Date()` không phân tích được định dạng `YYYY-MM-DD HH:MM:SS` của SQLite (trả `Invalid Date` → ném `RangeError`), làm video không bao giờ khởi tạo. Thêm helper `formatDate` trong `src/client/api.ts` phân tích ngày theo mẫu trước khi dùng `Date`, đồng thời bọc lỗi mạng trong `player.ts` (video/history/comments) để hiện thông báo thay vì trang trống.
- Sửa lỗi nút Upload kẹt "Đang upload..." vĩnh viễn khi server trả lỗi không phải JSON: bọc `JSON.parse` trong `upload.ts` bằng try/catch, luôn trả lại trạng thái nút.
- Sửa Range request trong endpoint stream (`server.ts`): hỗ trợ range dạng đuôi `bytes=-N` (trước đây trả 416 sai), clamp `end` về `stat.size - 1`, trả 416 kèm `Content-Range: bytes */size` cho mọi range không hợp lệ.
- Giảm false positive của `antidev.ts`: kiểm tra kích thước cửa sổ chỉ kích hoạt khi nghi ngờ kéo dài 2 lần liên tiếp và yêu cầu chênh lệch cả chiều ngang lẫn chiều dọc (tránh khóa nhầm trang khi bàn phím ảo/split-screen trên mobile).
- Sửa trạng thái toggle form đăng nhập lệch sau khi đăng ký thành công (`auth.ts`): reset lại nút và dòng nhắc về chế độ đăng nhập.
- Lưu session vào database thay vì Map trong bộ nhớ (`sessions` table trong `db.ts`): không còn bị mất đăng nhập khi server khởi động lại; tự dọn session cũ hơn 7 ngày.
- Chặn crash `verifyPassword` khi hash lưu trong DB bị hỏng (thiếu dấu `:`), trả về false an toàn; login yêu cầu đủ username/password trước khi kiểm tra.
- Kiểm tra magic bytes của file upload (`server.ts`): đọc 12 byte đầu, đối chiếu chữ ký MP4/MOV/M4V/3GP/WebM/MKV/AVI/OGG, từ chối và xóa file nếu không phải video thật (chặn upload file giả mạo mimetype).
- Thêm rate limit đăng nhập: khóa IP 15 phút sau 5 lần thất bại liên tiếp (trả 429).
- Validate `POST /api/history`: yêu cầu `videoId` hợp lệ và tồn tại trong DB (trước đây lỗi khi thiếu → 400 mơ hồ), clamp progress về 0–1.
- Thêm `.3gp` vào danh sách `accept` của `upload.html` cho khớp với danh sách đuôi file phía server.

## 1.7.0
- Chuyển toàn bộ giao diện từ CSS tự viết (`public/css/style.css`) sang **Tailwind CSS v4**:
  - Cài `tailwindcss` + `@tailwindcss/vite`, bật plugin trong `vite.config.ts`.
  - Thêm file `src/client/tailwind.css` khai báo theme (bảng màu dark, font, bóng đổ), các utility `bg-brand`/`text-brand` và override cho XGPlayer; mỗi trang nhập CSS qua module TS tương ứng (`home`, `auth`, `player`, `upload`).
  - Thêm `src/client/vite-env.d.ts` để TypeScript nhận khai báo CSS của Vite.
  - Viết lại 4 file HTML (`index`, `login`, `player`, `upload`) bằng class utility của Tailwind, giữ nguyên mọi id bắt buộc mà JS phụ thuộc.
  - Thêm `src/client/ui.ts` chứa các chuỗi class dùng chung cho nút, thẻ video, bình luận, thông báo; cập nhật `main`, `home`, `player`, `upload`, `auth` dùng class mới (ẩn/hiện bằng class `hidden`, drop highlight bằng `data-active`).
  - Xóa `public/css/style.css`, cập nhật `scripts/build.js` kiểm tra `src/client/tailwind.css` thay cho file cũ.

- `npm run dev` không còn cần biên dịch: cài `tsx`, nodemon chạy thẳng file TypeScript (`node node_modules/tsx/dist/cli.mjs src/server/server.ts`) thay vì phải `tsc` rồi mới chạy. Sửa code trong `src/server/` là khởi động lại ngay.

## 1.6.1
- Thêm thư viện `nodemon` dùng trong `npm run dev`: server tự biên dịch lại và khởi động lại mỗi khi sửa code trong `src/server/` (cấu hình tại `nodemon.json`).
- `npm run dev` giờ chỉ chạy server bằng nodemon; frontend dùng bản đã build bằng `npm run build`. Bỏ script `dev:server`.

## 1.6.0
- Chuyển toàn bộ dự án sang TypeScript + Vite.
- Server: `server.js`, `db.js` → `src/server/server.ts`, `src/server/db.ts`, biên dịch bằng `tsc` ra `dist/server`, chạy bằng `node dist/server/server.js`. Đường dẫn `uploads/` và `data.db` cố định theo thư mục gốc (chạy từ `dist` vẫn đúng).
- Frontend: các trang HTML chuyển lên thư mục gốc làm entry Vite (multi-page), JS chuyển thành module TS trong `src/client/` (`main`, `home`, `auth`, `upload`, `player`, `antidev`, `api`), build bằng `vite` ra `dist/public` và tự động copy `public/` (CSS + vendor) sang.
- `scripts/build.js`: 5 bước — biên dịch server, typecheck client, build Vite, kiểm tra HTML/CSS (id bắt buộc + tham chiếu file), load test server.
- Scripts mới: `npm start` (chạy bản đã build), `npm run dev` (Vite dev server có proxy `/api` → cổng 3000), `npm run dev:server` (biên dịch server + watch).
- Lưu ý môi trường Termux: dùng TypeScript 5 và Vite 7 (bản JS thuần), các lệnh gọi qua `node` trực tiếp do thiếu `/usr/bin/env`.

## 1.5.2
- Nâng cấp `scripts/build.js`: với `server.js` và `db.js`, ngoài kiểm tra cú pháp còn **load thử trong tiến trình con** để bắt lỗi runtime (ví dụ `ReferenceError`, lỗi khi mở database) — trước đây chỉ check cú pháp nên không phát hiện được.

## 1.5.1
- Nâng cấp `scripts/build.js` thành kiểm tra toàn diện toàn bộ dự án: ngoài JS còn kiểm tra cả HTML và CSS.
- HTML: dò mọi id, phát hiện id trùng lặp và thiếu id bắt buộc mà JS cần (đăng nhập, upload, player, trang chủ), kiểm tra mọi tham chiếu `src`/`href` nội bộ phải tồn tại.
- CSS: kiểm tra dấu ngoặc nhọn cân bằng.

## 1.5.0
- Đập toàn bộ giao diện và xây dựng lại theo phong cách dark hiện đại: nền tối với gradient xanh dương – tím, card bo góc lớn, header trong suốt có hiệu ứng blur, nút gradient, ô input/textarea bo tròn có viền sáng khi focus.
- Thêm hero banner trên trang chủ, footer, khối mô tả video riêng, thanh tiến độ upload tròn.
- Giữ nguyên toàn bộ tính năng và cấu trúc id/class mà JS phụ thuộc (đăng nhập, upload, xem video, bình luận, lịch sử).

## 1.4.0
- Chặn kiểm tra DevTools trên toàn bộ trang: kết hợp thư viện `disable-devtool` 0.3.9 (tự-host tại `public/vendor/`) với script tự viết `public/js/antidev.js`.
- Script tự viết: chặn F12 / Ctrl+Shift+I/J/C / Ctrl+U / chuột phải, phát hiện devtools qua chênh lệch kích thước cửa sổ, vòng lặp `debugger` gây khó khi tạm dừng, ngụy trang console.log.
- Khi phát hiện DevTools: chặn cứng — xóa nội dung trang, hiện cảnh báo, tạm dừng video và đóng cửa sổ.

## 1.3.0
- Không đưa URL phát trực tiếp vào file player.js nữa: server tạo endpoint `/api/videos/:id/player.js` trả về file JS có URL đã bị xáo trộn (đảo byte + XOR + base64), trình duyệt tự giải mã rồi mới phát.
- Thêm hàm `loadScript` trong player.js để nạp file JS xáo trộn trước khi khởi tạo XGPlayer.

## 1.2.1
- Tắt nút tải video (download) của XGPlayer trong trình phát: không hiển thị nút tải khi xem video.

## 1.2.0
- Chuyển trình phát video sang XGPlayer 3.0.26 (tải file về `public/vendor/`, tự-host không cần internet).
- Thay thẻ `<video>` gốc bằng khởi tạo `Player` của XGPlayer, giữ nguyên tính năng tiếp tục xem và lưu lịch sử tiến độ.

## 1.1.2
- Sửa `scripts/build.js`: tự dò tìm mọi file `.js` trong dự án thay vì liệt kê cứng (thêm file mới không cần sửa file build).

## 1.1.1
- Sửa lỗi nút Upload không hoạt động trên điện thoại: bỏ top-level `await` trong script classic (trình duyệt mobile coi là lỗi cú pháp), bọc vào async function.

## 1.1.0
- Thêm quy tắc không chuyển đổi định dạng video: lưu nguyên file gốc, stream đúng định dạng (Content-Type theo đuôi file, không ghi cứng `video/mp4`).
- Sửa giao diện chọn file thân thiện mobile: dùng `label` + `visually-hidden` thay cho `.click()` chương trình.
- Mở rộng `fileFilter` server chấp nhận `application/octet-stream` khi đuôi file thuộc danh sách video.

## 1.0.1
- Thêm scripts `build` (kiểm tra cú pháp) và `dev` (chạy với watch).
