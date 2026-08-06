# Video Player

**English** | [Tiếng Việt](./README.vi.md)

A web video player: register, log in, upload videos, watch online, search, and
share videos through dedicated per-video URLs.

## Features

- Watch videos publicly without logging in
- Register / log in to upload videos and manage your own uploads (registration requires a Gmail address; login accepts your Gmail or username)
- Only the owner can delete a video
- Support for video thumbnails (automatic extraction using FFmpeg upon upload, or custom image upload)
- Completely optimized mobile UI and responsive video library card grid
- Every video has its own shareable URL (`/video/:id`)
- Direct media URLs are never exposed — the API returns a short-lived HMAC-signed media token, and the client streams the video through `/api/media?t=<token>` (Range requests supported)
- Hardened responses: Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options` and other security headers on every request
- Full-featured player: play/pause, seek, volume, playback speed, fullscreen, keyboard shortcuts
- Logged-in users can submit feedback (feature request, bug report, or other) via the "Góp ý" button which opens the GitHub Issues page

## Tech Stack

- Bun 1.3 (runtime + bundler)
- React 19 + TypeScript + Tailwind 4 + shadcn/ui
- SQLite storage — no separate database to install
- hls.js for HLS playback

## Install

```bash
bun install
```

> **Official package manager: Bun only.** npm and pnpm are NOT supported. Do
> not use them, and do not open issues about problems caused by npm or pnpm —
> they are not considered official. Only Bun is supported.

## Run

```bash
# run both frontend (3000) and API (3001) — auto-restarts on src/ changes
bun dev

# API only
bun devb

# frontend only (uses an already-running API server)
bun devf

# share over LAN (binds 0.0.0.0, prints the LAN IP)
bun devs

# production
bun start
```

`bun dev` uses a small runner (`dev.ts`) that watches `src/` and restarts the
server automatically when you edit files — no manual restarts.

## Structure

- `src/index.ts` — frontend server (port 3000), proxies `/api/*` to the API and serves the SPA
- `dev.ts` — dev runner: watches `src/` and auto-restarts the dev server on file changes
- `src/server/api.ts` — standalone API server (port 3001)
- `src/server/` — routes, handlers, db (SQLite), auth (session cookie), storage (upload), media tokens (`mediaToken.ts`), security headers (`security.ts`)
- `bin/` — platform-specific native C++ binaries (linux-x64, linux-arm64, darwin-x64, darwin-arm64, windows-x64, android-arm64). The server detects the current architecture and loads the correct binary from this directory. This is mandatory — the server will not start without the correct binary.
- `src/server/cpp/` — C++ source code for native modules (mediatoken, security, auth, db, videos)
- `build_cpp.sh` — compiles C++ source into shared libraries for the current platform
- `bin/detect.ts` — detects platform architecture and copies the correct binaries to `bin/`
- `src/App.tsx` — routing (home `/` and watch page `/video/:id`)
- `src/HomePage.tsx` — home page: search, upload, video list, feedback link to GitHub Issues
- `src/UploadModal.tsx` — upload modal with video and thumbnail image selection + progress bar
- `src/VideoPage.tsx` — video watch page
