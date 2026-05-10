"use client";

import { Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import {
  defaultGridfinityBinParameters,
  getMinimumWallThicknessMm,
  type GridfinityBinParameters,
  type OpenScadDefineValue,
} from "@/lib/openscad/gridfinityExtended";
import {
  chamberNumberFields,
  extraOptionGroups,
  generalNumberFields,
  labelDetailOptions,
  numberFields,
  type ExtraOption,
  type NumberField,
} from "./binOptions";
import {
  BooleanField,
  CollapsibleSection,
  ExtraOptionField,
  NumberInputField,
  SelectField,
} from "./parameterControls";
import styles from "./bin-generator.module.css";

type BinParametersPanelProps = {
  params: GridfinityBinParameters;
  draft: Record<NumberField, string>;
  isRendering: boolean;
  setParams: Dispatch<SetStateAction<GridfinityBinParameters>>;
  setDraft: Dispatch<SetStateAction<Record<NumberField, string>>>;
  clearRenderError: () => void;
  onGenerate: () => void;
  onReset: () => void;
};

const lipStyleOptions = [
  { value: "normal", label: "Normal" },
  { value: "reduced", label: "Reduced" },
  { value: "reduced_double", label: "Reduced Double" },
  { value: "minimum", label: "Minimum" },
  { value: "none", label: "None" },
] as const;

const fingerSlideOptions = [
  { value: "none", label: "None" },
  { value: "rounded", label: "Rounded" },
  { value: "chamfered", label: "Chamfered" },
] as const;

const labelStyleOptions = [
  { value: "disabled", label: "Disabled" },
  { value: "normal", label: "Normal" },
  { value: "gflabel", label: "Gridfinity Label" },
  { value: "pred", label: "Pred Labels" },
  { value: "cullenect", label: "Cullenect V2" },
  { value: "cullenect_legacy", label: "Cullenect V1" },
] as const;

const labelPositionOptions = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "leftchamber", label: "Left Chamber" },
  { value: "centerchamber", label: "Center Chamber" },
  { value: "rightchamber", label: "Right Chamber" },
] as const;

const flatBaseOptions = [
  { value: "off", label: "Off" },
  { value: "gridfinity", label: "Gridfinity Stackable" },
  { value: "rounded", label: "Rounded" },
] as const;
const defaultCenterMagnetSize = [6.5, 2.4] as const;
const gridfinityPitchMm = 42;

const magnetOptionKeys = new Set([
  "magnet_size",
  "magnet_easy_release",
  "magnet_side_access",
  "magnet_captive_height",
  "magnet_crush_depth",
  "magnet_chamfer",
]);
const screwOptionKeys = new Set(["screw_size"]);
const fingerSlideDetailKeys = new Set([
  "fingerslide_radius",
  "fingerslide_walls",
  "fingerslide_lip_aligned",
]);
const taperedCornerDetailKeys = new Set([
  "tapered_corner_size",
  "tapered_setback",
]);
const lipDetailKeys = new Set([
  "height_includes_lip",
  "lip_side_relief_trigger",
  "lip_top_relief_height",
  "lip_top_relief_width",
  "lip_top_notches",
  "lip_clip_position",
  "lip_non_blocking",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getExtraOptions(groupTitle: string) {
  return (
    extraOptionGroups.find((group) => group.title === groupTitle)?.options ?? []
  );
}

function getExtraOption(groupTitle: string, key: string) {
  return getExtraOptions(groupTitle).find((option) => option.key === key);
}

function isDisabledWallCutoutPosition(value: number) {
  return value < 0 && value > -1;
}

function wallCutoutPositionToMm(value: OpenScadDefineValue, wallUnits: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  if (isDisabledWallCutoutPosition(value)) {
    return 0;
  }

  if (value < 0) {
    return (wallUnits * gridfinityPitchMm) / Math.abs(value);
  }

  return value * gridfinityPitchMm;
}

function wallCutoutPositionToScadUnits(positionMm: OpenScadDefineValue) {
  if (typeof positionMm !== "number" || !Number.isFinite(positionMm)) {
    return 0;
  }

  return positionMm / gridfinityPitchMm;
}

function toWallCutoutPositionDisplayTuple(
  value: OpenScadDefineValue | undefined,
  wallUnits: number,
) {
  return Array.isArray(value)
    ? value.map((item) => wallCutoutPositionToMm(item, wallUnits))
    : [];
}

export function BinParametersPanel({
  params,
  draft,
  isRendering,
  setParams,
  setDraft,
  clearRenderError,
  onGenerate,
  onReset,
}: BinParametersPanelProps) {
  const updateParams = (updater: SetStateAction<GridfinityBinParameters>) => {
    clearRenderError();
    setParams(updater);
  };

  const getExtraDefine = (key: string) =>
    params.extraDefines[key] ?? defaultGridfinityBinParameters.extraDefines[key];

  const updateExtraDefine = (key: string, value: OpenScadDefineValue) => {
    updateParams((current) => ({
      ...current,
      extraDefines: {
        ...current.extraDefines,
        [key]: value,
      },
    }));
  };

  const commitNumberField = (field: NumberField) => {
    const config = numberFields[field];
    const parsed = Number(draft[field]);
    const minimumValue =
      field === "wallThicknessMm"
        ? getMinimumWallThicknessMm(params.heightUnits)
        : config.min;
    const rawValue = Number.isFinite(parsed)
      ? parsed
      : defaultGridfinityBinParameters[field];
    const nextValue = clamp(rawValue, minimumValue, config.max);
    const normalized =
      config.step >= 1
        ? String(Math.round(nextValue))
        : String(Number(nextValue.toFixed(2)));

    const nextHeightUnits =
      field === "heightUnits" ? Math.round(nextValue) : params.heightUnits;
    const nextWallThicknessMinimum = getMinimumWallThicknessMm(nextHeightUnits);

    setDraft((current) => ({
      ...current,
      [field]: normalized,
      ...(field === "heightUnits" &&
      params.wallThicknessMm < nextWallThicknessMinimum
        ? { wallThicknessMm: String(nextWallThicknessMinimum) }
        : {}),
    }));
    updateParams((current) => ({
      ...current,
      [field]: config.step >= 1 ? Math.round(nextValue) : Number(normalized),
      ...(field === "heightUnits" &&
      current.wallThicknessMm < nextWallThicknessMinimum
        ? { wallThicknessMm: nextWallThicknessMinimum }
        : {}),
    }));
  };

  const isSolidBlock = params.filledIn;
  const centerMagnetSize = getExtraDefine("center_magnet_size");
  const centerMagnetEnabled =
    Array.isArray(centerMagnetSize) &&
    centerMagnetSize.some((value) => typeof value === "number" && value > 0);
  const labelDisabled = isSolidBlock || params.labelStyle === "disabled";
  const slidingLidEnabled = getExtraDefine("sliding_lid_enabled") === true;
  const taperedCornerEnabled = getExtraDefine("tapered_corner") !== "none";
  const wallPatternEnabled = getExtraDefine("wallpattern_enabled") === true;
  const floorPatternEnabled = getExtraDefine("floorpattern_enabled") === true;
  const verticalCutoutEnabled = getExtraDefine("wallcutout_vertical") !== "disabled";
  const horizontalCutoutEnabled = getExtraDefine("wallcutout_horizontal") !== "disabled";
  const verticalIrregularEnabled = getExtraDefine("vertical_irregular_subdivisions") === true;
  const horizontalIrregularEnabled =
    getExtraDefine("horizontal_irregular_subdivisions") === true;
  const hasVerticalSeparators = params.verticalChambers > 1;
  const hasHorizontalSeparators = params.horizontalChambers > 1;
  const hasAnySeparators = hasVerticalSeparators || hasHorizontalSeparators;
  const hasFractionalWidth = !Number.isInteger(params.widthUnits);
  const hasFractionalDepth = !Number.isInteger(params.depthUnits);

  const isExtraOptionDisabled = (option: ExtraOption) => {
    const key = option.key;

    if (isSolidBlock) {
      return true;
    }

    if (magnetOptionKeys.has(key)) {
      return !params.magnets;
    }

    if (screwOptionKeys.has(key)) {
      return !params.screws;
    }

    if (key === "align_grid_x") {
      return !hasFractionalWidth;
    }

    if (key === "align_grid_y") {
      return !hasFractionalDepth;
    }

    if (key === "center_magnet_size") {
      return !centerMagnetEnabled;
    }

    if (key === "hole_overhang_remedy") {
      return !params.magnets || !params.screws;
    }

    if (key === "box_corner_attachments_only") {
      return !params.magnets && !params.screws;
    }

    if (labelDetailOptions.some((labelOption) => labelOption.key === key)) {
      return labelDisabled;
    }

    if (
      key === "chamber_wall_thickness" ||
      key === "chamber_wall_headroom" ||
      key === "chamber_wall_top_radius"
    ) {
      return !hasAnySeparators;
    }

    if (key === "vertical_irregular_subdivisions") {
      return !hasVerticalSeparators;
    }

    if (key === "vertical_separator_config") {
      return !hasVerticalSeparators || !verticalIrregularEnabled;
    }

    if (key.startsWith("vertical_separator_")) {
      return !hasVerticalSeparators;
    }

    if (key === "horizontal_irregular_subdivisions") {
      return !hasHorizontalSeparators;
    }

    if (key === "horizontal_separator_config") {
      return !hasHorizontalSeparators || !horizontalIrregularEnabled;
    }

    if (key.startsWith("horizontal_separator_")) {
      return !hasHorizontalSeparators;
    }

    if (fingerSlideDetailKeys.has(key)) {
      return params.fingerslide === "none";
    }

    if (taperedCornerDetailKeys.has(key)) {
      return !taperedCornerEnabled;
    }

    if (key.startsWith("sliding_lid_") && key !== "sliding_lid_enabled") {
      return !slidingLidEnabled;
    }

    if (lipDetailKeys.has(key)) {
      return params.lipStyle === "none";
    }

    if (key.startsWith("wallcutout_vertical_")) {
      return !verticalCutoutEnabled;
    }

    if (key.startsWith("wallcutout_horizontal_")) {
      return !horizontalCutoutEnabled;
    }

    if (key.startsWith("wallpattern_") && key !== "wallpattern_enabled") {
      return !wallPatternEnabled;
    }

    if (key.startsWith("floorpattern_") && key !== "floorpattern_enabled") {
      return !floorPatternEnabled;
    }

    return false;
  };

  const renderNumberField = (field: NumberField, disabled = false) => {
    const config = numberFields[field];

    return (
      <NumberInputField
        key={field}
        label={config.label}
        type="number"
        min={config.min}
        max={config.max}
        step={config.step}
        value={draft[field]}
        suffix={config.suffix}
        disabled={disabled}
        onBlur={() => commitNumberField(field)}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            [field]: value,
          }))
        }
      />
    );
  };

  const renderExtraOption = (option: ExtraOption) => (
    (() => {
      if (
        option.key === "wallcutout_vertical_position" ||
        option.key === "wallcutout_horizontal_position"
      ) {
        const wallUnits =
          option.key === "wallcutout_vertical_position"
            ? params.widthUnits
            : params.depthUnits;
        const rawValue = getExtraDefine(option.key);
        const displayValue = toWallCutoutPositionDisplayTuple(rawValue, wallUnits);

        return (
          <ExtraOptionField
            key={option.key}
            option={option}
            value={displayValue}
            disabled={isExtraOptionDisabled(option)}
            onChange={(key, nextValue) => {
              if (!Array.isArray(nextValue)) {
                updateExtraDefine(key, wallCutoutPositionToScadUnits(nextValue));
                return;
              }

              const rawTuple = Array.isArray(rawValue) ? rawValue : [];
              const nextTuple = nextValue.map((item, index) => {
                const rawItem = rawTuple[index];
                const previousDisplayItem = displayValue[index];

                if (
                  typeof rawItem === "number" &&
                  isDisabledWallCutoutPosition(rawItem) &&
                  item === previousDisplayItem
                ) {
                  return rawItem;
                }

                return wallCutoutPositionToScadUnits(item);
              });

              updateExtraDefine(key, nextTuple);
            }}
          />
        );
      }

      return (
        <ExtraOptionField
          key={option.key}
          option={option}
          value={getExtraDefine(option.key)}
          disabled={isExtraOptionDisabled(option)}
          onChange={updateExtraDefine}
        />
      );
    })()
  );
  const renderExtraOptions = (groupTitle: string) =>
    getExtraOptions(groupTitle).map(renderExtraOption);
  const renderExtraOptionByKey = (groupTitle: string, key: string) => {
    const option = getExtraOption(groupTitle, key);

    return option ? renderExtraOption(option) : null;
  };

  return (
    <section className={styles.panel} aria-label="Bin Parameters">
      <div className={styles.panelHeader}>
        <SlidersHorizontal aria-hidden="true" size={18} />
        <h2>Bin Parameters</h2>
      </div>

      <div className={styles.panelScroll}>
        <div className={styles.formShell}>
          <CollapsibleSection title="Size" columns>
            {generalNumberFields.map((field) =>
              renderNumberField(field, isSolidBlock && field === "wallThicknessMm"),
            )}
            {renderExtraOptionByKey("Base", "align_grid_x")}
            {renderExtraOptionByKey("Base", "align_grid_y")}
            <BooleanField
              label="Solid Block"
              checked={params.filledIn}
              onChange={(filledIn) =>
                updateParams((current) => ({ ...current, filledIn }))
              }
            />
          </CollapsibleSection>

          <CollapsibleSection title="Compartments" columns>
            {chamberNumberFields.map((field) => renderNumberField(field, isSolidBlock))}
            {renderExtraOptions("Subdivision Details")}
          </CollapsibleSection>

          <CollapsibleSection title="Label" columns>
            <SelectField
              label="Label Shelf"
              value={params.labelStyle}
              options={labelStyleOptions}
              fullWidth
              disabled={isSolidBlock}
              onChange={(labelStyle) =>
                updateParams((current) => ({ ...current, labelStyle }))
              }
            />
            <SelectField
              label="Label Position"
              value={params.labelPosition}
              options={labelPositionOptions}
              disabled={labelDisabled}
              onChange={(labelPosition) =>
                updateParams((current) => ({ ...current, labelPosition }))
              }
            />
            {labelDetailOptions.map(renderExtraOption)}
          </CollapsibleSection>

          <CollapsibleSection title="Finger Slide" columns defaultCollapsed>
            <SelectField
              label="Finger Slide"
              value={params.fingerslide}
              options={fingerSlideOptions}
              disabled={isSolidBlock}
              fullWidth
              onChange={(fingerslide) =>
                updateParams((current) => ({ ...current, fingerslide }))
              }
            />
            {renderExtraOptions("Finger Slide Details")}
          </CollapsibleSection>

          <CollapsibleSection title="Base" columns defaultCollapsed>
            <SelectField
              label="Flat Base"
              value={params.flatBase}
              options={flatBaseOptions}
              disabled={isSolidBlock}
              onChange={(flatBase) =>
                updateParams((current) => ({ ...current, flatBase }))
              }
            />
            {renderExtraOptionByKey("Base", "efficient_floor")}
            {renderExtraOptionByKey("Base", "floor_thickness")}
            {renderExtraOptionByKey("Base", "cavity_floor_radius")}
            {renderExtraOptionByKey("Base", "sub_pitch")}
            {renderExtraOptionByKey("Base", "spacer")}
            {renderExtraOptionByKey("Base", "minimum_printable_pad_size")}
            {renderExtraOptionByKey("Base", "flat_base_rounded_radius")}
            {renderExtraOptionByKey("Base", "flat_base_rounded_easyPrint")}
            <BooleanField
              label="Corner Magnets"
              checked={params.magnets}
              disabled={isSolidBlock}
              fullWidth
              onChange={(magnets) =>
                updateParams((current) => ({ ...current, magnets }))
              }
            />
            {renderExtraOptionByKey("Base", "magnet_size")}
            {renderExtraOptionByKey("Base", "magnet_easy_release")}
            {renderExtraOptionByKey("Base", "magnet_side_access")}
            {renderExtraOptionByKey("Base", "magnet_captive_height")}
            {renderExtraOptionByKey("Base", "magnet_crush_depth")}
            {renderExtraOptionByKey("Base", "magnet_chamfer")}
            <BooleanField
              label="Center Magnet"
              checked={centerMagnetEnabled}
              disabled={isSolidBlock}
              fullWidth
              onChange={(enabled) =>
                updateExtraDefine(
                  "center_magnet_size",
                  enabled ? defaultCenterMagnetSize : [0, 0],
                )
              }
            />
            {renderExtraOptionByKey("Base", "center_magnet_size")}
            <BooleanField
              label="Screws"
              checked={params.screws}
              disabled={isSolidBlock}
              fullWidth
              onChange={(screws) =>
                updateParams((current) => ({ ...current, screws }))
              }
            />
            {renderExtraOptionByKey("Base", "screw_size")}
            {renderExtraOptionByKey("Base", "hole_overhang_remedy")}
            {renderExtraOptionByKey("Base", "box_corner_attachments_only")}
          </CollapsibleSection>

          <CollapsibleSection title="Front Access" columns defaultCollapsed>
            {renderExtraOptions("Tapered Corner")}
            {renderExtraOptions("Sliding Lid")}
          </CollapsibleSection>

          <CollapsibleSection title="Bin Lip" columns defaultCollapsed>
            <SelectField
              label="Lip Style"
              value={params.lipStyle}
              options={lipStyleOptions}
              fullWidth
              disabled={isSolidBlock}
              onChange={(lipStyle) =>
                updateParams((current) => ({ ...current, lipStyle }))
              }
            />
            {renderExtraOptions("Bin Lip")}
          </CollapsibleSection>

          <CollapsibleSection title="Wall Cutouts" columns defaultCollapsed>
            {renderExtraOptions("Wall Cutouts")}
          </CollapsibleSection>

          <CollapsibleSection title="Wall Pattern" columns defaultCollapsed>
            {renderExtraOptions("Wall Pattern")}
          </CollapsibleSection>

          <CollapsibleSection title="Floor Pattern" columns defaultCollapsed>
            {renderExtraOptions("Floor Pattern")}
          </CollapsibleSection>
        </div>
      </div>

      <div className={styles.panelActions}>
        <div className={styles.actionRow}>
          <button
            className={styles.generateButton}
            disabled={isRendering}
            onClick={onGenerate}
            type="button"
          >
            <Play aria-hidden="true" size={16} />
            Generate
          </button>
          <button
            aria-label="Reset Model"
            className={styles.resetIconButton}
            onClick={onReset}
            title="Reset Model"
            type="button"
          >
            <RotateCcw aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
