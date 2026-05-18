import { randomUUID } from "crypto";
import {
  createCachedObjectApiUrl,
  getOpenScadCacheModel,
  sha256,
  stableStringify,
  type OpenScadCacheModel,
} from "@/lib/openscad/modelCache";
import { getGridfinityExtendedSourceFingerprint } from "@/lib/openscad/sourceFingerprint";
import {
  createPresignedR2Url,
  createR2ObjectUrl,
  createSignedR2Headers,
  getR2Config,
  type R2Config,
} from "@/lib/r2/signing";

type ModelRequest = {
  modelId: string;
  params: unknown;
};

type RenderResult = {
  durationMs: string;
  requestId: string;
  stl: Uint8Array;
};

export type GetOrCreateModelResult = {
  cacheStatus: "disabled" | "hit" | "miss" | "unavailable";
  downloadUrl?: string;
  objectKey: string;
  renderDurationMs?: string;
  renderRequestId?: string;
  source: "native_openscad" | "r2_cache";
  sourceFingerprint: string;
  stl: Uint8Array;
};

export class NativeRenderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NativeRenderUnavailableError";
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

async function readR2Object(config: R2Config, objectKey: string) {
  const response = await fetch(
    createPresignedR2Url({
      config,
      key: objectKey,
      method: "GET",
      expiresSeconds: 60,
    }),
    { cache: "no-store" },
  );

  if (!response.ok) {
    return null;
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function hasR2Object(config: R2Config, objectKey: string) {
  const response = await fetch(
    createPresignedR2Url({
      config,
      key: objectKey,
      method: "GET",
      expiresSeconds: 60,
    }),
    {
      cache: "no-store",
      headers: {
        Range: "bytes=0-0",
      },
    },
  );

  return response.ok || response.status === 206;
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

export async function renderRemoteNativeOpenScad({
  model,
  modelId,
  params,
  sourceFingerprint,
}: ModelRequest & {
  model: OpenScadCacheModel;
  sourceFingerprint: string;
}): Promise<RenderResult> {
  if (isNativeRenderDisabled()) {
    throw new NativeRenderUnavailableError("Native OpenSCAD rendering is disabled.");
  }

  const config = getRemoteNativeRenderConfig();

  if (!config) {
    throw new NativeRenderUnavailableError(
      "Native OpenSCAD rendering is not configured.",
    );
  }

  if (!config.token) {
    throw new Error("NATIVE_RENDER_TOKEN is required when NATIVE_RENDER_URL is set.");
  }

  const response = await fetch(`${config.url}/v1/render`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
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
    stl: new Uint8Array(await response.arrayBuffer()),
  };
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

  if (r2Config) {
    try {
      const cachedStl = await readR2Object(r2Config, objectKey);

      if (cachedStl) {
        return {
          cacheStatus: "hit",
          downloadUrl: createCachedObjectApiUrl(modelId, objectKey),
          objectKey,
          source: "r2_cache",
          sourceFingerprint,
          stl: cachedStl,
        };
      }
    } catch (error) {
      console.warn("R2 cache read failed; rendering with native OpenSCAD.", {
        error,
        objectKey,
      });
    }
  }

  const render = await renderRemoteNativeOpenScad({
    model,
    modelId,
    params,
    sourceFingerprint,
  });
  let cacheStatus: GetOrCreateModelResult["cacheStatus"] = r2Config
    ? "miss"
    : "disabled";
  let downloadUrl: string | undefined;

  if (r2Config) {
    try {
      if (!(await hasR2Object(r2Config, objectKey))) {
        await uploadR2Object(r2Config, objectKey, render.stl);
      }

      downloadUrl = createCachedObjectApiUrl(modelId, objectKey);
    } catch (error) {
      cacheStatus = "unavailable";
      console.warn("R2 cache upload failed; returning rendered STL.", {
        error,
        objectKey,
      });
    }
  }

  return {
    cacheStatus,
    downloadUrl,
    objectKey,
    renderDurationMs: render.durationMs,
    renderRequestId: render.requestId,
    source: "native_openscad",
    sourceFingerprint,
    stl: render.stl,
  };
}
