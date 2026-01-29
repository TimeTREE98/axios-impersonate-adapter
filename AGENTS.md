# AGENTS.md

## Project overview

- Axios adapter that shells out to `curl-impersonate` to mimic browser TLS/HTTP fingerprints.
- Core logic lives in `src/adapter.ts`; it builds curl args, merges headers, and spawns `bin/curl-impersonate`.
- Header parsing helpers are in `src/utils/headers.ts`.
- Axios config augmentation is in `src/types.ts`.
- `src/impersonate.ts` is generated and contains profile defaults.

## Repo layout

- `src/`: TypeScript source
- `test/`: Jest tests
- `scripts/`: maintenance scripts

## Setup commands

- Install deps: `pnpm install` (runs postinstall to download the binary)
- Build: `pnpm build`
- Lint: `pnpm lint`
- Format: `pnpm format`
- Test: `pnpm test`

## Generated files

- Do not hand-edit `src/impersonate.ts`.
- Regenerate profiles: `node scripts/generate-impersonates.js` (requires `curl-impersonate/bin` from the submodule).

## Code style

- Functions use `const` with arrow syntax.

## Submodule and binary notes

- Sync submodule revision: `node scripts/prepare-submodule.js`.
- The installer downloads a GitHub release asset into `bin/` on install.
- Relevant env vars for the installer: `CURL_IMPERSONATE_VERSION`, `CURL_IMPERSONATE_LIBC`, `GITHUB_TOKEN` or `GH_TOKEN`.

## Testing notes

- Jest tests mock `child_process.spawn`; no real network calls.
- When changing request/response handling, update `test/adapter.test.ts` and `test/headers.test.ts`.
