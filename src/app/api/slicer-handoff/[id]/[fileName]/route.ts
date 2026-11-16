import { NextResponse } from "next/server";
import { getR2Config } from "@/server/r2/signing";
import {
  isHandoffFileName,
  isHandoffId,
  peekHandoff,
  takeHandoff,
} from "@/server/slicerHandoff/handoff";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; fileName: string }>;
};

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function stlHeaders(fileName: string) {
  return {
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Content-Type": "model/stl",
  };
}

async function readRequest(context: RouteContext) {
  const { id, fileName } = await context.params;
  const config = getR2Config();

  if (!config || !isHandoffId(id) || !isHandoffFileName(fileName)) {
    return null;
  }

  return { config, fileName, id };
}

// Answers HEAD probes without using up the single download.
export async function HEAD(_request: Request, context: RouteContext) {
  const handoff = await readRequest(context);

  if (!handoff) {
    return new Response(null, { status: 404 });
  }

  try {
    const size = await peekHandoff(handoff.config, handoff.id);

    return size === null
      ? new Response(null, { status: 410 })
      : new Response(null, {
          headers: {
            ...stlHeaders(handoff.fileName),
            "Content-Length": String(size),
          },
        });
  } catch (error) {
    console.error("Slicer handoff check failed.", error);
    return new Response(null, { status: 502 });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const handoff = await readRequest(context);

  if (!handoff) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const result = await takeHandoff(handoff.config, handoff.id);

    if (result.status === "gone") {
      return NextResponse.json(
        { error: "This link was already used or has expired." },
        { status: 410 },
      );
    }

    if (result.status === "invalid") {
      return NextResponse.json(
        { error: "The uploaded file is not a generated STL." },
        { status: 422 },
      );
    }

    return new Response(toArrayBuffer(result.stl), {
      headers: stlHeaders(handoff.fileName),
    });
  } catch (error) {
    console.error("Slicer handoff download failed.", error);
    return NextResponse.json(
      { error: "Slicer handoff download failed." },
      { status: 502 },
    );
  }
}
