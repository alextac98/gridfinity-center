import { NextResponse } from "next/server";
import { gridfinityBinCacheModel } from "@/lib/openscad/binCache";
import {
  createPresignedR2Url,
  getR2Config,
} from "@/lib/r2/signing";

function isValidObjectKey(value: string) {
  return new RegExp(
    `^models/${gridfinityBinCacheModel}/source-[a-f0-9]{12}/[a-f0-9]{64}\\.stl$`,
  ).test(value);
}

export async function GET(request: Request) {
  const config = getR2Config();

  if (!config) {
    return NextResponse.json({ error: "R2 cache is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const objectKey = searchParams.get("key") ?? "";

  if (!isValidObjectKey(objectKey)) {
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
      "Content-Disposition": 'attachment; filename="gridfinity-bin.stl"',
      "Content-Type": objectResponse.headers.get("Content-Type") ?? "model/stl",
    },
  });
}
