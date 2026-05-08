"use client";

import {
  Code2,
  Download,
  Layers3,
  PanelLeft,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GRIDFINITY_GRID_MM, GRIDFINITY_HEIGHT_UNIT_MM } from "@/lib/gridfinity/constants";
import {
  createBinDefines,
  createBinScadSnippet,
  defaultGridfinityBinParameters,
  type GridfinityBinParameters,
} from "@/lib/openscad/gridfinityExtended";
import { createOpenScadWorker } from "@/lib/openscad/workerClient";
import type { OpenScadWorkerRequest, OpenScadWorkerResponse } from "@/lib/openscad/workerTypes";
import type { GridfinityAppProps } from "../types";
import { OpenScadPreview } from "../openscad/OpenScadPreview";
import styles from "./bin-generator.module.css";

type NumberField = keyof Pick<
  GridfinityBinParameters,
  | "widthUnits"
  | "depthUnits"
  | "heightUnits"
  | "verticalChambers"
  | "horizontalChambers"
  | "wallThicknessMm"
>;

const numberFields: Record<
  NumberField,
  { label: string; min: number; max: number; step: number; suffix: string }
> = {
  widthUnits: { label: "Width", min: 0.5, max: 12, step: 0.5, suffix: "u" },
  depthUnits: { label: "Depth", min: 0.5, max: 12, step: 0.5, suffix: "u" },
  heightUnits: { label: "Height", min: 1, max: 24, step: 1, suffix: "u" },
  verticalChambers: { label: "X chambers", min: 1, max: 8, step: 1, suffix: "" },
  horizontalChambers: { label: "Y chambers", min: 1, max: 8, step: 1, suffix: "" },
  wallThicknessMm: { label: "Wall thickness", min: 0, max: 4, step: 0.05, suffix: "mm" },
};

const defaultModelPath = "/default-models/default-gridfinity-bin.stl";
const defaultParamsKey = createParamsKey(defaultGridfinityBinParameters);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
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
  const defaultStlRef = useRef<Uint8Array | null>(null);
  const [generatedParamsKey, setGeneratedParamsKey] = useState("");
  const [renderStatus, setRenderStatus] = useState("Loading default preview");
  const [renderError, setRenderError] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const renderSequenceRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const latestParamsRef = useRef(defaultGridfinityBinParameters);
  const latestParamsKeyRef = useRef(defaultParamsKey);
  const activeRequestRef = useRef<number | null>(null);
  const activeParamsKeyRef = useRef("");
  const isWorkerRenderingRef = useRef(false);
  const queuedRenderRef = useRef(false);

  const scadSnippet = useMemo(() => createBinScadSnippet(params), [params]);
  const currentParamsKey = useMemo(() => createParamsKey(params), [params]);
  const isLoadingDefaultPreview =
    currentParamsKey === defaultParamsKey &&
    !stl &&
    !renderError &&
    renderStatus === "Loading default preview";
  const isPreviewCurrent = Boolean(stl && generatedParamsKey === currentParamsKey && !renderError);
  const previewStatus = renderError
    ? "Render failed"
    : isRendering
      ? "Rendering"
      : isLoadingDefaultPreview
        ? "Loading default preview"
      : isPreviewCurrent
        ? "OpenSCAD preview ready"
        : stl
          ? "Changes pending"
          : "Ready to generate";
  const dimensions = useMemo(
    () => ({
      width: params.widthUnits * GRIDFINITY_GRID_MM,
      depth: params.depthUnits * GRIDFINITY_GRID_MM,
      height: params.heightUnits * GRIDFINITY_HEIGHT_UNIT_MM,
    }),
    [params],
  );

  useEffect(() => {
    const mountTimer = window.setTimeout(() => setHasMounted(true), 0);

    return () => window.clearTimeout(mountTimer);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    let cancelled = false;

    fetch(defaultModelPath)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load default STL: ${response.status}`);
        }

        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) {
          return;
        }

        const bytes = new Uint8Array(buffer);
        defaultStlRef.current = bytes;

        setStl(bytes);
        setGeneratedParamsKey(defaultParamsKey);
        setRenderStatus("Default preview ready");
        setRenderError("");
      })
      .catch((error: unknown) => {
        console.error("Default STL failed to load.", error);

        if (!cancelled) {
          setRenderStatus("Ready to generate");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasMounted]);

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
    (nextParams: GridfinityBinParameters) => {
      latestParamsRef.current = nextParams;
      latestParamsKeyRef.current = createParamsKey(nextParams);
      setRenderError("");

      if (!workerRef.current) {
        setIsRendering(false);
        setRenderStatus("Preparing OpenSCAD worker");
        return;
      }

      if (isWorkerRenderingRef.current) {
        queuedRenderRef.current = true;
        setIsRendering(true);
        setRenderStatus("Rendering updated OpenSCAD STL");
        return;
      }

      setIsRendering(true);
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

    const handleMessage = (event: MessageEvent<OpenScadWorkerResponse>) => {
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

        setStl(new Uint8Array(message.stl));
        setGeneratedParamsKey(activeParamsKeyRef.current);
        setRenderStatus("OpenSCAD preview ready");
        setRenderError("");
        setIsRendering(false);
        return;
      }

      writeOpenScadErrorToConsole(message.message, message.logs);

      if (startQueuedRenderIfNeeded()) {
        return;
      }

      setRenderError("OpenSCAD could not generate this bin. Check the browser console for details.");
      setRenderStatus("OpenSCAD render failed");
      setIsRendering(false);
    };

    const handleWorkerError = (event: ErrorEvent) => {
      console.error("OpenSCAD worker failed.", event.error ?? event.message);
      isWorkerRenderingRef.current = false;
      activeRequestRef.current = null;
      setStl(undefined);
      setRenderError("The OpenSCAD worker failed to start. Check the browser console for details.");
      setRenderStatus("OpenSCAD worker failed");
      setIsRendering(false);
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleWorkerError);

    return () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleWorkerError);
      worker.terminate();
      workerRef.current = null;
      isWorkerRenderingRef.current = false;
      activeRequestRef.current = null;
    };
  }, [hasMounted, startRender]);

  const commitNumberField = (field: NumberField) => {
    const config = numberFields[field];
    const parsed = Number(draft[field]);
    const nextValue = Number.isFinite(parsed)
      ? clamp(parsed, config.min, config.max)
      : defaultGridfinityBinParameters[field];
    const normalized =
      config.step >= 1 ? String(Math.round(nextValue)) : String(Number(nextValue.toFixed(2)));

    setDraft((current) => ({ ...current, [field]: normalized }));
    setRenderError("");
    setParams((current) => ({
      ...current,
      [field]: config.step >= 1 ? Math.round(nextValue) : Number(normalized),
    }));
  };

  const reset = () => {
    setRenderError("");
    setParams(defaultGridfinityBinParameters);
    setGeneratedParamsKey(defaultParamsKey);
    setRenderStatus(defaultStlRef.current ? "Default preview ready" : "Loading default preview");

    if (defaultStlRef.current) {
      setStl(defaultStlRef.current);
    }

    setDraft(
      Object.fromEntries(
        Object.keys(numberFields).map((key) => [
          key,
          String(defaultGridfinityBinParameters[key as NumberField]),
        ]),
      ) as Record<NumberField, string>,
    );
  };

  if (!hasMounted) {
    return (
      <div className={styles.appFrame} data-accent={accent}>
        <section className={styles.panel} aria-label="Bin parameters">
          <div className={styles.panelHeader}>
            <SlidersHorizontal aria-hidden="true" size={18} />
            <h2>Bin parameters</h2>
          </div>
          <div className={styles.loadingPanel}>Loading generator</div>
        </section>

        <section className={styles.preview} aria-label="Bin preview">
          <div className={styles.previewToolbar}>
            <span>Bin preview</span>
            <div className={styles.toolbarStatus}>
              <Layers3 aria-hidden="true" size={16} />
              Loading
            </div>
          </div>
          <div className={styles.previewLoading}>Preparing 3D preview</div>
        </section>

        <section className={styles.panel} aria-label="Model output">
          <div className={styles.panelHeader}>
            <PanelLeft aria-hidden="true" size={18} />
            <h2>Model output</h2>
          </div>
          <div className={styles.loadingPanel}>Preparing OpenSCAD runtime</div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.appFrame} data-accent={accent}>
      <section className={styles.panel} aria-label="Bin parameters">
        <div className={styles.panelHeader}>
          <SlidersHorizontal aria-hidden="true" size={18} />
          <h2>Bin parameters</h2>
        </div>

        <div className={styles.formShell}>
          {Object.entries(numberFields).map(([field, config]) => (
            <label className={styles.field} key={field}>
              <span>{config.label}</span>
              <div className={styles.inputWrap}>
                <input
                  inputMode="decimal"
                  type="text"
                  value={draft[field as NumberField]}
                  onBlur={() => commitNumberField(field as NumberField)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                />
                {config.suffix ? <small>{config.suffix}</small> : null}
              </div>
            </label>
          ))}

          <label className={styles.field}>
            <span>Lip style</span>
            <select
              value={params.lipStyle}
              onChange={(event) => {
                setRenderError("");
                setParams((current) => ({
                  ...current,
                  lipStyle: event.target.value as GridfinityBinParameters["lipStyle"],
                }));
              }}
            >
              <option value="normal">Normal</option>
              <option value="reduced">Reduced</option>
              <option value="minimum">Minimum</option>
              <option value="none">None</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Label shelf</span>
            <select
              value={params.labelStyle}
              onChange={(event) => {
                setRenderError("");
                setParams((current) => ({
                  ...current,
                  labelStyle: event.target.value as GridfinityBinParameters["labelStyle"],
                }));
              }}
            >
              <option value="disabled">Disabled</option>
              <option value="normal">Normal</option>
              <option value="gflabel">Gridfinity label</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Label position</span>
            <select
              value={params.labelPosition}
              onChange={(event) => {
                setRenderError("");
                setParams((current) => ({
                  ...current,
                  labelPosition: event.target.value as GridfinityBinParameters["labelPosition"],
                }));
              }}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Finger slide</span>
            <select
              value={params.fingerslide}
              onChange={(event) => {
                setRenderError("");
                setParams((current) => ({
                  ...current,
                  fingerslide: event.target.value as GridfinityBinParameters["fingerslide"],
                }));
              }}
            >
              <option value="none">None</option>
              <option value="rounded">Rounded</option>
              <option value="chamfered">Chamfered</option>
            </select>
          </label>

          <div className={styles.switchGrid}>
            <label>
              <input
                type="checkbox"
                checked={params.magnets}
                onChange={(event) => {
                  setRenderError("");
                  setParams((current) => ({ ...current, magnets: event.target.checked }));
                }}
              />
              <span>Magnets</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={params.screws}
                onChange={(event) => {
                  setRenderError("");
                  setParams((current) => ({ ...current, screws: event.target.checked }));
                }}
              />
              <span>Screws</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={params.filledIn}
                onChange={(event) => {
                  setRenderError("");
                  setParams((current) => ({ ...current, filledIn: event.target.checked }));
                }}
              />
              <span>Solid block</span>
            </label>
          </div>

          <div className={styles.actionRow}>
            <button
              className={styles.generateButton}
              disabled={isRendering}
              onClick={() => requestRender(params)}
              type="button"
            >
              Generate
            </button>
            <button
              aria-label="Reset Model"
              className={styles.resetIconButton}
              onClick={reset}
              title="Reset Model"
              type="button"
            >
              <RotateCcw aria-hidden="true" size={16} />
            </button>
          </div>
        </div>
      </section>

      <section className={styles.preview} aria-label="Bin preview">
        <div className={styles.previewToolbar}>
          <span>Bin preview</span>
          <div className={styles.toolbarStatus}>
            <Layers3 aria-hidden="true" size={16} />
            {previewStatus}
          </div>
        </div>
        <OpenScadPreview
          stl={stl}
          errorMessage={renderError}
          isLoading={isRendering || isLoadingDefaultPreview}
          loadingMessage={isRendering || isLoadingDefaultPreview ? renderStatus : undefined}
        />
      </section>

      <section className={styles.panel} aria-label="Model output">
        <div className={styles.panelHeader}>
          <PanelLeft aria-hidden="true" size={18} />
          <h2>Model output</h2>
        </div>

        <div className={styles.outputList}>
          <div>
            <span>Model</span>
            <strong>
              {params.widthUnits} x {params.depthUnits} x {params.heightUnits} bin
            </strong>
          </div>
          <div>
            <span>Dimensions</span>
            <strong>
              {dimensions.width.toFixed(1)} x {dimensions.depth.toFixed(1)} x{" "}
              {dimensions.height.toFixed(1)} mm
            </strong>
          </div>
          <button
            type="button"
            disabled={!isPreviewCurrent}
            onClick={() =>
              stl &&
              downloadBlob(
                "gridfinity-bin.stl",
                new Blob([toArrayBuffer(stl)], { type: "model/stl" }),
              )
            }
          >
            <Download aria-hidden="true" size={16} />
            STL
          </button>
          <button
            type="button"
            onClick={() =>
              downloadBlob(
                "gridfinity-bin.scad",
                new Blob([scadSnippet], { type: "text/plain" }),
              )
            }
          >
            <Code2 aria-hidden="true" size={16} />
            SCAD
          </button>
        </div>
      </section>
    </div>
  );
}
