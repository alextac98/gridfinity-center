# Contributing

This project is one Next.js app that hosts multiple Gridfinity tools. Keep changes small, verify the behavior you touched, and prefer working inside the relevant app folder.

## GitHub Contribution Process

1. Open an issue or discussion for large changes before writing a broad patch.
2. Create a branch for the work.
3. Keep the pull request focused on one fix, feature, or documentation update.
4. Include screenshots or short screen recordings for user-facing UI changes when useful.
5. Run the relevant verification before requesting review.
6. Call out any skipped checks, known limitations, or follow-up work in the pull request description.

Pull requests should describe:

- what changed
- why it changed
- how it was verified
- any compatibility, deployment, or migration concerns

## Requirements

- Node.js compatible with the checked-in Next.js version
- pnpm
- Docker, only when building the production image locally

Install dependencies:

```bash
pnpm install
```

## Local UI Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Models render in the browser with OpenSCAD WASM; no other service is needed. The "Open In" slicer buttons also need the R2 variables below.

## Docker

The root `Dockerfile` builds the Next.js app as a standalone production image. Pass the commit SHA explicitly, since `.git` is excluded from the build context:

```bash
docker build --build-arg GRIDFINITY_COMMIT_SHA="$(git rev-parse HEAD)" -t gridfinity-center .
docker run --rm -p 3000:3000 gridfinity-center
```

`NEXT_PUBLIC_*` values are inlined at build time, so pass `NEXT_PUBLIC_POSTHOG_KEY` as a build arg rather than a runtime variable.

Or use the compose file:

```bash
GRIDFINITY_COMMIT_SHA="$(git rev-parse HEAD)" docker compose up --build
```

The app is served on [http://localhost:3000](http://localhost:3000). Set `WEB_PORT` to publish the app on a different host port, and export the `R2_*` variables to exercise the slicer handoff. The compose file is for testing only, not deployment.

## Common Commands

```bash
pnpm dev
pnpm lint
pnpm build
pnpm test:e2e
pnpm test:e2e:ui
```

Use `pnpm test:e2e` for browser-level regression coverage. Use `pnpm test:e2e:ui` when debugging a Playwright flow interactively.

## Project Boundaries

- `src/app/` is for Next.js route entrypoints, layouts, metadata, global CSS, and API route files.
- `src/ui/` owns browser-facing code: the shell, tools, workers, analytics, and shared UI components.
- `src/ui/apps/<app-name>/` owns app-specific UI, state, helpers, and types.
- `src/ui/shell/appRegistry.ts` is the source of truth for tools shown in the shell.
- `src/server/` owns server-only code used by API routes.
- `src/shared/` contains code safe to import from both server and browser code.
- `tests/e2e/` contains Playwright tests.

## Adding Or Changing A Tool

Work inside `src/ui/apps/<app-name>/` unless the change needs shared behavior. Register new tools in `src/ui/shell/appRegistry.ts`.

For OpenSCAD-backed generators, keep parameter normalization and browser defines aligned. The Architecture doc explains the data flow at a higher level: [docs/ARCHITECTURE.md](ARCHITECTURE.md).

## Environment Variables

Cloudflare R2, for the slicer handoff (see the Slicer Handoff section of ARCHITECTURE.md for bucket setup):

```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```
