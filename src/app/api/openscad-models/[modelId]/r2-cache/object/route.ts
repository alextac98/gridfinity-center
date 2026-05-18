import { NextResponse } from "next/server";
import {
  getOpenScadCacheModel,
  isValidModelObjectKey,
} from "@/server/openscad/modelCache";
import {
  createPresignedR2Url,
  getR2Config,
} from "@/server/r2/signing";

type RouteContext = {
  params: Promise<{ modelId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { modelId } = await context.params;
  const model = getOpenScadCacheModel(modelId);

  if (!model) {
    return NextResponse.json({ error: "Unknown OpenSCAD model." }, { status: 404 });
  }

  const config = getR2Config();

  if (!config) {
    return NextResponse.json({ error: "R2 cache is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const objectKey = searchParams.get("key") ?? "";

  if (!isValidModelObjectKey(model, objectKey)) {
    return NextResponse.json({ error: "Invalid R2 object key." }, { status: 400 });
  }

  const objectResponse = await fetch(
    createPresignedR2Url({
      config,
      key: objectKey,
      method: "GET",
      expiresSeconds: 60,
    }),
    { cache: "no-store" },
  );

  if (!objectResponse.ok || !objectResponse.body) {
    return NextResponse.json(
      {
        error: "Cached STL could not be loaded.",
        status: objectResponse.status,
      },
      { status: objectResponse.status === 404 ? 404 : 502 },
    );
  }

  return new Response(objectResponse.body, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `attachment; filename="${model.outputFileName}"`,
      "Content-Type": objectResponse.headers.get("Content-Type") ?? "model/stl",
    },
  });
}
