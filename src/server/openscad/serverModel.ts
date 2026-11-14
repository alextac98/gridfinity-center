import { randomUUID } from "crypto";
import { after } from "next/server";
import {
  createModelDownloadUrl,
  getOpenScadCacheModel,
  sha256,
  stableStringify,
  type OpenScadCacheModel,
} from "@/server/openscad/modelCache";
import { getGridfinityExtendedSourceFingerprint } from "@/server/openscad/sourceFingerprint";
import { renderOpenScadWasm } from "@/server/openscad/wasmRenderer";
import {
  createPresignedR2Url,
  createR2ObjectUrl,
  createSignedR2Headers,
  getR2Config,
  getR2PublicBaseUrl,
  type R2Config,
} from "@/server/r2/signing";

type ModelRequest = {
  modelId: string;
  params: unknown;
};

type RenderResult = {
  durationMs: string;
  requestId: string;
  source: "native_openscad" | "server_wasm";
  stl: Uint8Array;
};

export type GetOrCreateModelResult = {
  cacheStatus: "disabled" | "hit" | "miss" | "unavailable";
  downloadUrl?: string;
  objectKey: string;
  renderDurationMs?: string;
  renderRequestId?: string;
  source: "native_openscad" | "r2_cache" | "server_wasm";
  sourceFingerprint: string;
  // Omitted for cache hits served from the public R2 URL; fetch downloadUrl instead.
  stl?: Uint8Array;
};

export class NativeRenderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NativeRenderUnavailableError";
  }
}

class R2ResponseError extends Error {
  constructor(
    message: string,
    readonly details: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "R2ResponseError";
  }
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function isNativeRenderDisabled() {
  return process.env.NATIVE_RENDER_DISABLED === "1";
}

function getRemoteNativeRenderConfig() {
  const url = process.env.NATIVE_RENDER_URL?.trim();

  if (!url) {
    return null;
  }

  return {
    token: process.env.NATIVE_RENDER_TOKEN?.trim() ?? "",
    url: url.replace(/\/$/, ""),
  };
}

export function createModelObjectKey(
  model: OpenScadCacheModel,
  params: unknown,
  sourceFingerprint: string,
) {
  const cachePrefix = `models/${model.cacheModel}/source-${sourceFingerprint}`;
  const canonicalSettings = model.createCanonicalSettings(params);
  const settingsHash = sha256(stableStringify(canonicalSettings));

  return `${cachePrefix}/${settingsHash}.stl`;
}

async function fetchR2Object(
  config: R2Config,
  objectKey: string,
  headers?: HeadersInit,
) {
  const response = await fetch(
    createPresignedR2Url({
      config,
      key: objectKey,
      method: "GET",
      expiresSeconds: 60,
    }),
    { cache: "no-store", headers },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new R2ResponseError(
      "R2 cache read failed.",
      await response.text().catch(() => ""),
      response.status,
    );
  }

  return response;
}

async function readR2Object(config: R2Config, objectKey: string) {
  const response = await fetchR2Object(config, objectKey);
  return response ? new Uint8Array(await response.arrayBuffer()) : null;
}

async function hasR2Object(config: R2Config, objectKey: string) {
  return Boolean(await fetchR2Object(config, objectKey, { Range: "bytes=0-0" }));
}

async function uploadR2Object(
  config: R2Config,
  objectKey: string,
  stl: Uint8Array,
) {
  const body = toArrayBuffer(stl);
  const response = await fetch(createR2ObjectUrl(config, objectKey), {
    method: "PUT",
    headers: {
      ...createSignedR2Headers(config, objectKey, "PUT", body),
      // Object keys include the source fingerprint and a settings hash, so contents never change.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "model/stl",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `R2 upload failed with status ${response.status}: ${await response.text()}`,
    );
  }
}

async function renderRemoteNativeOpenScad({
  model,
  modelId,
  params,
  sourceFingerprint,
  url,
  token,
}: ModelRequest & {
  model: OpenScadCacheModel;
  sourceFingerprint: string;
  url: string;
  token: string;
}): Promise<RenderResult> {
  if (!token) {
    throw new Error("NATIVE_RENDER_TOKEN is required when NATIVE_RENDER_URL is set.");
  }

  const response = await fetch(`${url}/v1/render`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      defines: model.createDefines(params),
      entryFile: model.entryFile,
      modelId,
      outputFileName: model.outputFileName,
      requestId: randomUUID(),
      sourceFingerprint,
    }),
    signal: AbortSignal.timeout(125_000),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Remote native OpenSCAD render failed with status ${response.status}: ${details}`,
    );
  }

  return {
    durationMs: response.headers.get("X-Render-Duration-Ms") ?? "",
    requestId: response.headers.get("X-Render-Request-Id") ?? "",
    source: "native_openscad",
    stl: new Uint8Array(await response.arrayBuffer()),
  };
}

// Renders with the remote native service when NATIVE_RENDER_URL is set, otherwise in-process with WASM.
async function renderOpenScadModel(
  request: ModelRequest & { model: OpenScadCacheModel; sourceFingerprint: string },
): Promise<RenderResult> {
  if (isNativeRenderDisabled()) {
    throw new NativeRenderUnavailableError("Server OpenSCAD rendering is disabled.");
  }

  const remoteConfig = getRemoteNativeRenderConfig();

  if (remoteConfig) {
    return renderRemoteNativeOpenScad({ ...request, ...remoteConfig });
  }

  const render = await renderOpenScadWasm({
    entryFile: request.model.entryFile,
    defines: request.model.createDefines(request.params),
  });

  return { ...render, requestId: randomUUID(), source: "server_wasm" };
}

export async function getOrCreateOpenScadModel({
  modelId,
  params,
}: ModelRequest): Promise<GetOrCreateModelResult> {
  const model = getOpenScadCacheModel(modelId);

  if (!model) {
    throw new Error("Unknown OpenSCAD model.");
  }

  if (!model.isParameters(params)) {
    throw new Error("Invalid model parameters.");
  }

  const sourceFingerprint = await getGridfinityExtendedSourceFingerprint();
  const objectKey = createModelObjectKey(model, params, sourceFingerprint);
  const r2Config = getR2Config();
  let cacheStatus: GetOrCreateModelResult["cacheStatus"] = r2Config
    ? "miss"
    : "disabled";

  if (r2Config) {
    try {
      const cachedResult = {
        cacheStatus: "hit",
        downloadUrl: createModelDownloadUrl(modelId, objectKey),
        objectKey,
        source: "r2_cache",
        sourceFingerprint,
      } as const;

      if (getR2PublicBaseUrl()) {
        if (await hasR2Object(r2Config, objectKey)) {
          return cachedResult;
        }
      } else {
        const cachedStl = await readR2Object(r2Config, objectKey);

        if (cachedStl) {
          return { ...cachedResult, stl: cachedStl };
        }
      }
    } catch (error) {
      cacheStatus = "unavailable";
      console.warn("R2 cache read failed; rendering on the server.", {
        details: error instanceof R2ResponseError ? error.details : "",
        error: error instanceof Error ? error.message : error,
        objectKey,
        status: error instanceof R2ResponseError ? error.status : undefined,
      });
    }
  }

  const render = await renderOpenScadModel({
    model,
    modelId,
    params,
    sourceFingerprint,
  });
  let downloadUrl: string | undefined;

  if (r2Config && cacheStatus !== "unavailable") {
    // Upload after the response is sent so users don't wait on R2.
    after(() =>
      uploadR2Object(r2Config, objectKey, render.stl).catch((error: unknown) => {
        console.warn("R2 cache upload failed.", { error, objectKey });
      }),
    );
    downloadUrl = createModelDownloadUrl(modelId, objectKey);
  }

  return {
    cacheStatus,
    downloadUrl,
    objectKey,
    renderDurationMs: render.durationMs,
    renderRequestId: render.requestId,
    source: render.source,
    sourceFingerprint,
    stl: render.stl,
  };
}
