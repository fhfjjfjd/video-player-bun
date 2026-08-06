# Agent Rules — Build, Version, Release Workflow

This project lives at `https://github.com/fhfjjfjd/video-player-node` (branch `main`).

These rules are MANDATORY. Follow them every time you complete a task, add a
feature, or fix a bug.

## 1. Documentation language

- `README.md` and every English-language doc in this repo MUST be written in
  **English**. Never write Vietnamese in English docs.
- Keep `README.vi.md` as the Vietnamese translation mirror of `README.md`.
- Update `README.md` (and `README.vi.md`) whenever behavior, commands, or the
  tech stack change.

## 2. Required workflow after every completed change

Once the code change is done, verified, and the build passes, run this exact
sequence — do not skip any step:

### Step 1 — Verify the build

```bash
bun run build
```

The build MUST pass before proceeding. If it fails, fix it first.

### Step 2 — Bump the version

Bump `version` in `package.json` to a SemVer number that matches the next
GitHub release tag. The version must be HIGHER than the latest release tag on
GitHub (check with `gh release list`).

- Patch bump (`x.y.z+1`) for bug fixes, refactors, docs, and small tweaks.
- Minor bump (`x.(y+1).0`) for new features.
- Major bump (`(x+1).0.0`) for breaking changes.

### Step 3 — Update documentation

Update `README.md` in English (and `README.vi.md` in Vietnamese) if the change
affects features, commands, or setup.

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

### Step 7 — Create a GitHub release

```bash
gh release create v<version> --repo fhfjjfjd/video-player-node \
  --title "v<version> - <short summary>" \
  --latest \
  --notes "<what changed, in English>"
```

Release notes go in English and summarize the changes in this version.

### Rule: do not modify a published release

Once a release is published, do NOT go back and edit it. If you need to
fix something or add something, make the change and release a new version
following the same workflow above.

## 3. Reminders

- Always use the GitHub CLI (`gh`) for releases; it is authenticated.
- Keep the local repo clean: never commit secrets, databases, uploads, or build
  output.
- If you are unsure which version to bump to, ask the user instead of guessing.

## 4. Feedback (Góp ý) handling

Suggestions from the "Góp ý" dialog are saved as Markdown files in the
`feedback/` folder (gitignored). Each file has a frontmatter block plus the
detailed content (nội dung chi tiết) below it:

```markdown
---
id: <uuid>
type: feature|bug|other
title: <short title>
status: open|closed
created_at: <ISO timestamp>
author: <username>
---

<nội dung chi tiết — detailed description of the request>
```

Rules:

- Check the `feedback/` folder when starting work and after every change.
- Read EVERY open file COMPLETELY — both its `title` and the full detailed
  content (`nội dung chi tiết`) below the frontmatter — before acting. Never
  act on the title alone.
- If a file has `status: open`, do what its full content asks: fix the bug,
  add the feature, or implement whatever it requests.
- After finishing, edit the file to set `status: closed` AND append a
  `## Reply` section explaining what was done, so the submitter sees the
  answer. Never close an item without replying. Write the reply in BOTH
  English and Vietnamese (a short English paragraph and a short Vietnamese
  paragraph) so everyone can read it.
- Never modify or "fix" files with `status: closed`.
