import {
  createBinDefines,
  type GridfinityBinParameters,
} from "./gridfinityExtended";

export const gridfinityBinCacheModel = "gridfinity-basic-cup";

export type CanonicalGridfinityBinSettings = {
  params: GridfinityBinParameters;
  defines: ReturnType<typeof createBinDefines>;
};

export function createCanonicalBinSettings(
  params: GridfinityBinParameters,
): CanonicalGridfinityBinSettings {
  return {
    params: {
      widthUnits: params.widthUnits,
      depthUnits: params.depthUnits,
      heightUnits: params.heightUnits,
      verticalChambers: params.verticalChambers,
      horizontalChambers: params.horizontalChambers,
      lipStyle: params.lipStyle,
      labelStyle: params.labelStyle,
      labelPosition: params.labelPosition,
      fingerslide: params.fingerslide,
      magnets: params.magnets,
      screws: params.screws,
      flatBase: params.flatBase,
      filledIn: params.filledIn,
      wallThicknessMm: params.wallThicknessMm,
    },
    defines: createBinDefines(params),
  };
}

export function isGridfinityBinParameters(value: unknown): value is GridfinityBinParameters {
  if (!value || typeof value !== "object") {
    return false;
  }

  const params = value as Partial<GridfinityBinParameters>;
  return (
    typeof params.widthUnits === "number" &&
    typeof params.depthUnits === "number" &&
    typeof params.heightUnits === "number" &&
    typeof params.verticalChambers === "number" &&
    typeof params.horizontalChambers === "number" &&
    typeof params.wallThicknessMm === "number" &&
    (params.lipStyle === "normal" ||
      params.lipStyle === "reduced" ||
      params.lipStyle === "minimum" ||
      params.lipStyle === "none") &&
    (params.labelStyle === "disabled" ||
      params.labelStyle === "normal" ||
      params.labelStyle === "gflabel") &&
    (params.labelPosition === "left" ||
      params.labelPosition === "center" ||
      params.labelPosition === "right") &&
    (params.fingerslide === "none" ||
      params.fingerslide === "rounded" ||
      params.fingerslide === "chamfered") &&
    typeof params.magnets === "boolean" &&
    typeof params.screws === "boolean" &&
    (params.flatBase === "off" ||
      params.flatBase === "gridfinity" ||
      params.flatBase === "rounded") &&
    typeof params.filledIn === "boolean"
  );
}
