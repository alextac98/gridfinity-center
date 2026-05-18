import { formatScadValue, type OpenScadDefineValue } from "./openscad-defines";

export type BaseplateAlignment = "near" | "center" | "far";
export type BaseplateStyle = "default" | "cnclaser";
export type OversizeMethod = "crop" | "fill";
export type BuildPlateMode = "disabled" | "enabled" | "unique";
export type MagnetReleaseMethod = "none" | "slot" | "hole";
export type ConnectorPosition = "center_wall" | "intersection" | "both";
export type ConnectorSnapsStyle = "disabled" | "larger" | "smaller";

export type GridfinityBaseplateParameters = {
  widthUnits: number;
  depthUnits: number;
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
  plateStyle: "default",
  oversizeMethod: "fill",
  positionFillGridX: "near",
  positionFillGridY: "near",
  outerWidthUnits: 0,
  outerDepthUnits: 0,
  outerHeightMm: 0,
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

export function createBaseplateDefines(params: GridfinityBaseplateParameters) {
  return {
    Base_Plate_Options: params.plateStyle,
    Width: [params.widthUnits, 0],
    Depth: [params.depthUnits, 0],
    oversize_method: params.oversizeMethod,
    position_fill_grid_x: params.positionFillGridX,
    position_fill_grid_y: params.positionFillGridY,
    outer_Width: [params.outerWidthUnits, 0],
    outer_Depth: [params.outerDepthUnits, 0],
    outer_Height: params.outerHeightMm,
    position_grid_in_outer_x: params.positionGridInOuterX,
    position_grid_in_outer_y: params.positionGridInOuterY,
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
