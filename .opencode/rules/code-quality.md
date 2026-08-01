# Code Quality Rules

Mandatory standards for every code change.

## Simplicity

1. Write the simplest solution that works.
2. Prefer small, focused files and functions. Do not over-engineer.

## Reuse

1. Before writing something new, search the existing codebase.
2. Reuse existing functions, patterns, and utilities. Never duplicate logic.

## Consistency

1. Follow the existing structure, naming, and style of the project.
2. Match neighboring code.

## Comments

1. Do NOT add comments unless explicitly requested.
2. If a comment is needed, keep it meaningful and in the project's language.

## Dependencies

1. Do not add libraries unless truly necessary.
2. Prefer built-in platform features.

## Error Handling

1. Catch every error path.
2. Return clear, user-friendly messages.
3. Never swallow errors silently; never leave unhandled rejections.

## Validation

1. Validate all inputs at the boundary.
2. Fail fast with clear messages.

## Scope

1. Keep changes small and focused.
2. Never bundle unrelated changes.
3. Never touch files outside the requested scope.

## Type Safety

1. In TypeScript, avoid `any` where a real type is possible.
2. Keep strict mode on. Do not suppress compiler errors.

## Cleanliness

1. Remove dead code, unused imports, and debug statements before handing over.
2. No leftover temporary files.
