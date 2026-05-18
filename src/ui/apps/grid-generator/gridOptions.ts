import type {
  BaseplateAlignment,
  BuildPlateMode,
  ConnectorPosition,
  ConnectorSnapsStyle,
  MagnetReleaseMethod,
  OversizeMethod,
  BaseplateStyle,
  GridfinityBaseplateParameters,
} from "@/shared/gridfinityBaseplate";

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
  widthUnits: { label: "Width", min: 0.5, max: 24, step: 0.5, suffix: "u" },
  depthUnits: { label: "Depth", min: 0.5, max: 24, step: 0.5, suffix: "u" },
  outerWidthUnits: {
    label: "Outer Width",
    min: 0,
    max: 30,
    step: 0.5,
    suffix: "u",
  },
  outerDepthUnits: {
    label: "Outer Depth",
    min: 0,
    max: 30,
    step: 0.5,
    suffix: "u",
  },
  outerHeightMm: {
    label: "Outer Height",
    min: 0,
    max: 40,
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

export const plateStyleOptions = [
  { value: "default", label: "Efficient Base" },
  { value: "cnclaser", label: "CNC / Laser Cut" },
] as const satisfies readonly { value: BaseplateStyle; label: string }[];

export const oversizeMethodOptions = [
  { value: "fill", label: "Fill" },
  { value: "crop", label: "Crop" },
] as const satisfies readonly { value: OversizeMethod; label: string }[];

export const alignmentOptions = [
  { value: "near", label: "Near" },
  { value: "center", label: "Center" },
  { value: "far", label: "Far" },
] as const satisfies readonly { value: BaseplateAlignment; label: string }[];

export const buildPlateModeOptions = [
  { value: "disabled", label: "Disabled" },
  { value: "enabled", label: "Split Plates" },
  { value: "unique", label: "Unique Plates Only" },
] as const satisfies readonly { value: BuildPlateMode; label: string }[];

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

export const connectorSnapsOptions = [
  { value: "disabled", label: "Disabled" },
  { value: "larger", label: "Larger" },
  { value: "smaller", label: "Smaller" },
] as const satisfies readonly { value: ConnectorSnapsStyle; label: string }[];
