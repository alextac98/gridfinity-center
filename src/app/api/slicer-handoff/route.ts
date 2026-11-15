import { NextResponse } from "next/server";
import { getR2Config } from "@/server/r2/signing";
import {
  createHandoff,
  isHandoffFileName,
  isHandoffSize,
} from "@/server/slicerHandoff/handoff";

export const runtime = "nodejs";

type HandoffRequest = {
  fileName?: unknown;
  size?: unknown;
};

export async function POST(request: Request) {
  const config = getR2Config();

  if (!config) {
    return NextResponse.json(
      { error: "Slicer handoff is not configured." },
      { status: 503 },
    );
  }

  let body: HandoffRequest;

  try {
    body = (await request.json()) as HandoffRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    !isHandoffSize(body.size) ||
    typeof body.fileName !== "string" ||
    !isHandoffFileName(body.fileName)
  ) {
    return NextResponse.json(
      { error: "Invalid file size or name." },
      { status: 400 },
    );
  }

  const { id, uploadUrl } = createHandoff(config, body.size);
  const downloadUrl = new URL(
    `/api/slicer-handoff/${id}/${body.fileName}`,
    request.url,
  ).toString();

  return NextResponse.json({ downloadUrl, uploadUrl });
}
