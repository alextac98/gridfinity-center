import {
  gridfinityExtendedFiles,
  gridfinityExtendedRoot,
  type OpenScadDefineValue,
  formatScadValue,
} from "@/shared/gridfinityExtended";

type OpenScadFileSystem = {
  mkdir(path: string): void;
  readFile(path: string, options?: { encoding: "binary" | "utf8" }): Uint8Array | string;
  writeFile(path: string, data: string | Uint8Array): void;
  unlink(path: string): void;
};

type OpenScadRuntime = {
  FS: OpenScadFileSystem;
  callMain(args: string[]): number;
};

type OpenScadModule = {
  createOpenSCAD(options?: {
    noInitialRun?: boolean;
    print?: (text: string) => void;
    printErr?: (text: string) => void;
  }): Promise<{
    getInstance(): OpenScadRuntime;
  }>;
};

type RenderOptions = {
  entryFile: string;
  defines: Record<string, OpenScadDefineValue>;
  outputName?: string;
};

let sourcesPromise: Promise<Record<string, string>> | undefined;
let preparedRuntimePromise: Promise<OpenScadRuntime> | undefined;
let openScadLogs: string[] = [];

async function createOpenScadRuntime() {
  const { createOpenSCAD } = (await import("openscad-wasm")) as OpenScadModule;
  const instance = await createOpenSCAD({
    noInitialRun: true,
    print: (text) => openScadLogs.push(text),
    printErr: (text) => openScadLogs.push(text),
  });

  return instance.getInstance();
}

function createOpenScadError(message: string, cause?: unknown) {
  const logTail = openScadLogs.slice(-40).join("\n");
  const causeMessage =
    cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  const details = [message, causeMessage, logTail].filter(Boolean).join("\n\n");

  return new Error(details);
}

async function loadGridfinityExtendedSources() {
  if (!sourcesPromise) {
    sourcesPromise = Promise.all(
      gridfinityExtendedFiles.map(async (path) => {
        const response = await fetch(`${gridfinityExtendedRoot}/${path}`);

        if (!response.ok) {
          throw new Error(`Could not load OpenSCAD source: ${path}`);
        }

        return [path, await response.text()] as const;
      }),
    ).then((entries) => Object.fromEntries(entries));
  }

  return sourcesPromise;
}

function ensureDirectory(fs: OpenScadFileSystem, path: string) {
  try {
    fs.mkdir(path);
  } catch {
    // Emscripten throws when the directory already exists.
  }
}

function ensureParentDirectories(fs: OpenScadFileSystem, filePath: string) {
  const parts = filePath.split("/").filter(Boolean).slice(0, -1);
  let current = "";

  for (const part of parts) {
    current = `${current}/${part}`;
    ensureDirectory(fs, current);
  }
}

async function writeGridfinityExtendedSources(fs: OpenScadFileSystem) {
  const sources = await loadGridfinityExtendedSources();
  for (const [path, source] of Object.entries(sources)) {
    ensureParentDirectories(fs, `/${path}`);
    fs.writeFile(`/${path}`, source);
  }
}

async function createPreparedOpenScadRuntime() {
  const openScad = await createOpenScadRuntime();
  await writeGridfinityExtendedSources(openScad.FS);
  return openScad;
}

function createPreparedOpenScadRuntimePromise() {
  const runtimePromise = createPreparedOpenScadRuntime().catch((error: unknown) => {
    if (preparedRuntimePromise === runtimePromise) {
      preparedRuntimePromise = undefined;
    }

    throw error;
  });

  return runtimePromise;
}

function getPreparedOpenScadRuntime() {
  if (!preparedRuntimePromise) {
    preparedRuntimePromise = createPreparedOpenScadRuntimePromise();
  }

  const runtime = preparedRuntimePromise;
  preparedRuntimePromise = undefined;
  return runtime;
}

export function prewarmOpenScadRuntime() {
  if (preparedRuntimePromise) {
    return preparedRuntimePromise.then(() => undefined);
  }

  preparedRuntimePromise = createPreparedOpenScadRuntimePromise();
  return preparedRuntimePromise.then(() => undefined);
}

function deleteIfPresent(fs: OpenScadFileSystem, path: string) {
  try {
    fs.unlink(path);
  } catch {
    // Missing generated files are harmless between render attempts.
  }
}

export function getOpenScadLogs() {
  return [...openScadLogs];
}

export async function renderOpenScadToStl({
  entryFile,
  defines,
  outputName = "model.stl",
}: RenderOptions) {
  openScadLogs = [];
  const openScad = await getPreparedOpenScadRuntime();

  const outputPath = `/${outputName}`;
  deleteIfPresent(openScad.FS, outputPath);

  const defineArgs = Object.entries(defines).flatMap(([key, value]) => [
    "-D",
    `${key}=${formatScadValue(value)}`,
  ]);

  let exitCode = 0;

  try {
    exitCode = openScad.callMain([
      "--enable=textmetrics",
      ...defineArgs,
      `/${entryFile}`,
      "-o",
      outputPath,
    ]);
  } catch (error) {
    void prewarmOpenScadRuntime().catch(() => {});
    throw createOpenScadError("OpenSCAD crashed while rendering.", error);
  }

  if (exitCode !== 0) {
    void prewarmOpenScadRuntime().catch(() => {});
    throw createOpenScadError(`OpenSCAD exited with code ${exitCode}.`);
  }

  let output: Uint8Array | string;

  try {
    output = openScad.FS.readFile(outputPath, { encoding: "binary" });
  } catch (error) {
    void prewarmOpenScadRuntime().catch(() => {});
    throw createOpenScadError("OpenSCAD did not write an STL file.", error);
  }

  deleteIfPresent(openScad.FS, outputPath);
  void prewarmOpenScadRuntime().catch(() => {});

  if (typeof output === "string") {
    return new TextEncoder().encode(output);
  }

  return output;
}
