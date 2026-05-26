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
- Docker, only when running the native OpenSCAD render service locally

Install dependencies:

```bash
pnpm install
```

## Local UI Development

Run the app with browser OpenSCAD WASM only:

```bash
NATIVE_RENDER_DISABLED=1 pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

This is the simplest mode for UI work. It exercises the app shell, generators, parameter panels, previews, local state, and browser rendering fallback without requiring the native render service.

## Local Backend Development

Run the native render service:

```bash
RENDER_AUTH_TOKEN=dev-secret pnpm render-service:dev
```

In another terminal, run the Next.js app against that service:

```bash
NATIVE_RENDER_URL=http://localhost:8080 \
NATIVE_RENDER_TOKEN=dev-secret \
pnpm dev
```

The native service exposes:

- `GET /healthz` for health and queue state
- `POST /v1/render` for authenticated OpenSCAD renders

You can also build and run the render service with Docker:

```bash
docker build -f render-service/Dockerfile -t gridfinity-render-service .
docker run --rm -p 8080:8080 -e RENDER_AUTH_TOKEN=dev-secret gridfinity-render-service
```

## Common Commands

```bash
pnpm dev
pnpm lint
pnpm build
pnpm test:e2e
pnpm test:e2e:ui
pnpm render-service:dev
```

Use `pnpm test:e2e` for browser-level regression coverage. Use `pnpm test:e2e:ui` when debugging a Playwright flow interactively.

## Project Boundaries

- `src/app/` is for Next.js route entrypoints, layouts, metadata, global CSS, and API route files.
- `src/ui/` owns browser-facing code: the shell, tools, workers, analytics, and shared UI components.
- `src/ui/apps/<app-name>/` owns app-specific UI, state, helpers, and types.
- `src/ui/shell/appRegistry.ts` is the source of truth for tools shown in the shell.
- `src/server/` owns server-only code used by API routes.
- `src/shared/` contains code safe to import from both server and browser code.
- `render-service/` contains the standalone native OpenSCAD render service.
- `tests/e2e/` contains Playwright tests.

## Adding Or Changing A Tool

Work inside `src/ui/apps/<app-name>/` unless the change needs shared behavior. Register new tools in `src/ui/shell/appRegistry.ts`.

For OpenSCAD-backed generators, keep parameter normalization, browser defines, server cache definitions, and render-service model IDs aligned. The Architecture doc explains the data flow at a higher level: [docs/ARCHITECTURE.md](ARCHITECTURE.md).

## Environment Variables

Native rendering:

```bash
NATIVE_RENDER_URL=http://localhost:8080
NATIVE_RENDER_TOKEN=dev-secret
NATIVE_RENDER_DISABLED=1
```

Render service:

```bash
RENDER_AUTH_TOKEN=dev-secret
RENDER_MAX_CONCURRENCY=1
RENDER_MAX_QUEUE_LENGTH=10
RENDER_TIMEOUT_MS=120000
OPENSCAD_BIN=/usr/bin/openscad
OPENSCAD_ENABLE_TEXTMETRICS=0
```

Cloudflare R2 model cache:

```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```
