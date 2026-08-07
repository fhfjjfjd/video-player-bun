# Agent Rules — Build, Version, Release Workflow

This project lives at `https://github.com/fhfjjfjd/video-player-bun` (branch `main`).

These rules are MANDATORY. Follow them every time you complete a task, add a
feature, fix a bug, or cut a release. Do not skip steps, do not reorder
phases, and do not rely on memory — re-read the relevant sections each time
you start work.

---

## 0. How this document is organized

- **Section 1** — documentation language rules (multilingual repo).
- **Section 2** — the full release pipeline, phase by phase (this is the
  normative process; follow it exactly).
- **Section 3** — absolute rules that apply at all times (never-broken
  invariants).
- **Section 4** — how to use subagents (tác nhân) in this pipeline.
- **Section 5** — feedback / GitHub Issues handling.

Use **Section 2** as your checklist. Whenever the guide says "delegate to a
subagent", follow the instructions in **Section 4** first.

---

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

---

## 2. The release pipeline

The pipeline has **14 phases**. Phases 0–8 happen on this machine. Phases 9–13
happen on GitHub. Phase 14 is close-out. Every phase must complete before the
next one starts. If any phase fails, do not proceed; fix and retry.

### Phase 0 — Intake and reconnaissance

0.1. **Check open GitHub Issues.** Run
     `gh issue list --repo fhfjjfjd/video-player-bun`. Read EVERY open issue
     completely (title AND body). Never act on a title alone.

0.2. **Confirm repository state.** Run `git status`, `git log --oneline -10`,
     and `git remote -v`. Confirm you are on `main`, the working tree matches
     your expectations, and there are no unexpected local commits.

0.3. **Confirm the latest release.** Run `gh release list --repo
     fhfjjfjd/video-player-bun` and note the newest tag. You will need it in
     Phase 3 to pick a correct version bump.

0.4. **Inventory the affected code.** If the task touches more than one file,
     delegate to an `explore` subagent to produce a concise map of what was
     changed, what calls what, and what could break (see Section 4.1). This map
     becomes the input to Phase 1.

### Phase 1 — Change analysis and planning

1.1. **Understand the scope.** Using the Phase 0.4 map (and your own reading of
     the diff), write down in your own words: what the change does, which
     surfaces it touches (frontend, backend, docs, CI), and the risk areas.

1.2. **Classify the change type.** Pick exactly one:
     - `bugfix` — fixes incorrect behavior, no new capability.
     - `feature` — adds new capability or changes visible behavior.
     - `breaking` — removes features, changes storage formats, or breaks
       existing deployments.
     - `chore` — docs, config, CI, refactor with no behavior change.

1.3. **Draft the version bump** based on the classification (see Phase 3 for
     exact rules). Do not edit `package.json` yet — first confirm the current
     version and the latest tag are consistent (Phase 0.3).

1.4. **Create a todo list** of the remaining phases (2 → 14) and mark Phase 2
     as in-progress. Track every phase in the todo list; never silently skip
     one.

### Phase 2 — Build verification (frontend only)

2.1. Run `bun run build`. The frontend build MUST pass before proceeding.

2.2. If the build fails: fix the code and re-run until green. Do not move past
     this phase on a red build.

2.3. **NEVER build, compile, or syntax-check the backend on this machine.**
     This is a low-power Android/Termux device. Do NOT run `build_cpp.sh`,
     `g++`, `clang++`, `gcc`, or any local compile/syntax check
     (`-fsyntax-only`, etc.) for the backend, ever, regardless of the language
     the backend is written in. All backend compilation happens exclusively on
     GitHub Actions (Phases 9–10).

2.4. If the change touched frontend behavior, optionally delegate to a
     `general` subagent to review the affected UI logic for regressions
     (see Section 4.2).

### Phase 3 — Version bump

3.1. **Read the current version** in `package.json` (`"version"` field).

3.2. **Compute the target version.** It must be STRICTLY HIGHER than the latest
     release tag from Phase 0.3. Use these rules:
     - `chore` / `bugfix` (non-visible) → patch bump: `x.y.z+1`.
     - `feature` → minor bump: `x.(y+1).0`.
     - `breaking` → major bump: `(x+1).0.0`.
     - If the previous tag was never reflected in `package.json` (the file lags
       behind the latest tag), still bump from the TAG, not from the file.

3.3. **Apply the bump** by editing the `version` field in `package.json`.

3.4. **If you are unsure** which version to use, STOP and ask the user. Never
     guess a version number.

### Phase 4 — Documentation update

4.1. Decide whether the change affects features, commands, setup, or the tech
     stack. If it does, update `README.md` AND any per-language mirrors that
     exist (e.g. `README.vi.md`).

4.2. If multiple translations are needed and the change is large, delegate the
     translation of each mirror to a `general` subagent (one per language),
     then review the results yourself before committing.

4.3. Keep every doc file in a single language. Never interleave languages.

### Phase 5 — Local review before commit

5.1. Run `git status` and `git diff`. Re-read your own changes carefully:
     look for bugs, memory/resource leaks, obvious race conditions, and broken
     cross-platform assumptions (paths, encodings, line endings).

5.2. **Independent review.** If the change is non-trivial (more than a few
     lines), delegate an independent code review to a `general` subagent with
     instructions to look specifically for: logic bugs, security issues
     (SQL injection, path traversal, secrets in code), and anything that would
     break the backend build on any of the 4 target OSes (Phases 9–10). Do NOT
     delegate to the same agent you used for the feature work; use a fresh
     subagent session.

5.3. Fix every issue the review finds before committing. Never commit known
     issues into `main`.

### Phase 6 — Commit

6.1. Run `git status` and `git diff` once more to confirm exactly what will be
     staged.

6.2. **Never stage or commit** `data.db*`, `uploads/`, `node_modules/`,
     `dist/`, or any secret/credential file. They are gitignored; if `git
     status` shows them, something is wrong — investigate before staging.

6.3. Stage with `git add -A`, then review the staged set with
     `git diff --cached --stat` and confirm only intended files are present.

6.4. Commit with a concise message matching the repo style, using one of these
     prefixes: `Add:`, `Fix:`, `Change:`, `Remove:`, `Docs:`.
     Example: `Fix: correct upload progress calculation on slow links`.

### Phase 7 — Push

7.1. Push to origin: `git push origin main`. Confirm the push succeeded and
     the remote `main` is now ahead by exactly one commit.

### Phase 8 — Tag

8.1. Create the tag matching the version from Phase 3:
     `git tag v<version>` (e.g. `git tag v4.2.1`).

8.2. Push the tag: `git push origin v<version>`.

8.3. If the tag was pushed earlier and needs to move (e.g. the previous CI run
     failed and you fixed code afterward), you may delete and recreate it ONLY
     while no release exists for it yet: `git tag -d v<version> &&
     git push origin :refs/tags/v<version>` then redo 8.1–8.2. Once a release
     is published, never touch the tag (Section 3.5).

### Phase 9 — Manual CI execution (CRITICAL: manual-only)

The 4 backend build workflows are **manual-only** (`workflow_dispatch`). They
**do NOT run automatically** on push, PR, or tag. You MUST trigger them by
hand. Never assume a push will build the backend.

9.1. **Verify the workflows exist and are manual-only.** Confirm
     `.github/workflows/build-linux.yml`, `build-macos.yml`,
     `build-windows.yml`, and `build-android.yml` exist and that their `on:`
     block contains ONLY `workflow_dispatch` (no `push:` / `pull_request:`).

9.2. **Trigger all four workflows.** Trigger each one against the `main`
     branch:
     ```bash
     gh workflow run "Build C++ Server (Linux)" --repo fhfjjfjd/video-player-bun --ref main
     gh workflow run "Build C++ Server (macOS)" --repo fhfjjfjd/video-player-bun --ref main
     gh workflow run "Build C++ Server (Windows)" --repo fhfjjfjd/video-player-bun --ref main
     gh workflow run "Build C++ Server (Android)" --repo fhfjjfjd/video-player-bun --ref main
     ```
     (Or do it via the web: **Actions** tab → workflow → **Run workflow** →
     branch `main` → **Run workflow**.)

9.3. **Record the run IDs.** Run `gh run list --repo fhfjjfjd/video-player-bun`
     and note the 4 new run IDs (they should be for the workflow names above,
     triggered by `workflow_dispatch`).

9.4. **Wait and collect status.** Poll `gh run list` until all 4 runs finish.
     Optionally delegate the polling loop to a `general` subagent that reports
     back one status line per run (see Section 4.3). Do not proceed while any
     run is still `in_progress`.

### Phase 10 — CI result inspection

10.1. **Check every job, not just the run.** For each of the 4 runs, list its
      jobs and conclusions. There are 8 jobs total:
      `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`,
      `windows-x64`, `windows-arm64`, `android-arm64`, `android-x64`.
      Every job must be `success`.

10.2. **On any failure**, delegate log analysis to a `general` subagent:
      instruct it to read `gh run view <ID> --repo fhfjjfjd/video-player-bun
      --log-failed`, extract the ROOT CAUSE (the first real error, not the
      cascade), and report the failing file + line. Do not fix code based on
      guessing.

10.3. **Fix, then re-run the loop.** After fixing, return to Phase 5 and walk
      forward: review → commit → push (Phase 6–7) → move the tag if needed
      (Phase 8.3) → re-trigger all 4 workflows manually (Phase 9.2). Repeat
      until all 8 jobs pass.

10.4. **Gate rule:** never create a release (Phase 12) while any backend build
      workflow is failing or unverified. No exceptions.

10.5. **On all-green:** do not re-run or re-verify builds that already
      succeeded. Move to Phase 11.

### Phase 11 — Download and verify artifacts

11.1. Download the artifacts for all 4 successful runs:
      `gh run download <ID> --repo fhfjjfjd/video-player-bun --dir <dir>`.
      Each artifact contains `video-server` (or `video-server.exe`) plus an
      intermediate `sqlite3.o` — the latter is build output and is ignored.

11.2. **Verify every binary.** Confirm you have 8 binaries with the expected
      format by checking the magic bytes:
      - Linux + Android → ELF (first 4 bytes `7f 45 4c 46`).
      - macOS (darwin) → Mach-O (first 4 bytes `cf fa ed fe` for arm64/x64).
      - Windows → MZ / PE (first 2 bytes `4d 5a`).
      Reject any artifact that does not match.

11.3. Optionally delegate the artifact download + magic-byte verification to a
      `general` subagent that returns a table of
      `platform-arch | bytes | size` (see Section 4.3).

### Phase 12 — Create the release

12.1. Create the release against the tag from Phase 8:
      ```bash
      gh release create v<version> --repo fhfjjfjd/video-player-bun \
        --title "v<version> - <short summary>" \
        --latest \
        --notes "<what changed>"
      ```
      Release notes can be written in any language and must summarize the
      changes in this version.

12.2. Record the release ID (from the `gh release create` output or
      `gh api repos/fhfjjfjd/video-player-bun/releases/tags/v<version> --jq .id`).

### Phase 13 — Upload binary artifacts

13.1. **Upload with unique asset names.** `gh release upload` collapses files
      with the same basename, so upload each platform binary under its own
      name. Use the GitHub API for reliable naming:
      ```bash
      REL_ID=<release id from Phase 12.2>
      for f in \
        "linux-x64/video-server|video-server-linux-x64" \
        "linux-arm64/video-server|video-server-linux-arm64" \
        "darwin-x64/video-server|video-server-darwin-x64" \
        "darwin-arm64/video-server|video-server-darwin-arm64" \
        "windows-x64/video-server.exe|video-server-windows-x64.exe" \
        "windows-arm64/video-server.exe|video-server-windows-arm64.exe" \
        "android-arm64/video-server|video-server-android-arm64" \
        "android-x64/video-server|video-server-android-x64"; do
        path="${f%%|*}"; name="${f##*|}";
        curl -sL -o /dev/null -w "%{http_code}\n" \
          -X POST \
          -H "Authorization: Bearer $(gh auth token)" \
          -H "Accept: application/vnd.github+json" \
          -H "Content-Type: application/octet-stream" \
          --data-binary "@$path" \
          "https://uploads.github.com/repos/fhfjjfjd/video-player-bun/releases/$REL_ID/assets?name=$name"
      done
      ```
      Every upload must return HTTP `201`.

13.2. **Verify the asset list.** Run
      `gh release view v<version> --repo fhfjjfjd/video-player-bun --json assets
      --jq '.assets[].name'` and confirm all 8 expected names are present.

### Phase 14 — Close-out

14.1. **Close fixed issues.** If any open GitHub Issue was addressed by this
      work, reply on the issue explaining what was done (in a language the
      reporter can read, matching theirs if possible) and close it:
      `gh issue close <number> --comment "<explanation>"`.

14.2. **Confirm a clean tree.** Run `git status` and confirm nothing is left
      uncommitted or untracked.

14.3. **Report to the user.** Give a concise summary: what changed, the new
      version, the 8 artifact names, and the release URL.

---

## 3. Absolute rules (apply at all times)

3.1. **Never compile or run the backend on this machine.** No `build_cpp.sh`,
     `g++`, `clang++`, `gcc`, or `-fsyntax-only` for backend code. Ever.
     Backend builds happen only on GitHub Actions, triggered manually.

3.2. **Backend CI is manual-only.** The 4 build workflows never auto-run. You
     must trigger them by hand (Phase 9) after every backend-related change.

3.3. **Never proceed to a release with a failing backend build.** Phase 10.4 is
     a hard gate.

3.4. **Always use the GitHub CLI (`gh`) for release operations.** It is
     authenticated; do not fall back to unauthenticated curl for release
     management. (The Phase 13.1 upload snippet uses `gh auth token` internally
     — that is still gh-backed.)

3.5. **Never modify a published release or move its tag.** If you need to fix
     something after publishing, make the change and cut a NEW version via the
     full pipeline. Do not edit, delete, or re-upload to an existing release.

3.6. **Keep the local repo clean.** Never commit secrets, credentials,
     databases, uploads, or build output.

3.7. **Never guess a version.** When in doubt, ask the user.

---

## 4. Using subagents (tác nhân) in this pipeline

Subagents help reduce context usage and parallelize work. Use them for
research and verification, NEVER for making final decisions.

4.1. **`explore` subagent** — for fast codebase searches and summaries. Use in
     Phase 0.4 to map affected code, and anytime you need to find files or
     symbols quickly. Specify a thoroughness level (`quick` / `medium` /
     `very thorough`) so it knows how deep to go.

4.2. **`general` subagent** — for multi-step analysis and parallelizable
     work. Use in Phase 2.4 (frontend regression review), Phase 4.2
     (translations), Phase 5.2 (independent diff review), Phase 9.4 (CI
     polling), Phase 10.2 (failed-log root-cause analysis), and Phase 11.3
     (artifact verification).

4.3. **Delegation rules:**
     - Give the subagent a fully self-contained prompt: what to do, which
       commands/files to use, and EXACTLY what to return. The subagent starts
       with fresh context — it cannot see our conversation.
     - Tell it whether you expect code changes or research only.
     - Launch independent subagents in parallel (one message, multiple tool
       calls) whenever they do not depend on each other.
     - Once a task is delegated, do not duplicate that work yourself; wait for
       the result and continue with non-overlapping tasks.
     - **Never delegate a phase decision** (version choice, release go/no-go,
       whether to close an issue). Those stay with you / the user.
     - For code review (5.2), always use a FRESH subagent session, never the
       one that implemented the change.

---

## 5. Feedback / Issues handling

User feedback goes to **GitHub Issues** — there is no in-app feedback folder
anymore. The app's "Góp ý" button links directly to the Issues page of this
repository.

Rules:

- Check the GitHub Issues for this repository when starting work and after
  every change: `gh issue list --repo fhfjjfjd/video-player-bun`.
- Read every open issue COMPLETELY (title + body) before acting. Never act on
  the title alone.
- If an issue asks for a fix/feature, implement it following the pipeline
  above (Phase 0 → 14).
- After finishing, reply on the issue explaining what was done and close it:
  `gh issue close <number> --comment "<explanation>"`. Write the reply in any
  language (matching the issue's language if you can) so the reporter can read
  it.
- Never reopen or "fix" issues that are already closed.
