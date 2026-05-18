export function createOpenScadWorker() {
  return new Worker(new URL("./openscad.worker.ts", import.meta.url), {
    type: "module",
  });
}
