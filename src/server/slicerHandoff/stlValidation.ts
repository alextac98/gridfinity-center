const headerSize = 80;
const triangleOffset = headerSize + 4;
const triangleSize = 50;
// OpenSCAD writes this header, padded with zeros, for every binary STL.
const openScadHeader = "OpenSCAD Model\n";
// Far larger than any Gridfinity model, small enough to reject junk coordinates.
const maxCoordinateMm = 2_000;

export function isBinaryStlSize(size: number) {
  return (
    Number.isInteger(size) &&
    size >= triangleOffset + triangleSize &&
    (size - triangleOffset) % triangleSize === 0
  );
}

// Accepts only binary STLs shaped like OpenSCAD output, so the handoff can't host arbitrary files.
export function isOpenScadBinaryStl(bytes: Uint8Array) {
  if (!isBinaryStlSize(bytes.byteLength)) {
    return false;
  }

  for (let index = 0; index < headerSize; index += 1) {
    const expected =
      index < openScadHeader.length ? openScadHeader.charCodeAt(index) : 0;

    if (bytes[index] !== expected) {
      return false;
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangleCount = view.getUint32(headerSize, true);

  if (triangleOffset + triangleCount * triangleSize !== bytes.byteLength) {
    return false;
  }

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangleOffset + triangle * triangleSize;

    // Normal, then three vertices: 12 little-endian floats.
    for (let value = 0; value < 12; value += 1) {
      const number = view.getFloat32(offset + value * 4, true);

      if (!Number.isFinite(number) || Math.abs(number) > maxCoordinateMm) {
        return false;
      }
    }

    if (view.getUint16(offset + 48, true) !== 0) {
      return false;
    }
  }

  return true;
}
