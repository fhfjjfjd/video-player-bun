# Video Player

**English** | [Tiếng Việt](./README.vi.md)

A web-based video player: users register, upload videos, watch videos (HLS streaming with adaptive quality), comment, and keep a watch history. New uploads are converted to HLS (`.m3u8` + `.ts`) by ffmpeg with multiple resolutions; owners can add subtitles and set a video to public or private (link-only sharing).

## Tech Stack

- Backend: Node.js (>= 24) + Express 5 + TypeScript
- Database: PostgreSQL 18 (client: `pg`), auto-started by the server
- Frontend: TypeScript + Vite (multi-page), hls.js player
- Transcoding: ffmpeg/ffprobe → HLS with adaptive multi-resolution renditions
- Upload: multer (max 500MB, video formats), subtitles `.srt`/`.vtt` (max 2MB)
- Dev: nodemon + tsx (no compilation needed while developing)

## Install

```bash
pkg install postgresql ffmpeg   # Termux: DB server + transcoder
npm install
npm run db:migrate              # optional: copy existing data.db data into PostgreSQL
```

The server connects to `DATABASE_URL` if set, otherwise defaults to a local database `video_player` (`postgresql://<user>@localhost:5432/video_player`). If the local PostgreSQL is not running, the server starts it automatically on boot and restarts it if the process is killed.

## Commands

| Command | Description |
| --- | --- |
| `npm run build` | Compile server, build frontend, check HTML/CSS/JS, load-test server |
| `npm start` | Run the built version (`node dist/server/server.js`) |
| `npm run dev` | Run backend (nodemon + tsx, port 3000) and frontend (Vite + HMR, port 5173) together |
| `npm run db:start` | Start PostgreSQL (`pg_ctl`) |
| `npm run db:stop` | Stop PostgreSQL |
| `npm run db:migrate` | Migrate existing `data.db` (SQLite) rows into PostgreSQL |

Termux note: commands are invoked directly via `node` because `/usr/bin/env` is missing.

## Run

1. `npm run build` — compile for the first time
2. `npm start` — run the server at http://localhost:3000 (PostgreSQL starts automatically)
3. Open the browser, register an account, upload and watch videos

While developing: `npm run dev` runs both the backend (auto-reloads via nodemon) and the Vite dev server (HMR). Open http://localhost:5173 — no build needed. Vite proxies `/api` to the backend on port 3000.

## Project Structure

```
src/server/        # Server TypeScript (Express + PostgreSQL, ffmpeg HLS)
src/client/        # Frontend TypeScript (Vite modules, hls.js)
public/            # CSS + vendor (disable-devtool)
scripts/build.js   # Build + full project checks
scripts/migrate-db.js  # SQLite → PostgreSQL migration
dist/              # Build output (server + public)
uploads/           # Original uploaded videos (not committed)
uploads/hls/       # HLS output per video (not committed)
uploads/subtitles/ # Subtitle files (not committed)
```

## Main API

- `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/videos`, `GET /api/videos/:id` (private videos require a share token `?t=...`)
- `POST /api/videos` — upload (multipart, requires login, HLS transcode starts automatically)
- `POST /api/videos/:id/view` — count a view
- `DELETE /api/videos/:id` — delete a video (login + owner only)
- `GET /api/videos/:id/stream` — progressive streaming, supports HTTP Range (fallback)
- `GET /api/videos/:id/hls/:file` — HLS manifest + segments (`.m3u8`/`.ts`)
- `POST /api/videos/:id/share` — create/get a share link (owner only)
- `POST /api/videos/:id/visibility` — toggle `public`/`private` (owner only)
- `GET /share/:token` — resolve a share link
- `GET/POST/DELETE /api/videos/:id/subtitles(...)` — subtitle list, upload (owner), delete (owner)
- `GET/POST /api/videos/:id/comments`
- `GET/POST /api/history` — watch history (progress 0–1)

## Development Rules

Every code change must bump the version in `package.json` and record it in `CHANGELOG.md` (new version + list of changes).
