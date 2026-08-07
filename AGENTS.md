# Agent Rules — Build, Version, Release Workflow

This project lives at `https://github.com/fhfjjfjd/video-player-bun` (branch `main`).

These rules are MANDATORY. Follow them every time you complete a task, add a
feature, or fix a bug.

## 1. Documentation language

- The repo is **multilingual**. Docs are NOT fixed to any single language —
  write in any language, and add translations when useful.
- Keep `README.md` as the primary doc; add a per-language mirror file (e.g.
  `README.vi.md` for Vietnamese, `README.zh.md` for Chinese) for each
  translation you add.
- Never mix multiple languages inside one doc; keep each doc file in one
  language.
- Update the README (and its translation mirrors) whenever behavior, commands,
  or the tech stack change.

## 2. Required workflow after every completed change

Once the code change is done, verified, and the build passes, run this exact
sequence — do not skip any step:

### Step 1 — Verify the build

```bash
bun run build
```

The frontend build MUST pass before proceeding. If it fails, fix it first.

**IMPORTANT — never build or run the backend on this machine.** This
machine is a low-power Android/Termux device and cannot compile the native
backend server. Do NOT run the backend build script, `g++`, `clang++`, or any
local compile/syntax check (`-fsyntax-only`, etc.) for the backend, ever, no
matter which programming language the backend is written in. All backend
compilation and verification happens on GitHub Actions only: push the code and
let the backend build workflow compile it across all target platforms.
If the build fails, read the Actions log and fix the code, then push again.

### Step 2 — Bump the version

Bump `version` in `package.json` to a SemVer number that matches the next
GitHub release tag. The version must be HIGHER than the latest release tag on
GitHub (check with `gh release list`).

- Patch bump (`x.y.z+1`) for bug fixes, refactors, docs, and small tweaks.
- Minor bump (`x.(y+1).0`) for new features.
- Major bump (`(x+1).0.0`) for breaking changes.

### Step 3 — Update documentation

Update the documentation (`README.md` and its per-language mirrors) if the
change affects features, commands, or setup. The docs are multilingual — update
or add any language you like; no language is mandatory.

### Step 4 — Commit

```bash
git add -A
git commit -m "<concise summary of the change>"
```

Commit message must be concise and match the repo style (e.g.
`Fix: ...`, `Add: ...`). Never commit `data.db*`, `uploads/`, `node_modules/`,
or `dist/` — they are gitignored.

### Step 5 — Push

```bash
git push origin main
```

### Step 6 — Tag

```bash
git tag v<version>          # e.g. git tag v3.0.1
git push origin v<version>  # e.g. git push origin v3.0.1
```

### Step 7 — Run GitHub Actions manually

After pushing the tag, go to the GitHub repository → **Actions** tab →
run the backend build workflows (one per OS: Linux, macOS, Windows,
Android) — or let them trigger automatically by the push. Wait for them
to complete for each OS and chip (x86 and ARM). Download the produced
binary artifacts for each platform. Each artifact contains the
pre-compiled backend executable for that platform — never compile it on
a local machine.

### Step 7b — Check the build results

After the workflows finish, check the result of every workflow run on
the **Actions** tab:

- If any workflow **fails**: read the failing step's log, fix the code,
  and push again (repeat Step 4–7 until all workflows pass).
- If all workflows **pass** (green): move on to Step 8. No further
  action is needed — do not re-run or re-verify builds that already
  succeeded.

Never proceed to create a release while any backend build workflow is
failing.

### Step 8 — Create a GitHub release

```bash
gh release create v<version> --repo fhfjjfjd/video-player-bun \
  --title "v<version> - <short summary>" \
  --latest \
  --notes "<what changed>"
```

### Step 9 — Upload binary artifacts to the release

After creating the release, upload the binary artifacts produced by
GitHub Actions (the native binaries for each platform) to the release
page using the GitHub CLI or the web UI:

```bash
gh release upload v<version> <path-to-binary> --repo fhfjjfjd/video-player-bun
```

Repeat for each platform binary. Release notes can be written in any language
and summarize the changes in this version.

### Rule: do not modify a published release

Once a release is published, do NOT go back and edit it. If you need to
fix something or add something, make the change and release a new version
following the same workflow above.

## 3. How users install and run

The backend is a native compiled binary (written in whatever language the
project uses — no single language is mandated). It is NEVER compiled on a
user's machine.

1. Clone/download the source code.
2. Download the pre-compiled `video-server` executable for the user's
   platform (Linux x86, Linux ARM, macOS x86, macOS ARM, Windows x86,
   Android ARM) from the GitHub release page or Actions artifacts.
3. Place the executable at `bin/<platform>-<arch>/video-server`, for
   example `bin/linux-x64/video-server`.
4. Build the frontend (`bun install && bun run build`) and run the app
   with `bun run start` (or `npm start`). The launcher detects the
   platform/arch, finds the binary in `bin/`, and executes it.

Do not add instructions that ask users to compile the backend code locally.

## 4. Reminders

- Always use the GitHub CLI (`gh`) for releases; it is authenticated.
- Keep the local repo clean: never commit secrets, databases, uploads, or build
  output.
- If you are unsure which version to bump to, ask the user instead of guessing.

## 5. Feedback / Issues handling

User feedback goes to **GitHub Issues** — there is no in-app feedback folder
anymore. The app's "Góp ý" button links directly to the Issues page of this
repository.

Rules:

- Check the GitHub Issues for this repository when starting work and after
  every change: `gh issue list --repo fhfjjfjd/video-player-bun`.
- Read every open issue COMPLETELY (title + body) before acting. Never act on
  the title alone.
- If an issue asks for a fix/feature, implement it following the workflow
  above.
- After finishing, reply on the issue explaining what was done and close it:
  `gh issue close <number> --comment "<explanation>"`. Write the reply in any
  language (matching the issue's language if you can) so the reporter can read
  it.
- Never reopen or "fix" issues that are already closed.
