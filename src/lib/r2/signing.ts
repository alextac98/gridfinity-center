import { createHmac, createHash } from "crypto";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

type PresignOptions = {
  config: R2Config;
  key: string;
  method: "GET" | "PUT";
  expiresSeconds: number;
};

const service = "s3";
const region = "auto";
const unsignedPayload = "UNSIGNED-PAYLOAD";

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Bytes(value: ArrayBuffer | Uint8Array) {
  return createHash("sha256").update(new Uint8Array(value)).digest("hex");
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function encodeQueryValue(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function toDateStamp(date: Date) {
  return toAmzDate(date).slice(0, 8);
}

function getSigningKey(secretAccessKey: string, dateStamp: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

function getScope(dateStamp: string) {
  return `${dateStamp}/${region}/${service}/aws4_request`;
}

export function getR2Config(): R2Config | null {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
  } = process.env;

  const accountId = R2_ACCOUNT_ID?.trim();
  const accessKeyId = R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = R2_BUCKET_NAME?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
  };
}

export function createR2ObjectUrl(config: R2Config, key: string) {
  return `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${encodePath(
    key,
  )}`;
}

export function createPresignedR2Url({
  config,
  key,
  method,
  expiresSeconds,
}: PresignOptions) {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const credential = `${config.accessKeyId}/${getScope(dateStamp)}`;
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${config.bucketName}/${encodePath(key)}`;
  const signedHeaders = "host";
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  const canonicalQuery = [...query.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${encodeQueryValue(name)}=${encodeQueryValue(value)}`)
    .join("&");
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    signedHeaders,
    unsignedPayload,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    getScope(dateStamp),
    sha256(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", getSigningKey(config.secretAccessKey, dateStamp))
    .update(stringToSign)
    .digest("hex");

  query.set("X-Amz-Signature", signature);

  return `https://${host}${canonicalUri}?${query.toString()}`;
}

export function createSignedR2Headers(
  config: R2Config,
  key: string,
  method: "HEAD" | "PUT",
  payload?: ArrayBuffer | Uint8Array,
) {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${config.bucketName}/${encodePath(key)}`;
  const payloadHash = payload ? sha256Bytes(payload) : sha256("");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    getScope(dateStamp),
    sha256(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", getSigningKey(config.secretAccessKey, dateStamp))
    .update(stringToSign)
    .digest("hex");
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${getScope(dateStamp)}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  return {
    Authorization: authorization,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
}
