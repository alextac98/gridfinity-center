import { readFile } from "fs/promises";
import path from "path";
import { Worker } from "worker_threads";
import { formatScadValue, type OpenScadDefineValue } from "@/shared/openscad-defines";
import { getGridfinityExtendedSources } from "./sourceFingerprint";

// Same official OpenSCAD WASM build the browser worker loads; see public/openscad-wasm/SOURCES.md.
const wasmDir = path.join(process.cwd(), "public", "openscad-wasm");
const workerPath = path.join(
  process.cwd(),
  "src",
  "server",
  "openscad",
  "wasmRenderWorker.mjs",
);
const outputPath = "/model.stl";
const renderTimeoutMs = 120_000;

type WorkerResult = { ok: true; stl: Uint8Array } | { ok: false; error: string };

let wasmModulePromise: Promise<WebAssembly.Module> | undefined;

function getWasmModule() {
  if (!wasmModulePromise) {
    wasmModulePromise = readFile(path.join(wasmDir, "openscad.wasm"))
      .then((bytes) => WebAssembly.compile(bytes))
      .catch((error: unknown) => {
        wasmModulePromise = undefined;
        throw error;
      });
  }

  return wasmModulePromise;
}

export async function renderOpenScadWasm({
  entryFile,
  defines,
}: {
  entryFile: string;
  defines: Record<string, OpenScadDefineValue>;
}) {
  const [wasmModule, sources] = await Promise.all([
    getWasmModule(),
    getGridfinityExtendedSources(),
  ]);
  const defineArgs = Object.entries(defines).flatMap(([key, value]) => [
    "-D",
    `${key}=${formatScadValue(value)}`,
  ]);
  const startedAt = performance.now();
  const worker = new Worker(workerPath, {
    workerData: {
      args: [
        "--enable=textmetrics",
        "--export-format=binstl",
        ...defineArgs,
        `/${entryFile}`,
        "-o",
        outputPath,
      ],
      openScadJsPath: path.join(wasmDir, "openscad.js"),
      outputPath,
      sources,
      wasmModule,
    },
  });

  const stl = await new Promise<Uint8Array>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`OpenSCAD WASM render timed out after ${renderTimeoutMs}ms.`));
      void worker.terminate();
    }, renderTimeoutMs);

    worker.once("message", (result: WorkerResult) => {
      clearTimeout(timeout);
      void worker.terminate();

      if (result.ok) {
        resolve(result.stl);
      } else {
        reject(new Error(`OpenSCAD WASM render failed: ${result.error}`));
      }
    });
    worker.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    worker.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`OpenSCAD WASM worker exited with code ${code}.`));
    });
  });

  return {
    durationMs: String(Math.round(performance.now() - startedAt)),
    stl,
  };
}
