import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

function parsePositiveInteger(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value, fallback) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const port = parsePositiveInteger(process.env.PORT, 8080);
const authToken = process.env.RENDER_AUTH_TOKEN?.trim() ?? "";
const openScadBin = process.env.OPENSCAD_BIN?.trim() || "/usr/bin/openscad";
const maxConcurrency = parsePositiveInteger(process.env.RENDER_MAX_CONCURRENCY, 1);
const maxQueueLength = parseNonNegativeInteger(
  process.env.RENDER_MAX_QUEUE_LENGTH,
  10,
);
const renderTimeoutMs = Math.max(
  1_000,
  parsePositiveInteger(process.env.RENDER_TIMEOUT_MS, 120_000),
);
const enableTextMetrics = process.env.OPENSCAD_ENABLE_TEXTMETRICS === "1";
const maxBodyBytes = Math.max(
  1_024,
  parsePositiveInteger(process.env.RENDER_MAX_BODY_BYTES, 1_048_576),
);
const tmpRoot = process.env.RENDER_TMP_DIR?.trim() || tmpdir();
const sourceRoot = path.resolve(
  process.env.OPENSCAD_SOURCE_ROOT?.trim() ||
    path.join(process.cwd(), "public", "openscad", "gridfinity_extended_openscad"),
);

const models = {
  "bin-generator": {
    entryFile: "gridfinity_basic_cup.scad",
    outputFileName: "gridfinity-bin.stl",
  },
  "grid-generator": {
    entryFile: "gridfinity_baseplate.scad",
    outputFileName: "gridfinity-baseplate.stl",
  },
};

let activeRenders = 0;
const renderQueue = [];

function writeJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    request.on("data", (chunk) => {
      size += chunk.byteLength;

      if (size > maxBodyBytes) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function isDefineValue(value) {
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  return Array.isArray(value) && value.every(isDefineValue);
}

function formatScadValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(formatScadValue).join(", ")}]`;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "0";
  }

  return JSON.stringify(value);
}

function validateRenderRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Request body must be an object." };
  }

  const model = models[value.modelId];

  if (!model) {
    return { ok: false, error: "Unknown modelId." };
  }

  if (value.entryFile !== model.entryFile) {
    return { ok: false, error: "entryFile does not match modelId." };
  }

  if (value.outputFileName !== model.outputFileName) {
    return { ok: false, error: "outputFileName does not match modelId." };
  }

  if (
    !value.defines ||
    typeof value.defines !== "object" ||
    Array.isArray(value.defines) ||
    !Object.values(value.defines).every(isDefineValue)
  ) {
    return { ok: false, error: "defines must contain valid OpenSCAD values." };
  }

  return {
    ok: true,
    request: {
      requestId:
        typeof value.requestId === "string" && value.requestId
          ? value.requestId
          : randomUUID(),
      modelId: value.modelId,
      entryFile: value.entryFile,
      outputFileName: value.outputFileName,
      defines: value.defines,
      sourceFingerprint:
        typeof value.sourceFingerprint === "string" ? value.sourceFingerprint : "",
    },
  };
}

async function enqueueRender(task) {
  if (activeRenders < maxConcurrency) {
    activeRenders += 1;
    const result = await task().finally(() => {
      activeRenders -= 1;
      const next = renderQueue.shift();
      if (next) {
        void next();
      }
    });

    return { ok: true, result };
  }

  if (renderQueue.length >= maxQueueLength) {
    return {
      ok: false,
      queue: {
        active: activeRenders,
        maxConcurrency,
        maxQueueLength,
        pending: renderQueue.length,
      },
    };
  }

  return new Promise((resolve, reject) => {
    renderQueue.push(() => {
      activeRenders += 1;
      return task()
        .then((result) => resolve({ ok: true, result }), reject)
        .finally(() => {
          activeRenders -= 1;
          const next = renderQueue.shift();
          if (next) {
            void next();
          }
        });
    });
  });
}

async function renderOpenScad(request) {
  const tempDir = await mkdtemp(path.join(tmpRoot, "gridfinity-openscad-"));
  const inputPath = path.join(sourceRoot, request.entryFile);
  const outputPath = path.join(tempDir, request.outputFileName);
  const defineArgs = Object.entries(request.defines).flatMap(([key, value]) => [
    "-D",
    `${key}=${formatScadValue(value)}`,
  ]);
  const startedAt = performance.now();

  try {
    await execFileAsync(
      openScadBin,
      [
        ...(enableTextMetrics ? ["--enable=textmetrics"] : []),
        ...defineArgs,
        inputPath,
        "-o",
        outputPath,
      ],
      {
        cwd: sourceRoot,
        maxBuffer: 1024 * 1024,
        timeout: renderTimeoutMs,
      },
    );

    const stl = await readFile(outputPath);
    return {
      durationMs: Math.round(performance.now() - startedAt),
      stl,
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function handleRender(request, response) {
  if (!authToken) {
    writeJson(response, 503, { error: "Render service auth is not configured." });
    return;
  }

  const authorization = request.headers.authorization ?? "";
  if (authorization !== `Bearer ${authToken}`) {
    writeJson(response, 401, { error: "Unauthorized." });
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(request));
  } catch (error) {
    writeJson(response, 400, {
      error: error instanceof Error ? error.message : "Invalid JSON body.",
    });
    return;
  }

  const validation = validateRenderRequest(body);
  if (!validation.ok) {
    writeJson(response, 400, { error: validation.error });
    return;
  }

  const renderRequest = validation.request;

  try {
    const queuedRender = await enqueueRender(() =>
      renderOpenScad(renderRequest),
    );

    if (!queuedRender.ok) {
      console.warn(
        JSON.stringify({
          modelId: renderRequest.modelId,
          queue: queuedRender.queue,
          requestId: renderRequest.requestId,
          sourceFingerprint: renderRequest.sourceFingerprint,
          status: "queue_full",
        }),
      );
      writeJson(response, 429, {
        error: "Render queue is full.",
        queue: queuedRender.queue,
      });
      return;
    }

    const { durationMs, stl } = queuedRender.result;

    console.info(
      JSON.stringify({
        durationMs,
        modelId: renderRequest.modelId,
        requestId: renderRequest.requestId,
        sourceFingerprint: renderRequest.sourceFingerprint,
        status: "success",
        stlBytes: stl.byteLength,
      }),
    );

    response.writeHead(200, {
      "Content-Disposition": `attachment; filename="${renderRequest.outputFileName}"`,
      "Content-Type": "model/stl",
      "X-Render-Duration-Ms": String(durationMs),
      "X-Render-Request-Id": renderRequest.requestId,
      "X-Render-Source": "native-openscad",
    });
    response.end(stl);
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown render error",
        modelId: renderRequest.modelId,
        requestId: renderRequest.requestId,
        sourceFingerprint: renderRequest.sourceFingerprint,
        status: "failed",
      }),
    );
    writeJson(response, 500, { error: "OpenSCAD render failed." });
  }
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    writeJson(response, 200, {
      ok: true,
      openscad: {
        available: existsSync(openScadBin),
        binary: openScadBin,
      },
      queue: {
        active: activeRenders,
        maxConcurrency,
        maxQueueLength,
        pending: renderQueue.length,
      },
    });
    return;
  }

  if (request.method === "POST" && request.url === "/v1/render") {
    void handleRender(request, response);
    return;
  }

  writeJson(response, 404, { error: "Not found." });
});

server.listen(port, () => {
  console.info(
    JSON.stringify({
      event: "render_service_started",
      enableTextMetrics,
      maxConcurrency,
      maxQueueLength,
      openScadBin,
      port,
      sourceRoot,
    }),
  );
});
