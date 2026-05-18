import type { GridfinityBinParameters } from "@/shared/gridfinityExtended";
import type {
  ParameterOption,
  ParameterOptionGroup,
} from "@/ui/apps/openscad/parameterTypes";

export type NumberField = keyof Pick<
  GridfinityBinParameters,
  | "widthUnits"
  | "depthUnits"
  | "heightUnits"
  | "verticalChambers"
  | "horizontalChambers"
  | "wallThicknessMm"
>;

export type ExtraOption = ParameterOption;
export type ExtraOptionGroup = ParameterOptionGroup;

export const numberFields: Record<
  NumberField,
  { label: string; min: number; max: number; step: number; suffix: string }
> = {
  widthUnits: { label: "Width", min: 0.5, max: 12, step: 0.5, suffix: "u" },
  depthUnits: { label: "Depth", min: 0.5, max: 12, step: 0.5, suffix: "u" },
  heightUnits: { label: "Height", min: 1, max: 24, step: 1, suffix: "u" },
  verticalChambers: {
    label: "X Compartments",
    min: 1,
    max: 8,
    step: 1,
    suffix: "ct",
  },
  horizontalChambers: {
    label: "Y Compartments",
    min: 1,
    max: 8,
    step: 1,
    suffix: "ct",
  },
  wallThicknessMm: {
    label: "Wall Thickness",
    min: 0.95,
    max: 4,
    step: 0.05,
    suffix: "mm",
  },
};

export const generalNumberFields: NumberField[] = [
  "widthUnits",
  "depthUnits",
  "heightUnits",
  "wallThicknessMm",
];

export const chamberNumberFields: NumberField[] = [
  "verticalChambers",
  "horizontalChambers",
];

export const disabledBothOptions = [
  { value: "disabled", label: "Disabled" },
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
  { value: "both", label: "Both" },
] as const;

const patternStyleOptions = [
  { value: "hexgrid", label: "Hex Grid" },
  { value: "grid", label: "Grid" },
  { value: "voronoi", label: "Voronoi" },
  { value: "voronoigrid", label: "Voronoi Grid" },
  { value: "voronoihexgrid", label: "Voronoi Hex Grid" },
  { value: "brick", label: "Brick" },
  { value: "brickoffset", label: "Brick Offset" },
] as const;

const patternFillOptions = [
  { value: "none", label: "None" },
  { value: "space", label: "Space" },
  { value: "crop", label: "Crop" },
  { value: "crophorizontal", label: "Crop Horizontal" },
  { value: "cropvertical", label: "Crop Vertical" },
  {
    value: "crophorizontal_spacevertical",
    label: "Crop Horizontal, Space Vertical",
  },
  {
    value: "cropvertical_spacehorizontal",
    label: "Crop Vertical, Space Horizontal",
  },
  { value: "spacevertical", label: "Space Vertical" },
  { value: "spacehorizontal", label: "Space Horizontal" },
] as const;

const holeSideOptions = [
  { value: 4, label: "Square" },
  { value: 6, label: "Hex" },
  { value: 8, label: "Octagon" },
  { value: 64, label: "Circle" },
] as const;

const wallCutoutVerticalOptions = [
  { value: "disabled", label: "Disabled" },
  { value: "enabled", label: "Enabled" },
  { value: "inneronly", label: "Inner Only" },
  { value: "wallsonly", label: "Walls Only" },
  { value: "frontonly", label: "Front Only" },
  { value: "backonly", label: "Back Only" },
] as const;

const wallCutoutHorizontalOptions = [
  { value: "disabled", label: "Disabled" },
  { value: "enabled", label: "Enabled" },
  { value: "inneronly", label: "Inner Only" },
  { value: "wallsonly", label: "Walls Only" },
  { value: "leftonly", label: "Left Only" },
  { value: "rightonly", label: "Right Only" },
] as const;

export const labelDetailOptions: ExtraOption[] = [
  {
    key: "label_dividers",
    label: "Divider Labels",
    type: "select",
    options: disabledBothOptions,
  },
  {
    key: "label_size",
    label: "Label Size",
    type: "tuple",
    labels: ["Width", "Depth", "Height", "Radius"],
    step: 0.01,
    suffix: ["u", "mm", "mm", "mm"],
  },
  {
    key: "label_relief",
    label: "Label Relief",
    type: "tuple",
    labels: ["Width", "Depth", "Height", "Radius"],
    step: 0.1,
    suffix: "mm",
  },
  {
    key: "label_walls",
    label: "Label Walls",
    type: "tuple",
    labels: ["Front", "Back", "Left", "Right"],
    valueKind: "boolean",
    step: 1,
  },
];

export const extraOptionGroups: ExtraOptionGroup[] = [
  {
    title: "Bin Lip",
    columns: true,
    options: [
      {
        key: "headroom",
        label: "Headroom",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "height_includes_lip",
        label: "Height Includes Lip",
        type: "boolean",
      },
      {
        key: "lip_side_relief_trigger",
        label: "Side Relief Trigger",
        type: "tuple",
        labels: ["X", "Y"],
        step: 0.1,
        suffix: "u",
      },
      {
        key: "lip_top_relief_height",
        label: "Top Relief Height",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "lip_top_relief_width",
        label: "Top Relief Width",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      { key: "lip_top_notches", label: "Top Notches", type: "boolean" },
      {
        key: "lip_clip_position",
        label: "Lip Clip",
        type: "select",
        options: [
          { value: "disabled", label: "Disabled" },
          { value: "intersection", label: "Intersection" },
          { value: "center_wall", label: "Center Wall" },
          { value: "both", label: "Both" },
        ],
      },
      { key: "lip_non_blocking", label: "Non-Blocking Lip", type: "boolean" },
    ],
  },
  {
    title: "Subdivision Details",
    columns: true,
    options: [
      {
        key: "chamber_wall_thickness",
        label: "Divider Wall Thickness",
        type: "tuple",
        labels: ["Bottom", "Top"],
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "chamber_wall_headroom",
        label: "Divider Headroom",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "chamber_wall_top_radius",
        label: "Divider Top Radius",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "vertical_separator_bend_separation",
        label: "X Divider Bend Separation",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "vertical_separator_bend_angle",
        label: "X Divider Bend Angle",
        type: "number",
        step: 1,
        suffix: "deg",
      },
      {
        key: "vertical_separator_bend_position",
        label: "X Divider Bend Position",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "vertical_separator_cut_depth",
        label: "X Divider Cut Depth",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "vertical_irregular_subdivisions",
        label: "Custom X Dividers",
        type: "boolean",
      },
      {
        key: "vertical_separator_config",
        label: "X Divider Positions",
        type: "text",
      },
      {
        key: "horizontal_separator_bend_separation",
        label: "Y Divider Bend Separation",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "horizontal_separator_bend_angle",
        label: "Y Divider Bend Angle",
        type: "number",
        step: 1,
        suffix: "deg",
      },
      {
        key: "horizontal_separator_bend_position",
        label: "Y Divider Bend Position",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "horizontal_separator_cut_depth",
        label: "Y Divider Cut Depth",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "horizontal_irregular_subdivisions",
        label: "Custom Y Dividers",
        type: "boolean",
      },
      {
        key: "horizontal_separator_config",
        label: "Y Divider Positions",
        type: "text",
      },
    ],
  },
  {
    title: "Base",
    columns: true,
    options: [
      {
        key: "magnet_size",
        label: "Magnet Size",
        type: "tuple",
        labels: ["Diameter", "Height"],
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "magnet_easy_release",
        label: "Magnet Release",
        type: "select",
        options: [
          { value: "off", label: "Off" },
          { value: "auto", label: "Auto" },
          { value: "inner", label: "Inner" },
          { value: "outer", label: "Outer" },
        ],
      },
      {
        key: "magnet_side_access",
        label: "Magnet Side Access",
        type: "select",
        options: [
          { value: "disabled", label: "Disabled" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
      {
        key: "magnet_captive_height",
        label: "Captive Magnet Height",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "magnet_crush_depth",
        label: "Magnet Crush Depth",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "magnet_chamfer",
        label: "Magnet Chamfer",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "screw_size",
        label: "Screw Size",
        type: "tuple",
        labels: ["Diameter", "Height"],
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "center_magnet_size",
        label: "Center Magnet Size",
        type: "tuple",
        labels: ["Diameter", "Height"],
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "hole_overhang_remedy",
        label: "Hole Overhang Remedy",
        type: "number",
        step: 1,
        suffix: "mm",
      },
      {
        key: "box_corner_attachments_only",
        label: "Corner Attachments",
        type: "select",
        options: [
          { value: "disabled", label: "Disabled" },
          { value: "enabled", label: "Enabled" },
          { value: "aligned", label: "Aligned" },
        ],
      },
      {
        key: "floor_thickness",
        label: "Floor Thickness",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "cavity_floor_radius",
        label: "Cavity Floor Radius",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "efficient_floor",
        label: "Efficient Floor",
        type: "select",
        options: [
          { value: "off", label: "Off" },
          { value: "on", label: "On" },
          { value: "rounded", label: "Rounded" },
          { value: "smooth", label: "Smooth" },
        ],
      },
      {
        key: "sub_pitch",
        label: "Sub Pitch",
        type: "select",
        options: [
          { value: 1, label: "Disabled" },
          { value: 2, label: "Half Pitch" },
          { value: 3, label: "Third Pitch" },
          { value: 4, label: "Quarter Pitch" },
        ],
      },
      { key: "spacer", label: "Spacer", type: "boolean" },
      {
        key: "minimum_printable_pad_size",
        label: "Minimum Pad Size",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "flat_base_rounded_radius",
        label: "Rounded Base Radius",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "flat_base_rounded_easyPrint",
        label: "Rounded Base Chamfer",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "align_grid_x",
        label: "Align Grid X",
        type: "select",
        options: [
          { value: "near", label: "Near" },
          { value: "far", label: "Far" },
        ],
      },
      {
        key: "align_grid_y",
        label: "Align Grid Y",
        type: "select",
        options: [
          { value: "near", label: "Near" },
          { value: "far", label: "Far" },
        ],
      },
    ],
  },
  {
    title: "Sliding Lid",
    columns: true,
    options: [
      {
        key: "sliding_lid_enabled",
        label: "Enable Sliding Lid",
        type: "boolean",
        fullWidth: true,
      },
      {
        key: "sliding_lid_thickness",
        label: "Lid Thickness",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "sliding_lid_min_wall_thickness",
        label: "Min Wall Thickness",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "sliding_lid_min_support",
        label: "Min Support",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "sliding_lid_clearance",
        label: "Clearance",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "sliding_lid_pull_style",
        label: "Pull Style",
        type: "select",
        options: [
          { value: "disabled", label: "Disabled" },
          { value: "lip", label: "Lip" },
          { value: "finger", label: "Finger" },
        ],
      },
      {
        key: "sliding_lid_nub_size",
        label: "Nub Size",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
    ],
  },
  {
    title: "Finger Slide Details",
    columns: true,
    options: [
      {
        key: "fingerslide_radius",
        label: "Radius",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "fingerslide_lip_aligned",
        label: "Align With Lip",
        type: "boolean",
      },
      {
        key: "fingerslide_walls",
        label: "Slide Sides",
        type: "tuple",
        labels: [
          "Enable On Front",
          "Enable On Back",
          "Enable On Left",
          "Enable On Right",
        ],
        valueKind: "fingerSlideSides",
        step: 1,
      },
    ],
  },
  {
    title: "Tapered Corner",
    columns: true,
    options: [
      {
        key: "tapered_corner",
        label: "Taper",
        type: "select",
        fullWidth: true,
        options: [
          { value: "none", label: "None" },
          { value: "rounded", label: "Rounded" },
          { value: "chamfered", label: "Chamfered" },
        ],
      },
      {
        key: "tapered_corner_size",
        label: "Size",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "tapered_setback",
        label: "Setback",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
    ],
  },
  {
    title: "Wall Pattern",
    columns: true,
    options: [
      {
        key: "wallpattern_enabled",
        label: "Enable Wall Pattern",
        type: "boolean",
      },
      {
        key: "wallpattern_style",
        label: "Style",
        type: "select",
        options: patternStyleOptions,
      },
      {
        key: "wallpattern_strength",
        label: "Strength",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallpattern_walls",
        label: "Pattern Walls",
        type: "tuple",
        labels: ["Front", "Back", "Left", "Right"],
        step: 1,
        suffix: "0/1",
      },
      { key: "wallpattern_rotate_grid", label: "Rotate Grid", type: "boolean" },
      {
        key: "wallpattern_cell_size",
        label: "Cell Size",
        type: "tuple",
        labels: ["Width", "Height"],
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallpattern_dividers_enabled",
        label: "Divider Pattern",
        type: "select",
        options: disabledBothOptions,
      },
      {
        key: "wallpattern_hole_sides",
        label: "Hole Shape",
        type: "select",
        options: holeSideOptions,
      },
      {
        key: "wallpattern_hole_radius",
        label: "Hole Radius",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallpattern_fill",
        label: "Fill Mode",
        type: "select",
        options: patternFillOptions,
      },
      {
        key: "wallpattern_border",
        label: "Border",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallpattern_depth",
        label: "Depth",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallpattern_pattern_grid_chamfer",
        label: "Grid Chamfer",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallpattern_pattern_voronoi_noise",
        label: "Voronoi Noise",
        type: "number",
        step: 0.01,
        suffix: "ratio",
      },
      {
        key: "wallpattern_pattern_brick_weight",
        label: "Brick Weight",
        type: "number",
        step: 1,
      },
      {
        key: "wallpattern_pattern_quality",
        label: "Pattern Quality",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallpattern_colored",
        label: "Colored Pattern",
        type: "select",
        options: [
          { value: "disabled", label: "Disabled" },
          { value: "enabled", label: "Enabled" },
        ],
      },
    ],
  },
  {
    title: "Floor Pattern",
    columns: true,
    options: [
      {
        key: "floorpattern_enabled",
        label: "Enable Floor Pattern",
        type: "boolean",
      },
      {
        key: "floorpattern_style",
        label: "Style",
        type: "select",
        options: patternStyleOptions,
      },
      {
        key: "floorpattern_strength",
        label: "Strength",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "floorpattern_rotate_grid",
        label: "Rotate Grid",
        type: "boolean",
      },
      {
        key: "floorpattern_cell_size",
        label: "Cell Size",
        type: "tuple",
        labels: ["Width", "Height"],
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "floorpattern_hole_sides",
        label: "Hole Shape",
        type: "select",
        options: holeSideOptions,
      },
      {
        key: "floorpattern_hole_radius",
        label: "Hole Radius",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "floorpattern_fill",
        label: "Fill Mode",
        type: "select",
        options: patternFillOptions,
      },
      {
        key: "floorpattern_border",
        label: "Border",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "floorpattern_depth",
        label: "Depth",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "floorpattern_pattern_grid_chamfer",
        label: "Grid Chamfer",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "floorpattern_pattern_voronoi_noise",
        label: "Voronoi Noise",
        type: "number",
        step: 0.01,
        suffix: "ratio",
      },
      {
        key: "floorpattern_pattern_brick_weight",
        label: "Brick Weight",
        type: "number",
        step: 1,
      },
      {
        key: "floorpattern_pattern_quality",
        label: "Pattern Quality",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
    ],
  },
  {
    title: "Wall Cutouts",
    columns: true,
    options: [
      {
        key: "wallcutout_vertical",
        label: "X Wall Cutout",
        type: "select",
        options: wallCutoutVerticalOptions,
      },
      {
        key: "wallcutout_vertical_position",
        label: "X Cutout Position",
        type: "tuple",
        labels: ["A", "B", "C", "D"],
        step: 0.01,
        suffix: "mm",
      },
      {
        key: "wallcutout_vertical_width",
        label: "X Cutout Width",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallcutout_vertical_angle",
        label: "X Cutout Angle",
        type: "number",
        step: 1,
        suffix: "deg",
      },
      {
        key: "wallcutout_vertical_height",
        label: "X Cutout Height",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallcutout_vertical_corner_radius",
        label: "X Corner Radius",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallcutout_horizontal",
        label: "Y Wall Cutout",
        type: "select",
        options: wallCutoutHorizontalOptions,
      },
      {
        key: "wallcutout_horizontal_position",
        label: "Y Cutout Position",
        type: "tuple",
        labels: ["A", "B", "C", "D"],
        step: 0.01,
        suffix: "mm",
      },
      {
        key: "wallcutout_horizontal_width",
        label: "Y Cutout Width",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallcutout_horizontal_angle",
        label: "Y Cutout Angle",
        type: "number",
        step: 1,
        suffix: "deg",
      },
      {
        key: "wallcutout_horizontal_height",
        label: "Y Cutout Height",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
      {
        key: "wallcutout_horizontal_corner_radius",
        label: "Y Corner Radius",
        type: "number",
        step: 0.1,
        suffix: "mm",
      },
    ],
  },
];
