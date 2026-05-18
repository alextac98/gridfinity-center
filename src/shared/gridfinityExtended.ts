import { formatScadValue, type OpenScadDefineValue } from "./openscad-defines";
export { formatScadValue } from "./openscad-defines";

export const gridfinityExtendedRoot =
  "/openscad/gridfinity_extended_openscad";

export const gridfinityExtendedFiles = [
  "gridfinity_basic_cup.scad",
  "gridfinity_baseplate.scad",
  "modules/functions_environment.scad",
  "modules/functions_general.scad",
  "modules/functions_gridfinity.scad",
  "modules/functions_string.scad",
  "modules/gridfinity_constants.scad",
  "modules/module_attachment_clip.scad",
  "modules/module_bin_chambers.scad",
  "modules/module_calipers.scad",
  "modules/module_divider_walls.scad",
  "modules/module_fingerslide.scad",
  "modules/module_gridfinity.scad",
  "modules/module_gridfinity_Extendable.scad",
  "modules/module_gridfinity_baseplate.scad",
  "modules/module_gridfinity_baseplate_cnclaser.scad",
  "modules/module_gridfinity_baseplate_cncmagnet.scad",
  "modules/module_gridfinity_baseplate_common.scad",
  "modules/module_gridfinity_baseplate_common_post.scad",
  "modules/module_gridfinity_baseplate_lid.scad",
  "modules/module_gridfinity_baseplate_regular.scad",
  "modules/module_gridfinity_block.scad",
  "modules/module_gridfinity_cup.scad",
  "modules/module_gridfinity_cup_base.scad",
  "modules/module_gridfinity_cup_base_text.scad",
  "modules/module_gridfinity_efficient_floor.scad",
  "modules/module_gridfinity_frame_connectors.scad",
  "modules/module_gridfinity_label.scad",
  "modules/module_gridfinity_lid.scad",
  "modules/module_gridfinity_sliding_lid.scad",
  "modules/module_item_holder.scad",
  "modules/module_item_holder_data.scad",
  "modules/module_lip.scad",
  "modules/module_magnet.scad",
  "modules/module_pattern_brick.scad",
  "modules/module_pattern_slat.scad",
  "modules/module_pattern_voronoi.scad",
  "modules/module_patterns.scad",
  "modules/module_rounded_negative_champher.scad",
  "modules/module_voronoi.scad",
  "modules/module_wallplacard.scad",
  "modules/polyround.scad",
  "modules/thirdparty/dotSCAD/__comm__/__frags.scad",
  "modules/thirdparty/dotSCAD/__comm__/__ra_to_xy.scad",
  "modules/thirdparty/dotSCAD/__comm__/__to_ang_vect.scad",
  "modules/thirdparty/dotSCAD/cross_sections.scad",
  "modules/thirdparty/dotSCAD/matrix/_impl/_m_rotation_impl.scad",
  "modules/thirdparty/dotSCAD/matrix/_impl/_m_scaling_impl.scad",
  "modules/thirdparty/dotSCAD/matrix/_impl/_m_translation_impl.scad",
  "modules/thirdparty/dotSCAD/matrix/m_rotation.scad",
  "modules/thirdparty/dotSCAD/matrix/m_scaling.scad",
  "modules/thirdparty/dotSCAD/matrix/m_translation.scad",
  "modules/thirdparty/dotSCAD/ring_extrude.scad",
  "modules/thirdparty/dotSCAD/sweep.scad",
  "modules/thirdparty/dotSCAD/util/reverse.scad",
  "modules/thirdparty/ub_caliper.scad",
  "modules/thirdparty/ub_common.scad",
  "modules/thirdparty/ub_helptxt.scad",
  "modules/thirdparty/ub_hexgrid.scad",
  "modules/thirdparty/ub_sbogen.scad",
  "modules/utility/SequentialBridgingDoubleHole.scad",
  "modules/utility/chamfered_shapes.scad",
  "modules/utility/circle_wavy.scad",
  "modules/utility/module_utility.scad",
  "modules/utility/utilities.scad",
  "modules/utility/wallcutout.scad",
] as const;

export type { OpenScadDefineValue } from "./openscad-defines";

export type GridfinityBinExtraDefines = Record<string, OpenScadDefineValue>;

export type GridfinityBinParameters = {
  widthUnits: number;
  depthUnits: number;
  heightUnits: number;
  verticalChambers: number;
  horizontalChambers: number;
  lipStyle: "normal" | "reduced" | "reduced_double" | "minimum" | "none";
  labelStyle: "disabled" | "normal" | "gflabel" | "pred" | "cullenect" | "cullenect_legacy";
  labelPosition: "left" | "center" | "right" | "leftchamber" | "centerchamber" | "rightchamber";
  fingerslide: "none" | "rounded" | "chamfered";
  magnets: boolean;
  screws: boolean;
  flatBase: "off" | "gridfinity" | "rounded";
  filledIn: boolean;
  wallThicknessMm: number;
  extraDefines: GridfinityBinExtraDefines;
};

export function getMinimumWallThicknessMm(heightUnits: number) {
  if (heightUnits < 6) {
    return 0.95;
  }

  if (heightUnits < 12) {
    return 1.2;
  }

  return 1.6;
}

export const defaultGridfinityBinParameters: GridfinityBinParameters = {
  widthUnits: 1,
  depthUnits: 2,
  heightUnits: 3,
  verticalChambers: 1,
  horizontalChambers: 1,
  lipStyle: "normal",
  labelStyle: "disabled",
  labelPosition: "left",
  fingerslide: "none",
  magnets: false,
  screws: false,
  flatBase: "off",
  filledIn: false,
  wallThicknessMm: getMinimumWallThicknessMm(3),
  extraDefines: {
    headroom: 0.8,
    lip_side_relief_trigger: [1, 1],
    lip_top_relief_height: -1,
    lip_top_relief_width: -1,
    lip_top_notches: true,
    lip_clip_position: "disabled",
    lip_non_blocking: false,
    height_includes_lip: false,
    chamber_wall_thickness: [getMinimumWallThicknessMm(3), getMinimumWallThicknessMm(3)],
    chamber_wall_headroom: 0,
    chamber_wall_top_radius: 0,
    vertical_separator_bend_separation: 0,
    vertical_separator_bend_angle: 45,
    vertical_separator_bend_position: 0,
    vertical_separator_cut_depth: 0,
    horizontal_separator_bend_separation: 0,
    horizontal_separator_bend_angle: 45,
    horizontal_separator_bend_position: 0,
    horizontal_separator_cut_depth: 0,
    vertical_irregular_subdivisions: false,
    vertical_separator_config: "10.5|21|42|50|60",
    horizontal_irregular_subdivisions: false,
    horizontal_separator_config: "10.5|21|42|50|60",
    magnet_size: [6.5, 2.4],
    magnet_easy_release: "auto",
    magnet_side_access: "disabled",
    magnet_captive_height: 0,
    magnet_crush_depth: 0,
    magnet_chamfer: 0,
    screw_size: [3, 6],
    center_magnet_size: [0, 0],
    hole_overhang_remedy: 2,
    box_corner_attachments_only: "enabled",
    floor_thickness: 0.7,
    cavity_floor_radius: -1,
    efficient_floor: "off",
    sub_pitch: 1,
    spacer: false,
    minimum_printable_pad_size: 0.2,
    flat_base_rounded_radius: -1,
    flat_base_rounded_easyPrint: -1,
    align_grid_x: "near",
    align_grid_y: "near",
    label_dividers: "disabled",
    label_size: [0, 14, 0, 0.6],
    label_relief: [0, 0, 0, 0.6],
    label_walls: [0, 1, 0, 0],
    sliding_lid_enabled: false,
    sliding_lid_thickness: 0,
    sliding_lid_min_wall_thickness: 0,
    sliding_lid_min_support: 0,
    sliding_lid_clearance: 0.1,
    sliding_lid_pull_style: "disabled",
    sliding_lid_nub_size: 0.5,
    fingerslide_radius: 7,
    fingerslide_walls: [1, 0, 0, 0],
    fingerslide_lip_aligned: true,
    tapered_corner: "none",
    tapered_corner_size: 10,
    tapered_setback: -1,
    wallpattern_enabled: false,
    wallpattern_style: "hexgrid",
    wallpattern_strength: 2,
    wallpattern_walls: [1, 1, 1, 1],
    wallpattern_rotate_grid: false,
    wallpattern_cell_size: [10, 10],
    wallpattern_dividers_enabled: "disabled",
    wallpattern_hole_sides: 6,
    wallpattern_hole_radius: 0.5,
    wallpattern_fill: "none",
    wallpattern_border: 0,
    wallpattern_depth: 0,
    wallpattern_pattern_grid_chamfer: 0,
    wallpattern_pattern_voronoi_noise: 0.75,
    wallpattern_pattern_brick_weight: 5,
    wallpattern_pattern_quality: 0.4,
    wallpattern_colored: "disabled",
    floorpattern_enabled: false,
    floorpattern_style: "hexgrid",
    floorpattern_strength: 2,
    floorpattern_rotate_grid: false,
    floorpattern_cell_size: [10, 10],
    floorpattern_hole_sides: 6,
    floorpattern_hole_radius: 0.5,
    floorpattern_fill: "crop",
    floorpattern_border: 0,
    floorpattern_depth: 0,
    floorpattern_pattern_grid_chamfer: 0,
    floorpattern_pattern_voronoi_noise: 0.75,
    floorpattern_pattern_brick_weight: 5,
    floorpattern_pattern_quality: 0.4,
    wallcutout_vertical: "disabled",
    wallcutout_vertical_position: [-2, -0.5, -0.5, -0.5],
    wallcutout_vertical_width: 0,
    wallcutout_vertical_angle: 70,
    wallcutout_vertical_height: 0,
    wallcutout_vertical_corner_radius: 5,
    wallcutout_horizontal: "disabled",
    wallcutout_horizontal_position: [-2, -0.5, -0.5, -0.5],
    wallcutout_horizontal_width: 0,
    wallcutout_horizontal_angle: 70,
    wallcutout_horizontal_height: 0,
    wallcutout_horizontal_corner_radius: 5,
  },
};

function toBooleanNumberTuple(
  value: OpenScadDefineValue | undefined,
  fallback: readonly number[],
) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.map((item) => {
    if (typeof item === "number") {
      return item === 0 ? 0 : 1;
    }

    return item === true ? 1 : 0;
  });
}

function toFingerSlideWallsTuple(
  value: OpenScadDefineValue | undefined,
  fallback: readonly number[],
) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.map((item) => {
    if (typeof item === "number" && Number.isFinite(item)) {
      return item;
    }

    return item === true ? 1 : 0;
  });
}

export function normalizeBinExtraDefines(
  extraDefines: GridfinityBinExtraDefines,
): GridfinityBinExtraDefines {
  return {
    ...extraDefines,
    fingerslide_walls: toFingerSlideWallsTuple(
      extraDefines.fingerslide_walls,
      [1, 0, 0, 0],
    ),
    label_walls: toBooleanNumberTuple(extraDefines.label_walls, [0, 1, 0, 0]),
  };
}

export function createBinDefines(params: GridfinityBinParameters) {
  const extraDefines = normalizeBinExtraDefines(params.extraDefines);

  return {
    ...extraDefines,
    width: [params.widthUnits, 0],
    depth: [params.depthUnits, 0],
    height: [params.heightUnits, 0],
    vertical_chambers: params.verticalChambers,
    horizontal_chambers: params.horizontalChambers,
    lip_style: params.lipStyle,
    label_style: params.labelStyle,
    label_position: params.labelPosition,
    fingerslide: params.fingerslide,
    enable_magnets: params.magnets,
    enable_screws: params.screws,
    flat_base: params.flatBase,
    filled_in: params.filledIn ? "enabled" : "disabled",
    wall_thickness: params.wallThicknessMm,
    set_colour: "enable",
    render_position: "center",
    fa: 10,
    fs: 0.8,
    force_render: false,
  } satisfies Record<string, OpenScadDefineValue>;
}

export function createBinScadSnippet(params: GridfinityBinParameters) {
  const defines = createBinDefines(params);
  const assignments = Object.entries(defines)
    .map(([key, value]) => `${key} = ${formatScadValue(value)};`)
    .join("\n");

  return `${assignments}\ninclude <gridfinity_basic_cup.scad>\n`;
}
