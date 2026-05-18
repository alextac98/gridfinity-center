"use client";

import { Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import {
  BooleanField,
  CollapsibleSection,
  NumberInputField,
  SelectField,
  TupleField,
} from "@/ui/apps/openscad/parameterControls";
import type { GridfinityBaseplateParameters } from "@/shared/gridfinityBaseplate";
import styles from "@/ui/apps/openscad/generator.module.css";
import {
  alignmentOptions,
  buildPlateModeOptions,
  connectorPositionOptions,
  connectorSnapsOptions,
  gridNumberFields,
  magnetReleaseOptions,
  oversizeMethodOptions,
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

  const commitNumberField = (field: GridNumberField) => {
    const config = gridNumberFields[field];
    const parsed = Number(draft[field]);
    const rawValue = Number.isFinite(parsed) ? parsed : params[field];
    const nextValue = clamp(rawValue, config.min, config.max);
    const normalized =
      config.step >= 1
        ? String(Math.round(nextValue))
        : String(Number(nextValue.toFixed(2)));

    setDraft((current) => ({
      ...current,
      [field]: normalized,
    }));
    updateParams((current) => ({
      ...current,
      [field]: config.step >= 1 ? Math.round(nextValue) : Number(normalized),
    }));
  };

  const renderNumberField = (field: GridNumberField, disabled = false) => {
    const config = gridNumberFields[field];

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

  const buildPlateDisabled = params.buildPlateMode === "disabled";
  const magnetsDisabled = !params.magnets;
  const connectorDetailsDisabled =
    !params.connectorOnly && !params.connectorClipEnabled;
  const connectorSnapsDisabled = params.connectorSnapsStyle === "disabled";

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
            <SelectField
              label="Plate Style"
              value={params.plateStyle}
              options={plateStyleOptions}
              fullWidth
              onChange={(plateStyle) =>
                updateParams((current) => ({ ...current, plateStyle }))
              }
            />
            <SelectField
              label="Oversize Method"
              value={params.oversizeMethod}
              options={oversizeMethodOptions}
              onChange={(oversizeMethod) =>
                updateParams((current) => ({ ...current, oversizeMethod }))
              }
            />
            <SelectField
              label="X Alignment"
              value={params.positionFillGridX}
              options={alignmentOptions}
              onChange={(positionFillGridX) =>
                updateParams((current) => ({ ...current, positionFillGridX }))
              }
            />
            <SelectField
              label="Y Alignment"
              value={params.positionFillGridY}
              options={alignmentOptions}
              onChange={(positionFillGridY) =>
                updateParams((current) => ({ ...current, positionFillGridY }))
              }
            />
          </CollapsibleSection>

          <CollapsibleSection title="Outer Bounds" columns defaultCollapsed>
            {renderNumberField("outerWidthUnits")}
            {renderNumberField("outerDepthUnits")}
            {renderNumberField("outerHeightMm")}
            <SelectField
              label="Grid X Position"
              value={params.positionGridInOuterX}
              options={alignmentOptions}
              onChange={(positionGridInOuterX) =>
                updateParams((current) => ({ ...current, positionGridInOuterX }))
              }
            />
            <SelectField
              label="Grid Y Position"
              value={params.positionGridInOuterY}
              options={alignmentOptions}
              onChange={(positionGridInOuterY) =>
                updateParams((current) => ({ ...current, positionGridInOuterY }))
              }
            />
          </CollapsibleSection>

          <CollapsibleSection title="Build Plate Split" columns defaultCollapsed>
            <SelectField
              label="Build Plate Mode"
              value={params.buildPlateMode}
              options={buildPlateModeOptions}
              fullWidth
              onChange={(buildPlateMode) =>
                updateParams((current) => ({ ...current, buildPlateMode }))
              }
            />
            {renderNumberField("buildPlateWidthMm", buildPlateDisabled)}
            {renderNumberField("buildPlateDepthMm", buildPlateDisabled)}
            <BooleanField
              label="Average Plate Sizes"
              checked={params.averagePlateSizes}
              disabled={buildPlateDisabled}
              fullWidth
              onChange={(averagePlateSizes) =>
                updateParams((current) => ({ ...current, averagePlateSizes }))
              }
            />
          </CollapsibleSection>

          <CollapsibleSection title="Frame" columns defaultCollapsed>
            {renderNumberField("reducedWallHeightMm")}
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
              fullWidth
              onChange={(removeBottomTaper) =>
                updateParams((current) => ({ ...current, removeBottomTaper }))
              }
            />
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
            <BooleanField
              label="Connector Only"
              checked={params.connectorOnly}
              onChange={(connectorOnly) =>
                updateParams((current) => ({ ...current, connectorOnly }))
              }
            />
            <BooleanField
              label="Clip Connectors"
              checked={params.connectorClipEnabled}
              onChange={(connectorClipEnabled) =>
                updateParams((current) => ({
                  ...current,
                  connectorClipEnabled,
                }))
              }
            />
            <SelectField
              label="Connector Position"
              value={params.connectorPosition}
              options={connectorPositionOptions}
              fullWidth
              onChange={(connectorPosition) =>
                updateParams((current) => ({ ...current, connectorPosition }))
              }
            />
            {renderNumberField("connectorClipSizeMm", connectorDetailsDisabled)}
            {renderNumberField(
              "connectorClipToleranceMm",
              connectorDetailsDisabled,
            )}
            <SelectField
              label="Snap Connectors"
              value={params.connectorSnapsStyle}
              options={connectorSnapsOptions}
              fullWidth
              onChange={(connectorSnapsStyle) =>
                updateParams((current) => ({ ...current, connectorSnapsStyle }))
              }
            />
            {renderNumberField(
              "connectorSnapsClearanceMm",
              connectorSnapsDisabled,
            )}
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
