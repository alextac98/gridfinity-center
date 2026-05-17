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

Run the native OpenSCAD render service in Docker, then point the Next.js app at
it:

```bash
pnpm install
docker build -f render-service/Dockerfile -t gridfinity-render-service .
docker run --rm -p 8080:8080 -e RENDER_AUTH_TOKEN=dev-secret gridfinity-render-service
```

In a second terminal:

```bash
NATIVE_RENDER_URL=http://localhost:8080 \
NATIVE_RENDER_TOKEN=dev-secret \
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Use browser WASM only:

```bash
NATIVE_RENDER_DISABLED=1 pnpm dev
```

## Verification

```bash
pnpm lint
pnpm build
```

## Native OpenSCAD Rendering

Browser-based OpenSCAD wasm is much slower than native OpenSCAD for larger
models. The Next.js app does not run a local OpenSCAD binary; it calls the
Docker render service when `NATIVE_RENDER_URL` is configured. Browser WASM
remains the fallback when the service is disabled or unavailable.

For production, run native OpenSCAD in the Docker render service and point the
Next.js app at it:

```bash
NATIVE_RENDER_URL=https://render.example.com
NATIVE_RENDER_TOKEN=
```

Disable native rendering from the Next.js API layer:

```bash
NATIVE_RENDER_DISABLED=1 pnpm dev
```

Run the render service locally:

```bash
RENDER_AUTH_TOKEN=dev-secret pnpm render-service:dev
NATIVE_RENDER_URL=http://localhost:8080 NATIVE_RENDER_TOKEN=dev-secret pnpm dev
```

Build and run the Docker service:

```bash
docker build -f render-service/Dockerfile -t gridfinity-render-service .
docker run --rm -p 8080:8080 -e RENDER_AUTH_TOKEN=dev-secret gridfinity-render-service
```

The Docker image uses `openscad/openscad:dev` because Debian's packaged
OpenSCAD is currently too old for the bundled Gridfinity source syntax.
Set `OPENSCAD_ENABLE_TEXTMETRICS=0` only if you replace the base image with an
OpenSCAD build that does not support `--enable=textmetrics`.

## Render Service Deployment

The render service is built and deployed by
`.github/workflows/render-service.yml`.

- Pull requests build the Docker image but do not push or deploy.
- Pushes to `main` that touch render-service inputs build, push to GHCR, and
  deploy production.
- Manual workflow runs build, push to GHCR, and deploy preview from the selected
  branch.

The image is published to:

```txt
ghcr.io/<github-owner>/gridfinity-render-service:<commit-sha>
ghcr.io/<github-owner>/gridfinity-render-service:latest
```

Create GitHub Environments named `Preview` and `Production`. Add these
environment secrets to each:

```bash
RENDER_AUTH_TOKEN=      # shared secret expected by the render service
RENDER_DEPLOY_PATH=     # remote folder, e.g. /opt/gridfinity-render
RENDER_HOST=            # render service hostname, e.g. render.example.com
RENDER_SSH_KEY=         # private SSH key for deployment
RENDER_USER=            # SSH user
```

Pushes to `main` deploy with the `Production` environment. Manual workflow runs
deploy with the `Preview` environment, so both environments need their own
values before those deploy modes will work.

Optional environment variables:

```bash
RENDER_MAX_CONCURRENCY=1
RENDER_MAX_QUEUE_LENGTH=10
RENDER_TIMEOUT_MS=120000
```

Deployment assumes the VPS already runs `nginxproxy/nginx-proxy` with
`acme-companion` on an external Docker network named `nginx-proxy`. The render
service joins that network, advertises `RENDER_HOST` through `VIRTUAL_HOST` and
`LETSENCRYPT_HOST`, and exposes container port `8080` only to the proxy. DNS for
`RENDER_HOST` should point at the VPS, and the deploy workflow also uses that
host for SSH.

The deploy job copies `render-service/docker-compose.deploy.yml` to the VPS,
writes an `.env` file with the selected image tag, pulls the public GHCR image,
starts the service, prunes old images, and checks `/healthz`.

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
