"use client";

import {
  Box,
  Code2,
  Download,
  Layers3,
  PanelLeft,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GRIDFINITY_GRID_MM, GRIDFINITY_HEIGHT_UNIT_MM } from "@/lib/gridfinity/constants";
import { renderOpenScadToStl } from "@/lib/openscad/client";
import {
  createBinDefines,
  createBinScadSnippet,
  defaultGridfinityBinParameters,
  type GridfinityBinParameters,
} from "@/lib/openscad/gridfinityExtended";
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
  const [renderStatus, setRenderStatus] = useState("Procedural preview ready");
  const [renderError, setRenderError] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const renderSequenceRef = useRef(0);

  const scadSnippet = useMemo(() => createBinScadSnippet(params), [params]);
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
    const renderSequence = renderSequenceRef.current + 1;
    renderSequenceRef.current = renderSequence;
    const renderTimer = window.setTimeout(() => {
      setIsRendering(true);
      setRenderStatus("Rendering OpenSCAD STL");
      setRenderError("");

      renderOpenScadToStl({
        entryFile: "gridfinity_basic_cup.scad",
        defines: createBinDefines(params),
        outputName: "gridfinity-bin.stl",
      })
        .then((bytes) => {
          if (cancelled || renderSequence !== renderSequenceRef.current) {
            return;
          }

          setStl(bytes);
          setRenderStatus("OpenSCAD preview ready");
          setRenderError("");
        })
        .catch((error: unknown) => {
          if (cancelled || renderSequence !== renderSequenceRef.current) {
            return;
          }

          setStl(undefined);
          setRenderError(error instanceof Error ? error.message : "Unknown OpenSCAD error");
          setRenderStatus(
            error instanceof Error
              ? `OpenSCAD render failed: ${error.message.split("\n")[0]}`
              : "OpenSCAD render failed",
          );
        })
        .finally(() => {
          if (!cancelled && renderSequence === renderSequenceRef.current) {
            setIsRendering(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(renderTimer);
    };
  }, [hasMounted, params]);

  const commitNumberField = (field: NumberField) => {
    const config = numberFields[field];
    const parsed = Number(draft[field]);
    const nextValue = Number.isFinite(parsed)
      ? clamp(parsed, config.min, config.max)
      : defaultGridfinityBinParameters[field];
    const normalized =
      config.step >= 1 ? String(Math.round(nextValue)) : String(Number(nextValue.toFixed(2)));

    setDraft((current) => ({ ...current, [field]: normalized }));
    setParams((current) => ({
      ...current,
      [field]: config.step >= 1 ? Math.round(nextValue) : Number(normalized),
    }));
  };

  const reset = () => {
    setParams(defaultGridfinityBinParameters);
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
              onChange={(event) =>
                setParams((current) => ({
                  ...current,
                  lipStyle: event.target.value as GridfinityBinParameters["lipStyle"],
                }))
              }
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
              onChange={(event) =>
                setParams((current) => ({
                  ...current,
                  labelStyle: event.target.value as GridfinityBinParameters["labelStyle"],
                }))
              }
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
              onChange={(event) =>
                setParams((current) => ({
                  ...current,
                  labelPosition: event.target.value as GridfinityBinParameters["labelPosition"],
                }))
              }
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
              onChange={(event) =>
                setParams((current) => ({
                  ...current,
                  fingerslide: event.target.value as GridfinityBinParameters["fingerslide"],
                }))
              }
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
                onChange={(event) =>
                  setParams((current) => ({ ...current, magnets: event.target.checked }))
                }
              />
              <span>Magnets</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={params.screws}
                onChange={(event) =>
                  setParams((current) => ({ ...current, screws: event.target.checked }))
                }
              />
              <span>Screws</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={params.filledIn}
                onChange={(event) =>
                  setParams((current) => ({ ...current, filledIn: event.target.checked }))
                }
              />
              <span>Solid block</span>
            </label>
          </div>

          <button className={styles.secondaryButton} type="button" onClick={reset}>
            <RotateCcw aria-hidden="true" size={16} />
            Reset
          </button>
        </div>
      </section>

      <section className={styles.preview} aria-label="Bin preview">
        <div className={styles.previewToolbar}>
          <span>Bin preview</span>
          <div className={styles.toolbarStatus}>
            <Layers3 aria-hidden="true" size={16} />
            {renderError ? "Render failed" : isRendering ? "Rendering" : renderStatus}
          </div>
        </div>
        <OpenScadPreview params={params} stl={stl} />
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
          <div>
            <span>Renderer</span>
            <strong>
              {renderError
                ? "OpenSCAD failed; showing draft placeholder"
                : "Gridfinity Extended OpenSCAD via openscad-wasm"}
            </strong>
          </div>
          {renderError ? (
            <div className={styles.errorBox}>
              <span>OpenSCAD error</span>
              <pre>{renderError}</pre>
            </div>
          ) : null}
          <button
            type="button"
            disabled={!stl}
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

        <div className={styles.sourceBox}>
          <div>
            <Box aria-hidden="true" size={15} />
            <span>OpenSCAD source</span>
          </div>
          <pre>{scadSnippet}</pre>
        </div>
      </section>
    </div>
  );
}
