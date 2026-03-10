# Important Points To Consider

## npm and Dependency Hygiene

- Do not log into npm unless publishing packages.
- Avoid private registry overrides in global npm config.
- Prefer `npm ci` when `package-lock.json` exists.
- Do not run `npm install` as a replacement for CI parity checks.
- If install fails, fix lockfile/dependency issues and rerun `npm ci`.

## API Key Setup

Use an exported environment variable so child processes can access it.

Correct:

```bash
export GEMINI_API_KEY="PASTE_YOUR_KEY_HERE"
```

Common mistakes:

- `export GEMINI_API_KEY = value` (invalid spacing around `=`)
- `GEMINI_API_KEY=value` without `export` (not inherited by child processes)
- Missing quotes when values contain special characters

## Common Command Pitfalls

- `npm run ci` is not a valid script in this repo. Use `npm ci`.
- Run commands from repo root (the directory containing `package.json`).
- After rebases, rerun typecheck/lint before preflight.

## Branch and Rebase Hygiene

- Keep `upstream` remote configured and up to date.
- Rebase feature branches on `upstream/main` before opening PR.
- Resolve conflicts without dropping upstream changes.
- Recheck `git diff upstream/main...HEAD` for unintended file changes.

## macOS Microphone Permissions (Voice Work)

If voice capture is being developed/tested, ensure both apps are enabled:

- Terminal
- Visual Studio Code

Path:

- `System Settings -> Privacy & Security -> Microphone`

Without permission, microphone capture may fail silently.

## Lint and Formatting Expectations

- Warnings may appear from existing code outside your changes; do not mask them.
- Keep your modified files lint-clean.
- Run formatter only when needed and avoid repo-wide churn in unrelated files.

## Scope Guardrails for Voice Scaffold

- Keep new voice code under `packages/cli/src/voice/`.
- Do not modify `packages/core` for scaffold-only PRs.
- Avoid adding dependencies for early scaffold steps.
- Keep behavior explicit and testable with small pure functions where possible.
