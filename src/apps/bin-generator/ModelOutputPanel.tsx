"use client";

import { ChevronUp, Code2, Download, PanelLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GridfinityBinParameters } from "@/lib/openscad/gridfinityExtended";
import { useToast } from "@/shell/ToastProvider";
import type { ModelDimensions } from "./stlDimensions";
import styles from "./bin-generator.module.css";

type SlicerActionId =
  | "open-prusaslicer"
  | "open-orcaslicer"
  | "open-bambu-slicer";
type OutputActionId = "download-stl" | SlicerActionId | "download-scad";

type SlicerLauncher = {
  id: SlicerActionId;
  label: string;
  actionLabel: string;
  iconClass: string;
  createUrl: (modelUrl: string) => string;
};

type ModelOutputPanelProps = {
  params: GridfinityBinParameters;
  dimensions: ModelDimensions | null;
  currentModelUrl: string;
  isPreviewCurrent: boolean;
  onDownloadStl: () => void;
  onDownloadScad: () => void;
};

const outputActionStorageKey = "gridfinity-bin-generator-output-action";

const slicerLaunchers: SlicerLauncher[] = [
  {
    id: "open-prusaslicer",
    label: "PrusaSlicer",
    actionLabel: "Open In PrusaSlicer",
    iconClass: styles.prusaSlicerIcon,
    createUrl: (modelUrl) =>
      `prusaslicer://open?file=${encodeURIComponent(modelUrl)}`,
  },
  {
    id: "open-orcaslicer",
    label: "OrcaSlicer",
    actionLabel: "Open In OrcaSlicer",
    iconClass: styles.orcaSlicerIcon,
    createUrl: (modelUrl) =>
      `orcaslicer://open?file=${encodeURIComponent(modelUrl)}`,
  },
  {
    id: "open-bambu-slicer",
    label: "Bambu Studio",
    actionLabel: "Open In Bambu Slicer",
    iconClass: styles.bambuStudioIcon,
    createUrl: (modelUrl) => {
      const isApplePlatform =
        /Mac|iPhone|iPad|iPod/i.test(window.navigator.platform) ||
        /Mac|iPhone|iPad|iPod/i.test(window.navigator.userAgent);

      if (isApplePlatform) {
        return `bambustudioopen://${encodeURIComponent(modelUrl)}`;
      }

      return `bambustudio://open?file=${encodeURIComponent(modelUrl)}`;
    },
  },
];

function isOutputActionId(value: string | null): value is OutputActionId {
  return (
    value === "download-stl" ||
    value === "open-prusaslicer" ||
    value === "open-orcaslicer" ||
    value === "open-bambu-slicer" ||
    value === "download-scad"
  );
}

function openExternalUrl(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  link.click();
}

export function ModelOutputPanel({
  params,
  dimensions,
  currentModelUrl,
  isPreviewCurrent,
  onDownloadStl,
  onDownloadScad,
}: ModelOutputPanelProps) {
  const { showToast } = useToast();
  const [selectedOutputAction, setSelectedOutputAction] =
    useState<OutputActionId>(() => {
      if (typeof window === "undefined") {
        return "download-stl";
      }

      const storedAction = window.localStorage.getItem(outputActionStorageKey);

      return isOutputActionId(storedAction) ? storedAction : "download-stl";
    });
  const [isOutputMenuOpen, setIsOutputMenuOpen] = useState(false);
  const outputMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOutputMenuOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (!outputMenuRef.current?.contains(event.target as Node)) {
        setIsOutputMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOutputMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("mousedown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOutputMenuOpen]);

  const selectedSlicerLauncher = slicerLaunchers.find(
    (launcher) => launcher.id === selectedOutputAction,
  );
  const selectedOutputLabel =
    selectedOutputAction === "download-stl"
      ? "Download STL"
      : selectedOutputAction === "download-scad"
        ? "Download OpenSCAD"
        : (selectedSlicerLauncher?.actionLabel ?? "Download STL");
  const unavailableOutputActionText =
    selectedOutputAction === "download-stl"
      ? "downloading STL"
      : selectedOutputAction === "open-prusaslicer"
        ? "opening in PrusaSlicer"
        : selectedOutputAction === "open-orcaslicer"
          ? "opening in OrcaSlicer"
          : selectedOutputAction === "open-bambu-slicer"
            ? "opening in Bambu Slicer"
            : "continuing";
  const isSelectedOutputEnabled =
    selectedOutputAction === "download-stl"
      ? isPreviewCurrent
      : selectedOutputAction === "download-scad"
        ? true
        : Boolean(currentModelUrl && selectedSlicerLauncher);
  const selectedOutputTitle = !isSelectedOutputEnabled
    ? "Generate Model First"
    : selectedOutputAction === "download-stl"
      ? "Download STL"
      : selectedOutputAction === "download-scad"
        ? "Download OpenSCAD"
        : selectedOutputLabel;

  const selectOutputAction = (action: OutputActionId) => {
    setSelectedOutputAction(action);
    setIsOutputMenuOpen(false);
    window.localStorage.setItem(outputActionStorageKey, action);
  };

  const runSelectedOutputAction = () => {
    if (!isSelectedOutputEnabled) {
      showToast(
        `Please generate the model before ${unavailableOutputActionText}.`,
        {
          variant: "info",
        },
      );
      return;
    }

    if (selectedOutputAction === "download-stl") {
      onDownloadStl();
      return;
    }

    if (selectedOutputAction === "download-scad") {
      onDownloadScad();
      return;
    }

    if (selectedSlicerLauncher && currentModelUrl) {
      openExternalUrl(selectedSlicerLauncher.createUrl(currentModelUrl));
    }
  };

  return (
    <section className={styles.panel} aria-label="Model Output">
      <div className={styles.panelHeader}>
        <PanelLeft aria-hidden="true" size={18} />
        <h2>Model Output</h2>
      </div>

      <div className={styles.panelScroll}>
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
              {dimensions
                ? `${dimensions.width.toFixed(1)} x ${dimensions.depth.toFixed(1)} x ${dimensions.height.toFixed(1)} mm`
                : "Generate Model To Measure STL"}
            </strong>
          </div>
        </div>
      </div>

      <div className={styles.panelActions}>
        <div className={styles.outputActions} ref={outputMenuRef}>
          <div className={styles.splitAction}>
            <button
              className={styles.primaryOutputButton}
              type="button"
              aria-disabled={!isSelectedOutputEnabled}
              onClick={runSelectedOutputAction}
              title={selectedOutputTitle}
            >
              {selectedSlicerLauncher ? (
                <span
                  className={`${styles.slicerIcon} ${selectedSlicerLauncher.iconClass}`}
                  aria-hidden="true"
                />
              ) : selectedOutputAction === "download-scad" ? (
                <Code2 aria-hidden="true" size={16} />
              ) : (
                <Download aria-hidden="true" size={16} />
              )}
              {selectedOutputLabel}
            </button>
            <button
              aria-expanded={isOutputMenuOpen}
              aria-haspopup="menu"
              aria-label="Choose Output Action"
              className={styles.outputMenuButton}
              onClick={() => setIsOutputMenuOpen((current) => !current)}
              title="Choose Output Action"
              type="button"
            >
              <ChevronUp aria-hidden="true" size={16} />
            </button>
          </div>

          {isOutputMenuOpen ? (
            <div className={styles.outputMenu} role="menu">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selectedOutputAction === "download-stl"}
                onClick={() => selectOutputAction("download-stl")}
              >
                <Download aria-hidden="true" size={16} />
                Download STL
              </button>
              {slicerLaunchers.map((launcher) => (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={selectedOutputAction === launcher.id}
                  key={launcher.id}
                  onClick={() => selectOutputAction(launcher.id)}
                >
                  <span
                    className={`${styles.slicerIcon} ${launcher.iconClass}`}
                    aria-hidden="true"
                  />
                  {launcher.actionLabel}
                </button>
              ))}
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selectedOutputAction === "download-scad"}
                onClick={() => selectOutputAction("download-scad")}
              >
                <Code2 aria-hidden="true" size={16} />
                Download OpenSCAD
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
