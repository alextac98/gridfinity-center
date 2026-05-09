import { createHash } from "crypto";
import { NextResponse } from "next/server";
import {
  createCanonicalBinSettings,
  gridfinityBinCacheModel,
  isGridfinityBinParameters,
} from "@/lib/openscad/binCache";
import { getGridfinityExtendedSourceFingerprint } from "@/lib/openscad/sourceFingerprint";
import {
  createPresignedR2Url,
  getR2Config,
} from "@/lib/r2/signing";

type CacheRequest = {
  params?: unknown;
};

function stableStringify(value: unknown): string {
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

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createCachedObjectApiUrl(objectKey: string) {
  return `/api/bin-generator/r2-cache/object?key=${encodeURIComponent(objectKey)}`;
}

export async function POST(request: Request) {
  let body: CacheRequest;

  try {
    body = (await request.json()) as CacheRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isGridfinityBinParameters(body.params)) {
    return NextResponse.json({ error: "Invalid bin parameters." }, { status: 400 });
  }

  const config = getR2Config();
  const sourceFingerprint = await getGridfinityExtendedSourceFingerprint();
  const cachePrefix = `models/${gridfinityBinCacheModel}/source-${sourceFingerprint}`;
  const canonicalSettings = createCanonicalBinSettings(body.params);
  const settingsHash = sha256(stableStringify(canonicalSettings));
  const objectKey = `${cachePrefix}/${settingsHash}.stl`;

  if (!config) {
    return NextResponse.json({
      enabled: false,
      reason: "R2 cache is not configured.",
      model: gridfinityBinCacheModel,
      sourceFingerprint,
      settingsHash,
      objectKey,
    });
  }

  const downloadUrl = createPresignedR2Url({
    config,
    key: objectKey,
    method: "GET",
    expiresSeconds: 60 * 60,
  });
  const lookupResponse = await fetch(downloadUrl, {
    headers: {
      Range: "bytes=0-0",
    },
    cache: "no-store",
  });

  if (lookupResponse.ok || lookupResponse.status === 206) {
    return NextResponse.json({
      enabled: true,
      hit: true,
      model: gridfinityBinCacheModel,
      sourceFingerprint,
      settingsHash,
      objectKey,
      downloadUrl: createCachedObjectApiUrl(objectKey),
    });
  }

  if (lookupResponse.status !== 404) {
    const details = await lookupResponse.text().catch(() => "");
    console.error("R2 cache lookup failed.", {
      status: lookupResponse.status,
      objectKey,
      details,
    });

    return NextResponse.json({
      enabled: false,
      reason: `R2 cache lookup failed with status ${lookupResponse.status}.`,
      model: gridfinityBinCacheModel,
      sourceFingerprint,
      settingsHash,
      objectKey,
    });
  }

  return NextResponse.json({
    enabled: true,
    hit: false,
    model: gridfinityBinCacheModel,
    sourceFingerprint,
    settingsHash,
    objectKey,
    uploadUrl: createPresignedR2Url({
      config,
      key: objectKey,
      method: "PUT",
      expiresSeconds: 10 * 60,
    }),
    downloadUrl: createCachedObjectApiUrl(objectKey),
  });
}
