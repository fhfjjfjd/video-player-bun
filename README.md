# Video Player

**English** | [Tiếng Việt](./README.vi.md)

> **Development is temporarily paused.** This project is currently in a
> maintenance hold — no new features or changes are being worked on right now.
> The latest release still works as documented below.

A web video player: register, log in, upload videos, watch online, search, and
share videos through dedicated per-video URLs.

## Features

- Watch videos publicly without logging in
- Register / log in to upload videos and manage your own uploads (registration requires a Gmail address; login accepts your Gmail or username)
- Only the owner can delete a video
- Support for video thumbnails (automatic extraction using FFmpeg upon upload, or custom image upload)
- Completely optimized mobile UI and responsive video library card grid
- Modern streaming-style dark UI: cinematic gradient brand (emerald → teal → cyan), glassy blurred header, featured-video hero banner, hover-rich video cards, and redesigned player, auth and upload screens
- Every video has its own shareable URL (`/video/:id`)
- Direct media URLs are never exposed — the API returns a short-lived HMAC-signed media token, and the client streams the video through `/api/media?t=<token>` (Range requests supported)
- Hardened responses: Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options` and other security headers on every request
- Full-featured player: play/pause, seek, volume, playback speed, fullscreen, keyboard shortcuts
- Logged-in users can submit feedback (feature request, bug report, or other) via the "Góp ý" button which opens the GitHub Issues page

## Tech Stack

- Bun 1.3 (runtime + bundler)
- React 19 + TypeScript + Tailwind 4 + shadcn/ui (custom dark design system with gradient brand tokens)
- PHP backend (PHP 8.1+, SQLite via PDO) — no separate database to install
- hls.js for HLS playback

## Quick install (one command)

No manual setup needed. Run the installer for your OS — it installs PHP (the
backend runtime) if missing, clones the source, builds the frontend, and
creates a `videohub` command:

- **Linux / macOS / Android (Termux):**

  ```bash
  curl -fsSL https://raw.githubusercontent.com/fhfjjfjd/video-player-bun/main/scripts/install.sh | bash
  ```

- **Windows (PowerShell):**

  ```powershell
  Invoke-WebRequest -Uri "https://raw.githubusercontent.com/fhfjjfjd/video-player-bun/main/scripts/install.bat" -OutFile install.bat
  .\install.bat
  ```

When it finishes, open a new terminal and just type:

```bash
videohub
```

The app installs to `~/videohub` (set `VIDEOHUB_DIR` to change the location).
Manage it from anywhere:

```bash
videohub           # start the app
videohub update    # update source in place
videohub reinstall # fresh install (asks whether to keep uploads/ + data.db)
videohub uninstall # remove launcher, PATH entries, and app (asks whether to keep uploads/ + data.db)
```

`videohub reinstall` and `videohub uninstall` always ask whether you want to
keep your uploaded videos (`uploads/` and `data.db`). Answer `y` to keep the
data, anything else to delete everything. The same flows work as
`bash scripts/install.sh reinstall|uninstall` (Unix) or
`scripts/install.bat reinstall|uninstall` (Windows).

**Version pinning:** install and update always fetch the **latest GitHub
release** — the source is checked out at the release tag so the frontend and
backend you get are always a matching pair (never a newer `main` mixed with an
older release).

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
bun start       # start the PHP backend (SPA + API, http://127.0.0.1:3000)
```

`bun dev` does the same in development mode. The server binds to
`127.0.0.1:3000` by default; set `HOST=0.0.0.0` to share over LAN.

### The backend (PHP)

The backend is a PHP router in `src/server/php/`, launched by `scripts/start.ts`
with PHP's built-in web server (`php -S`). There is no compilation and no
binary to download — the server runs straight from the source.

Requirements:

- PHP 8.1+ with the `pdo_sqlite` extension (SQLite is embedded, no separate
  database to install)
- `ffmpeg` on PATH for automatic thumbnail extraction (optional — custom
  thumbnails still work without it)

The installers (`scripts/install.sh` / `scripts/install.bat`) install PHP and
ffmpeg when missing and verify the `pdo_sqlite` extension before setting things
up.

## Structure

- `src/server/php/` — the PHP backend: `server.php` (HTTP router, API
  handlers, media streaming with Range support, static files), `db.php`
  (SQLite storage via PDO), `crypto.php` (signed media tokens, sessions,
  PBKDF2/bcrypt password hashing)
- `scripts/start.ts` — launches the PHP backend via `php -S`
- `src/App.tsx` — routing (home `/` and watch page `/video/:id`)
- `src/HomePage.tsx` — home page: search, upload, video list, feedback link to GitHub Issues
- `src/BrandLogo.tsx` — reusable gradient brand logo (also used as the favicon, `src/logo.svg`)
- `src/UploadModal.tsx` — upload modal with video and thumbnail image selection + progress bar
- `src/VideoPage.tsx` — video watch page
