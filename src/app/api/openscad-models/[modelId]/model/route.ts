import { NextResponse } from "next/server";
import {
  getOrCreateOpenScadModel,
  NativeRenderUnavailableError,
} from "@/lib/openscad/serverModel";
import { getOpenScadCacheModel } from "@/lib/openscad/modelCache";

export const runtime = "nodejs";

type ModelRequest = {
  params?: unknown;
};

type RouteContext = {
  params: Promise<{ modelId: string }>;
};

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function POST(request: Request, context: RouteContext) {
  const { modelId } = await context.params;
  const model = getOpenScadCacheModel(modelId);

  if (!model) {
    return NextResponse.json({ error: "Unknown OpenSCAD model." }, { status: 404 });
  }

  let body: ModelRequest;

  try {
    body = (await request.json()) as ModelRequest;
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

    return new NextResponse(toArrayBuffer(result.stl), {
      headers: {
        "Content-Disposition": `attachment; filename="${model.outputFileName}"`,
        "Content-Type": "model/stl",
        "X-Model-Cache-Status": result.cacheStatus,
        ...(result.downloadUrl ? { "X-Model-Url": result.downloadUrl } : {}),
        ...(result.renderDurationMs
          ? { "X-Render-Duration-Ms": result.renderDurationMs }
          : {}),
        ...(result.renderRequestId
          ? { "X-Render-Request-Id": result.renderRequestId }
          : {}),
        "X-Render-Source": result.source,
      },
    });
  } catch (error) {
    if (error instanceof NativeRenderUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("OpenSCAD model request failed.", error);
    return NextResponse.json(
      { error: "OpenSCAD model request failed." },
      { status: 500 },
    );
  }
}
