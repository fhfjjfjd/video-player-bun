# Versioning & Changelog Rules

How every change is versioned and documented.

## Semantic Versioning

1. Every code change must bump the version in `package.json`:
   - Bugfix → patch bump (`1.1.1` → `1.1.2`)
   - New feature → minor bump (`1.1.2` → `1.2.0`)
   - Breaking change → major bump (`1.x` → `2.0.0`)

## One Level Only

1. Bump exactly one level per change. Never skip levels or bump multiple in a single change.

## Changelog

1. Every version bump MUST be recorded in `CHANGELOG.md` at the top.
2. Header with the exact new version.
3. A bullet list describing each concrete change (what, where, why).

## README Sync

1. Update `README.md` whenever commands, setup, or architecture change.
2. Keep both the English and Vietnamese versions in sync.

## Report

1. Always tell the user: the new version number and the list of changes.

## Docs-only Changes

1. Documentation-only edits (`.md` files) do not require a version bump unless they describe a release.
2. Code changes always require a version bump.
