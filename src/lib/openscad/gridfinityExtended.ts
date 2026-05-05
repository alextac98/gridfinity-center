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

export type OpenScadDefineValue =
  | string
  | number
  | boolean
  | readonly OpenScadDefineValue[];

export type GridfinityBinParameters = {
  widthUnits: number;
  depthUnits: number;
  heightUnits: number;
  verticalChambers: number;
  horizontalChambers: number;
  lipStyle: "normal" | "reduced" | "minimum" | "none";
  labelStyle: "disabled" | "normal" | "gflabel";
  labelPosition: "left" | "center" | "right";
  fingerslide: "none" | "rounded" | "chamfered";
  magnets: boolean;
  screws: boolean;
  flatBase: "off" | "gridfinity" | "rounded";
  filledIn: boolean;
  wallThicknessMm: number;
};

export const defaultGridfinityBinParameters: GridfinityBinParameters = {
  widthUnits: 2,
  depthUnits: 1,
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
  wallThicknessMm: 0,
};

export function formatScadValue(value: OpenScadDefineValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatScadValue(item)).join(", ")}]`;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "0";
  }

  return JSON.stringify(value);
}

export function createBinDefines(params: GridfinityBinParameters) {
  return {
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
