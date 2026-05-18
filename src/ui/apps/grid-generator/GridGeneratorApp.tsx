"use client";

import { PanelLeft, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { captureEvent } from "@/ui/analytics/posthog";
import {
  createBaseplateDefines,
  createBaseplateScadSnippet,
  defaultGridfinityBaseplateParameters,
  type BaseplateAlignment,
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
import { readLocalStorageJson, writeLocalStorageJson } from "../openscad/storage";
import { measureStlDimensions } from "../openscad/stlDimensions";
import { useGroundPlanePreference } from "../openscad/useGroundPlanePreference";
import { useOpenScadModel } from "../openscad/useOpenScadModel";
import type { GridfinityAppProps } from "../types";
import { GridParametersPanel } from "./GridParametersPanel";
import { gridNumberFields, type GridNumberField } from "./gridOptions";

const gridSettingsStorageKey = "gridfinity-grid-generator-settings";
const groundPlaneStorageKey = "gridfinity-grid-generator-ground-plane";

type StoredGridGeneratorSettings = {
  params: GridfinityBaseplateParameters;
  draft: Record<GridNumberField, string>;
};

const baseplateStyles = ["default", "cnclaser"] as const;
const oversizeMethods = ["crop", "fill"] as const;
const alignments = ["near", "center", "far"] as const;
const buildPlateModes = ["disabled", "enabled", "unique"] as const;
const magnetReleaseMethods = ["none", "slot", "hole"] as const;
const connectorPositions = ["center_wall", "intersection", "both"] as const;
const connectorSnapsStyles = ["disabled", "larger", "smaller"] as const;

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
  const params: GridfinityBaseplateParameters = {
    ...defaults,
    widthUnits: readNumberField(
      storedParams.widthUnits,
      defaults.widthUnits,
      "widthUnits",
    ),
    depthUnits: readNumberField(
      storedParams.depthUnits,
      defaults.depthUnits,
      "depthUnits",
    ),
    outerWidthUnits: readNumberField(
      storedParams.outerWidthUnits,
      defaults.outerWidthUnits,
      "outerWidthUnits",
    ),
    outerDepthUnits: readNumberField(
      storedParams.outerDepthUnits,
      defaults.outerDepthUnits,
      "outerDepthUnits",
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

  return readLocalStorageJson(
    gridSettingsStorageKey,
    { params: defaults, draft: createDraftFromParams(defaults) },
    parseStoredGridSettings,
  );
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
    plate_style: params.plateStyle,
    magnets: params.magnets,
    build_plate_mode: params.buildPlateMode,
  };
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
  const groundPlane = useGroundPlanePreference(groundPlaneStorageKey);

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
          viewStorageKey="gridfinity-grid-generator-preview-view"
        />
      }
      outputPanel={
        <ModelOutputPanel
          modelSummary={`${params.widthUnits} x ${params.depthUnits} baseplate`}
          dimensions={dimensions}
          currentModelUrl={model.currentModelUrl}
          groundPlaneDepthMm={groundPlane.preference.depthMm}
          groundPlaneWidthMm={groundPlane.preference.widthMm}
          isPreviewCurrent={model.isPreviewCurrent}
          selectedBuildPlatePresetName={
            groundPlane.preference.selectedBuildPlatePresetName
          }
          showGroundPlane={groundPlane.preference.showGroundPlane}
          storageKey="gridfinity-grid-generator-output-action"
          onDownloadStl={model.downloadStl}
          onDownloadScad={model.downloadScad}
          onGroundPlaneDepthChange={groundPlane.setGroundPlaneDepth}
          onGroundPlaneWidthChange={groundPlane.setGroundPlaneWidth}
          onBuildPlatePresetSelect={groundPlane.selectBuildPlatePreset}
          onShowGroundPlaneChange={groundPlane.setShowGroundPlane}
        />
      }
    />
  );
}
