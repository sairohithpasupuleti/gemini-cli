# Gemini CLI Setup Notes

This document captures the practical setup and workflow notes for contributing
to Gemini CLI from a fork on macOS (Apple Silicon).

## Prerequisites

- macOS on Apple Silicon (M1/M2/M3).
- Homebrew for package management.
- `nvm` for Node version control.
- Node.js `20.19.0` (project-aligned).

Install baseline tooling:

```bash
brew install nvm git sox ffmpeg
nvm install 20.19.0
nvm use 20.19.0
```

Pin version in repo:

```bash
echo "20.19.0" > .nvmrc
```

## Repository Workflow

- Fork upstream repository.
- Clone your fork locally.
- Configure remotes:
  - `origin` -> your fork
  - `upstream` -> `https://github.com/google-gemini/gemini-cli.git`
- Work from feature branches, not `main`.

Example:

```bash
git remote add upstream https://github.com/google-gemini/gemini-cli.git
git fetch upstream
git checkout -b feat/voice-mode-scaffold
```

Sync feature branch before validation:

```bash
git checkout feat/voice-mode-scaffold
git rebase upstream/main
```

## Dependency Setup

Use lockfile-based install to match CI:

```bash
npm ci
```

Use this only when intentionally rebuilding from scratch:

```bash
rm -rf node_modules
npm ci
```

## Build and Validation

Recommended local validation sequence:

```bash
npm run build
npm run typecheck
npm run lint
npm run test:ci
npm run preflight
```

If checking CLI flags manually:

```bash
npm start -- --help
npm start -- --voice
```

## Voice Scaffold Notes

Current scaffold is intentionally text-first:

- `--voice` activates experimental voice mode.
- Input loop is text-based placeholder.
- Native microphone/audio streaming is planned for follow-up PRs.

Current voice module location:

```text
packages/cli/src/voice/
```

## Git and PR Workflow

Use a focused commit history:

```bash
git status
git diff upstream/main...HEAD
git push origin feat/voice-mode-scaffold
```

Open PR from fork branch to upstream `main`.

## Current PR/Issue References

- PR: `https://github.com/google-gemini/gemini-cli/pull/21110`
- PR: `https://github.com/google-gemini/gemini-cli/pull/21532`
- Issue: `https://github.com/google-gemini/gemini-cli/issues/21252`

## Notes

- Keep diffs minimal and scoped.
- Avoid unrelated formatting churn.
- Do not modify `.npmrc`, `.vscode`, or lockfiles unless required.

## Deprecated Example (kept for historical context)

```bash
git checkout -b feat/voice-audio-input
```
