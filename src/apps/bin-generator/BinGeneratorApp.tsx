"use client";

import { Layers3, PanelLeft, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createBinDefines,
  createBinScadSnippet,
  defaultGridfinityBinParameters,
  normalizeBinExtraDefines,
  type GridfinityBinParameters,
} from "@/lib/openscad/gridfinityExtended";
import { createOpenScadWorker } from "@/lib/openscad/workerClient";
import type {
  OpenScadWorkerRequest,
  OpenScadWorkerResponse,
} from "@/lib/openscad/workerTypes";
import type { GridfinityAppProps } from "../types";
import {
  OpenScadPreview,
  type GroundPlaneConfig,
} from "../openscad/OpenScadPreview";
import { BinParametersPanel } from "./BinParametersPanel";
import { ModelOutputPanel } from "./ModelOutputPanel";
import { numberFields, type NumberField } from "./binOptions";
import styles from "./bin-generator.module.css";
import { measureStlDimensions } from "./stlDimensions";

type R2CacheResponse =
  | {
      enabled: false;
      reason: string;
      settingsHash: string;
      objectKey: string;
    }
  | {
      enabled: true;
      hit: boolean;
      settingsHash: string;
      objectKey: string;
      downloadUrl: string;
      uploadUrl?: string;
    };

const binSettingsStorageKey = "gridfinity-bin-generator-settings";
const defaultGroundPlaneDraft = {
  widthMm: "250",
  depthMm: "250",
};
const groundPlaneStorageKey = "gridfinity-bin-generator-ground-plane";

type GroundPlanePreference = {
  showGroundPlane: boolean;
  widthMm: string;
  depthMm: string;
  selectedBuildPlatePresetName: string;
};

type StoredBinGeneratorSettings = {
  params: GridfinityBinParameters;
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

function createDraftFromParams(params: GridfinityBinParameters) {
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
) {
  const config = numberFields[field];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, config.min), config.max);
}

function readStoredBinSettings(): StoredBinGeneratorSettings {
  const defaults = cloneDefaultBinParameters();
  const defaultDraft = createDraftFromParams(defaults);

  if (typeof window === "undefined") {
    return { params: defaults, draft: defaultDraft };
  }

  const storedSettings = window.localStorage.getItem(binSettingsStorageKey);

  if (!storedSettings) {
    return { params: defaults, draft: defaultDraft };
  }

  try {
    const parsed = JSON.parse(storedSettings) as unknown;
    const storedParams = isRecord(parsed)
      ? isRecord(parsed.params)
        ? parsed.params
        : parsed
      : {};
    const storedDraft = isRecord(parsed) && isRecord(parsed.draft)
      ? parsed.draft
      : {};
    const storedExtraDefines = isRecord(storedParams.extraDefines)
      ? storedParams.extraDefines
      : {};
    const extraDefines = { ...defaults.extraDefines };

    for (const [key, value] of Object.entries(storedExtraDefines)) {
      if (isStorageValue(value)) {
        extraDefines[key] = value;
      }
    }

    const params: GridfinityBinParameters = {
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
      heightUnits: readNumberField(
        storedParams.heightUnits,
        defaults.heightUnits,
        "heightUnits",
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
      const value = storedDraft[key];

      if (typeof value === "string") {
        draft[key] = value;
      }
    }

    return { params, draft };
  } catch {
    return { params: defaults, draft: defaultDraft };
  }
}

function writeStoredBinSettings(
  params: GridfinityBinParameters,
  draft: Record<NumberField, string>,
) {
  window.localStorage.setItem(
    binSettingsStorageKey,
    JSON.stringify({ params, draft }),
  );
}

function parseGroundPlaneDimension(value: string) {
  const dimension = Number.parseFloat(value);

  return Number.isFinite(dimension) && dimension > 0 ? dimension : null;
}

function readGroundPlanePreference(): GroundPlanePreference {
  if (typeof window === "undefined") {
    return {
      showGroundPlane: false,
      selectedBuildPlatePresetName: "",
      ...defaultGroundPlaneDraft,
    };
  }

  const storedPreference = window.localStorage.getItem(groundPlaneStorageKey);

  if (!storedPreference) {
    return {
      showGroundPlane: false,
      selectedBuildPlatePresetName: "",
      ...defaultGroundPlaneDraft,
    };
  }

  try {
    const preference = JSON.parse(storedPreference) as Partial<GroundPlanePreference>;
    const widthMm =
      typeof preference.widthMm === "string" &&
      parseGroundPlaneDimension(preference.widthMm) !== null
        ? preference.widthMm
        : defaultGroundPlaneDraft.widthMm;
    const depthMm =
      typeof preference.depthMm === "string" &&
      parseGroundPlaneDimension(preference.depthMm) !== null
        ? preference.depthMm
        : defaultGroundPlaneDraft.depthMm;

    return {
      showGroundPlane: preference.showGroundPlane === true,
      selectedBuildPlatePresetName:
        typeof preference.selectedBuildPlatePresetName === "string"
          ? preference.selectedBuildPlatePresetName
          : "",
      widthMm,
      depthMm,
    };
  } catch {
    return {
      showGroundPlane: false,
      selectedBuildPlatePresetName: "",
      ...defaultGroundPlaneDraft,
    };
  }
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadUrl(name: string, url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  link.click();
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
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

function writeOpenScadErrorToConsole(message: string, logs: string[]) {
  console.error("OpenSCAD render failed.", message);

  if (logs.length > 0) {
    console.groupCollapsed("OpenSCAD logs");
    console.info(logs.join("\n"));
    console.groupEnd();
  }
}

async function cacheGeneratedStl(cache: R2CacheResponse, stlBytes: Uint8Array) {
  if (!cache.enabled || cache.hit) {
    return;
  }

  if (!cache.uploadUrl) {
    console.warn(
      "R2 cache upload skipped because no upload URL was returned.",
      {
        objectKey: cache.objectKey,
        settingsHash: cache.settingsHash,
      },
    );
    return;
  }

  try {
    try {
      await uploadStlToR2(cache.uploadUrl, stlBytes);
      console.info("R2 cache upload completed directly.", {
        objectKey: cache.objectKey,
        settingsHash: cache.settingsHash,
      });
    } catch (directUploadError) {
      console.warn(
        "Direct R2 upload failed; retrying through API.",
        directUploadError,
      );
      await uploadStlThroughApi(cache.objectKey, stlBytes);
      console.info("R2 cache upload completed through API fallback.", {
        objectKey: cache.objectKey,
        settingsHash: cache.settingsHash,
      });
    }
  } catch (error) {
    console.warn("R2 cache upload failed; keeping local STL.", error);
    throw error;
  }
}

async function lookupR2Cache(params: GridfinityBinParameters) {
  const response = await fetch("/api/bin-generator/r2-cache", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ params }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`R2 cache lookup failed with status ${response.status}: ${details}`);
  }

  return (await response.json()) as R2CacheResponse;
}

async function fetchStlFromUrl(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not load cached STL: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function uploadStlToR2(uploadUrl: string, stlBytes: Uint8Array) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "model/stl",
    },
    body: toArrayBuffer(stlBytes),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`R2 cache upload failed with status ${response.status}: ${details}`);
  }
}

async function uploadStlThroughApi(objectKey: string, stlBytes: Uint8Array) {
  const response = await fetch("/api/bin-generator/r2-cache/upload", {
    method: "POST",
    headers: {
      "Content-Type": "model/stl",
      "x-r2-object-key": objectKey,
    },
    body: toArrayBuffer(stlBytes),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`R2 cache API upload failed with status ${response.status}: ${details}`);
  }
}

export function BinGeneratorApp({ accent }: GridfinityAppProps) {
  const [initialSettings] = useState(readStoredBinSettings);

  const [hasMounted, setHasMounted] = useState(false);
  const [params, setParams] = useState(initialSettings.params);
  const [draft, setDraft] = useState(initialSettings.draft);
  const [stl, setStl] = useState<Uint8Array>();
  const [generatedParamsKey, setGeneratedParamsKey] = useState("");
  const [renderStatus, setRenderStatus] = useState("Preparing OpenSCAD Worker");
  const [renderError, setRenderError] = useState("");
  const [isRendering, setIsRendering] = useState(true);
  const renderSequenceRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const latestParamsRef = useRef(initialSettings.params);
  const activeRequestRef = useRef<number | null>(null);
  const activeParamsKeyRef = useRef("");
  const isWorkerRenderingRef = useRef(false);
  const queuedRenderRef = useRef(false);
  const activeCacheRef = useRef<R2CacheResponse | null>(null);
  const [cachedDownloadUrl, setCachedDownloadUrl] = useState("");
  const [cachedDownloadParamsKey, setCachedDownloadParamsKey] = useState("");
  const [groundPlanePreference, setGroundPlanePreference] = useState(
    readGroundPlanePreference,
  );

  const scadSnippet = useMemo(() => createBinScadSnippet(params), [params]);
  const currentParamsKey = useMemo(() => createParamsKey(params), [params]);
  const isPreviewCurrent = Boolean(
    stl && generatedParamsKey === currentParamsKey && !renderError,
  );
  const previewStatus = renderError
    ? "Render Failed"
    : isRendering
      ? "Rendering"
      : isPreviewCurrent
        ? "OpenSCAD Preview Ready"
        : stl
          ? "Changes Pending"
          : "Ready To Generate";
  const dimensions = useMemo(() => {
    if (!stl || !isPreviewCurrent) {
      return null;
    }

    return measureStlDimensions(stl);
  }, [isPreviewCurrent, stl]);
  const groundPlane = useMemo<GroundPlaneConfig>(() => {
    const widthMm = parseGroundPlaneDimension(groundPlanePreference.widthMm);
    const depthMm = parseGroundPlaneDimension(groundPlanePreference.depthMm);

    return {
      visible:
        groundPlanePreference.showGroundPlane &&
        widthMm !== null &&
        depthMm !== null,
      printerName: groundPlanePreference.selectedBuildPlatePresetName,
      widthMm: widthMm ?? 250,
      depthMm: depthMm ?? 250,
    };
  }, [
    groundPlanePreference.depthMm,
    groundPlanePreference.selectedBuildPlatePresetName,
    groundPlanePreference.showGroundPlane,
    groundPlanePreference.widthMm,
  ]);

  useEffect(() => {
    const mountTimer = window.setTimeout(() => setHasMounted(true), 0);

    return () => window.clearTimeout(mountTimer);
  }, []);

  useEffect(() => {
    writeStoredBinSettings(params, draft);
  }, [draft, params]);

  useEffect(() => {
    window.localStorage.setItem(
      groundPlaneStorageKey,
      JSON.stringify(groundPlanePreference),
    );
  }, [groundPlanePreference]);

  const startRender = useCallback((nextParams: GridfinityBinParameters) => {
    const worker = workerRef.current;

    if (!worker) {
      return;
    }

    const renderSequence = renderSequenceRef.current + 1;
    renderSequenceRef.current = renderSequence;
    activeRequestRef.current = renderSequence;
    activeParamsKeyRef.current = createParamsKey(nextParams);
    isWorkerRenderingRef.current = true;
    queuedRenderRef.current = false;
    setIsRendering(true);
    setRenderError("");
    setRenderStatus("Rendering OpenSCAD STL");

    const request: OpenScadWorkerRequest = {
      type: "render",
      requestId: renderSequence,
      entryFile: "gridfinity_basic_cup.scad",
      defines: createBinDefines(nextParams),
      outputName: "gridfinity-bin.stl",
    };

    worker.postMessage(request);
  }, []);

  const requestRender = useCallback(
    async (nextParams: GridfinityBinParameters) => {
      const nextParamsKey = createParamsKey(nextParams);
      latestParamsRef.current = nextParams;
      activeCacheRef.current = null;
      setRenderError("");

      if (!workerRef.current) {
        setIsRendering(false);
        setRenderStatus("Preparing OpenSCAD Worker");
        return;
      }

      if (isWorkerRenderingRef.current) {
        queuedRenderRef.current = true;
        setIsRendering(true);
        setRenderStatus("Rendering Updated OpenSCAD STL");
        return;
      }

      setIsRendering(true);
      setRenderStatus("Checking Model Cache");

      try {
        const cache = await lookupR2Cache(nextParams);

        if (!cache.enabled) {
          console.warn("R2 cache disabled; rendering locally.", {
            reason: cache.reason,
            objectKey: cache.objectKey,
            settingsHash: cache.settingsHash,
          });
        }

        if (cache.enabled && cache.hit) {
          console.info("R2 cache hit.", {
            objectKey: cache.objectKey,
            settingsHash: cache.settingsHash,
          });
          setRenderStatus("Loading Cached STL");
          const cachedStl = await fetchStlFromUrl(cache.downloadUrl);
          setStl(cachedStl);
          setGeneratedParamsKey(nextParamsKey);
          setCachedDownloadUrl(cache.downloadUrl);
          setCachedDownloadParamsKey(nextParamsKey);
          setRenderStatus("Cached OpenSCAD Preview Ready");
          setIsRendering(false);
          return;
        }

        if (cache.enabled) {
          console.info("R2 cache miss; rendering locally and uploading in the background.", {
            objectKey: cache.objectKey,
            settingsHash: cache.settingsHash,
            hasUploadUrl: Boolean(cache.uploadUrl),
          });
          activeCacheRef.current = cache;
        }
      } catch (error) {
        console.warn("R2 cache lookup failed; rendering locally.", error);
      }

      setRenderStatus("Rendering OpenSCAD STL");
      startRender(latestParamsRef.current);
    },
    [startRender],
  );

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    const worker = createOpenScadWorker();
    workerRef.current = worker;

    const startQueuedRenderIfNeeded = () => {
      isWorkerRenderingRef.current = false;
      activeRequestRef.current = null;

      if (queuedRenderRef.current) {
        queuedRenderRef.current = false;
        startRender(latestParamsRef.current);
        return true;
      }

      return false;
    };

    const handleWorkerMessage = async (event: MessageEvent<OpenScadWorkerResponse>) => {
      const message = event.data;

      if (message.type === "render-started") {
        return;
      }

      if (message.requestId !== activeRequestRef.current) {
        return;
      }

      if (message.type === "render-done") {
        if (startQueuedRenderIfNeeded()) {
          return;
        }

        const stlBytes = new Uint8Array(message.stl);
        const cache = activeCacheRef.current;
        const renderedParamsKey = activeParamsKeyRef.current;
        activeCacheRef.current = null;
        setStl(stlBytes);
        setGeneratedParamsKey(renderedParamsKey);
        setRenderStatus("OpenSCAD Preview Ready");
        setRenderError("");
        setIsRendering(false);

        if (cache?.enabled && !cache.hit && cache.uploadUrl) {
          setCachedDownloadUrl("");
          setCachedDownloadParamsKey("");
          void cacheGeneratedStl(cache, stlBytes)
            .then(() => {
              setCachedDownloadUrl(cache.downloadUrl);
              setCachedDownloadParamsKey(renderedParamsKey);
            })
            .catch(() => {
              setCachedDownloadUrl("");
              setCachedDownloadParamsKey("");
            });
        } else {
          setCachedDownloadUrl("");
          setCachedDownloadParamsKey("");
        }

        return;
      }

      writeOpenScadErrorToConsole(message.message, message.logs);
      activeCacheRef.current = null;

      if (startQueuedRenderIfNeeded()) {
        return;
      }

      setRenderError(
        "OpenSCAD could not generate this bin. Check the browser console for details.",
      );
      setRenderStatus("OpenSCAD Render Failed");
      setIsRendering(false);
    };

    const handleMessage = (event: MessageEvent<OpenScadWorkerResponse>) => {
      void handleWorkerMessage(event);
    };

    const handleWorkerError = (event: ErrorEvent) => {
      console.error("OpenSCAD worker failed.", event.error ?? event.message);
      isWorkerRenderingRef.current = false;
      activeRequestRef.current = null;
      setStl(undefined);
      setRenderError(
        "The OpenSCAD worker failed to start. Check the browser console for details.",
      );
      setRenderStatus("OpenSCAD Worker Failed");
      setIsRendering(false);
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleWorkerError);
    const initialRenderTimer = window.setTimeout(() => {
      void requestRender(latestParamsRef.current);
    }, 0);

    return () => {
      window.clearTimeout(initialRenderTimer);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleWorkerError);
      worker.terminate();
      workerRef.current = null;
      isWorkerRenderingRef.current = false;
      activeRequestRef.current = null;
      activeCacheRef.current = null;
    };
  }, [hasMounted, requestRender, startRender]);

  const downloadCurrentStl = () => {
    if (!stl || !isPreviewCurrent) {
      return;
    }

    if (cachedDownloadUrl && cachedDownloadParamsKey === currentParamsKey) {
      downloadUrl("gridfinity-bin.stl", cachedDownloadUrl);
      return;
    }

    downloadBlob(
      "gridfinity-bin.stl",
      new Blob([toArrayBuffer(stl)], { type: "model/stl" }),
    );
  };

  const downloadCurrentScad = () => {
    downloadBlob(
      "gridfinity-bin.scad",
      new Blob([scadSnippet], { type: "text/plain" }),
    );
  };

  const currentModelUrl =
    isPreviewCurrent &&
    cachedDownloadUrl &&
    cachedDownloadParamsKey === currentParamsKey
      ? new URL(cachedDownloadUrl, window.location.origin).toString()
      : "";

  const reset = () => {
    const defaultParams = cloneDefaultBinParameters();
    const defaultDraft = createDraftFromParams(defaultParams);

    setRenderError("");
    setParams(defaultParams);
    setStl(undefined);
    setGeneratedParamsKey("");
    setCachedDownloadUrl("");
    setCachedDownloadParamsKey("");
    setRenderStatus("Checking Model Cache");
    setDraft(defaultDraft);
    writeStoredBinSettings(defaultParams, defaultDraft);
    void requestRender(defaultParams);
  };

  if (!hasMounted) {
    return (
      <div className={styles.appFrame} data-accent={accent}>
        <section className={styles.panel} aria-label="Bin Parameters">
          <div className={styles.panelHeader}>
            <SlidersHorizontal aria-hidden="true" size={18} />
            <h2>Bin Parameters</h2>
          </div>
          <div className={styles.loadingPanel}>Loading Generator</div>
        </section>

        <section className={styles.preview} aria-label="Bin Preview">
          <div className={styles.previewToolbar}>
            <span>Bin Preview</span>
            <div className={styles.toolbarStatus}>
              <Layers3 aria-hidden="true" size={16} />
              Loading
            </div>
          </div>
          <div className={styles.previewLoading}>Preparing 3D Preview</div>
        </section>

        <section className={styles.panel} aria-label="Model Output">
          <div className={styles.panelHeader}>
            <PanelLeft aria-hidden="true" size={18} />
            <h2>Model Output</h2>
          </div>
          <div className={styles.loadingPanel}>Preparing OpenSCAD Runtime</div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.appFrame} data-accent={accent}>
      <BinParametersPanel
        params={params}
        draft={draft}
        isRendering={isRendering}
        setParams={setParams}
        setDraft={setDraft}
        clearRenderError={() => setRenderError("")}
        onGenerate={() => {
          void requestRender(params);
        }}
        onReset={reset}
      />

      <section className={styles.preview} aria-label="Bin Preview">
        <div className={styles.previewToolbar}>
          <span>Bin Preview</span>
          <div className={styles.toolbarStatus}>
            <Layers3 aria-hidden="true" size={16} />
            {previewStatus}
          </div>
        </div>
        <OpenScadPreview
          stl={stl}
          errorMessage={renderError}
          groundPlane={groundPlane}
          isLoading={isRendering}
          loadingMessage={isRendering ? renderStatus : undefined}
          viewStorageKey="gridfinity-bin-generator-preview-view"
        />
      </section>

      <ModelOutputPanel
        params={params}
        dimensions={dimensions}
        currentModelUrl={currentModelUrl}
        groundPlaneDepthMm={groundPlanePreference.depthMm}
        groundPlaneWidthMm={groundPlanePreference.widthMm}
        isPreviewCurrent={isPreviewCurrent}
        selectedBuildPlatePresetName={
          groundPlanePreference.selectedBuildPlatePresetName
        }
        showGroundPlane={groundPlanePreference.showGroundPlane}
        onDownloadStl={downloadCurrentStl}
        onDownloadScad={downloadCurrentScad}
        onGroundPlaneDepthChange={(depthMm) =>
          setGroundPlanePreference((current) => ({
            ...current,
            depthMm,
            selectedBuildPlatePresetName: "",
          }))
        }
        onGroundPlaneWidthChange={(widthMm) =>
          setGroundPlanePreference((current) => ({
            ...current,
            selectedBuildPlatePresetName: "",
            widthMm,
          }))
        }
        onBuildPlatePresetSelect={(preset) =>
          setGroundPlanePreference((current) => ({
            ...current,
            depthMm: String(preset.depthMm),
            selectedBuildPlatePresetName: preset.label,
            widthMm: String(preset.widthMm),
          }))
        }
        onShowGroundPlaneChange={(showGroundPlane) =>
          setGroundPlanePreference((current) => ({
            ...current,
            showGroundPlane,
          }))
        }
      />
    </div>
  );
}
