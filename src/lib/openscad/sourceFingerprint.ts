import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { gridfinityExtendedFiles } from "./gridfinityExtended";

let sourceFingerprintPromise: Promise<string> | undefined;

export async function getGridfinityExtendedSourceFingerprint() {
  if (!sourceFingerprintPromise) {
    sourceFingerprintPromise = Promise.all(
      gridfinityExtendedFiles.map(async (filePath) => {
        const sourcePath = path.join(
          process.cwd(),
          "public",
          "openscad",
          "gridfinity_extended_openscad",
          filePath,
        );
        return [filePath, await readFile(sourcePath, "utf8")] as const;
      }),
    ).then((entries) => {
      const hash = createHash("sha256");

      for (const [filePath, contents] of entries) {
        hash.update(filePath);
        hash.update("\0");
        hash.update(contents);
        hash.update("\0");
      }

      return hash.digest("hex").slice(0, 12);
    });
  }

  return sourceFingerprintPromise;
}
