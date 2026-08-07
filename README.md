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
- Native backend server (currently C++ with SQLite) — no separate database to install
- Backend build is **language-agnostic** (`build.sh`): switching to Rust, Go, Python, or Node needs no CI or release changes
- hls.js for HLS playback

## Quick install (one command)

No manual setup needed. Run the installer for your OS — it clones the source,
downloads the pre-built backend binary for your CPU/OS, builds the frontend,
and creates a `videohub` command:

- **Linux / macOS / Android (Termux):**

  ```bash
  curl -fsSL https://raw.githubusercontent.com/fhfjjfjd/video-player-bun/main/install.sh | bash
  ```

- **Windows (PowerShell):**

  ```powershell
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fhfjjfjd/video-player-bun/main/install.bat" -OutFile install.bat
  .\install.bat
  ```

When it finishes, open a new terminal and just type:

```bash
videohub
```

The app installs to `~/videohub` (set `VIDEOHUB_DIR` to change the location).
To update both the source and the binary, run:

```bash
videohub update
```

or re-run the installer (`bash install.sh update`).

## Install

```bash
bun install
```

> **Official package manager: Bun only.** npm and pnpm are NOT supported. Do
> not use them, and do not open issues about problems caused by npm or pnpm —
> they are not considered official. Only Bun is supported.

## Run

```bash
bun run build   # build the frontend into dist/
bun start       # start the native server (SPA + API, http://127.0.0.1:3000)
```

`bun dev` does the same in development mode. The server binds to
`127.0.0.1:3000` by default; set `HOST=0.0.0.0` to share over LAN.

### The backend binary

The backend is a pre-compiled native executable (`video-server`). It is
**never compiled on your machine** — GitHub Actions builds it for every
platform/arch (Linux, macOS, Windows, Android; x86 and ARM) and the binaries
are attached to each Release.

These builds are **manual-only**: they never run automatically on push. The
maintainer triggers each build by hand (Actions tab → Run workflow), so a
Release is only published after all 8 platform/arch builds pass. Each Release
ships all 8 binaries.

1. Download the binary for your platform from the Release page.
2. Place it at the matching path, e.g. `bin/linux-x64/video-server`
   (for Windows: `bin/windows-x64/video-server.exe`).
3. Then run the app as above. `bin/detect.ts` picks the correct binary for
   your OS and architecture automatically.

Supported paths: `bin/linux-x64`, `bin/linux-arm64`, `bin/darwin-x64`,
`bin/darwin-arm64`, `bin/windows-x64`, `bin/windows-arm64`,
`bin/android-arm64`, `bin/android-x64`.

## Structure

- `src/server/` — backend source; language is auto-detected by `build.sh` from marker files (`Cargo.toml`, `go.mod`, `pyproject.toml`, `package.json`, or `cpp/`)
- `src/server/cpp/` — current backend implementation in C++ (HTTP server, SQLite, auth/sessions, media tokens, SHA-256/HMAC/PBKDF2)
- `src/server/cpp/vendor/` — vendored SQLite (amalgamation source, no system lib needed)
- `build.sh` — language-agnostic backend build dispatcher (detects language, always outputs `src/server/out/video-server`; used by GitHub Actions, never run locally)
- `.github/workflows/build-<os>.yml` — manual-only CI workflows that build the backend for Linux, macOS, Windows and Android via `build.sh`
- `bin/` — pre-compiled `video-server` executables, one per platform/arch (downloaded from Releases, not committed)
- `bin/detect.ts` — detects the current platform/arch and launches the matching binary
- `src/App.tsx` — routing (home `/` and watch page `/video/:id`)
- `src/HomePage.tsx` — home page: search, upload, video list, feedback link to GitHub Issues
- `src/UploadModal.tsx` — upload modal with video and thumbnail image selection + progress bar
- `src/VideoPage.tsx` — video watch page
