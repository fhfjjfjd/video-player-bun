# Security Rules

These are the mandatory security rules. Read before touching anything that handles user data, authentication, uploads, or secrets.

## Secrets

1. NEVER store, log, print, or return plaintext passwords, API keys, tokens, cookies, or session data.
2. Always hash passwords with a salt (e.g. `crypto.scryptSync`).
3. Never write secrets into source files. `.env` must stay untracked.

## Input Validation

1. Every user-controlled input must be validated before use: type, length, range, and allowed values.
2. Reject invalid input with a clear error; never trust the client.

## Authentication & Sessions

1. Protect sensitive routes with an auth guard.
2. Use HttpOnly, SameSite cookies.
3. Invalidate sessions on logout.
4. Never expose whether a username exists in error messages that could aid enumeration.

## File Uploads

1. Whitelist MIME types and file extensions.
2. Enforce a maximum size.
3. Do NOT convert or trust the original name for path construction — always store under a server-generated name.
4. Serve with a Content-Type derived from the file, never hardcoded.

## Path Safety

1. Never build filesystem paths from user input without sanitizing and resolving; prevent traversal (`../`, absolute paths).
2. Resolve and verify the path stays inside the intended directory.

## Error Disclosure

1. Return generic error messages to the client; log details server-side only.
2. Do not leak stack traces, SQL, or internal paths.

## Execution

1. Never execute user-supplied code or shell commands derived from user input.

## Least Privilege

1. Grant the minimal permissions needed.
2. Do not read or modify files/data outside the requested scope.

## Dependencies

1. Do not add dependencies unless necessary; verify the package is trustworthy before installing.
