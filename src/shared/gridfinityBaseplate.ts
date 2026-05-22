import { formatScadValue, type OpenScadDefineValue } from "./openscad-defines";
import { GRIDFINITY_GRID_MM } from "./gridfinity/constants";

export type BaseplateAlignment = "near" | "center" | "far";
export type BaseplateStyle = "default" | "cnclaser";
export type OversizeMethod = "crop" | "fill";
export type BaseplateFillMode = "crop" | "grid" | "solid" | "grid-solid";
export type BuildPlateMode = "disabled" | "enabled" | "unique";
export type MagnetReleaseMethod = "none" | "slot" | "hole";
export type ConnectorPosition = "center_wall" | "intersection" | "both";
export type ConnectorSnapsStyle = "disabled" | "larger" | "smaller";
export type BaseplateDimensionUnit = "u" | "mm" | "in";

export type GridfinityBaseplateParameters = {
  widthUnits: number;
  depthUnits: number;
  widthUnit: BaseplateDimensionUnit;
  depthUnit: BaseplateDimensionUnit;
  solidUnit: BaseplateDimensionUnit;
  fillMode: BaseplateFillMode;
  plateStyle: BaseplateStyle;
  oversizeMethod: OversizeMethod;
  positionFillGridX: BaseplateAlignment;
  positionFillGridY: BaseplateAlignment;
  outerWidthUnits: number;
  outerDepthUnits: number;
  outerHeightMm: number;
  positionGridInOuterX: BaseplateAlignment;
  positionGridInOuterY: BaseplateAlignment;
  reducedWallHeightMm: number;
  reducedWallTaper: boolean;
  plateCornerRadiusMm: number;
  secondaryCornerRadiusMm: number;
  buildPlateMode: BuildPlateMode;
  averagePlateSizes: boolean;
  buildPlateWidthMm: number;
  buildPlateDepthMm: number;
  magnets: boolean;
  magnetSize: readonly [number, number];
  magnetZOffsetMm: number;
  magnetTopCoverMm: number;
  magnetReleaseMethod: MagnetReleaseMethod;
  cornerScrews: boolean;
  centerScrew: boolean;
  weightCavities: boolean;
  removeBottomTaper: boolean;
  connectorOnly: boolean;
  connectorPosition: ConnectorPosition;
  connectorClipEnabled: boolean;
  connectorClipSizeMm: number;
  connectorClipToleranceMm: number;
  connectorSnapsStyle: ConnectorSnapsStyle;
  connectorSnapsClearanceMm: number;
};

export const defaultGridfinityBaseplateParameters: GridfinityBaseplateParameters = {
  widthUnits: 3,
  depthUnits: 2,
  widthUnit: "u",
  depthUnit: "u",
  solidUnit: "u",
  fillMode: "grid",
  plateStyle: "default",
  oversizeMethod: "fill",
  positionFillGridX: "center",
  positionFillGridY: "center",
  outerWidthUnits: 3,
  outerDepthUnits: 2,
  outerHeightMm: 4,
  positionGridInOuterX: "center",
  positionGridInOuterY: "center",
  reducedWallHeightMm: -1,
  reducedWallTaper: false,
  plateCornerRadiusMm: 3.75,
  secondaryCornerRadiusMm: 3.75,
  buildPlateMode: "disabled",
  averagePlateSizes: false,
  buildPlateWidthMm: 250,
  buildPlateDepthMm: 250,
  magnets: false,
  magnetSize: [6.5, 2.4],
  magnetZOffsetMm: 0,
  magnetTopCoverMm: 0,
  magnetReleaseMethod: "none",
  cornerScrews: false,
  centerScrew: false,
  weightCavities: false,
  removeBottomTaper: false,
  connectorOnly: false,
  connectorPosition: "center_wall",
  connectorClipEnabled: false,
  connectorClipSizeMm: 10,
  connectorClipToleranceMm: 0.1,
  connectorSnapsStyle: "disabled",
  connectorSnapsClearanceMm: 0.2,
};

function createDimensionTuple(value: number, unit: BaseplateDimensionUnit) {
  if (unit === "u") {
    return [value, 0] as const;
  }

  return [0, unit === "in" ? value * 25.4 : value] as const;
}

function getDimensionUnits(value: number, unit: BaseplateDimensionUnit) {
  if (unit === "u") {
    return value;
  }

  return (unit === "in" ? value * 25.4 : value) / GRIDFINITY_GRID_MM;
}

function getSolidFillGridUnits(value: number, unit: BaseplateDimensionUnit) {
  return Math.max(1, Math.floor(getDimensionUnits(value, unit)));
}

export function createBaseplateDefines(params: GridfinityBaseplateParameters) {
  const isSolidFill = params.fillMode === "solid";
  const isGridSolidFill = params.fillMode === "grid-solid";
  const width = isSolidFill
    ? [getSolidFillGridUnits(params.widthUnits, params.widthUnit), 0] as const
    : createDimensionTuple(params.widthUnits, params.widthUnit);
  const depth = isSolidFill
    ? [getSolidFillGridUnits(params.depthUnits, params.depthUnit), 0] as const
    : createDimensionTuple(params.depthUnits, params.depthUnit);
  const outerWidth = isSolidFill
    ? createDimensionTuple(params.widthUnits, params.widthUnit)
    : isGridSolidFill
      ? createDimensionTuple(params.outerWidthUnits, params.solidUnit)
      : [0, 0] as const;
  const outerDepth = isSolidFill
    ? createDimensionTuple(params.depthUnits, params.depthUnit)
    : isGridSolidFill
      ? createDimensionTuple(params.outerDepthUnits, params.solidUnit)
      : [0, 0] as const;

  return {
    Base_Plate_Options: params.plateStyle,
    Width: width,
    Depth: depth,
    oversize_method: params.fillMode === "crop" ? "crop" : "fill",
    position_fill_grid_x: params.positionFillGridX,
    position_fill_grid_y: params.positionFillGridY,
    outer_Width: outerWidth,
    outer_Depth: outerDepth,
    outer_Height: params.outerHeightMm,
    position_grid_in_outer_x: params.positionFillGridX,
    position_grid_in_outer_y: params.positionFillGridY,
    Reduced_Wall_Height: params.reducedWallHeightMm,
    Reduced_Wall_Taper: params.reducedWallTaper,
    plate_corner_radius: params.plateCornerRadiusMm,
    secondary_corner_radius: params.secondaryCornerRadiusMm,
    build_plate_enabled: params.buildPlateMode,
    average_plate_sizes: params.averagePlateSizes,
    build_plate_size: [params.buildPlateWidthMm, params.buildPlateDepthMm],
    Enable_Magnets: params.magnets,
    Magnet_Size: params.magnetSize,
    Magnet_Z_Offset: params.magnetZOffsetMm,
    Magnet_Top_Cover: params.magnetTopCoverMm,
    Magnet_Release_Method: params.magnetReleaseMethod,
    Corner_Screw_Enabled: params.cornerScrews,
    Center_Screw_Enabled: params.centerScrew,
    Enable_Weight: params.weightCavities,
    Remove_Bottom_Taper: params.removeBottomTaper,
    Connector_Only: params.connectorOnly,
    Connector_Position: params.connectorPosition,
    Connector_Clip_Enabled: params.connectorClipEnabled,
    Connector_Clip_Size: params.connectorClipSizeMm,
    Connector_Clip_Tolerance: params.connectorClipToleranceMm,
    Connector_Butterfly_Enabled: false,
    Connector_Filament_Enabled: false,
    Connector_Snaps_Enabled: params.connectorSnapsStyle,
    Connector_Snaps_Clearance: params.connectorSnapsClearanceMm,
    Render_Position: "center",
    fa: 6,
    fs: 0.1,
    fn: 0,
    enable_help: false,
  } satisfies Record<string, OpenScadDefineValue>;
}

export function createBaseplateScadSnippet(
  params: GridfinityBaseplateParameters,
) {
  const defines = createBaseplateDefines(params);
  const assignments = Object.entries(defines)
    .map(([key, value]) => `${key} = ${formatScadValue(value)};`)
    .join("\n");

  return `${assignments}\ninclude <gridfinity_baseplate.scad>\n`;
}
