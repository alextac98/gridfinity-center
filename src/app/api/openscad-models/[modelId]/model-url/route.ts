import { NextResponse } from "next/server";
import {
  getOrCreateOpenScadModel,
  NativeRenderUnavailableError,
} from "@/server/openscad/serverModel";
import { getOpenScadCacheModel } from "@/server/openscad/modelCache";

export const runtime = "nodejs";

type ModelUrlRequest = {
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

  let body: ModelUrlRequest;

  try {
    body = (await request.json()) as ModelUrlRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!model.isParameters(body.params)) {
    return NextResponse.json({ error: "Invalid model parameters." }, { status: 400 });
  }

  try {
    const result = await getOrCreateOpenScadModel({
      modelId,
      params: body.params,
    });

    if (!result.downloadUrl) {
      return NextResponse.json(
        { error: "Model URL is not available.", cacheStatus: result.cacheStatus },
        { status: 503 },
      );
    }

    return NextResponse.json({
      cacheStatus: result.cacheStatus,
      modelUrl: result.downloadUrl,
      objectKey: result.objectKey,
      renderSource: result.source,
      sourceFingerprint: result.sourceFingerprint,
    });
  } catch (error) {
    if (error instanceof NativeRenderUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("OpenSCAD model URL request failed.", error);
    return NextResponse.json(
      { error: "OpenSCAD model URL request failed." },
      { status: 500 },
    );
  }
}
