import {
  createBaseplateDefines,
  createBaseplateScadSnippet,
  type GridfinityBaseplateParameters,
} from "@/shared/gridfinityBaseplate";
import type { OpenScadCacheModel } from "./modelCache";

export const gridfinityBaseplateCacheModel = "gridfinity-baseplate";

export type CanonicalGridfinityBaseplateSettings = {
  params: GridfinityBaseplateParameters;
  defines: ReturnType<typeof createBaseplateDefines>;
};

export function createCanonicalBaseplateSettings(
  params: GridfinityBaseplateParameters,
): CanonicalGridfinityBaseplateSettings {
  return {
    params: {
      ...params,
      magnetSize: [params.magnetSize[0], params.magnetSize[1]],
    },
    defines: createBaseplateDefines(params),
  };
}

function isAlignment(value: unknown) {
  return value === "near" || value === "center" || value === "far";
}

function isBaseplateDimensionUnit(value: unknown) {
  return value === "u" || value === "mm" || value === "in";
}

function isBaseplateFillMode(value: unknown) {
  return (
    value === "crop" ||
    value === "grid" ||
    value === "solid" ||
    value === "grid-solid"
  );
}

export function isGridfinityBaseplateParameters(
  value: unknown,
): value is GridfinityBaseplateParameters {
  if (!value || typeof value !== "object") {
    return false;
  }

  const params = value as Partial<GridfinityBaseplateParameters>;

  return (
    typeof params.widthUnits === "number" &&
    Number.isFinite(params.widthUnits) &&
    typeof params.depthUnits === "number" &&
    Number.isFinite(params.depthUnits) &&
    isBaseplateDimensionUnit(params.widthUnit) &&
    isBaseplateDimensionUnit(params.depthUnit) &&
    isBaseplateDimensionUnit(params.solidUnit) &&
    isBaseplateFillMode(params.fillMode) &&
    (params.plateStyle === "default" || params.plateStyle === "cnclaser") &&
    (params.oversizeMethod === "crop" || params.oversizeMethod === "fill") &&
    isAlignment(params.positionFillGridX) &&
    isAlignment(params.positionFillGridY) &&
    typeof params.outerWidthUnits === "number" &&
    Number.isFinite(params.outerWidthUnits) &&
    typeof params.outerDepthUnits === "number" &&
    Number.isFinite(params.outerDepthUnits) &&
    typeof params.outerHeightMm === "number" &&
    Number.isFinite(params.outerHeightMm) &&
    isAlignment(params.positionGridInOuterX) &&
    isAlignment(params.positionGridInOuterY) &&
    typeof params.reducedWallHeightMm === "number" &&
    Number.isFinite(params.reducedWallHeightMm) &&
    typeof params.reducedWallTaper === "boolean" &&
    typeof params.plateCornerRadiusMm === "number" &&
    Number.isFinite(params.plateCornerRadiusMm) &&
    typeof params.secondaryCornerRadiusMm === "number" &&
    Number.isFinite(params.secondaryCornerRadiusMm) &&
    (params.buildPlateMode === "disabled" ||
      params.buildPlateMode === "enabled" ||
      params.buildPlateMode === "unique") &&
    typeof params.averagePlateSizes === "boolean" &&
    typeof params.buildPlateWidthMm === "number" &&
    Number.isFinite(params.buildPlateWidthMm) &&
    typeof params.buildPlateDepthMm === "number" &&
    Number.isFinite(params.buildPlateDepthMm) &&
    typeof params.magnets === "boolean" &&
    Array.isArray(params.magnetSize) &&
    params.magnetSize.length === 2 &&
    params.magnetSize.every((item) => typeof item === "number" && Number.isFinite(item)) &&
    typeof params.magnetZOffsetMm === "number" &&
    Number.isFinite(params.magnetZOffsetMm) &&
    typeof params.magnetTopCoverMm === "number" &&
    Number.isFinite(params.magnetTopCoverMm) &&
    (params.magnetReleaseMethod === "none" ||
      params.magnetReleaseMethod === "slot" ||
      params.magnetReleaseMethod === "hole") &&
    typeof params.cornerScrews === "boolean" &&
    typeof params.centerScrew === "boolean" &&
    typeof params.weightCavities === "boolean" &&
    typeof params.removeBottomTaper === "boolean" &&
    typeof params.connectorOnly === "boolean" &&
    (params.connectorPosition === "center_wall" ||
      params.connectorPosition === "intersection" ||
      params.connectorPosition === "both") &&
    typeof params.connectorClipEnabled === "boolean" &&
    typeof params.connectorClipSizeMm === "number" &&
    Number.isFinite(params.connectorClipSizeMm) &&
    typeof params.connectorClipToleranceMm === "number" &&
    Number.isFinite(params.connectorClipToleranceMm) &&
    (params.connectorSnapsStyle === "disabled" ||
      params.connectorSnapsStyle === "larger" ||
      params.connectorSnapsStyle === "smaller") &&
    typeof params.connectorSnapsClearanceMm === "number" &&
    Number.isFinite(params.connectorSnapsClearanceMm)
  );
}

export const gridfinityBaseplateCacheDefinition = {
  id: "grid-generator",
  cacheModel: gridfinityBaseplateCacheModel,
  entryFile: "gridfinity_baseplate.scad",
  outputFileName: "gridfinity-baseplate.stl",
  isParameters: isGridfinityBaseplateParameters,
  createCanonicalSettings: (params: unknown) =>
    createCanonicalBaseplateSettings(params as GridfinityBaseplateParameters),
  createDefines: (params: unknown) =>
    createBaseplateDefines(params as GridfinityBaseplateParameters),
  createScadSnippet: (params: unknown) =>
    createBaseplateScadSnippet(params as GridfinityBaseplateParameters),
} satisfies OpenScadCacheModel;
