import { NextResponse } from "next/server";
import { getGridfinityExtendedSourceFingerprint } from "@/lib/openscad/sourceFingerprint";
import {
  createCachedObjectApiUrl,
  getOpenScadCacheModel,
  sha256,
  stableStringify,
} from "@/lib/openscad/modelCache";
import {
  createPresignedR2Url,
  getR2Config,
} from "@/lib/r2/signing";

type CacheRequest = {
  params?: unknown;
};

type RouteContext = {
  params: Promise<{ modelId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { modelId } = await context.params;
  const model = getOpenScadCacheModel(modelId);

  if (!model) {
    return NextResponse.json({ error: "Unknown OpenSCAD model." }, { status: 404 });
  }

  let body: CacheRequest;

  try {
    body = (await request.json()) as CacheRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!model.isParameters(body.params)) {
    return NextResponse.json({ error: "Invalid model parameters." }, { status: 400 });
  }

  const config = getR2Config();
  const sourceFingerprint = await getGridfinityExtendedSourceFingerprint();
  const cachePrefix = `models/${model.cacheModel}/source-${sourceFingerprint}`;
  const canonicalSettings = model.createCanonicalSettings(body.params);
  const settingsHash = sha256(stableStringify(canonicalSettings));
  const objectKey = `${cachePrefix}/${settingsHash}.stl`;

  if (!config) {
    return NextResponse.json({
      enabled: false,
      reason: "R2 cache is not configured.",
      model: model.cacheModel,
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
      model: model.cacheModel,
      sourceFingerprint,
      settingsHash,
      objectKey,
      downloadUrl: createCachedObjectApiUrl(model.id, objectKey),
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
      model: model.cacheModel,
      sourceFingerprint,
      settingsHash,
      objectKey,
    });
  }

  return NextResponse.json({
    enabled: true,
    hit: false,
    model: model.cacheModel,
    sourceFingerprint,
    settingsHash,
    objectKey,
    downloadUrl: createCachedObjectApiUrl(model.id, objectKey),
  });
}
