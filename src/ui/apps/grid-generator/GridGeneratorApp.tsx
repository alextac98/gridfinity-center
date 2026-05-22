"use client";

import { PanelLeft, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { captureEvent } from "@/ui/analytics/posthog";
import {
  createBaseplateDefines,
  createBaseplateScadSnippet,
  defaultGridfinityBaseplateParameters,
  type BaseplateAlignment,
  type BaseplateDimensionUnit,
  type BaseplateFillMode,
  type BuildPlateMode,
  type ConnectorPosition,
  type ConnectorSnapsStyle,
  type GridfinityBaseplateParameters,
  type MagnetReleaseMethod,
  type OversizeMethod,
  type BaseplateStyle,
} from "@/shared/gridfinityBaseplate";
import { ModelOutputPanel } from "../openscad/ModelOutputPanel";
import {
  GeneratorPanel,
  LoadingPanel,
  OpenScadGeneratorShell,
  PreviewLoading,
} from "../openscad/OpenScadGeneratorShell";
import { OpenScadPreview } from "../openscad/OpenScadPreview";
import {
  openscadGroundPlaneStorageKey,
  openscadOutputActionStorageKey,
  openscadPreviewViewStorageKey,
} from "../openscad/outputPreferenceKeys";
import { readLocalStorageJson, writeLocalStorageJson } from "../openscad/storage";
import { measureStlDimensions } from "../openscad/stlDimensions";
import { useGroundPlanePreference } from "../openscad/useGroundPlanePreference";
import { useOpenScadModel } from "../openscad/useOpenScadModel";
import type { GridfinityAppProps } from "../types";
import { GridBuildPlateSplitControls } from "./GridBuildPlateSplitControls";
import { GridParametersPanel } from "./GridParametersPanel";
import {
  convertGridSizeValue,
  getGridSizeFieldConfig,
  getSolidSizeFieldConfig,
  gridNumberFields,
  type GridNumberField,
} from "./gridOptions";

const gridSettingsStorageKey = "gridfinity-grid-generator-settings";

type StoredGridGeneratorSettings = {
  params: GridfinityBaseplateParameters;
  draft: Record<GridNumberField, string>;
};

const baseplateStyles = ["default", "cnclaser"] as const;
const oversizeMethods = ["crop", "fill"] as const;
const fillModes = ["crop", "grid", "solid", "grid-solid"] as const;
const alignments = ["near", "center", "far"] as const;
const buildPlateModes = ["disabled", "enabled", "unique"] as const;
const magnetReleaseMethods = ["none", "slot", "hole"] as const;
const connectorPositions = ["center_wall", "intersection", "both"] as const;
const connectorSnapsStyles = ["disabled", "larger", "smaller"] as const;
const baseplateDimensionUnits = ["u", "mm", "in"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneDefaultGridParameters(): GridfinityBaseplateParameters {
  return {
    ...defaultGridfinityBaseplateParameters,
    magnetSize: [...defaultGridfinityBaseplateParameters.magnetSize],
  };
}

function createDraftFromParams(params: GridfinityBaseplateParameters) {
  return Object.fromEntries(
    Object.keys(gridNumberFields).map((key) => [
      key,
      String(params[key as GridNumberField]),
    ]),
  ) as Record<GridNumberField, string>;
}

function readString<T extends string>(
  value: unknown,
  fallback: T,
  allowedValues: readonly T[],
): T {
  return typeof value === "string" && allowedValues.includes(value as T)
    ? value as T
    : fallback;
}

function readNumberField(
  value: unknown,
  fallback: number,
  field: GridNumberField,
) {
  const config = gridNumberFields[field];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, config.min), config.max);
}

function readSizeNumberField(
  value: unknown,
  fallback: number,
  unit: BaseplateDimensionUnit,
) {
  const config = getGridSizeFieldConfig(unit);

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, config.min), config.max);
}

function readSolidSizeNumberField(
  value: unknown,
  fallback: number,
  unit: BaseplateDimensionUnit,
) {
  const config = getSolidSizeFieldConfig(unit);

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, config.min), config.max);
}

function readMagnetSize(value: unknown) {
  const fallback = defaultGridfinityBaseplateParameters.magnetSize;

  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    return [...fallback] as [number, number];
  }

  return [
    Math.min(Math.max(value[0], 0.1), 30),
    Math.min(Math.max(value[1], 0.1), 20),
  ] as [number, number];
}

function parseStoredGridSettings(value: unknown): StoredGridGeneratorSettings {
  const defaults = cloneDefaultGridParameters();
  const storedParams = isRecord(value)
    ? isRecord(value.params)
      ? value.params
      : value
    : {};
  const storedDraft = isRecord(value) && isRecord(value.draft)
    ? value.draft
    : {};
  const widthUnit = readString(
    storedParams.widthUnit,
    defaults.widthUnit,
    baseplateDimensionUnits,
  ) as BaseplateDimensionUnit;
  const storedDepthUnit = readString(
    storedParams.depthUnit,
    widthUnit,
    baseplateDimensionUnits,
  ) as BaseplateDimensionUnit;
  const storedDepthUnits = readSizeNumberField(
    storedParams.depthUnits,
    defaults.depthUnits,
    storedDepthUnit,
  );
  const solidUnit = readString(
    storedParams.solidUnit,
    defaults.solidUnit,
    baseplateDimensionUnits,
  ) as BaseplateDimensionUnit;
  const storedOversizeMethod = readString(
    storedParams.oversizeMethod,
    defaults.oversizeMethod,
    oversizeMethods,
  ) as OversizeMethod;
  const fillMode = readString(
    storedParams.fillMode,
    storedOversizeMethod === "crop" ? "crop" : "grid",
    fillModes,
  ) as BaseplateFillMode;
  const params: GridfinityBaseplateParameters = {
    ...defaults,
    widthUnit,
    depthUnit: widthUnit,
    solidUnit,
    fillMode,
    widthUnits: readSizeNumberField(
      storedParams.widthUnits,
      defaults.widthUnits,
      widthUnit,
    ),
    depthUnits: readSizeNumberField(
      convertGridSizeValue(storedDepthUnits, storedDepthUnit, widthUnit),
      defaults.depthUnits,
      widthUnit,
    ),
    outerWidthUnits: readSolidSizeNumberField(
      storedParams.outerWidthUnits,
      defaults.outerWidthUnits,
      solidUnit,
    ),
    outerDepthUnits: readSolidSizeNumberField(
      storedParams.outerDepthUnits,
      defaults.outerDepthUnits,
      solidUnit,
    ),
    outerHeightMm: readNumberField(
      storedParams.outerHeightMm,
      defaults.outerHeightMm,
      "outerHeightMm",
    ),
    reducedWallHeightMm: readNumberField(
      storedParams.reducedWallHeightMm,
      defaults.reducedWallHeightMm,
      "reducedWallHeightMm",
    ),
    plateCornerRadiusMm: readNumberField(
      storedParams.plateCornerRadiusMm,
      defaults.plateCornerRadiusMm,
      "plateCornerRadiusMm",
    ),
    secondaryCornerRadiusMm: readNumberField(
      storedParams.secondaryCornerRadiusMm,
      defaults.secondaryCornerRadiusMm,
      "secondaryCornerRadiusMm",
    ),
    buildPlateWidthMm: readNumberField(
      storedParams.buildPlateWidthMm,
      defaults.buildPlateWidthMm,
      "buildPlateWidthMm",
    ),
    buildPlateDepthMm: readNumberField(
      storedParams.buildPlateDepthMm,
      defaults.buildPlateDepthMm,
      "buildPlateDepthMm",
    ),
    magnetZOffsetMm: readNumberField(
      storedParams.magnetZOffsetMm,
      defaults.magnetZOffsetMm,
      "magnetZOffsetMm",
    ),
    magnetTopCoverMm: readNumberField(
      storedParams.magnetTopCoverMm,
      defaults.magnetTopCoverMm,
      "magnetTopCoverMm",
    ),
    connectorClipSizeMm: readNumberField(
      storedParams.connectorClipSizeMm,
      defaults.connectorClipSizeMm,
      "connectorClipSizeMm",
    ),
    connectorClipToleranceMm: readNumberField(
      storedParams.connectorClipToleranceMm,
      defaults.connectorClipToleranceMm,
      "connectorClipToleranceMm",
    ),
    connectorSnapsClearanceMm: readNumberField(
      storedParams.connectorSnapsClearanceMm,
      defaults.connectorSnapsClearanceMm,
      "connectorSnapsClearanceMm",
    ),
    plateStyle: readString(
      storedParams.plateStyle,
      defaults.plateStyle,
      baseplateStyles,
    ) as BaseplateStyle,
    oversizeMethod: readString(
      storedParams.oversizeMethod,
      defaults.oversizeMethod,
      oversizeMethods,
    ) as OversizeMethod,
    positionFillGridX: readString(
      storedParams.positionFillGridX,
      defaults.positionFillGridX,
      alignments,
    ) as BaseplateAlignment,
    positionFillGridY: readString(
      storedParams.positionFillGridY,
      defaults.positionFillGridY,
      alignments,
    ) as BaseplateAlignment,
    positionGridInOuterX: readString(
      storedParams.positionGridInOuterX,
      defaults.positionGridInOuterX,
      alignments,
    ) as BaseplateAlignment,
    positionGridInOuterY: readString(
      storedParams.positionGridInOuterY,
      defaults.positionGridInOuterY,
      alignments,
    ) as BaseplateAlignment,
    buildPlateMode: readString(
      storedParams.buildPlateMode,
      defaults.buildPlateMode,
      buildPlateModes,
    ) as BuildPlateMode,
    magnetReleaseMethod: readString(
      storedParams.magnetReleaseMethod,
      defaults.magnetReleaseMethod,
      magnetReleaseMethods,
    ) as MagnetReleaseMethod,
    connectorPosition: readString(
      storedParams.connectorPosition,
      defaults.connectorPosition,
      connectorPositions,
    ) as ConnectorPosition,
    connectorSnapsStyle: readString(
      storedParams.connectorSnapsStyle,
      defaults.connectorSnapsStyle,
      connectorSnapsStyles,
    ) as ConnectorSnapsStyle,
    magnets:
      typeof storedParams.magnets === "boolean"
        ? storedParams.magnets
        : defaults.magnets,
    reducedWallTaper:
      typeof storedParams.reducedWallTaper === "boolean"
        ? storedParams.reducedWallTaper
        : defaults.reducedWallTaper,
    averagePlateSizes:
      typeof storedParams.averagePlateSizes === "boolean"
        ? storedParams.averagePlateSizes
        : defaults.averagePlateSizes,
    cornerScrews:
      typeof storedParams.cornerScrews === "boolean"
        ? storedParams.cornerScrews
        : defaults.cornerScrews,
    centerScrew:
      typeof storedParams.centerScrew === "boolean"
        ? storedParams.centerScrew
        : defaults.centerScrew,
    weightCavities:
      typeof storedParams.weightCavities === "boolean"
        ? storedParams.weightCavities
        : defaults.weightCavities,
    removeBottomTaper:
      typeof storedParams.removeBottomTaper === "boolean"
        ? storedParams.removeBottomTaper
        : defaults.removeBottomTaper,
    connectorOnly:
      typeof storedParams.connectorOnly === "boolean"
        ? storedParams.connectorOnly
        : defaults.connectorOnly,
    connectorClipEnabled:
      typeof storedParams.connectorClipEnabled === "boolean"
        ? storedParams.connectorClipEnabled
        : defaults.connectorClipEnabled,
    magnetSize: readMagnetSize(storedParams.magnetSize),
  };

  if (params.fillMode === "grid-solid") {
    params.outerWidthUnits = Math.max(
      params.outerWidthUnits,
      convertGridSizeValue(params.widthUnits, params.widthUnit, params.solidUnit),
    );
    params.outerDepthUnits = Math.max(
      params.outerDepthUnits,
      convertGridSizeValue(params.depthUnits, params.depthUnit, params.solidUnit),
    );
  }

  const draft = createDraftFromParams(params);

  for (const key of Object.keys(gridNumberFields) as GridNumberField[]) {
    const draftValue = storedDraft[key];

    if (typeof draftValue === "string") {
      draft[key] = draftValue;
    }
  }

  return { params, draft };
}

function readStoredGridSettings(): StoredGridGeneratorSettings {
  const defaults = cloneDefaultGridParameters();

  const settings = readLocalStorageJson(
    gridSettingsStorageKey,
    { params: defaults, draft: createDraftFromParams(defaults) },
    parseStoredGridSettings,
  );
  const buildPlateSettings = readGroundPlaneBuildPlateSettings();

  if (!buildPlateSettings) {
    return settings;
  }

  const params = {
    ...settings.params,
    buildPlateDepthMm: buildPlateSettings.depthMm,
    buildPlateWidthMm: buildPlateSettings.widthMm,
  };

  return {
    params,
    draft: {
      ...settings.draft,
      buildPlateDepthMm: String(buildPlateSettings.depthMm),
      buildPlateWidthMm: String(buildPlateSettings.widthMm),
    },
  };
}

function writeStoredGridSettings(
  params: GridfinityBaseplateParameters,
  draft: Record<GridNumberField, string>,
) {
  writeLocalStorageJson(gridSettingsStorageKey, { params, draft });
}

function createParamsKey(params: GridfinityBaseplateParameters) {
  return JSON.stringify({
    ...params,
    magnetSize: [params.magnetSize[0], params.magnetSize[1]],
  });
}

function createGridAnalyticsProperties(params: GridfinityBaseplateParameters) {
  return {
    width_units: params.widthUnits,
    depth_units: params.depthUnits,
    width_unit: params.widthUnit,
    depth_unit: params.depthUnit,
    fill_mode: params.fillMode,
    solid_unit: params.solidUnit,
    plate_style: params.plateStyle,
    magnets: params.magnets,
    build_plate_mode: params.buildPlateMode,
  };
}

function readGroundPlaneBuildPlateSettings() {
  return readLocalStorageJson(
    openscadGroundPlaneStorageKey,
    null as { widthMm: number; depthMm: number } | null,
    (value) => {
      if (!isRecord(value)) {
        return null;
      }

      const width =
        typeof value.widthMm === "string"
          ? parseBuildPlateDimension(value.widthMm)
          : null;
      const depth =
        typeof value.depthMm === "string"
          ? parseBuildPlateDimension(value.depthMm)
          : null;

      if (width === null || depth === null) {
        return null;
      }

      return {
        depthMm: normalizeBuildPlateDimension(depth, "buildPlateDepthMm"),
        widthMm: normalizeBuildPlateDimension(width, "buildPlateWidthMm"),
      };
    },
  );
}

function parseBuildPlateDimension(value: string) {
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeBuildPlateDimension(
  value: number,
  field: "buildPlateWidthMm" | "buildPlateDepthMm",
) {
  const config = gridNumberFields[field];

  return Math.round(Math.min(Math.max(value, config.min), config.max));
}

export function GridGeneratorApp({ accent }: GridfinityAppProps) {
  const [initialSettings] = useState(readStoredGridSettings);
  const [params, setParams] = useState(initialSettings.params);
  const [draft, setDraft] = useState(initialSettings.draft);
  const model = useOpenScadModel({
    params,
    cacheModelId: "grid-generator",
    entryFile: "gridfinity_baseplate.scad",
    outputBaseName: "gridfinity-baseplate",
    createDefines: createBaseplateDefines,
    createParamsKey,
    createScadSnippet: createBaseplateScadSnippet,
    renderErrorMessage:
      "OpenSCAD could not generate this baseplate. Check the browser console for details.",
    workerErrorMessage:
      "The OpenSCAD worker failed to start. Check the browser console for details.",
  });
  const groundPlane = useGroundPlanePreference(openscadGroundPlaneStorageKey);

  const syncBuildPlateDimension = (
    value: string,
    field: "buildPlateWidthMm" | "buildPlateDepthMm",
  ) => {
    const parsed = parseBuildPlateDimension(value);

    if (parsed === null) {
      return;
    }

    const normalized = normalizeBuildPlateDimension(parsed, field);

    model.clearRenderError();
    setParams((current) => ({ ...current, [field]: normalized }));
    setDraft((current) => ({ ...current, [field]: String(normalized) }));
  };

  const setBuildPlateWidth = (widthMm: string) => {
    groundPlane.setGroundPlaneWidth(widthMm);
    syncBuildPlateDimension(widthMm, "buildPlateWidthMm");
  };

  const setBuildPlateDepth = (depthMm: string) => {
    groundPlane.setGroundPlaneDepth(depthMm);
    syncBuildPlateDimension(depthMm, "buildPlateDepthMm");
  };

  const selectBuildPlatePreset = (
    preset: Parameters<typeof groundPlane.selectBuildPlatePreset>[0],
  ) => {
    groundPlane.selectBuildPlatePreset(preset);
    model.clearRenderError();
    setParams((current) => ({
      ...current,
      buildPlateDepthMm: normalizeBuildPlateDimension(
        preset.depthMm,
        "buildPlateDepthMm",
      ),
      buildPlateWidthMm: normalizeBuildPlateDimension(
        preset.widthMm,
        "buildPlateWidthMm",
      ),
    }));
    setDraft((current) => ({
      ...current,
      buildPlateDepthMm: String(
        normalizeBuildPlateDimension(preset.depthMm, "buildPlateDepthMm"),
      ),
      buildPlateWidthMm: String(
        normalizeBuildPlateDimension(preset.widthMm, "buildPlateWidthMm"),
      ),
    }));
  };

  useEffect(() => {
    writeStoredGridSettings(params, draft);
  }, [draft, params]);

  const dimensions = useMemo(() => {
    if (!model.stl || !model.isPreviewCurrent) {
      return null;
    }

    return measureStlDimensions(model.stl);
  }, [model.isPreviewCurrent, model.stl]);

  const reset = () => {
    const defaultParams = cloneDefaultGridParameters();
    const groundPlaneWidth = parseBuildPlateDimension(
      groundPlane.preference.widthMm,
    );
    const groundPlaneDepth = parseBuildPlateDimension(
      groundPlane.preference.depthMm,
    );

    if (groundPlaneWidth !== null) {
      defaultParams.buildPlateWidthMm = normalizeBuildPlateDimension(
        groundPlaneWidth,
        "buildPlateWidthMm",
      );
    }

    if (groundPlaneDepth !== null) {
      defaultParams.buildPlateDepthMm = normalizeBuildPlateDimension(
        groundPlaneDepth,
        "buildPlateDepthMm",
      );
    }

    const defaultDraft = createDraftFromParams(defaultParams);

    captureEvent("grid_model_reset");
    model.clearRenderError();
    model.clearGeneratedModel();
    model.markCheckingCache();
    setParams(defaultParams);
    setDraft(defaultDraft);
    writeStoredGridSettings(defaultParams, defaultDraft);
    void model.requestRender(defaultParams);
  };

  if (!model.hasMounted) {
    return (
      <OpenScadGeneratorShell
        accent={accent}
        parametersPanel={
          <GeneratorPanel
            ariaLabel="Grid Parameters"
            icon={<SlidersHorizontal aria-hidden="true" size={18} />}
            title="Grid Parameters"
          >
            <LoadingPanel>Loading Generator</LoadingPanel>
          </GeneratorPanel>
        }
        previewAriaLabel="Grid Preview"
        previewTitle="Grid Preview"
        previewStatus="Loading"
        preview={<PreviewLoading>Preparing 3D Preview</PreviewLoading>}
        outputPanel={
          <GeneratorPanel
            ariaLabel="Model Output"
            icon={<PanelLeft aria-hidden="true" size={18} />}
            title="Model Output"
          >
            <LoadingPanel>Preparing OpenSCAD Runtime</LoadingPanel>
          </GeneratorPanel>
        }
      />
    );
  }

  return (
    <OpenScadGeneratorShell
      accent={accent}
      parametersPanel={
        <GridParametersPanel
          params={params}
          draft={draft}
          isRendering={model.isRendering}
          setParams={setParams}
          setDraft={setDraft}
          clearRenderError={model.clearRenderError}
          onGenerate={() => {
            const analyticsProperties = createGridAnalyticsProperties(params);
            captureEvent("grid_model_generate_requested", analyticsProperties);
            void model.requestRender(params, {
              completionEventName: "grid_model_preview_ready",
              properties: analyticsProperties,
            });
          }}
          onReset={reset}
        />
      }
      previewAriaLabel="Grid Preview"
      previewTitle="Grid Preview"
      previewStatus={model.previewStatus}
      preview={
        <OpenScadPreview
          stl={model.stl}
          errorMessage={model.renderError}
          groundPlane={groundPlane.groundPlane}
          isLoading={model.isRendering}
          loadingMessage={model.isRendering ? model.renderStatus : undefined}
          onModelVisible={model.markPreviewVisible}
          viewStorageKey={openscadPreviewViewStorageKey}
        />
      }
      outputPanel={
        <ModelOutputPanel
          modelSummary={`${params.widthUnits} x ${params.depthUnits} baseplate`}
          dimensions={dimensions}
          currentModelUrl={model.currentModelUrl}
          floorMode={groundPlane.preference.floorMode}
          groundPlaneDepthMm={groundPlane.preference.depthMm}
          groundPlaneWidthMm={groundPlane.preference.widthMm}
          isPreviewCurrent={model.isPreviewCurrent}
          selectedBuildPlatePresetName={
            groundPlane.preference.selectedBuildPlatePresetName
          }
          storageKey={openscadOutputActionStorageKey}
          onDownloadStl={model.downloadStl}
          onDownloadScad={model.downloadScad}
          onFloorModeChange={groundPlane.setFloorMode}
          onGroundPlaneDepthChange={setBuildPlateDepth}
          onGroundPlaneWidthChange={setBuildPlateWidth}
          onBuildPlatePresetSelect={selectBuildPlatePreset}
          extraControls={
            <GridBuildPlateSplitControls
              params={params}
              setParams={setParams}
              clearRenderError={model.clearRenderError}
            />
          }
        />
      }
    />
  );
}
