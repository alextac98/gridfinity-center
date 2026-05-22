import type {
  BaseplateDimensionUnit,
  BaseplateFillMode,
  BaseplateAlignment,
  BuildPlateMode,
  ConnectorPosition,
  ConnectorSnapsStyle,
  MagnetReleaseMethod,
  BaseplateStyle,
  GridfinityBaseplateParameters,
} from "@/shared/gridfinityBaseplate";
import { GRIDFINITY_GRID_MM } from "@/shared/gridfinity/constants";

export type GridNumberField = keyof Pick<
  GridfinityBaseplateParameters,
  | "widthUnits"
  | "depthUnits"
  | "outerWidthUnits"
  | "outerDepthUnits"
  | "outerHeightMm"
  | "reducedWallHeightMm"
  | "plateCornerRadiusMm"
  | "secondaryCornerRadiusMm"
  | "buildPlateWidthMm"
  | "buildPlateDepthMm"
  | "magnetZOffsetMm"
  | "magnetTopCoverMm"
  | "connectorClipSizeMm"
  | "connectorClipToleranceMm"
  | "connectorSnapsClearanceMm"
>;

export const gridNumberFields: Record<
  GridNumberField,
  { label: string; min: number; max: number; step: number; suffix: string }
> = {
  widthUnits: {
    label: "Grid Width",
    min: 0.5,
    max: 24,
    step: 0.5,
    suffix: "u",
  },
  depthUnits: {
    label: "Grid Depth",
    min: 0.5,
    max: 24,
    step: 0.5,
    suffix: "u",
  },
  outerWidthUnits: {
    label: "Solid Width",
    min: 0,
    max: 30,
    step: 0.5,
    suffix: "u",
  },
  outerDepthUnits: {
    label: "Solid Depth",
    min: 0,
    max: 30,
    step: 0.5,
    suffix: "u",
  },
  outerHeightMm: {
    label: "Solid Height",
    min: 0,
    max: 4,
    step: 0.1,
    suffix: "mm",
  },
  reducedWallHeightMm: {
    label: "Reduced Wall Height",
    min: -1,
    max: 20,
    step: 0.1,
    suffix: "mm",
  },
  plateCornerRadiusMm: {
    label: "Outer Corner Radius",
    min: 0,
    max: 12,
    step: 0.05,
    suffix: "mm",
  },
  secondaryCornerRadiusMm: {
    label: "Inner Corner Radius",
    min: 0,
    max: 12,
    step: 0.05,
    suffix: "mm",
  },
  buildPlateWidthMm: {
    label: "Build Plate Width",
    min: 1,
    max: 1000,
    step: 1,
    suffix: "mm",
  },
  buildPlateDepthMm: {
    label: "Build Plate Depth",
    min: 1,
    max: 1000,
    step: 1,
    suffix: "mm",
  },
  magnetZOffsetMm: {
    label: "Magnet Z Offset",
    min: 0,
    max: 10,
    step: 0.1,
    suffix: "mm",
  },
  magnetTopCoverMm: {
    label: "Magnet Top Cover",
    min: 0,
    max: 10,
    step: 0.1,
    suffix: "mm",
  },
  connectorClipSizeMm: {
    label: "Clip Size",
    min: 1,
    max: 40,
    step: 0.1,
    suffix: "mm",
  },
  connectorClipToleranceMm: {
    label: "Clip Tolerance",
    min: 0,
    max: 2,
    step: 0.05,
    suffix: "mm",
  },
  connectorSnapsClearanceMm: {
    label: "Snap Clearance",
    min: 0,
    max: 2,
    step: 0.05,
    suffix: "mm",
  },
};

export const baseplateDimensionUnitOptions = [
  { value: "u", label: "u" },
  { value: "mm", label: "mm" },
  { value: "in", label: "in" },
] as const satisfies readonly {
  value: BaseplateDimensionUnit;
  label: string;
}[];

export function getGridSizeFieldConfig(unit: BaseplateDimensionUnit) {
  if (unit === "mm") {
    return {
      ...gridNumberFields.widthUnits,
      min: GRIDFINITY_GRID_MM / 2,
      max: GRIDFINITY_GRID_MM * 24,
      step: 1,
      suffix: "mm",
    };
  }

  if (unit === "in") {
    return {
      ...gridNumberFields.widthUnits,
      min: Number((GRIDFINITY_GRID_MM / 2 / 25.4).toFixed(2)),
      max: Number(((GRIDFINITY_GRID_MM * 24) / 25.4).toFixed(2)),
      step: 0.05,
      suffix: "in",
    };
  }

  return gridNumberFields.widthUnits;
}

export function getSolidSizeFieldConfig(unit: BaseplateDimensionUnit) {
  const baseConfig = gridNumberFields.outerWidthUnits;

  if (unit === "mm") {
    return {
      ...baseConfig,
      min: 0,
      max: GRIDFINITY_GRID_MM * 30,
      step: 1,
      suffix: "mm",
    };
  }

  if (unit === "in") {
    return {
      ...baseConfig,
      min: 0,
      max: Number(((GRIDFINITY_GRID_MM * 30) / 25.4).toFixed(2)),
      step: 0.05,
      suffix: "in",
    };
  }

  return baseConfig;
}

export function convertGridSizeValue(
  value: number,
  from: BaseplateDimensionUnit,
  to: BaseplateDimensionUnit,
) {
  const mm =
    from === "u"
      ? value * GRIDFINITY_GRID_MM
      : from === "in"
        ? value * 25.4
        : value;

  if (to === "u") {
    return mm / GRIDFINITY_GRID_MM;
  }

  return to === "in" ? mm / 25.4 : mm;
}

export const plateStyleOptions = [
  { value: "default", label: "Standard Grid" },
  { value: "cnclaser", label: "Laser Cut Grid" },
] as const satisfies readonly { value: BaseplateStyle; label: string }[];

export const fillModeOptions = [
  { value: "crop", label: "Crop" },
  { value: "grid", label: "Fill with Grid" },
  { value: "solid", label: "Fill with Solid" },
  { value: "grid-solid", label: "Grid + Solid" },
] as const satisfies readonly { value: BaseplateFillMode; label: string }[];

export const alignmentOptions = [
  { value: "near", label: "Near" },
  { value: "center", label: "Center" },
  { value: "far", label: "Far" },
] as const satisfies readonly { value: BaseplateAlignment; label: string }[];

export const widthAlignmentOptions = [
  { value: "near", label: "Right" },
  { value: "center", label: "Split" },
  { value: "far", label: "Left" },
] as const satisfies readonly { value: BaseplateAlignment; label: string }[];

export const depthAlignmentOptions = [
  { value: "near", label: "Back" },
  { value: "center", label: "Split" },
  { value: "far", label: "Front" },
] as const satisfies readonly { value: BaseplateAlignment; label: string }[];

export const buildPlateModeOptions = [
  { value: "disabled", label: "Disabled" },
  { value: "enabled", label: "Split Plates" },
  { value: "unique", label: "Unique Plates Only" },
] as const satisfies readonly { value: BuildPlateMode; label: string }[];

export const splitDistributionOptions = [
  { value: "full-first", label: "Fill Plate First" },
  { value: "balanced", label: "Balance Plates" },
] as const;

export const magnetReleaseOptions = [
  { value: "none", label: "None" },
  { value: "slot", label: "Side Slot" },
  { value: "hole", label: "Poke Hole" },
] as const satisfies readonly { value: MagnetReleaseMethod; label: string }[];

export const connectorPositionOptions = [
  { value: "center_wall", label: "Center Wall" },
  { value: "intersection", label: "Intersection" },
  { value: "both", label: "Both" },
] as const satisfies readonly { value: ConnectorPosition; label: string }[];

export const connectorModeOptions = [
  { value: "none", label: "No Connector" },
  { value: "clip", label: "Clip Connector" },
  { value: "snap", label: "Snap Connector" },
] as const;

export const connectorSnapsOptions = [
  { value: "larger", label: "Larger" },
  { value: "smaller", label: "Smaller" },
] as const satisfies readonly {
  value: Exclude<ConnectorSnapsStyle, "disabled">;
  label: string;
}[];
