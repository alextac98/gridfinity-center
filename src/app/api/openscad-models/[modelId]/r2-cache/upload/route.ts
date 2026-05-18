import { NextResponse } from "next/server";
import {
  getOpenScadCacheModel,
  isValidModelObjectKey,
} from "@/server/openscad/modelCache";
import {
  createR2ObjectUrl,
  createSignedR2Headers,
  getR2Config,
} from "@/server/r2/signing";

const maxUploadBytes = 25 * 1024 * 1024;

type RouteContext = {
  params: Promise<{ modelId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { modelId } = await context.params;
  const model = getOpenScadCacheModel(modelId);

  if (!model) {
    return NextResponse.json({ error: "Unknown OpenSCAD model." }, { status: 404 });
  }

  const config = getR2Config();

  if (!config) {
    return NextResponse.json({ error: "R2 cache is not configured." }, { status: 503 });
  }

  const objectKey = request.headers.get("x-r2-object-key") ?? "";

  if (!isValidModelObjectKey(model, objectKey)) {
    return NextResponse.json({ error: "Invalid R2 object key." }, { status: 400 });
  }

  const stlBuffer = await request.arrayBuffer();

  if (stlBuffer.byteLength === 0) {
    return NextResponse.json({ error: "Empty STL upload." }, { status: 400 });
  }

  if (stlBuffer.byteLength > maxUploadBytes) {
    return NextResponse.json({ error: "STL upload is too large." }, { status: 413 });
  }

  const objectUrl = createR2ObjectUrl(config, objectKey);
  const uploadResponse = await fetch(objectUrl, {
    method: "PUT",
    headers: {
      ...createSignedR2Headers(config, objectKey, "PUT", stlBuffer),
      "Content-Type": "model/stl",
    },
    body: stlBuffer,
  });

  if (!uploadResponse.ok) {
    return NextResponse.json(
      {
        error: "R2 upload failed.",
        status: uploadResponse.status,
        details: await uploadResponse.text(),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, objectKey });
}
