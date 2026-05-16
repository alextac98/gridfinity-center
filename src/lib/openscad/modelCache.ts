import type { OpenScadDefineValue } from "./defines";
import { createHash } from "crypto";
import { gridfinityBaseplateCacheDefinition } from "./baseplateCache";
import { gridfinityBinCacheDefinition } from "./binCache";

export type OpenScadCacheModel = {
  id: string;
  cacheModel: string;
  entryFile: string;
  outputFileName: string;
  isParameters: (value: unknown) => boolean;
  createCanonicalSettings: (params: unknown) => unknown;
  createDefines: (params: unknown) => Record<string, OpenScadDefineValue>;
  createScadSnippet: (params: unknown) => string;
};

const cacheModels = [
  gridfinityBinCacheDefinition,
  gridfinityBaseplateCacheDefinition,
] as const;

export function getOpenScadCacheModel(modelId: string) {
  return cacheModels.find((model) => model.id === modelId) ?? null;
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isValidModelObjectKey(
  model: OpenScadCacheModel,
  objectKey: string,
) {
  return new RegExp(
    `^models/${escapeRegExp(model.cacheModel)}/source-[a-f0-9]{12}/[a-f0-9]{64}\\.stl$`,
  ).test(objectKey);
}

export function createCachedObjectApiUrl(modelId: string, objectKey: string) {
  return `/api/openscad-models/${modelId}/r2-cache/object?key=${encodeURIComponent(objectKey)}`;
}
