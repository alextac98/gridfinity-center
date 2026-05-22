"use client";

import {
  Check,
  ChevronUp,
  Code2,
  Download,
  PanelLeft,
  Printer,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { captureEvent } from "@/ui/analytics/posthog";
import { useToast } from "@/ui/shell/ToastProvider";
import styles from "./generator.module.css";

export type ModelDimensions = {
  width: number;
  depth: number;
  height: number;
};

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

type BuildPlatePreset = {
  id: string;
  label: string;
  widthMm: number;
  depthMm: number;
};

type ModelOutputPanelProps = {
  modelSummary: string;
  dimensions: ModelDimensions | null;
  currentModelUrl: string;
  groundPlaneDepthMm: string;
  groundPlaneWidthMm: string;
  floorMode: "grid" | "build-plate";
  isPreviewCurrent: boolean;
  selectedBuildPlatePresetName: string;
  onBuildPlatePresetSelect: (preset: BuildPlatePreset) => void;
  onDownloadStl: () => void;
  onDownloadScad: () => void;
  onFloorModeChange: (mode: "grid" | "build-plate") => void;
  onGroundPlaneDepthChange: (value: string) => void;
  onGroundPlaneWidthChange: (value: string) => void;
  extraControls?: ReactNode;
  storageKey: string;
};

const buildPlatePresets: BuildPlatePreset[] = [
  {
    id: "voron-250",
    label: "Voron V2.4/Trident 250",
    widthMm: 250,
    depthMm: 250,
  },
  {
    id: "voron-300",
    label: "Voron V2.4/Trident 300",
    widthMm: 300,
    depthMm: 300,
  },
  {
    id: "voron-350",
    label: "Voron V2.4/Trident 350",
    widthMm: 350,
    depthMm: 350,
  },
  {
    id: "prusa-core-one",
    label: "Prusa CORE One (+)",
    widthMm: 250,
    depthMm: 220,
  },
  {
    id: "prusa-core-one-l",
    label: "Prusa CORE One L",
    widthMm: 300,
    depthMm: 300,
  },
  { id: "prusa-xl", label: "Prusa XL", widthMm: 360, depthMm: 360 },
  { id: "bambu-a1-mini", label: "Bambu A1 mini", widthMm: 180, depthMm: 180 },
  {
    id: "bambu-a1-p1-x1",
    label: "Bambu A1 / P1 / X1",
    widthMm: 256,
    depthMm: 256,
  },
  { id: "bambu-h2d", label: "Bambu H2D", widthMm: 325, depthMm: 320 },
  { id: "bambu-h2s", label: "Bambu H2S", widthMm: 340, depthMm: 320 },
];

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
  modelSummary,
  dimensions,
  currentModelUrl,
  groundPlaneDepthMm,
  groundPlaneWidthMm,
  floorMode,
  isPreviewCurrent,
  selectedBuildPlatePresetName,
  onBuildPlatePresetSelect,
  onDownloadStl,
  onDownloadScad,
  onFloorModeChange,
  onGroundPlaneDepthChange,
  onGroundPlaneWidthChange,
  extraControls,
  storageKey,
}: ModelOutputPanelProps) {
  const { showToast } = useToast();
  const [selectedOutputAction, setSelectedOutputAction] =
    useState<OutputActionId>(() => {
      if (typeof window === "undefined") {
        return "download-stl";
      }

      const storedAction = window.localStorage.getItem(storageKey);

      return isOutputActionId(storedAction) ? storedAction : "download-stl";
    });
  const [isOutputMenuOpen, setIsOutputMenuOpen] = useState(false);
  const [isBuildPlatePresetMenuOpen, setIsBuildPlatePresetMenuOpen] =
    useState(false);
  const outputMenuRef = useRef<HTMLDivElement | null>(null);
  const buildPlatePresetMenuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!isBuildPlatePresetMenuOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (!buildPlatePresetMenuRef.current?.contains(event.target as Node)) {
        setIsBuildPlatePresetMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsBuildPlatePresetMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("mousedown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isBuildPlatePresetMenuOpen]);

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
    window.localStorage.setItem(storageKey, action);
  };

  const selectBuildPlatePreset = (preset: BuildPlatePreset) => {
    onBuildPlatePresetSelect(preset);
    setIsBuildPlatePresetMenuOpen(false);
  };

  const isBuildPlatePresetSelected = (preset: BuildPlatePreset) =>
    selectedBuildPlatePresetName === preset.label &&
    Number.parseFloat(groundPlaneWidthMm) === preset.widthMm &&
    Number.parseFloat(groundPlaneDepthMm) === preset.depthMm;

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
      captureEvent("model_output_action_performed", {
        action: "download-stl",
        model_summary: modelSummary,
      });
      onDownloadStl();
      return;
    }

    if (selectedOutputAction === "download-scad") {
      captureEvent("model_output_action_performed", {
        action: "download-scad",
        model_summary: modelSummary,
      });
      onDownloadScad();
      return;
    }

    if (selectedSlicerLauncher && currentModelUrl) {
      captureEvent("model_output_action_performed", {
        action: selectedOutputAction,
        slicer: selectedSlicerLauncher.label,
        model_summary: modelSummary,
      });
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
            <strong>{modelSummary}</strong>
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

        <div className={styles.groundPlaneControls}>
          <div className={styles.field}>
            <span>Preview Floor</span>
            <div
              aria-label="Preview floor"
              className={`${styles.unitSwitch} ${styles.floorSwitch}`}
              role="group"
            >
              <button
                aria-pressed={floorMode === "grid"}
                className={floorMode === "grid" ? styles.unitButtonActive : ""}
                onClick={() => onFloorModeChange("grid")}
                type="button"
              >
                Grid
              </button>
              <button
                aria-pressed={floorMode === "build-plate"}
                className={
                  floorMode === "build-plate" ? styles.unitButtonActive : ""
                }
                onClick={() => onFloorModeChange("build-plate")}
                type="button"
              >
                Build Plate
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.buildPlateSizeRow}>
              <div className={styles.tupleGrid}>
                <label className={styles.tupleItem}>
                  <span className={styles.tupleSubLabel}>Width</span>
                  <div className={styles.inputWrap}>
                    <input
                      aria-label="Ground plane width"
                      min="1"
                      onChange={(event) =>
                        onGroundPlaneWidthChange(event.target.value)
                      }
                      step="1"
                      type="number"
                      value={groundPlaneWidthMm}
                    />
                    <small>mm</small>
                  </div>
                </label>

                <label className={styles.tupleItem}>
                  <span className={styles.tupleSubLabel}>Depth</span>
                  <div className={styles.inputWrap}>
                    <input
                      aria-label="Ground plane depth"
                      min="1"
                      onChange={(event) =>
                        onGroundPlaneDepthChange(event.target.value)
                      }
                      step="1"
                      type="number"
                      value={groundPlaneDepthMm}
                    />
                    <small>mm</small>
                  </div>
                </label>
              </div>

              <div
                className={styles.buildPlatePreset}
                ref={buildPlatePresetMenuRef}
              >
                <button
                  aria-expanded={isBuildPlatePresetMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Choose build plate preset"
                  className={styles.buildPlatePresetButton}
                  onClick={() =>
                    setIsBuildPlatePresetMenuOpen((current) => !current)
                  }
                  title="Choose build plate preset"
                  type="button"
                >
                  <Printer aria-hidden="true" size={16} />
                  <ChevronUp aria-hidden="true" size={14} />
                </button>

                {isBuildPlatePresetMenuOpen ? (
                  <div className={styles.buildPlatePresetMenu} role="menu">
                    {buildPlatePresets.map((preset) => {
                      const isSelected = isBuildPlatePresetSelected(preset);

                      return (
                        <button
                          aria-checked={isSelected}
                          key={preset.id}
                          onClick={() => selectBuildPlatePreset(preset)}
                          role="menuitemradio"
                          type="button"
                        >
                          <span>
                            <strong>{preset.label}</strong>
                            <small>
                              {preset.widthMm} x {preset.depthMm} mm
                            </small>
                          </span>
                          {isSelected ? (
                            <Check aria-hidden="true" size={15} />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
            </div>
          </div>

          {extraControls}
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
