import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getOpenScadCacheModel } from "@/lib/openscad/modelCache";
import { getGridfinityExtendedSourceFingerprint } from "@/lib/openscad/sourceFingerprint";

export const runtime = "nodejs";

type NativeRenderRequest = {
  params?: unknown;
};

type RouteContext = {
  params: Promise<{ modelId: string }>;
};

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

async function renderRemoteNativeOpenScad(
  model: NonNullable<ReturnType<typeof getOpenScadCacheModel>>,
  params: unknown,
  modelId: string,
) {
  const config = getRemoteNativeRenderConfig();

  if (!config) {
    return null;
  }

  if (!config.token) {
    throw new Error("NATIVE_RENDER_TOKEN is required when NATIVE_RENDER_URL is set.");
  }

  const sourceFingerprint = await getGridfinityExtendedSourceFingerprint();
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

export async function POST(request: Request, context: RouteContext) {
  if (isNativeRenderDisabled()) {
    return NextResponse.json(
      { error: "Native OpenSCAD rendering is disabled." },
      { status: 503 },
    );
  }

  const remoteConfig = getRemoteNativeRenderConfig();

  if (!remoteConfig) {
    return NextResponse.json(
      { error: "Native OpenSCAD rendering is not configured." },
      { status: 503 },
    );
  }

  const { modelId } = await context.params;
  const model = getOpenScadCacheModel(modelId);

  if (!model) {
    return NextResponse.json({ error: "Unknown OpenSCAD model." }, { status: 404 });
  }

  let body: NativeRenderRequest;

  try {
    body = (await request.json()) as NativeRenderRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!model.isParameters(body.params)) {
    return NextResponse.json({ error: "Invalid model parameters." }, { status: 400 });
  }

  try {
    const remoteRender = await renderRemoteNativeOpenScad(
      model,
      body.params,
      modelId,
    );

    if (!remoteRender) {
      return NextResponse.json(
        { error: "Native OpenSCAD rendering is not configured." },
        { status: 503 },
      );
    }

    return new NextResponse(remoteRender.stl, {
      headers: {
        "Content-Disposition": `attachment; filename="${model.outputFileName}"`,
        "Content-Type": "model/stl",
        ...(remoteRender?.durationMs
          ? { "X-Render-Duration-Ms": remoteRender.durationMs }
          : {}),
        ...(remoteRender?.requestId
          ? { "X-Render-Request-Id": remoteRender.requestId }
          : {}),
        "X-Render-Source": "remote-native-openscad",
      },
    });
  } catch (error) {
    console.error("Native OpenSCAD render failed.", error);
    return NextResponse.json(
      { error: "Native OpenSCAD render failed." },
      { status: 500 },
    );
  }
}
