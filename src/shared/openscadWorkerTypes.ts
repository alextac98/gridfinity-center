import type { OpenScadDefineValue } from "./openscad-defines";

export type OpenScadWorkerRenderRequest = {
  type: "render";
  requestId: number;
  entryFile: string;
  defines: Record<string, OpenScadDefineValue>;
  outputName: string;
};

export type OpenScadWorkerRequest = OpenScadWorkerRenderRequest;

export type OpenScadWorkerResponse =
  | {
      type: "render-started";
      requestId: number;
    }
  | {
      type: "render-done";
      requestId: number;
      stl: ArrayBuffer;
      logs: string[];
    }
  | {
      type: "render-error";
      requestId: number;
      message: string;
      logs: string[];
    };
