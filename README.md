# Gridfinity Center

A React + Next.js hub for Gridfinity tools, generators, model previews, labels, and generator workflows.

## Stack

- Next.js App Router
- React
- TypeScript
- CSS Modules
- pnpm
- Vercel-ready static/serverless deployment

## Local Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
pnpm lint
pnpm build
```

## R2 Model Cache

The bin generator can use Cloudflare R2 as a shared STL cache. Generated models are stored under a folder derived from the bundled OpenSCAD source fingerprint:

```txt
models/gridfinity-basic-cup/source-{sourceFingerprint}/{settingsHash}.stl
```

Configure these environment variables to enable the cache:

```bash
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

The browser first tries to upload generated STLs directly to presigned R2 URLs, then falls back to the Next API if browser CORS blocks the direct upload. Configure the R2 bucket CORS policy to allow `GET` and `PUT` from the app origin for the direct upload path.

## Initial Product Direction

The first homepage lays out the core modules this project can grow into:

- Gridfinity box and bin generator
- Grid/baseplate generator
- OpenSCAD generation bridge
- Gridfinity label generator
- Model and preset library
- STL/3MF previewing roadmap
