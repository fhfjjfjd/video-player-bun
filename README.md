# Video Player

**English** | [Tiếng Việt](./README.vi.md)

A web-based video player: users register, upload videos, watch videos (streaming), comment, and keep a watch history. Videos are stored in their original format on the server — never converted.

## Tech Stack

- Backend: Node.js (>= 24) + Express 5 + TypeScript
- Database: SQLite (built-in `node:sqlite` module)
- Frontend: TypeScript + Vite (multi-page), XGPlayer
- Upload: multer (max 500MB, video formats)
- Dev: nodemon + tsx (no compilation needed while developing)

## Install

```bash
npm install
```

## Commands

| Command | Description |
| --- | --- |
| `npm run build` | Compile server, build frontend, check HTML/CSS/JS, load-test server |
| `npm start` | Run the built version (`node dist/server/server.js`) |
| `npm run dev` | Run backend (nodemon + tsx, port 3000) and frontend (Vite + HMR, port 5173) together |

Termux note: commands are invoked directly via `node` because `/usr/bin/env` is missing.

## Run

1. `npm run build` — compile for the first time
2. `npm start` — run the server at http://localhost:3000
3. Open the browser, register an account, upload and watch videos

While developing: `npm run dev` runs both the backend (auto-reloads via nodemon) and the Vite dev server (HMR). Open http://localhost:5173 — no build needed. Vite proxies `/api` to the backend on port 3000.

## Project Structure

```
src/server/        # Server TypeScript (Express + SQLite)
src/client/        # Frontend TypeScript (Vite modules)
public/            # CSS + vendor (XGPlayer, disable-devtool)
scripts/build.js   # Build + full project checks
dist/              # Build output (server + public)
uploads/           # User-uploaded videos (not committed)
data.db            # SQLite database (not committed)
```

## Main API

- `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/videos`, `GET /api/videos/:id`
- `POST /api/videos` — upload (multipart, requires login)
- `DELETE /api/videos/:id` — delete a video (login + owner only)
- `GET /api/videos/:id/stream` — video streaming, supports HTTP Range
- `GET/POST /api/videos/:id/comments`
- `GET/POST /api/history` — watch history (progress 0–1)

## Development Rules

Every code change must bump the version in `package.json` and record it in `CHANGELOG.md` (new version + list of changes).
