import { randomUUID } from "crypto";
import {
  createPresignedR2Url,
  createR2ObjectUrl,
  createSignedR2Headers,
  type R2Config,
} from "@/server/r2/signing";
import { isBinaryStlSize, isOpenScadBinaryStl } from "./stlValidation";

// The browser uploads the previewed STL, then a slicer downloads it once through
// our download route. Links are single use and expire 5 minutes after upload;
// an R2 lifecycle rule on handoff/ removes anything left behind.
const handoffLifetimeMs = 5 * 60 * 1000;
const maxHandoffBytes = 32 * 1024 * 1024;

const handoffIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fileNamePattern = /^[a-z0-9-]{1,64}\.stl$/;

export type HandoffResult =
  | { status: "ok"; stl: Uint8Array }
  | { status: "gone" }
  | { status: "invalid" };

function createHandoffKey(id: string) {
  return `handoff/${id}.stl`;
}

export function isHandoffId(value: string) {
  return handoffIdPattern.test(value);
}

export function isHandoffFileName(value: string) {
  return fileNamePattern.test(value);
}

export function isHandoffSize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    isBinaryStlSize(value) &&
    value <= maxHandoffBytes
  );
}

export function createHandoff(config: R2Config, size: number) {
  const id = randomUUID();
  const uploadUrl = createPresignedR2Url({
    config,
    key: createHandoffKey(id),
    method: "PUT",
    expiresSeconds: handoffLifetimeMs / 1000,
    // Browsers send Content-Length themselves, so R2 rejects uploads of any other size.
    signedHeaders: { "content-length": String(size) },
  });

  return { id, uploadUrl };
}

function isFresh(lastModified: string | null) {
  const uploadedAt = lastModified ? Date.parse(lastModified) : Number.NaN;
  return Date.now() - uploadedAt <= handoffLifetimeMs;
}

async function deleteHandoff(config: R2Config, key: string) {
  const response = await fetch(createR2ObjectUrl(config, key), {
    method: "DELETE",
    headers: createSignedR2Headers(config, key, "DELETE"),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed with status ${response.status}.`);
  }
}

// Checks a handoff without consuming it, for HEAD requests.
export async function peekHandoff(config: R2Config, id: string) {
  const key = createHandoffKey(id);
  const response = await fetch(createR2ObjectUrl(config, key), {
    method: "HEAD",
    headers: createSignedR2Headers(config, key, "HEAD"),
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`R2 head failed with status ${response.status}.`);
  }

  return isFresh(response.headers.get("Last-Modified"))
    ? Number(response.headers.get("Content-Length"))
    : null;
}

// Reads, validates, and deletes a handoff so each link works only once.
export async function takeHandoff(
  config: R2Config,
  id: string,
): Promise<HandoffResult> {
  const key = createHandoffKey(id);
  const response = await fetch(
    createPresignedR2Url({ config, key, method: "GET", expiresSeconds: 60 }),
    { cache: "no-store" },
  );

  if (response.status === 404) {
    return { status: "gone" };
  }

  if (!response.ok) {
    throw new Error(`R2 read failed with status ${response.status}.`);
  }

  const isStale = !isFresh(response.headers.get("Last-Modified"));
  const stl = isStale ? null : new Uint8Array(await response.arrayBuffer());

  // Delete before responding: if this fails the link must not be served twice.
  await deleteHandoff(config, key);

  if (!stl) {
    return { status: "gone" };
  }

  if (stl.byteLength > maxHandoffBytes || !isOpenScadBinaryStl(stl)) {
    return { status: "invalid" };
  }

  return { status: "ok", stl };
}
