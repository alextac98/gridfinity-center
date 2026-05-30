"use client";

import { PanelLeft, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { captureEvent } from "@/ui/analytics/posthog";
import {
  createBinDefines,
  createBinScadSnippet,
  defaultGridfinityBinParameters,
  normalizeBinExtraDefines,
  type GridfinityBinParameters,
} from "@/shared/gridfinityExtended";
import type { GridfinityAppProps } from "../types";
import { GeneratorPanel, LoadingPanel, OpenScadGeneratorShell, PreviewLoading } from "../openscad/OpenScadGeneratorShell";
import { ModelOutputPanel } from "../openscad/ModelOutputPanel";
import { OpenScadPreview } from "../openscad/OpenScadPreview";
import {
  openscadGroundPlaneStorageKey,
  openscadOutputActionStorageKey,
  openscadPreviewViewStorageKey,
} from "../openscad/outputPreferenceKeys";
import { readLocalStorageJson, writeLocalStorageJson } from "../openscad/storage";
import { useGroundPlanePreference } from "../openscad/useGroundPlanePreference";
import { useOpenScadModel } from "../openscad/useOpenScadModel";
import { BinParametersPanel } from "./BinParametersPanel";
import {
  convertBinSizeValue,
  getBinNumberFieldConfig,
  numberFields,
  type BinGeneratorSettings,
  type GridfinityBinDimensionUnit,
  type GridfinityBinWallThicknessUnit,
  type NumberField,
} from "./binOptions";
import { measureStlDimensions } from "../openscad/stlDimensions";

const binSettingsStorageKey = "gridfinity-bin-generator-settings";

type StoredBinGeneratorSettings = {
  params: BinGeneratorSettings;
  draft: Record<NumberField, string>;
};

const lipStyles = ["normal", "reduced", "reduced_double", "minimum", "none"] as const;
const labelStyles = [
  "disabled",
  "normal",
  "gflabel",
  "pred",
  "cullenect",
  "cullenect_legacy",
] as const;
const labelPositions = [
  "left",
  "center",
  "right",
  "leftchamber",
  "centerchamber",
  "rightchamber",
] as const;
const fingerSlides = ["none", "rounded", "chamfered"] as const;
const flatBases = ["off", "gridfinity", "rounded"] as const;
const dimensionUnits = ["u", "mm", "in"] as const;
const wallThicknessUnits = ["auto", "mm", "in"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStorageValue(value: unknown): value is GridfinityBinParameters["extraDefines"][string] {
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  return Array.isArray(value) && value.every(isStorageValue);
}

function cloneDefaultBinParameters(): GridfinityBinParameters {
  return {
    ...defaultGridfinityBinParameters,
    extraDefines: { ...defaultGridfinityBinParameters.extraDefines },
  };
}

function createDefaultBinSettings(): BinGeneratorSettings {
  return {
    ...cloneDefaultBinParameters(),
    wallThicknessMm: 0.95,
    widthUnit: "u",
    depthUnit: "u",
    heightUnit: "u",
    wallThicknessUnit: "auto",
  };
}

function createDraftFromParams(params: BinGeneratorSettings) {
  return Object.fromEntries(
    Object.keys(numberFields).map((key) => [
      key,
      String(params[key as NumberField]),
    ]),
  ) as Record<NumberField, string>;
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
  field: NumberField,
  unit?: GridfinityBinDimensionUnit | GridfinityBinWallThicknessUnit,
) {
  const config = getBinNumberFieldConfig(field, unit);

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, config.min), config.max);
}

function parseStoredBinSettings(value: unknown): StoredBinGeneratorSettings {
  const defaults = createDefaultBinSettings();
  const storedParams = isRecord(value)
    ? isRecord(value.params)
      ? value.params
      : value
    : {};
  const storedDraft = isRecord(value) && isRecord(value.draft)
    ? value.draft
    : {};
  const storedExtraDefines = isRecord(storedParams.extraDefines)
    ? storedParams.extraDefines
    : {};
  const extraDefines = { ...defaults.extraDefines };

  for (const [key, item] of Object.entries(storedExtraDefines)) {
    if (isStorageValue(item)) {
      extraDefines[key] = item;
    }
  }

  const params: BinGeneratorSettings = {
    ...defaults,
    widthUnits: readNumberField(
      storedParams.widthUnits,
      defaults.widthUnits,
      "widthUnits",
      readString(storedParams.widthUnit, defaults.widthUnit, dimensionUnits),
    ),
    depthUnits: readNumberField(
      storedParams.depthUnits,
      defaults.depthUnits,
      "depthUnits",
      readString(storedParams.depthUnit, defaults.depthUnit, dimensionUnits),
    ),
    heightUnits: readNumberField(
      storedParams.heightUnits,
      defaults.heightUnits,
      "heightUnits",
      readString(storedParams.heightUnit, defaults.heightUnit, dimensionUnits),
    ),
    widthUnit: readString(storedParams.widthUnit, defaults.widthUnit, dimensionUnits),
    depthUnit: readString(storedParams.depthUnit, defaults.depthUnit, dimensionUnits),
    heightUnit: readString(
      storedParams.heightUnit,
      defaults.heightUnit,
      dimensionUnits,
    ),
    verticalChambers: readNumberField(
      storedParams.verticalChambers,
      defaults.verticalChambers,
      "verticalChambers",
    ),
    horizontalChambers: readNumberField(
      storedParams.horizontalChambers,
      defaults.horizontalChambers,
      "horizontalChambers",
    ),
    wallThicknessMm: readNumberField(
      storedParams.wallThicknessMm,
      defaults.wallThicknessMm,
      "wallThicknessMm",
      readString(
        storedParams.wallThicknessUnit,
        defaults.wallThicknessUnit,
        wallThicknessUnits,
      ),
    ),
    wallThicknessUnit: readString(
      storedParams.wallThicknessUnit,
      defaults.wallThicknessUnit,
      wallThicknessUnits,
    ),
    lipStyle: readString(storedParams.lipStyle, defaults.lipStyle, lipStyles),
    labelStyle: readString(
      storedParams.labelStyle,
      defaults.labelStyle,
      labelStyles,
    ),
    labelPosition: readString(
      storedParams.labelPosition,
      defaults.labelPosition,
      labelPositions,
    ),
    fingerslide: readString(
      storedParams.fingerslide,
      defaults.fingerslide,
      fingerSlides,
    ),
    flatBase: readString(storedParams.flatBase, defaults.flatBase, flatBases),
    magnets:
      typeof storedParams.magnets === "boolean"
        ? storedParams.magnets
        : defaults.magnets,
    screws:
      typeof storedParams.screws === "boolean"
        ? storedParams.screws
        : defaults.screws,
    filledIn:
      typeof storedParams.filledIn === "boolean"
        ? storedParams.filledIn
        : defaults.filledIn,
    extraDefines,
  };
  const draft = createDraftFromParams(params);

  for (const key of Object.keys(numberFields) as NumberField[]) {
    const draftValue = storedDraft[key];

    if (typeof draftValue === "string") {
      draft[key] = draftValue;
    }
  }

  return { params, draft };
}

function readStoredBinSettings(): StoredBinGeneratorSettings {
  const defaults = createDefaultBinSettings();

  return readLocalStorageJson(
    binSettingsStorageKey,
    { params: defaults, draft: createDraftFromParams(defaults) },
    parseStoredBinSettings,
  );
}

function writeStoredBinSettings(
  params: BinGeneratorSettings,
  draft: Record<NumberField, string>,
) {
  writeLocalStorageJson(binSettingsStorageKey, { params, draft });
}

function createRenderParams(settings: BinGeneratorSettings): GridfinityBinParameters {
  const {
    depthUnit,
    heightUnit,
    wallThicknessUnit,
    widthUnit,
    ...params
  } = settings;

  return {
    ...params,
    widthUnits: convertBinSizeValue(settings.widthUnits, "widthUnits", widthUnit, "u"),
    depthUnits: convertBinSizeValue(settings.depthUnits, "depthUnits", depthUnit, "u"),
    heightUnits: convertBinSizeValue(settings.heightUnits, "heightUnits", heightUnit, "u"),
    wallThicknessMm:
      wallThicknessUnit === "auto"
        ? 0
        : convertBinSizeValue(
            settings.wallThicknessMm,
            "wallThicknessMm",
            wallThicknessUnit,
            "mm",
          ),
  };
}

function createParamsKey(params: GridfinityBinParameters) {
  return JSON.stringify({
    widthUnits: params.widthUnits,
    depthUnits: params.depthUnits,
    heightUnits: params.heightUnits,
    verticalChambers: params.verticalChambers,
    horizontalChambers: params.horizontalChambers,
    lipStyle: params.lipStyle,
    labelStyle: params.labelStyle,
    labelPosition: params.labelPosition,
    fingerslide: params.fingerslide,
    magnets: params.magnets,
    screws: params.screws,
    flatBase: params.flatBase,
    filledIn: params.filledIn,
    wallThicknessMm: params.wallThicknessMm,
    extraDefines: normalizeBinExtraDefines(params.extraDefines),
  });
}

function createBinAnalyticsProperties(settings: BinGeneratorSettings) {
  return {
    width_units: settings.widthUnits,
    depth_units: settings.depthUnits,
    height_units: settings.heightUnits,
    width_unit: settings.widthUnit,
    depth_unit: settings.depthUnit,
    height_unit: settings.heightUnit,
    vertical_chambers: settings.verticalChambers,
    horizontal_chambers: settings.horizontalChambers,
    lip_style: settings.lipStyle,
    label_style: settings.labelStyle,
    magnets: settings.magnets,
    screws: settings.screws,
    filled_in: settings.filledIn,
    wall_thickness_unit: settings.wallThicknessUnit,
  };
}

export function BinGeneratorApp({ accent }: GridfinityAppProps) {
  const [initialSettings] = useState(readStoredBinSettings);
  const [params, setParams] = useState(initialSettings.params);
  const [draft, setDraft] = useState(initialSettings.draft);
  const renderParams = useMemo(() => createRenderParams(params), [params]);
  const model = useOpenScadModel({
    params: renderParams,
    cacheModelId: "bin-generator",
    entryFile: "gridfinity_basic_cup.scad",
    outputBaseName: "gridfinity-bin",
    createDefines: createBinDefines,
    createParamsKey,
    createScadSnippet: createBinScadSnippet,
    renderErrorMessage:
      "OpenSCAD could not generate this bin. Check the browser console for details.",
    workerErrorMessage:
      "The OpenSCAD worker failed to start. Check the browser console for details.",
  });
  const groundPlane = useGroundPlanePreference(openscadGroundPlaneStorageKey);

  useEffect(() => {
    writeStoredBinSettings(params, draft);
  }, [draft, params]);

  const dimensions = useMemo(() => {
    if (!model.stl || !model.isPreviewCurrent) {
      return null;
    }

    return measureStlDimensions(model.stl);
  }, [model.isPreviewCurrent, model.stl]);

  const reset = () => {
    const defaultParams = createDefaultBinSettings();
    const defaultDraft = createDraftFromParams(defaultParams);
    const defaultRenderParams = createRenderParams(defaultParams);

    captureEvent("bin_model_reset");
    model.clearRenderError();
    model.clearGeneratedModel();
    model.markCheckingCache();
    setParams(defaultParams);
    setDraft(defaultDraft);
    writeStoredBinSettings(defaultParams, defaultDraft);
    void model.requestRender(defaultRenderParams);
  };

  if (!model.hasMounted) {
    return (
      <OpenScadGeneratorShell
        accent={accent}
        parametersPanel={
          <GeneratorPanel
            ariaLabel="Bin Parameters"
            icon={<SlidersHorizontal aria-hidden="true" size={18} />}
            title="Bin Parameters"
          >
            <LoadingPanel>Loading Generator</LoadingPanel>
          </GeneratorPanel>
        }
        previewAriaLabel="Bin Preview"
        previewTitle="Bin Preview"
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
        <BinParametersPanel
          params={params}
          draft={draft}
          isRendering={model.isRendering}
          setParams={setParams}
          setDraft={setDraft}
          clearRenderError={model.clearRenderError}
          onGenerate={() => {
            const analyticsProperties = createBinAnalyticsProperties(params);
            captureEvent("bin_model_generate_requested", analyticsProperties);
            void model.requestRender(renderParams, {
              completionEventName: "bin_model_preview_ready",
              properties: analyticsProperties,
            });
          }}
          onReset={reset}
        />
      }
      previewAriaLabel="Bin Preview"
      previewTitle="Bin Preview"
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
          modelSummary={`${params.widthUnits}${params.widthUnit} x ${params.depthUnits}${params.depthUnit} x ${params.heightUnits}${params.heightUnit} bin`}
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
          onGroundPlaneDepthChange={groundPlane.setGroundPlaneDepth}
          onGroundPlaneWidthChange={groundPlane.setGroundPlaneWidth}
          onBuildPlatePresetSelect={groundPlane.selectBuildPlatePreset}
        />
      }
    />
  );
}
