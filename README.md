# Video Player

**English** | [Tiếng Việt](./README.vi.md)

A web video player: register, log in, upload videos, watch online, search, and
share videos through dedicated per-video URLs.

## Features

- Watch videos publicly without logging in
- Register / log in to upload videos and manage your own uploads (registration requires a Gmail address; login accepts your Gmail or username)
- Only the owner can delete a video
- Search videos by title
- Every video has its own shareable URL (`/video/:id`)
- Direct media URLs are never exposed — the API returns a short-lived HMAC-signed media token, and the client streams the video through `/api/media?t=<token>` (Range requests supported)
- Hardened responses: Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options` and other security headers on every request
- Full-featured player: play/pause, seek, volume, playback speed, fullscreen, keyboard shortcuts
- HLS (`.m3u8`) support via hls.js
- Logged-in users can send feedback (feature request, bug report, or other) from a "Góp ý" dialog on the home page; each suggestion is stored as a Markdown file in the `feedback/` folder with an `open`/`closed` status and an agent reply once closed

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

# public HTTPS tunnel (Cloudflare)
bun run tunnel   # quick tunnel (ephemeral)
bash tunnel.sh   # named tunnel with a fixed hostname
```

`bun dev` uses a small runner (`dev.ts`) that watches `src/` and restarts the
server automatically when you edit files — no manual restarts.

## Public access over HTTPS (Cloudflare Tunnel)

To expose the app publicly with a secure HTTPS link, use Cloudflare Tunnel:

```bash
# quick tunnel (ephemeral, no account needed)
bun run tunnel          # runs: cloudflared tunnel --url http://localhost:3000

# named tunnel (fixed hostname, needs a Cloudflare account + domain)
bash tunnel.sh
```

For a **named tunnel** set `TUNNEL_HOSTNAME=video.example.com bash tunnel.sh` to
skip the hostname prompt. The script logs in to Cloudflare, creates the tunnel,
writes `~/.cloudflared/video-player.yml` (ingress → `http://localhost:3000`),
routes DNS, and runs it. `bun dev` runs both ports in one process, so tunneling
to port 3000 gives access to the whole app.

## Structure

- `src/index.ts` — frontend server (port 3000), proxies `/api/*` to the API and serves the SPA
- `dev.ts` — dev runner: watches `src/` and auto-restarts the dev server on file changes
- `src/server/api.ts` — standalone API server (port 3001)
- `src/server/` — routes, handlers, db (SQLite), auth (session cookie), storage (upload), media tokens (`mediaToken.ts`), security headers (`security.ts`)
- `src/App.tsx` — routing (home `/` and watch page `/video/:id`)
- `src/HomePage.tsx` — home page: search, upload, video list, feedback dialog
- `src/FeedbackDialog.tsx` — "Góp ý" dialog: submit and browse suggestions (open/closed)
- `src/VideoPage.tsx` — video watch page
- `src/VideoPlayer.tsx` — the player (video element + controls + HLS)
- `src/server/feedback.ts` — feedback storage (one Markdown file per suggestion in `feedback/`, overridable via `FEEDBACK_DIR`)
