// Runs a single OpenSCAD WASM render. Started by wasmRenderer.ts in a fresh
// worker thread so renders don't block the event loop, can be terminated on
// timeout, and release their WASM memory when the thread exits.
import { pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";

const { args, openScadJsPath, outputPath, sources, wasmModule } = workerData;
const logs = [];

function ensureParentDirectories(fs, filePath) {
  let current = "";

  for (const part of filePath.split("/").filter(Boolean).slice(0, -1)) {
    current = `${current}/${part}`;
    try {
      fs.mkdir(current);
    } catch {
      // Emscripten throws when the directory already exists.
    }
  }
}

try {
  const { default: createOpenScad } = await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */
    pathToFileURL(openScadJsPath).href
  );
  const openScad = await createOpenScad({
    noInitialRun: true,
    print: (text) => logs.push(text),
    printErr: (text) => logs.push(text),
    instantiateWasm: (imports, receiveInstance) => {
      WebAssembly.instantiate(wasmModule, imports).then((instance) =>
        receiveInstance(instance, wasmModule),
      );
      return {};
    },
  });

  for (const [filePath, contents] of sources) {
    ensureParentDirectories(openScad.FS, `/${filePath}`);
    openScad.FS.writeFile(`/${filePath}`, contents);
  }

  const exitCode = openScad.callMain(args);

  if (exitCode !== 0) {
    throw new Error(`OpenSCAD exited with code ${exitCode}.`);
  }

  const stl = openScad.FS.readFile(outputPath, { encoding: "binary" });
  parentPort.postMessage({ ok: true, stl }, [stl.buffer]);
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: [error instanceof Error ? error.message : String(error), ...logs.slice(-20)]
      .filter(Boolean)
      .join("\n"),
  });
}
