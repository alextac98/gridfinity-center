"use client";

import { useEffect, useMemo, useState } from "react";
import type { GroundPlaneConfig } from "./OpenScadPreview";
import { readLocalStorageJson, writeLocalStorageJson } from "./storage";

const defaultGroundPlaneDraft = {
  widthMm: "250",
  depthMm: "250",
};

export type BuildPlatePreset = {
  id: string;
  label: string;
  widthMm: number;
  depthMm: number;
};

export type GroundPlanePreference = {
  showGroundPlane: boolean;
  widthMm: string;
  depthMm: string;
  selectedBuildPlatePresetName: string;
};

function parseGroundPlaneDimension(value: string) {
  const dimension = Number.parseFloat(value);

  return Number.isFinite(dimension) && dimension > 0 ? dimension : null;
}

function parseGroundPlanePreference(value: unknown): GroundPlanePreference {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      showGroundPlane: false,
      selectedBuildPlatePresetName: "",
      ...defaultGroundPlaneDraft,
    };
  }

  const preference = value as Partial<GroundPlanePreference>;
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
}

export function useGroundPlanePreference(storageKey: string) {
  const [preference, setPreference] = useState(() =>
    readLocalStorageJson(
      storageKey,
      parseGroundPlanePreference(null),
      parseGroundPlanePreference,
    ),
  );

  useEffect(() => {
    writeLocalStorageJson(storageKey, preference);
  }, [preference, storageKey]);

  const groundPlane = useMemo<GroundPlaneConfig>(() => {
    const widthMm = parseGroundPlaneDimension(preference.widthMm);
    const depthMm = parseGroundPlaneDimension(preference.depthMm);

    return {
      visible: preference.showGroundPlane && widthMm !== null && depthMm !== null,
      printerName: preference.selectedBuildPlatePresetName,
      widthMm: widthMm ?? 250,
      depthMm: depthMm ?? 250,
    };
  }, [
    preference.depthMm,
    preference.selectedBuildPlatePresetName,
    preference.showGroundPlane,
    preference.widthMm,
  ]);

  const setGroundPlaneDepth = (depthMm: string) => {
    setPreference((current) => ({
      ...current,
      depthMm,
      selectedBuildPlatePresetName: "",
    }));
  };

  const setGroundPlaneWidth = (widthMm: string) => {
    setPreference((current) => ({
      ...current,
      selectedBuildPlatePresetName: "",
      widthMm,
    }));
  };

  const selectBuildPlatePreset = (preset: BuildPlatePreset) => {
    setPreference((current) => ({
      ...current,
      depthMm: String(preset.depthMm),
      selectedBuildPlatePresetName: preset.label,
      widthMm: String(preset.widthMm),
    }));
  };

  const setShowGroundPlane = (showGroundPlane: boolean) => {
    setPreference((current) => ({
      ...current,
      showGroundPlane,
    }));
  };

  return {
    groundPlane,
    preference,
    selectBuildPlatePreset,
    setGroundPlaneDepth,
    setGroundPlaneWidth,
    setShowGroundPlane,
  };
}
