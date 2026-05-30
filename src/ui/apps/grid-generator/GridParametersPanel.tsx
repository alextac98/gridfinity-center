"use client";

import { Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import {
  AlignmentGridPicker,
  BooleanField,
  CollapsibleSection,
  NumberInputField,
  SelectField,
  TupleField,
} from "@/ui/apps/openscad/parameterControls";
import type {
  BaseplateFillMode,
  GridfinityBaseplateParameters,
} from "@/shared/gridfinityBaseplate";
import styles from "@/ui/apps/openscad/generator.module.css";
import {
  baseplateDimensionUnitOptions,
  convertGridSizeValue,
  connectorPositionOptions,
  connectorModeOptions,
  connectorSnapsOptions,
  fillModeOptions,
  getGridSizeFieldConfig,
  getSolidSizeFieldConfig,
  gridNumberFields,
  magnetReleaseOptions,
  plateStyleOptions,
  type GridNumberField,
} from "./gridOptions";

type GridParametersPanelProps = {
  params: GridfinityBaseplateParameters;
  draft: Record<GridNumberField, string>;
  isRendering: boolean;
  setParams: Dispatch<SetStateAction<GridfinityBaseplateParameters>>;
  setDraft: Dispatch<SetStateAction<Record<GridNumberField, string>>>;
  clearRenderError: () => void;
  onGenerate: () => void;
  onReset: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value: number, step: number) {
  if (step >= 1) {
    return String(Math.round(value));
  }

  return String(Number(value.toFixed(2)));
}

export function GridParametersPanel({
  params,
  draft,
  isRendering,
  setParams,
  setDraft,
  clearRenderError,
  onGenerate,
  onReset,
}: GridParametersPanelProps) {
  const updateParams = (
    updater: SetStateAction<GridfinityBaseplateParameters>,
  ) => {
    clearRenderError();
    setParams(updater);
  };

  const getDraftNumber = (field: GridNumberField) => {
    const draftValue = Number(draft[field]);

    return Number.isFinite(draftValue) ? draftValue : params[field];
  };

  const getSolidMinimum = (field: "outerWidthUnits" | "outerDepthUnits") => {
    return field === "outerWidthUnits"
      ? convertGridSizeValue(params.widthUnits, params.widthUnit, params.solidUnit)
      : convertGridSizeValue(params.depthUnits, params.depthUnit, params.solidUnit);
  };

  const getSolidMinimumForUnit = (
    field: "outerWidthUnits" | "outerDepthUnits",
    unit: GridfinityBaseplateParameters["solidUnit"],
  ) => {
    return field === "outerWidthUnits"
      ? convertGridSizeValue(params.widthUnits, params.widthUnit, unit)
      : convertGridSizeValue(params.depthUnits, params.depthUnit, unit);
  };

  const commitNumberField = (field: GridNumberField) => {
    const config = getNumberFieldConfig(field);
    const rawValue = getDraftNumber(field);
    const nextValue = clamp(rawValue, config.min, config.max);
    const normalized = formatNumber(nextValue, config.step);

    const nextDraft: Partial<Record<GridNumberField, string>> = {
      [field]: normalized,
    };
    const nextParams: Partial<GridfinityBaseplateParameters> = {
      [field]: config.step >= 1 ? Math.round(nextValue) : Number(normalized),
    };

    if (params.fillMode === "grid-solid" && field === "widthUnits") {
      const solidConfig = getNumberFieldConfig("outerWidthUnits");
      const solidMin = convertGridSizeValue(
        Number(normalized),
        params.widthUnit,
        params.solidUnit,
      );
      const solidValue = clamp(
        Math.max(getDraftNumber("outerWidthUnits"), solidMin),
        solidConfig.min,
        solidConfig.max,
      );
      const solidDraft = formatNumber(solidValue, solidConfig.step);

      nextDraft.outerWidthUnits = solidDraft;
      nextParams.outerWidthUnits = Number(solidDraft);
    }

    if (params.fillMode === "grid-solid" && field === "depthUnits") {
      const solidConfig = getNumberFieldConfig("outerDepthUnits");
      const solidMin = convertGridSizeValue(
        Number(normalized),
        params.depthUnit,
        params.solidUnit,
      );
      const solidValue = clamp(
        Math.max(getDraftNumber("outerDepthUnits"), solidMin),
        solidConfig.min,
        solidConfig.max,
      );
      const solidDraft = formatNumber(solidValue, solidConfig.step);

      nextDraft.outerDepthUnits = solidDraft;
      nextParams.outerDepthUnits = Number(solidDraft);
    }

    setDraft((current) => ({ ...current, ...nextDraft }));
    updateParams((current) => ({
      ...current,
      ...nextParams,
    }));
  };

  const getNumberFieldConfig = (field: GridNumberField) => {
    if (field === "widthUnits" || field === "depthUnits") {
      const unit = field === "widthUnits" ? params.widthUnit : params.depthUnit;
      const config = getGridSizeFieldConfig(unit);

      return params.fillMode === "solid"
        ? {
            ...config,
            min: Math.max(config.min, convertGridSizeValue(1, "u", unit)),
          }
        : config;
    }

    if (field === "outerWidthUnits" || field === "outerDepthUnits") {
      const config = getSolidSizeFieldConfig(params.solidUnit);

      return {
        ...config,
        label: gridNumberFields[field].label,
        min: Math.max(config.min, getSolidMinimum(field)),
      };
    }

    if (field === "reducedWallHeightMm" && params.reducedWallHeightMm >= 0) {
      return {
        ...gridNumberFields.reducedWallHeightMm,
        min: 0,
      };
    }

    return gridNumberFields[field];
  };

  const renderNumberField = (
    field: GridNumberField,
    disabled = false,
    fullWidth = false,
  ) => {
    const config = {
      ...getNumberFieldConfig(field),
      label: gridNumberFields[field].label,
    };

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
        fullWidth={fullWidth}
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

  const updateSizeUnit = (nextUnit: GridfinityBaseplateParameters["widthUnit"]) => {
    const currentWidthUnit = params.widthUnit;
    const currentDepthUnit = params.depthUnit;

    if (nextUnit === currentWidthUnit && nextUnit === currentDepthUnit) {
      return;
    }

    const widthValue = Number.isFinite(Number(draft.widthUnits))
      ? Number(draft.widthUnits)
      : params.widthUnits;
    const depthValue = Number.isFinite(Number(draft.depthUnits))
      ? Number(draft.depthUnits)
      : params.depthUnits;
    const config = getGridSizeFieldConfig(nextUnit);
    const nextWidth = clamp(
      convertGridSizeValue(widthValue, currentWidthUnit, nextUnit),
      config.min,
      config.max,
    );
    const nextDepth = clamp(
      convertGridSizeValue(depthValue, currentDepthUnit, nextUnit),
      config.min,
      config.max,
    );
    const nextWidthDraft = formatNumber(nextWidth, config.step);
    const nextDepthDraft = formatNumber(nextDepth, config.step);

    setDraft((current) => ({
      ...current,
      depthUnits: nextDepthDraft,
      widthUnits: nextWidthDraft,
    }));
    updateParams((current) => ({
      ...current,
      depthUnit: nextUnit,
      depthUnits: Number(nextDepthDraft),
      widthUnit: nextUnit,
      widthUnits: Number(nextWidthDraft),
    }));
  };

  const renderSizeUnitSwitch = () => (
    <div className={`${styles.field} ${styles.fullWidthField}`}>
      <span>Size Unit</span>
      <div className={styles.unitSwitch} role="group" aria-label="Size unit">
        {baseplateDimensionUnitOptions.map((option) => (
          <button
            key={option.value}
            aria-pressed={
              params.widthUnit === option.value && params.depthUnit === option.value
            }
            className={
              params.widthUnit === option.value && params.depthUnit === option.value
                ? styles.unitButtonActive
                : ""
            }
            type="button"
            onClick={() => updateSizeUnit(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  const updateSolidUnit = (
    nextUnit: GridfinityBaseplateParameters["solidUnit"],
  ) => {
    if (nextUnit === params.solidUnit) {
      return;
    }

    const widthValue = getDraftNumber("outerWidthUnits");
    const depthValue = getDraftNumber("outerDepthUnits");
    const config = getSolidSizeFieldConfig(nextUnit);
    const nextWidth = clamp(
      convertGridSizeValue(widthValue, params.solidUnit, nextUnit),
      Math.max(config.min, getSolidMinimumForUnit("outerWidthUnits", nextUnit)),
      config.max,
    );
    const nextDepth = clamp(
      convertGridSizeValue(depthValue, params.solidUnit, nextUnit),
      Math.max(config.min, getSolidMinimumForUnit("outerDepthUnits", nextUnit)),
      config.max,
    );
    const nextWidthDraft = formatNumber(nextWidth, config.step);
    const nextDepthDraft = formatNumber(nextDepth, config.step);

    setDraft((current) => ({
      ...current,
      outerDepthUnits: nextDepthDraft,
      outerWidthUnits: nextWidthDraft,
    }));
    updateParams((current) => ({
      ...current,
      outerDepthUnits: Number(nextDepthDraft),
      outerWidthUnits: Number(nextWidthDraft),
      solidUnit: nextUnit,
    }));
  };

  const renderSolidUnitSwitch = () => (
    <div className={`${styles.field} ${styles.fullWidthField}`}>
      <span>Solid Size Unit</span>
      <div className={styles.unitSwitch} role="group" aria-label="Solid size unit">
        {baseplateDimensionUnitOptions.map((option) => (
          <button
            key={option.value}
            aria-pressed={params.solidUnit === option.value}
            className={
              params.solidUnit === option.value ? styles.unitButtonActive : ""
            }
            type="button"
            onClick={() => updateSolidUnit(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderConnectorOutputSwitch = () => (
    <div className={`${styles.field} ${styles.fullWidthField}`}>
      <span>Generate Grid / Connector</span>
      <div
        className={`${styles.unitSwitch} ${styles.floorSwitch}`}
        role="group"
        aria-label="Connector output"
      >
        <button
          aria-pressed={!params.connectorOnly}
          className={!params.connectorOnly ? styles.unitButtonActive : ""}
          type="button"
          onClick={() =>
            updateParams((current) => ({ ...current, connectorOnly: false }))
          }
        >
          Grid
        </button>
        <button
          aria-pressed={params.connectorOnly}
          className={params.connectorOnly ? styles.unitButtonActive : ""}
          type="button"
          onClick={() =>
            updateParams((current) => ({ ...current, connectorOnly: true }))
          }
        >
          Connectors
        </button>
      </div>
    </div>
  );

  const setReducedWallHeightAuto = () => {
    setDraft((current) => ({
      ...current,
      reducedWallHeightMm: "-1",
    }));
    updateParams((current) => ({
      ...current,
      reducedWallHeightMm: -1,
    }));
  };

  const setReducedWallHeightCustom = () => {
    const nextValue = params.reducedWallHeightMm >= 0 ? params.reducedWallHeightMm : 4;
    const nextDraft = formatNumber(
      nextValue,
      gridNumberFields.reducedWallHeightMm.step,
    );

    setDraft((current) => ({
      ...current,
      reducedWallHeightMm: nextDraft,
    }));
    updateParams((current) => ({
      ...current,
      reducedWallHeightMm: Number(nextDraft),
    }));
  };

  const renderReducedWallHeightField = () => {
    const isAuto = params.reducedWallHeightMm < 0;
    const config = getNumberFieldConfig("reducedWallHeightMm");

    return (
      <label className={`${styles.field} ${styles.fullWidthField}`}>
        <span>Reduced Wall Height</span>
        <div className={styles.autoInputWrap}>
          <input
            inputMode="decimal"
            max={config.max}
            min={config.min}
            onBlur={() => {
              if (!isAuto) {
                commitNumberField("reducedWallHeightMm");
              }
            }}
            onChange={(event) => {
              if (isAuto) {
                setReducedWallHeightCustom();
              }

              setDraft((current) => ({
                ...current,
                reducedWallHeightMm: event.target.value,
              }));
            }}
            onFocus={() => {
              if (isAuto) {
                setReducedWallHeightCustom();
              }
            }}
            step={config.step}
            type={isAuto ? "text" : "number"}
            value={isAuto ? "Disabled" : draft.reducedWallHeightMm}
          />
          {isAuto ? null : <small>mm</small>}
          <button
            aria-label={
              isAuto
                ? "Override reduced wall height"
                : "Disable reduced wall height"
            }
            onClick={isAuto ? setReducedWallHeightCustom : setReducedWallHeightAuto}
            type="button"
          >
            {isAuto ? "Override" : "Disable"}
          </button>
        </div>
      </label>
    );
  };

  const updateFillMode = (fillMode: BaseplateFillMode) => {
    if (fillMode === "grid-solid") {
      const widthConfig = getNumberFieldConfig("outerWidthUnits");
      const depthConfig = getNumberFieldConfig("outerDepthUnits");
      const nextWidth = clamp(
        Math.max(getDraftNumber("outerWidthUnits"), widthConfig.min),
        widthConfig.min,
        widthConfig.max,
      );
      const nextDepth = clamp(
        Math.max(getDraftNumber("outerDepthUnits"), depthConfig.min),
        depthConfig.min,
        depthConfig.max,
      );
      const nextWidthDraft = formatNumber(nextWidth, widthConfig.step);
      const nextDepthDraft = formatNumber(nextDepth, depthConfig.step);

      setDraft((current) => ({
        ...current,
        outerDepthUnits: nextDepthDraft,
        outerWidthUnits: nextWidthDraft,
      }));
      updateParams((current) => ({
        ...current,
        fillMode,
        outerDepthUnits: Number(nextDepthDraft),
        outerWidthUnits: Number(nextWidthDraft),
        oversizeMethod: "fill",
      }));
      return;
    }

    if (fillMode !== "solid") {
      updateParams((current) => ({
        ...current,
        fillMode,
        oversizeMethod: fillMode === "crop" ? "crop" : "fill",
      }));
      return;
    }

    const widthConfig = {
      ...getGridSizeFieldConfig(params.widthUnit),
      min: convertGridSizeValue(1, "u", params.widthUnit),
    };
    const depthConfig = {
      ...getGridSizeFieldConfig(params.depthUnit),
      min: convertGridSizeValue(1, "u", params.depthUnit),
    };
    const widthValue = Number.isFinite(Number(draft.widthUnits))
      ? Number(draft.widthUnits)
      : params.widthUnits;
    const depthValue = Number.isFinite(Number(draft.depthUnits))
      ? Number(draft.depthUnits)
      : params.depthUnits;
    const nextWidth = clamp(widthValue, widthConfig.min, widthConfig.max);
    const nextDepth = clamp(depthValue, depthConfig.min, depthConfig.max);
    const nextWidthDraft = formatNumber(nextWidth, widthConfig.step);
    const nextDepthDraft = formatNumber(nextDepth, depthConfig.step);

    setDraft((current) => ({
      ...current,
      depthUnits: nextDepthDraft,
      widthUnits: nextWidthDraft,
    }));
    updateParams((current) => ({
      ...current,
      depthUnits: Number(nextDepthDraft),
      fillMode,
      oversizeMethod: "fill",
      widthUnits: Number(nextWidthDraft),
    }));
  };

  const magnetsDisabled = !params.magnets;
  const connectorSnapsDisabled = params.connectorSnapsStyle === "disabled";
  const connectorMode = params.connectorClipEnabled
    ? "clip"
    : params.connectorSnapsStyle !== "disabled"
      ? "snap"
      : "none";
  const showSolidSizeFields = params.fillMode === "grid-solid";
  const showSolidHeightField =
    params.fillMode === "solid" || params.fillMode === "grid-solid";
  const hasWidthExtraSpace = !Number.isInteger(
    convertGridSizeValue(params.widthUnits, params.widthUnit, "u"),
  );
  const hasDepthExtraSpace = !Number.isInteger(
    convertGridSizeValue(params.depthUnits, params.depthUnit, "u"),
  );

  const updateGridAlignment = ({
    x,
    y,
  }: {
    x: GridfinityBaseplateParameters["positionFillGridX"];
    y: GridfinityBaseplateParameters["positionFillGridY"];
  }) => {
    updateParams((current) => ({
      ...current,
      positionFillGridX: hasWidthExtraSpace ? x : "center",
      positionFillGridY: hasDepthExtraSpace ? y : "center",
    }));
  };

  return (
    <section className={styles.panel} aria-label="Grid Parameters">
      <div className={styles.panelHeader}>
        <SlidersHorizontal aria-hidden="true" size={18} />
        <h2>Grid Parameters</h2>
      </div>

      <div className={styles.panelScroll}>
        <div className={styles.formShell}>
          <CollapsibleSection title="Size" columns>
            {renderNumberField("widthUnits")}
            {renderNumberField("depthUnits")}
            {renderSizeUnitSwitch()}
            <AlignmentGridPicker
              label="Grid Alignment"
              x={params.positionFillGridX}
              y={params.positionFillGridY}
              xEnabled={hasWidthExtraSpace}
              yEnabled={hasDepthExtraSpace}
              onChange={updateGridAlignment}
            />
            <SelectField
              label="Grid Style"
              value={params.plateStyle}
              options={plateStyleOptions}
              fullWidth
              onChange={(plateStyle) =>
                updateParams((current) => ({ ...current, plateStyle }))
              }
            />
            <SelectField
              label="Fill Mode"
              value={params.fillMode}
              options={fillModeOptions}
              fullWidth
              onChange={updateFillMode}
            />
            {showSolidSizeFields ? (
              <>
                {renderNumberField("outerWidthUnits")}
                {renderNumberField("outerDepthUnits")}
                {renderSolidUnitSwitch()}
              </>
            ) : null}
            {showSolidHeightField
              ? renderNumberField("outerHeightMm", false, true)
              : null}
          </CollapsibleSection>

          <CollapsibleSection title="Magnets & Screws" columns defaultCollapsed>
            <BooleanField
              label="Corner Magnets"
              checked={params.magnets}
              fullWidth
              onChange={(magnets) =>
                updateParams((current) => ({ ...current, magnets }))
              }
            />
            <TupleField
              label="Magnet Size"
              value={params.magnetSize}
              labels={["Diameter", "Height"]}
              suffix="mm"
              disabled={magnetsDisabled}
              onChange={(index, value) =>
                updateParams((current) => {
                  const magnetSize = [...current.magnetSize] as [number, number];
                  magnetSize[index] = Number.isFinite(value) ? value : 0;

                  return { ...current, magnetSize };
                })
              }
            />
            {renderNumberField("magnetZOffsetMm", magnetsDisabled)}
            {renderNumberField("magnetTopCoverMm", magnetsDisabled)}
            <SelectField
              label="Magnet Release"
              value={params.magnetReleaseMethod}
              options={magnetReleaseOptions}
              disabled={magnetsDisabled}
              fullWidth
              onChange={(magnetReleaseMethod) =>
                updateParams((current) => ({ ...current, magnetReleaseMethod }))
              }
            />
            <BooleanField
              label="Corner Screws"
              checked={params.cornerScrews}
              onChange={(cornerScrews) =>
                updateParams((current) => ({ ...current, cornerScrews }))
              }
            />
            <BooleanField
              label="Center Screw"
              checked={params.centerScrew}
              onChange={(centerScrew) =>
                updateParams((current) => ({ ...current, centerScrew }))
              }
            />
            <BooleanField
              label="Weight Cavities"
              checked={params.weightCavities}
              fullWidth
              onChange={(weightCavities) =>
                updateParams((current) => ({ ...current, weightCavities }))
              }
            />
          </CollapsibleSection>

          <CollapsibleSection title="Connectors" columns defaultCollapsed>
            <SelectField
              label="Connector"
              value={connectorMode}
              options={connectorModeOptions}
              fullWidth
              onChange={(mode) =>
                updateParams((current) => ({
                  ...current,
                  connectorClipEnabled: mode === "clip",
                  connectorOnly: mode === "clip" ? current.connectorOnly : false,
                  connectorSnapsStyle:
                    mode === "snap"
                      ? current.connectorSnapsStyle === "disabled"
                        ? "larger"
                        : current.connectorSnapsStyle
                      : "disabled",
                }))
              }
            />
            {connectorMode === "clip" || connectorMode === "snap" ? (
              <SelectField
                label="Connector Position"
                value={params.connectorPosition}
                options={connectorPositionOptions}
                fullWidth
                onChange={(connectorPosition) =>
                  updateParams((current) => ({ ...current, connectorPosition }))
                }
              />
            ) : null}
            {connectorMode === "clip" ? (
              <>
                {renderNumberField(
                  "connectorClipSizeMm",
                  !params.connectorClipEnabled,
                )}
                {renderNumberField(
                  "connectorClipToleranceMm",
                  !params.connectorClipEnabled,
                )}
                {renderConnectorOutputSwitch()}
              </>
            ) : null}
            {connectorMode === "snap" ? (
              <>
                <SelectField
                  label="Snap Connector"
                  value={
                    params.connectorSnapsStyle === "disabled"
                      ? "larger"
                      : params.connectorSnapsStyle
                  }
                  options={connectorSnapsOptions}
                  fullWidth
                  onChange={(connectorSnapsStyle) =>
                    updateParams((current) => ({
                      ...current,
                      connectorSnapsStyle,
                    }))
                  }
                />
                {renderNumberField(
                  "connectorSnapsClearanceMm",
                  connectorSnapsDisabled,
                )}
              </>
            ) : null}
          </CollapsibleSection>

          <CollapsibleSection title="Frame" columns defaultCollapsed>
            {renderReducedWallHeightField()}
            {renderNumberField("plateCornerRadiusMm")}
            {renderNumberField("secondaryCornerRadiusMm")}
            <BooleanField
              label="Reduced Wall Taper"
              checked={params.reducedWallTaper}
              onChange={(reducedWallTaper) =>
                updateParams((current) => ({ ...current, reducedWallTaper }))
              }
            />
            <BooleanField
              label="Remove Bottom Taper"
              checked={params.removeBottomTaper}
              onChange={(removeBottomTaper) =>
                updateParams((current) => ({ ...current, removeBottomTaper }))
              }
            />
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
