# Architecture

Gridfinity Center is a single Next.js app that hosts multiple tools inside one product shell. The codebase is intentionally organized by runtime boundary first, then by app/tool ownership.

## High-Level Structure

```txt
src/app/       Next.js pages, layouts, metadata, and API route entrypoints
src/ui/        Browser-facing shell, apps, workers, analytics, and UI primitives
src/server/    Server-only slicer handoff and R2 signing code
src/shared/    Types, constants, and pure helpers safe for server and browser imports
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
-> useOpenScadModel renders in a browser worker and handles downloads
-> model preview displays the generated STL with Three.js
```

Models render only in the browser, with the official OpenSCAD WebAssembly build vendored in `public/openscad-wasm/` (see `SOURCES.md` there). It uses the Manifold backend and writes binary STL.

`src/ui/openscad.worker.ts` and `src/ui/openscadClient.ts` load the bundled Gridfinity Extended OpenSCAD files from `public/openscad/gridfinity_extended_openscad`, write them into the OpenSCAD WASM filesystem, apply `-D` defines, and return STL bytes to the UI. Download STL saves those bytes directly.

## Slicer Handoff

Slicers' "open" links need an HTTPS URL to download from, so "Open In OrcaSlicer" and "Open In Bambu Slicer" briefly hand the previewed STL to the server through Cloudflare R2. PrusaSlicer is not offered because it only downloads from Printables and Thingiverse.

```txt
POST /api/slicer-handoff { size, fileName }
-> validate the size is a binary STL under the cap
-> return a 5 minute R2 upload URL for handoff/<random-id>.stl, signed for exactly that Content-Length
-> return /api/slicer-handoff/<random-id>/<fileName> as the download URL
Browser PUTs the STL straight to R2, then opens orcaslicer://open?file=<download URL>
GET /api/slicer-handoff/:id/:fileName
-> 410 unless the object exists and was uploaded under 5 minutes ago
-> read it, then delete it, so every link works once
-> 422 unless it is an OpenSCAD binary STL (header, exact size, finite in-range floats)
-> return the bytes as an attachment
```

`HEAD` on the download URL checks the handoff without using it up. The route lives in `src/app/api/slicer-handoff/`, and the logic and STL checks in `src/server/slicerHandoff/`. The bucket stays private: the browser can only write one object per signed URL, and only the download route reads objects back.

If the upload takes longer than a few seconds, the browser may no longer let the page open another app, so the output button switches to "Click To Open In ..." instead of opening the slicer itself.

### R2 Setup

- Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`. Without them the slicer buttons show an error and downloads still work.
- Add an object lifecycle rule that deletes `handoff/` objects after 1 day, for uploads that were never opened.
- Add a CORS rule allowing `PUT` from the app's origins.
- Optionally add a Vercel Firewall rate limit rule on `POST /api/slicer-handoff`.

## Adding A New OpenSCAD-Backed Generator

A new generator usually needs changes in these places:

- `src/ui/apps/<new-app>/` for controls, state, labels, and the tool component
- `src/ui/shell/appRegistry.ts` to register the app in the shell
- `src/shared/` for parameter types, constants, and OpenSCAD define helpers shared by browser and server code
- `tests/e2e/` for focused browser coverage when the change affects navigation or user-visible behavior

Keep app-specific behavior inside the app folder. Promote code into shared UI primitives or `src/shared/` only after there is a concrete second use.

## Frontend Design Principles

The UI is a tool workspace, not a marketing site. Screens should prioritize scanning, parameter editing, preview confidence, and fast output actions.

Use app-local CSS Modules for tool-specific layout and styling. Use `src/ui/components/ui/` only for app-neutral primitives that more than one tool needs. Keep route files thin and avoid putting generator-specific behavior in the shell.

## Deployment Shape

The Next.js app deploys as a single app (on Vercel, or with the root `Dockerfile`). Rendering happens in the browser, so the server only signs and serves slicer handoffs, which need Cloudflare R2.
