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
import { OpenScadPreview } from "../openscad/OpenScadPreview";
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

const defaultParamsKey = createParamsKey(defaultGridfinityBinParameters);

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
  const [hasMounted, setHasMounted] = useState(false);
  const [params, setParams] = useState(defaultGridfinityBinParameters);
  const [draft, setDraft] = useState(
    Object.fromEntries(
      Object.keys(numberFields).map((key) => [
        key,
        String(defaultGridfinityBinParameters[key as NumberField]),
      ]),
    ) as Record<NumberField, string>,
  );
  const [stl, setStl] = useState<Uint8Array>();
  const [generatedParamsKey, setGeneratedParamsKey] = useState("");
  const [renderStatus, setRenderStatus] = useState("Preparing OpenSCAD Worker");
  const [renderError, setRenderError] = useState("");
  const [isRendering, setIsRendering] = useState(true);
  const renderSequenceRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const latestParamsRef = useRef(defaultGridfinityBinParameters);
  const latestParamsKeyRef = useRef(defaultParamsKey);
  const activeRequestRef = useRef<number | null>(null);
  const activeParamsKeyRef = useRef("");
  const isWorkerRenderingRef = useRef(false);
  const queuedRenderRef = useRef(false);
  const activeCacheRef = useRef<R2CacheResponse | null>(null);
  const [cachedDownloadUrl, setCachedDownloadUrl] = useState("");
  const [cachedDownloadParamsKey, setCachedDownloadParamsKey] = useState("");

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

  useEffect(() => {
    const mountTimer = window.setTimeout(() => setHasMounted(true), 0);

    return () => window.clearTimeout(mountTimer);
  }, []);

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
      latestParamsKeyRef.current = nextParamsKey;
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
      void requestRender(defaultGridfinityBinParameters);
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
    setRenderError("");
    setParams(defaultGridfinityBinParameters);
    setStl(undefined);
    setGeneratedParamsKey("");
    setCachedDownloadUrl("");
    setCachedDownloadParamsKey("");
    setRenderStatus("Checking Model Cache");
    setDraft(
      Object.fromEntries(
        Object.keys(numberFields).map((key) => [
          key,
          String(defaultGridfinityBinParameters[key as NumberField]),
        ]),
      ) as Record<NumberField, string>,
    );
    void requestRender(defaultGridfinityBinParameters);
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
          isLoading={isRendering}
          loadingMessage={isRendering ? renderStatus : undefined}
        />
      </section>

      <ModelOutputPanel
        params={params}
        dimensions={dimensions}
        currentModelUrl={currentModelUrl}
        isPreviewCurrent={isPreviewCurrent}
        onDownloadStl={downloadCurrentStl}
        onDownloadScad={downloadCurrentScad}
      />
    </div>
  );
}
