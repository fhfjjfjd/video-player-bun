# Release & GitHub Rules

How the project is pushed and released.

## Trigger

1. After every successful build (`npm run build` passes), the source code MUST be pushed to GitHub and a release MUST be created.

## Correct Remote

1. The only allowed remote URL is `https://github.com/fhfjjfjd/video-player-node.git` (origin).
2. Before pushing, verify with `git remote -v`. NEVER push to any other URL.

## Tag

1. The release tag must match the exact version in `package.json` (prefixed with `v`, e.g. `v1.6.2`).

## Release Notes

1. Include the `CHANGELOG.md` entry for that version in the release description.

## No Skipping

1. Do not skip the release even for small fixes.

## Order

1. Always: build passes → commit → push → create release (`gh release create vX.Y.Z`).

## Unconfigured

1. If Git/GitHub is not configured, ask the user for the repository URL and authentication before the first release.
2. Never guess credentials.
