# Workflow & Handover Rules

The process for every task, from start to handover.

## Understand First

1. Read the relevant files and understand the scope before changing anything.

## Ask, Don't Guess

1. If any information is missing or ambiguous, ask the user first. Never guess.

## Verification

1. After finishing edits, run `npm run build`. If it fails, fix it until it passes.
2. Only hand over green builds.

## Never Run the App

1. Only run `npm run build`. NEVER start the server (`npm start`, `npm run dev`) and never run additional tests. The user runs the app.

## Self-Review

1. Review your full diff before handing over.
2. Check for: scope creep, secrets, dead code, broken references, docs sync.

## Report

1. Hand over with a concise report: what was done, the new version, what changed, and what is left for the user to do.

## Rules Compliance

1. After every change, check compliance: version bumped (if code), CHANGELOG updated, README synced (if needed).
