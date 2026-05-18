import {
  getOpenScadLogs,
  prewarmOpenScadRuntime,
  renderOpenScadToStl,
} from "./openscadClient";
import type { OpenScadWorkerRequest, OpenScadWorkerResponse } from "@/shared/openscadWorkerTypes";

const workerScope = self as unknown as {
  postMessage(message: OpenScadWorkerResponse, transfer?: Transferable[]): void;
};

void prewarmOpenScadRuntime().catch(() => {});

function toTransferableBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function handleRenderRequest(request: OpenScadWorkerRequest) {
  workerScope.postMessage({
    type: "render-started",
    requestId: request.requestId,
  });

  try {
    const stl = await renderOpenScadToStl({
      entryFile: request.entryFile,
      defines: request.defines,
      outputName: request.outputName,
    });
    const stlBuffer = toTransferableBuffer(stl);

    workerScope.postMessage(
      {
        type: "render-done",
        requestId: request.requestId,
        stl: stlBuffer,
        logs: getOpenScadLogs(),
      },
      [stlBuffer],
    );
  } catch (error) {
    workerScope.postMessage({
      type: "render-error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "Unknown OpenSCAD error",
      logs: getOpenScadLogs(),
    });
  }
}

self.addEventListener("message", (event: MessageEvent<OpenScadWorkerRequest>) => {
  void handleRenderRequest(event.data);
});
