"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  captureEvent,
  type AnalyticsEventProperties,
} from "@/ui/analytics/posthog";
import type { OpenScadDefineValue } from "@/shared/openscad-defines";
import { createOpenScadWorker } from "@/ui/openscadWorkerClient";
import type {
  OpenScadWorkerRequest,
  OpenScadWorkerResponse,
} from "@/shared/openscadWorkerTypes";

type ModelResponse = {
  cacheStatus: string;
  modelUrl: string;
  renderSource: PreviewTiming["renderSource"];
  stl: Uint8Array;
};

type UseOpenScadModelOptions<TParams> = {
  params: TParams;
  entryFile: string;
  outputBaseName: string;
  cacheModelId?: string;
  createDefines: (params: TParams) => Record<string, OpenScadDefineValue>;
  createParamsKey: (params: TParams) => string;
  createScadSnippet: (params: TParams) => string;
  renderErrorMessage: string;
  workerErrorMessage: string;
};

type RenderRequestOptions = {
  completionEventName: string;
  properties?: AnalyticsEventProperties;
};

type RenderTiming = {
  completionEventName: string;
  properties?: AnalyticsEventProperties;
  startedAt: number;
};

type PreviewTiming = RenderTiming & {
  cacheStatus: string;
  renderSource: "openscad_render" | "native_openscad" | "r2_cache";
  stl: Uint8Array;
};

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
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

function writeOpenScadErrorToConsole(message: string, logs: string[]) {
  console.error("OpenSCAD render failed.", message);

  if (logs.length > 0) {
    console.groupCollapsed("OpenSCAD logs");
    console.info(logs.join("\n"));
    console.groupEnd();
  }
}

async function fetchModel<TParams>(
  modelId: string,
  params: TParams,
): Promise<{ unavailable: true } | ({ unavailable: false } & ModelResponse)> {
  const response = await fetch(`/api/openscad-models/${modelId}/model`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ params }),
  });

  if (response.status === 503) {
    return { unavailable: true as const };
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `OpenSCAD model request failed with status ${response.status}: ${details}`,
    );
  }

  const renderSource = response.headers.get("X-Render-Source");

  return {
    cacheStatus: response.headers.get("X-Model-Cache-Status") ?? "none",
    modelUrl: response.headers.get("X-Model-Url") ?? "",
    renderSource:
      renderSource === "r2_cache" ? "r2_cache" : "native_openscad",
    unavailable: false as const,
    stl: new Uint8Array(await response.arrayBuffer()),
  };
}

export function useOpenScadModel<TParams>({
  params,
  entryFile,
  outputBaseName,
  cacheModelId,
  createDefines,
  createParamsKey,
  createScadSnippet,
  renderErrorMessage,
  workerErrorMessage,
}: UseOpenScadModelOptions<TParams>) {
  const [hasMounted, setHasMounted] = useState(false);
  const [stl, setStl] = useState<Uint8Array>();
  const [generatedParamsKey, setGeneratedParamsKey] = useState("");
  const [renderStatus, setRenderStatus] = useState(
    "Preparing browser OpenSCAD WASM worker",
  );
  const [renderError, setRenderError] = useState("");
  const [isRendering, setIsRendering] = useState(true);
  const [cachedDownloadUrl, setCachedDownloadUrl] = useState("");
  const [cachedDownloadParamsKey, setCachedDownloadParamsKey] = useState("");
  const renderSequenceRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const latestParamsRef = useRef(params);
  const activeRequestRef = useRef<number | null>(null);
  const activeParamsKeyRef = useRef("");
  const isWorkerRenderingRef = useRef(false);
  const queuedRenderRef = useRef(false);
  const activeRenderTimingRef = useRef<RenderTiming | null>(null);
  const queuedRenderTimingRef = useRef<RenderTiming | null>(null);
  const previewTimingRef = useRef<PreviewTiming | null>(null);
  const nativeRendererUnavailableRef = useRef(false);

  const currentParamsKey = useMemo(
    () => createParamsKey(params),
    [createParamsKey, params],
  );
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
  const currentModelUrl =
    isPreviewCurrent &&
    cachedDownloadUrl &&
    cachedDownloadParamsKey === currentParamsKey &&
    typeof window !== "undefined"
      ? new URL(cachedDownloadUrl, window.location.origin).toString()
      : "";

  useEffect(() => {
    const mountTimer = window.setTimeout(() => setHasMounted(true), 0);

    return () => window.clearTimeout(mountTimer);
  }, []);

  const startRender = useCallback(
    (nextParams: TParams) => {
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
      setRenderStatus("Rendering in browser with OpenSCAD WASM");

      const request: OpenScadWorkerRequest = {
        type: "render",
        requestId: renderSequence,
        entryFile,
        defines: createDefines(nextParams),
        outputName: `${outputBaseName}.stl`,
      };

      worker.postMessage(request);
    },
    [createDefines, createParamsKey, entryFile, outputBaseName],
  );

  const createRenderTiming = useCallback(
    (options: RenderRequestOptions | undefined) =>
      options
        ? {
            completionEventName: options.completionEventName,
            properties: options.properties,
            startedAt: performance.now(),
          }
        : null,
    [],
  );

  const preparePreviewTiming = useCallback(
    (
      stlBytes: Uint8Array,
      renderSource: PreviewTiming["renderSource"],
      cacheStatus: string,
    ) => {
      const timing = activeRenderTimingRef.current;
      activeRenderTimingRef.current = null;

      if (!timing) {
        previewTimingRef.current = null;
        return;
      }

      previewTimingRef.current = {
        ...timing,
        cacheStatus,
        renderSource,
        stl: stlBytes,
      };
    },
    [],
  );

  const markPreviewVisible = useCallback((visibleStl: Uint8Array) => {
    const timing = previewTimingRef.current;

    if (!timing || timing.stl !== visibleStl) {
      return;
    }

    previewTimingRef.current = null;
    captureEvent(timing.completionEventName, {
      ...timing.properties,
      cache_status: timing.cacheStatus,
      duration_ms: Math.round(performance.now() - timing.startedAt),
      render_source: timing.renderSource,
    });
  }, []);

  const requestRender = useCallback(
    async (nextParams: TParams, options?: RenderRequestOptions) => {
      const nextParamsKey = createParamsKey(nextParams);
      const timing = createRenderTiming(options);
      latestParamsRef.current = nextParams;
      setRenderError("");

      if (!workerRef.current) {
        setIsRendering(false);
        setRenderStatus("Preparing browser OpenSCAD WASM worker");
        return;
      }

      if (isWorkerRenderingRef.current) {
        queuedRenderRef.current = true;
        activeRenderTimingRef.current = null;
        queuedRenderTimingRef.current = timing;
        previewTimingRef.current = null;
        setIsRendering(true);
        setRenderStatus("Rendering updated model in browser with OpenSCAD WASM");
        return;
      }

      activeRenderTimingRef.current = timing;
      queuedRenderTimingRef.current = null;
      previewTimingRef.current = null;

      if (cacheModelId && !nativeRendererUnavailableRef.current) {
        setIsRendering(true);
        setRenderStatus("Requesting OpenSCAD model");

        try {
          const modelResponse = await fetchModel(cacheModelId, nextParams);

          if (modelResponse.unavailable) {
            nativeRendererUnavailableRef.current = true;
          } else {
            preparePreviewTiming(
              modelResponse.stl,
              modelResponse.renderSource,
              modelResponse.cacheStatus,
            );
            setStl(modelResponse.stl);
            setGeneratedParamsKey(nextParamsKey);
            setRenderStatus("OpenSCAD Preview Ready");
            setRenderError("");
            setIsRendering(false);
            setCachedDownloadUrl(modelResponse.modelUrl);
            setCachedDownloadParamsKey(
              modelResponse.modelUrl ? nextParamsKey : "",
            );

            return;
          }
        } catch (error) {
          console.warn("OpenSCAD model request failed; rendering in browser.", error);
        }
      }

      setIsRendering(true);
      setRenderStatus("Rendering in browser with OpenSCAD WASM");
      startRender(latestParamsRef.current);
    },
    [
      cacheModelId,
      createParamsKey,
      createRenderTiming,
      preparePreviewTiming,
      startRender,
    ],
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
        activeRenderTimingRef.current = queuedRenderTimingRef.current;
        queuedRenderTimingRef.current = null;
        previewTimingRef.current = null;
        startRender(latestParamsRef.current);
        return true;
      }

      return false;
    };

    const handleWorkerMessage = async (
      event: MessageEvent<OpenScadWorkerResponse>,
    ) => {
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
        const renderedParamsKey = activeParamsKeyRef.current;
        preparePreviewTiming(stlBytes, "openscad_render", "none");
        setStl(stlBytes);
        setGeneratedParamsKey(renderedParamsKey);
        setRenderStatus("OpenSCAD Preview Ready");
        setRenderError("");
        setIsRendering(false);
        setCachedDownloadUrl("");
        setCachedDownloadParamsKey("");

        return;
      }

      writeOpenScadErrorToConsole(message.message, message.logs);
      activeRenderTimingRef.current = null;
      queuedRenderTimingRef.current = null;
      previewTimingRef.current = null;

      if (startQueuedRenderIfNeeded()) {
        return;
      }

      setRenderError(renderErrorMessage);
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
      activeRenderTimingRef.current = null;
      queuedRenderTimingRef.current = null;
      previewTimingRef.current = null;
      setStl(undefined);
      setRenderError(workerErrorMessage);
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
      activeRenderTimingRef.current = null;
      queuedRenderTimingRef.current = null;
      previewTimingRef.current = null;
    };
  }, [
    cacheModelId,
    hasMounted,
    preparePreviewTiming,
    requestRender,
    renderErrorMessage,
    startRender,
    workerErrorMessage,
  ]);

  const clearRenderError = () => setRenderError("");

  const clearGeneratedModel = () => {
    setStl(undefined);
    setGeneratedParamsKey("");
    setCachedDownloadUrl("");
    setCachedDownloadParamsKey("");
    previewTimingRef.current = null;
  };

  const markCheckingCache = () => setRenderStatus("Checking shared model cache");

  const downloadStl = () => {
    if (!stl || !isPreviewCurrent) {
      return;
    }

    if (cachedDownloadUrl && cachedDownloadParamsKey === currentParamsKey) {
      downloadUrl(`${outputBaseName}.stl`, cachedDownloadUrl);
      return;
    }

    downloadBlob(
      `${outputBaseName}.stl`,
      new Blob([toArrayBuffer(stl)], { type: "model/stl" }),
    );
  };

  const downloadScad = () => {
    downloadBlob(
      `${outputBaseName}.scad`,
      new Blob([createScadSnippet(params)], { type: "text/plain" }),
    );
  };

  return {
    clearGeneratedModel,
    clearRenderError,
    currentModelUrl,
    currentParamsKey,
    downloadScad,
    downloadStl,
    hasMounted,
    isPreviewCurrent,
    isRendering,
    markCheckingCache,
    markPreviewVisible,
    previewStatus,
    renderError,
    renderStatus,
    requestRender,
    stl,
  };
}
