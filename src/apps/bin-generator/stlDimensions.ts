export type ModelDimensions = {
  width: number;
  depth: number;
  height: number;
};

function createEmptyBounds() {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
    hasVertex: false,
  };
}

function addVertexToBounds(
  bounds: ReturnType<typeof createEmptyBounds>,
  x: number,
  y: number,
  z: number,
) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return;
  }

  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.maxZ = Math.max(bounds.maxZ, z);
  bounds.hasVertex = true;
}

function boundsToDimensions(bounds: ReturnType<typeof createEmptyBounds>) {
  if (!bounds.hasVertex) {
    return null;
  }

  return {
    width: bounds.maxX - bounds.minX,
    depth: bounds.maxY - bounds.minY,
    height: bounds.maxZ - bounds.minZ,
  } satisfies ModelDimensions;
}

function measureBinaryStlDimensions(bytes: Uint8Array) {
  if (bytes.byteLength < 84) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(80, true);
  const expectedByteLength = 84 + triangleCount * 50;

  if (expectedByteLength !== bytes.byteLength) {
    return null;
  }

  const bounds = createEmptyBounds();

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const triangleOffset = 84 + triangleIndex * 50;

    for (let vertexIndex = 0; vertexIndex < 3; vertexIndex += 1) {
      const vertexOffset = triangleOffset + 12 + vertexIndex * 12;
      addVertexToBounds(
        bounds,
        view.getFloat32(vertexOffset, true),
        view.getFloat32(vertexOffset + 4, true),
        view.getFloat32(vertexOffset + 8, true),
      );
    }
  }

  return boundsToDimensions(bounds);
}

function measureAsciiStlDimensions(bytes: Uint8Array) {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const bounds = createEmptyBounds();
  const vertexPattern =
    /vertex\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/gi;

  for (const match of text.matchAll(vertexPattern)) {
    addVertexToBounds(
      bounds,
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    );
  }

  return boundsToDimensions(bounds);
}

export function measureStlDimensions(bytes: Uint8Array) {
  return measureBinaryStlDimensions(bytes) ?? measureAsciiStlDimensions(bytes);
}
