type HandoffResponse = {
  downloadUrl: string;
  uploadUrl: string;
};

// Uploads the exact previewed STL and returns a single-use download URL for a slicer.
export async function uploadSlicerHandoff(stl: Uint8Array, fileName: string) {
  const response = await fetch("/api/slicer-handoff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, size: stl.byteLength }),
  });

  if (!response.ok) {
    throw new Error(`Slicer handoff request failed with status ${response.status}.`);
  }

  const { downloadUrl, uploadUrl } = (await response.json()) as HandoffResponse;
  const upload = await fetch(uploadUrl, {
    method: "PUT",
    body: new Uint8Array(stl),
  });

  if (!upload.ok) {
    throw new Error(`Slicer handoff upload failed with status ${upload.status}.`);
  }

  return downloadUrl;
}
