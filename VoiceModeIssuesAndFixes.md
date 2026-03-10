# Gemini CLI Voice Mode: Issues Faced and Fixes Applied

## Scope

This document captures the issues encountered while implementing and validating
experimental `--voice` mode in Gemini CLI, and the fixes applied.

## 1) TypeScript flag/config breakages

Issue:

- `CliArgs` / config changes introduced `voice` but tests/mocks did not include
  it.
- Build failed with missing property errors.

Fix:

- Updated CLI test mocks and typed argument objects to include `voice` where
  required.
- Kept `voiceMode` as a typed boolean in CLI config.

## 2) Vitest mock hoisting failure

Issue:

- `voiceSession.test.ts` failed with: "Cannot access 'mockRunNonInteractive'
  before initialization".
- Cause: top-level mock variable referenced in hoisted `vi.mock` factory.

Fix:

- Refactored mocks to factory-local `vi.fn()` or used `vi.mocked(...)` after
  import.
- Removed unsafe top-level references used by hoisted mocks.

## 3) Readline stdout conflict

Issue:

- `readline.createInterface({ input, output })` interfered with CLI output
  streaming.

Fix:

- Removed `output` from readline interface for voice mode where required.
- Let existing CLI output flow control stdout.

## 4) Prompt-construction safety (injection risk)

Issue:

- Voice prompt helper concatenated system instruction + raw user text into one
  string.

Fix:

- Separated prompt into structured fields (system/user) and avoided direct
  concatenation of untrusted input with instruction text.
- Added security rationale comments in prompt builder.

## 5) Lint script fragility in monorepo

Issue:

- Lint script enumerated specific package paths; fragile when packages change.

Fix:

- Switched to scalable glob pattern:
  - `eslint packages/*/src integration-tests scripts --cache`

## 6) Environment and launch confusion

Issue:

- Running commands outside repo root caused ENOENT (`package.json` missing).
- API key was set in shell variable format without export or wrong process
  scope.

Fix:

- Always run npm scripts from repo root.
- Use exported env vars or inline command vars for launch.

## 7) Voice mode started but no transcript/response

Issue:

- Session initialized mic + websocket, but no useful model output path.

Fix:

- Added focused debug tracing behind `GEMINI_VOICE_DEBUG=true` in
  microphone/session/live client.
- Logged key lifecycle events: mic init, first chunk, websocket open/close,
  message metadata.

## 8) `node-record-lpcm16` runtime mismatch

Issue:

- Runtime error: recorder API shape mismatch depending on module export form.

Fix:

- Added guarded factory resolution for recorder object/default export.
- Improved microphone error logging.
- Forced recorder options to stable format for macOS path (including SoX use
  where needed).

## 9) TypeScript env index-signature errors

Issue:

- TS4111 errors from `process.env.GOOGLE_API_KEY` /
  `process.env.GEMINI_API_KEY`.

Fix:

- Replaced dot access with bracket access:
  - `process.env['GOOGLE_API_KEY']`
  - `process.env['GEMINI_API_KEY']`

## 10) Gemini Live model incompatibility (1008 close)

Issue:

- WebSocket closed with code 1008 and reason that selected model was not
  found/supported for `bidiGenerateContent` API version.

Fix:

- Made voice model and API version configurable:
  - `GEMINI_VOICE_MODEL`
  - `GEMINI_VOICE_API_VERSION`
- Updated defaults toward Live-compatible model selection and v1beta.
- Added model-id normalization (`models/` prefix handling).
- Improved runtime hint text when close happens.

## 11) Branch/rebase/workflow issues

Issue:

- Multiple branches with overlapping work caused confusion on which branch had
  latest fixes.

Fix:

- Consolidated fixes via explicit commits and created dedicated branch for Live
  voice debug integration.
- Verified clean status before branch moves/commits.

## 12) Documentation drift

Issue:

- Voice flag docs and reference pages lagged behind behavior changes.

Fix:

- Updated CLI docs to mark `--voice` experimental and clearly state placeholder
  behavior/current limitations.
- Added roadmap linkage note for future native audio work.

## 13) Security hygiene

Issue:

- API keys were printed/shared in terminal logs during debugging.

Fix:

- Advised key rotation/revocation and avoiding plaintext key sharing.
- Kept debug logs focused on state/events, not secret output.

## Current known limitation

- Even with correct mic stream and WebSocket connection, effective voice
  experience depends on availability/access for the selected Gemini Live model
  in the account/project.
- If the model is unavailable, the session closes with a server reason (code
  1008).

## Recommended run command for debugging

```bash
GEMINI_VOICE_DEBUG=true \
GEMINI_VOICE_API_VERSION=v1beta \
GEMINI_VOICE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025 \
npm start -- --voice
```
