# Architecture

Gridfinity Center is a single Next.js app that hosts multiple tools inside one product shell. The codebase is intentionally organized by runtime boundary first, then by app/tool ownership.

## High-Level Structure

```txt
src/app/       Next.js pages, layouts, metadata, and API route entrypoints
src/ui/        Browser-facing shell, apps, workers, analytics, and UI primitives
src/server/    Server-only model rendering, cache, signing, and fingerprint code
src/shared/    Types, constants, and pure helpers safe for server and browser imports
render-service Optional standalone native OpenSCAD HTTP service
public/        Static assets and bundled OpenSCAD source
tests/e2e/     Playwright browser tests
```

The app registry in `src/ui/shell/appRegistry.ts` is the shell's source of truth for available tools. Each registered tool points to a component under `src/ui/apps/<app-name>/`.

## Frontend App Flow

At runtime, the shell renders the selected tool based on the route:

```txt
Next route -> app registry -> tool component -> app-specific controls and preview
```

OpenSCAD-backed tools follow the same broad pattern:

```txt
User changes parameters
-> tool builds normalized parameter state
-> shared OpenSCAD generator shell renders controls, preview, and output actions
-> useOpenScadModel decides how to render or download
-> model preview displays the generated STL with Three.js
```

Both server and browser rendering use the official OpenSCAD WebAssembly build vendored in `public/openscad-wasm/` (see `SOURCES.md` there). It uses the Manifold backend and writes binary STL.

The browser path uses `src/ui/openscad.worker.ts` and `src/ui/openscadClient.ts`. The worker loads the bundled Gridfinity Extended OpenSCAD files from `public/openscad/gridfinity_extended_openscad`, writes them into the OpenSCAD WASM filesystem, applies `-D` defines, and returns STL bytes to the UI. It is the fallback when the server responds with 503 or the request fails.

## API Design

API route files live under `src/app/api/openscad-models/[modelId]/...` and stay thin. They delegate model validation, cache key creation, rendering, and R2 signing to `src/server/`.

The main model request flow is:

```txt
POST /api/openscad-models/:modelId/model
-> validate modelId and params
-> compute source fingerprint
-> compute canonical settings hash
-> try R2 cache if configured
   (with R2_PUBLIC_BASE_URL set, a hit is a 303 redirect to the public bucket URL)
-> render on cache miss (server WASM, or the native service when NATIVE_RENDER_URL is set)
-> return STL bytes plus cache/render headers
-> upload rendered STL to R2 after the response is sent
```

## Server WASM Rendering

`src/server/openscad/wasmRenderer.ts` compiles `public/openscad-wasm/openscad.wasm` once per server instance, then runs each render in a fresh worker thread (`wasmRenderWorker.mjs`). Workers keep long renders off the event loop, are terminated after a 120 second timeout, and release their WASM memory when they exit. `next.config.ts` adds these files to the API routes' output file tracing so they are deployed with the functions.

Related routes expose cached object access and model URLs for download behavior. Server code validates cache object keys before signing or proxying cache objects.

## Native Render Service

The optional native render service in `render-service/server.mjs` is a small Node HTTP service around the OpenSCAD CLI. The app uses it instead of server WASM only when `NATIVE_RENDER_URL` is set.

```txt
Next API
-> POST /v1/render with bearer token, modelId, entryFile, outputFileName, defines
-> render service validates the request against known models
-> render service queues work based on concurrency settings
-> OpenSCAD CLI writes an STL into a temporary directory
-> service returns STL bytes and render timing headers
```

The service intentionally accepts only known model IDs and matching entry/output files. That keeps the HTTP API narrow: the Next app owns parameter validation and model definitions, while the render service owns authenticated native rendering and queue control.

## R2 Cache Flow

The cache key is derived from:

- the cache model name
- a fingerprint of the bundled OpenSCAD source
- a stable hash of canonicalized model settings

The resulting object key has this shape:

```txt
models/<cache-model>/source-<source-fingerprint>/<settings-hash>.stl
```

Because the source fingerprint is part of the path, changing bundled OpenSCAD source naturally creates a new cache namespace. Existing cached files can remain in R2 without being served for newer source revisions.

The browser does not upload directly to R2. It asks the Next API for a model, and the server handles cache reads, rendering, cache uploads, and signed object access.

Uploaded objects get `Cache-Control: public, max-age=31536000, immutable`, because a key's contents never change. To serve cache hits from Cloudflare's CDN instead of through the app, connect a custom domain to the bucket and set `R2_PUBLIC_BASE_URL` to it. The bucket also needs a CORS policy that allows `GET` from the app's origin, because the browser follows the redirect with `fetch`. Slicer links and the preview then use the public URL directly. If the redirect fetch fails, the client falls back to browser rendering.

## Adding A New OpenSCAD-Backed Generator

A new generator usually needs changes in these places:

- `src/ui/apps/<new-app>/` for controls, state, labels, and the tool component
- `src/ui/shell/appRegistry.ts` to register the app in the shell
- `src/shared/` for parameter types, constants, and OpenSCAD define helpers shared by browser and server code
- `src/server/openscad/` for cache model definitions and server-side parameter validation
- `render-service/server.mjs` if the native service needs to recognize a new model ID
- `tests/e2e/` for focused browser coverage when the change affects navigation or user-visible behavior

Keep app-specific behavior inside the app folder. Promote code into shared UI primitives or `src/shared/` only after there is a concrete second use.

## Frontend Design Principles

The UI is a tool workspace, not a marketing site. Screens should prioritize scanning, parameter editing, preview confidence, and fast output actions.

Use app-local CSS Modules for tool-specific layout and styling. Use `src/ui/components/ui/` only for app-neutral primitives that more than one tool needs. Keep route files thin and avoid putting generator-specific behavior in the shell.

## Deployment Shape

The Next.js app renders models itself with server WASM, so it needs no separate render service. Production deployments can add:

- the native render service, by setting `NATIVE_RENDER_URL`
- Cloudflare R2 for shared STL caching
- the render-service GitHub workflow for Docker image publishing and VPS deployment
