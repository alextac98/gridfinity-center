import {
  createBinDefines,
  createBinScadSnippet,
  normalizeBinExtraDefines,
  type OpenScadDefineValue,
  type GridfinityBinParameters,
} from "@/shared/gridfinityExtended";
import type { OpenScadCacheModel } from "./modelCache";

export const gridfinityBinCacheModel = "gridfinity-basic-cup";

export type CanonicalGridfinityBinSettings = {
  params: GridfinityBinParameters;
  defines: ReturnType<typeof createBinDefines>;
};

export function createCanonicalBinSettings(
  params: GridfinityBinParameters,
): CanonicalGridfinityBinSettings {
  const extraDefines = normalizeBinExtraDefines(params.extraDefines);

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
      extraDefines,
    },
    defines: createBinDefines({ ...params, extraDefines }),
  };
}

function isOpenScadDefineValue(value: unknown): value is OpenScadDefineValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  return Array.isArray(value) && value.every(isOpenScadDefineValue);
}

function isExtraDefines(value: unknown): value is GridfinityBinParameters["extraDefines"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(isOpenScadDefineValue);
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
      params.lipStyle === "reduced_double" ||
      params.lipStyle === "minimum" ||
      params.lipStyle === "none") &&
    (params.labelStyle === "disabled" ||
      params.labelStyle === "normal" ||
      params.labelStyle === "gflabel" ||
      params.labelStyle === "pred" ||
      params.labelStyle === "cullenect" ||
      params.labelStyle === "cullenect_legacy") &&
    (params.labelPosition === "left" ||
      params.labelPosition === "center" ||
      params.labelPosition === "right" ||
      params.labelPosition === "leftchamber" ||
      params.labelPosition === "centerchamber" ||
      params.labelPosition === "rightchamber") &&
    (params.fingerslide === "none" ||
      params.fingerslide === "rounded" ||
      params.fingerslide === "chamfered") &&
    typeof params.magnets === "boolean" &&
    typeof params.screws === "boolean" &&
    (params.flatBase === "off" ||
      params.flatBase === "gridfinity" ||
      params.flatBase === "rounded") &&
    typeof params.filledIn === "boolean" &&
    isExtraDefines(params.extraDefines)
  );
}

export const gridfinityBinCacheDefinition = {
  id: "bin-generator",
  cacheModel: gridfinityBinCacheModel,
  entryFile: "gridfinity_basic_cup.scad",
  outputFileName: "gridfinity-bin.stl",
  isParameters: isGridfinityBinParameters,
  createCanonicalSettings: (params: unknown) =>
    createCanonicalBinSettings(params as GridfinityBinParameters),
  createDefines: (params: unknown) =>
    createBinDefines(params as GridfinityBinParameters),
  createScadSnippet: (params: unknown) =>
    createBinScadSnippet(params as GridfinityBinParameters),
} satisfies OpenScadCacheModel;
