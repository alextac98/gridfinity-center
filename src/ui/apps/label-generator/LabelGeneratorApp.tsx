"use client";

import {
  CollapsibleSection,
  GeneratorPanel,
  GeneratorPanelActions,
  GeneratorPanelBody,
} from "@/ui/components/ui/GeneratorSidebar";

import {
  Check,
  ChevronDown,
  Download,
  Home,
  ImagePlus,
  PanelLeft,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import QRCode from "qrcode";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { ComboboxInput } from "@/ui/components/ui/ComboboxInput";
import { captureEvent } from "@/ui/analytics/posthog";
import {
  OpenScadGeneratorShell,
} from "@/ui/apps/openscad/OpenScadGeneratorShell";
import type { GridfinityAppProps } from "../types";
import {
  driveOptions,
  getDriveOption,
  getDriveSvgMarkup,
  getHardwareSvgMarkup,
  getHeadProfileOption,
  getHeadProfileSvgMarkup,
  headProfileOptions,
  type DriveId,
  type HeadProfileId,
} from "./artwork/fastenerArtwork";
import { fitLabelMargins, getLabelLayout, scaleLabelMargins } from "./labelLayout";
import {
  getLabelTextLayout,
  getLabelTextStyle,
} from "./labelText";
import { labelExportDpi, renderLabelExportPng, renderPrinterPreviewPng, type LabelRasterOptions } from "./labelRaster";
import { getPrinterMargins, getPrinterPixelSize, maxPrinterDpi, minPrinterDpi, printerPresets } from "./printerPresets";
import styles from "./label-generator.module.css";

type FastenerId =
  | "socket-cap"
  | "button-head"
  | "flat-head"
  | "hex-bolt"
  | "nut"
  | "washer";
type ItemTypeId = "screw" | "nut" | "washer" | "custom";
type StandardMode = "iso" | "din" | "both";
type MeasurementSystem = "metric" | "imperial";
type DetailFieldId =
  | "itemName"
  | "primaryImage"
  | "secondaryImage"
  | "standard"
  | "threadSize"
  | "pitch"
  | "length"
  | "measurementSystem"
  | "note"
  | "qrUrl";

type LabelSize = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
};

type ThreadSizeOption = {
  pitches: string[];
  lengths: string[];
};

type PreviewView = {
  x: number;
  y: number;
  scale: number;
};

const labelSizes: LabelSize[] = [
  { id: "35x12", name: "35 x 12", widthMm: 35, heightMm: 12 },
  { id: "42x12", name: "42 x 12", widthMm: 42, heightMm: 12 },
  { id: "50x15", name: "50 x 15", widthMm: 50, heightMm: 15 },
  { id: "60x20", name: "60 x 20", widthMm: 60, heightMm: 20 },
  { id: "70x25", name: "70 x 25", widthMm: 70, heightMm: 25 },
];
const customLabelSizeId = "custom";
const minLabelWidthMm = 10;
const maxLabelWidthMm = 180;
const minLabelHeightMm = 6;
const maxLabelHeightMm = 80;
const previewPxPerMm = 11;
const previewGridSizeMm = 5;
const homePreviewReferenceWidthMm = 42;
const homePreviewScaleMultiplier = 1.3;
const minPreviewScale = 0.2;
const maxPreviewScale = 4;
const minVisiblePreviewLabelPx = 48;

function clampPreviewView(
  view: PreviewView,
  {
    labelHeight,
    labelWidth,
    surfaceHeight,
    surfaceWidth,
  }: {
    labelHeight: number;
    labelWidth: number;
    surfaceHeight: number;
    surfaceWidth: number;
  },
): PreviewView {
  if (surfaceWidth <= 0 || surfaceHeight <= 0) {
    return view;
  }

  const scaledWidth = labelWidth * view.scale;
  const scaledHeight = labelHeight * view.scale;
  const minX = minVisiblePreviewLabelPx - surfaceWidth / 2 - scaledWidth / 2;
  const maxX = surfaceWidth / 2 - minVisiblePreviewLabelPx + scaledWidth / 2;
  const minY = minVisiblePreviewLabelPx - surfaceHeight / 2 - scaledHeight / 2;
  const maxY = surfaceHeight / 2 - minVisiblePreviewLabelPx + scaledHeight / 2;

  return {
    scale: view.scale,
    x: Math.min(maxX, Math.max(minX, view.x)),
    y: Math.min(maxY, Math.max(minY, view.y)),
  };
}

function getHomePreviewScale(labelSize: LabelSize) {
  return Math.min(
    maxPreviewScale,
    Math.max(
      minPreviewScale,
      (homePreviewReferenceWidthMm / labelSize.widthMm) *
        homePreviewScaleMultiplier,
    ),
  );
}

const fasteners: Array<{
  id: FastenerId;
  name: string;
  shortName: string;
  standard: string;
}> = [
  {
    id: "socket-cap",
    name: "Socket cap screw",
    shortName: "Socket Cap",
    standard: "ISO 4762 / DIN 912",
  },
  {
    id: "button-head",
    name: "Button head screw",
    shortName: "Button Head",
    standard: "ISO 7380",
  },
  {
    id: "flat-head",
    name: "Flat head screw",
    shortName: "Flat Head",
    standard: "ISO 10642 / DIN 7991",
  },
  {
    id: "hex-bolt",
    name: "Hex bolt",
    shortName: "Hex Bolt",
    standard: "ISO 4017 / DIN 933",
  },
  {
    id: "nut",
    name: "Hex nut",
    shortName: "Hex Nut",
    standard: "ISO 4032 / DIN 934",
  },
  {
    id: "washer",
    name: "Flat washer",
    shortName: "Washer",
    standard: "ISO 7089 / DIN 125",
  },
];
const itemTypeOptions = [
  "screw",
  "nut",
  "washer",
  "custom",
] as const satisfies readonly ItemTypeId[];

const itemTypeDescriptions: Record<ItemTypeId, string> = {
  screw: "Machine screws and bolts",
  nut: "Hexagonal internally threaded nuts",
  washer: "Flat round spacing and load washers",
  custom: "User supplied artwork and label text",
};

const defaultArtworkByFastener: Record<
  FastenerId,
  { driveId: DriveId; headProfileId: HeadProfileId }
> = {
  "socket-cap": { driveId: "hex", headProfileId: "socket" },
  "button-head": { driveId: "hex", headProfileId: "button" },
  "flat-head": { driveId: "hex", headProfileId: "countersunk" },
  "hex-bolt": { driveId: "external-hex", headProfileId: "hex" },
  nut: { driveId: "external-hex", headProfileId: "hex" },
  washer: { driveId: "slot", headProfileId: "wafer" },
};

const fastenerIdByHeadProfile: Record<HeadProfileId, FastenerId> = {
  socket: "socket-cap",
  button: "button-head",
  countersunk: "flat-head",
  pan: "socket-cap",
  hex: "hex-bolt",
  wafer: "socket-cap",
};

const standardByScrewStyle: Partial<Record<string, string>> = {
  "socket:hex": "ISO 4762 / DIN 912",
  "button:hex": "ISO 7380",
  "countersunk:hex": "ISO 10642 / DIN 7991",
  "hex:external-hex": "ISO 4017 / DIN 933",
};

function getScrewStyleStandard(
  headProfileId: HeadProfileId,
  driveId: DriveId,
) {
  return standardByScrewStyle[`${headProfileId}:${driveId}`] ?? "";
}

// Edit this map to control pitch/length suggestions for each thread size.
// `standard` means the coarse pitch for that size and is intentionally omitted
// from the rendered label text. Users can still type custom values.
const metricThreadSizeOptions: Record<string, ThreadSizeOption> = {
  M2: {
    pitches: ["standard", "0.4"],
    lengths: ["3", "4", "5", "6", "8", "10", "12", "16", "20"],
  },
  "M2.5": {
    pitches: ["standard", "0.45"],
    lengths: ["3", "4", "5", "6", "8", "10", "12", "16", "20"],
  },
  M3: {
    pitches: ["standard", "0.5"],
    lengths: ["5", "6", "8", "10", "12", "14", "16", "20", "25", "30", "35"],
  },
  M4: {
    pitches: ["standard", "0.7"],
    lengths: ["6", "8", "10", "12", "14", "16", "20", "25", "30", "35", "40", "50"],
  },
  M5: {
    pitches: ["standard", "0.8", "0.5"],
    lengths: ["6", "8", "10", "12", "14", "16", "20", "25", "30", "45", "50", "60"],
  },
  M6: {
    pitches: ["standard", "1.0"],
    lengths: ["8", "10", "12", "14", "16", "20", "25", "30", "35", "40", "45", "50", "60", "70", "75"],
  },
  M8: {
    pitches: ["standard", "1.25", "1.0"],
    lengths: ["10", "12", "16", "20", "25", "30", "35", "40", "45", "50"],
  },
  M10: {
    pitches: ["standard", "1.5", "1.25", "1.0"],
    lengths: ["20", "25", "30", "40", "50", "60", "70", "80", "90"],
  },
};

const imperialThreadSizeOptions: Record<string, ThreadSizeOption> = {
  "#2": {
    pitches: ["standard", "56"],
    lengths: ["1/8", "3/16", "1/4", "5/16", "3/8", "1/2", "5/8", "3/4"],
  },
  "#4": {
    pitches: ["standard", "40"],
    lengths: ["1/8", "3/16", "1/4", "5/16", "3/8", "1/2", "5/8", "3/4", "1"],
  },
  "#6": {
    pitches: ["standard", "32"],
    lengths: ["3/16", "1/4", "5/16", "3/8", "1/2", "5/8", "3/4", "1", "1-1/4"],
  },
  "#8": {
    pitches: ["standard", "32"],
    lengths: ["1/4", "5/16", "3/8", "1/2", "5/8", "3/4", "1", "1-1/4", "1-1/2"],
  },
  "#10": {
    pitches: ["standard", "24", "32"],
    lengths: ["1/4", "3/8", "1/2", "5/8", "3/4", "1", "1-1/4", "1-1/2", "2"],
  },
  "1/4": {
    pitches: ["standard", "20", "28"],
    lengths: ["1/2", "5/8", "3/4", "1", "1-1/4", "1-1/2", "2", "2-1/2", "3"],
  },
  "5/16": {
    pitches: ["standard", "18", "24"],
    lengths: ["1/2", "3/4", "1", "1-1/4", "1-1/2", "2", "2-1/2", "3"],
  },
  "3/8": {
    pitches: ["standard", "16", "24"],
    lengths: ["3/4", "1", "1-1/4", "1-1/2", "2", "2-1/2", "3", "3-1/2", "4"],
  },
  "1/2": {
    pitches: ["standard", "13", "20"],
    lengths: ["1", "1-1/4", "1-1/2", "2", "2-1/2", "3", "3-1/2", "4", "5", "6"],
  },
};

const threadSizeOptionsBySystem: Record<
  MeasurementSystem,
  Record<string, ThreadSizeOption>
> = {
  metric: metricThreadSizeOptions,
  imperial: imperialThreadSizeOptions,
};

const metricFallbackPitches = [
  "standard",
  "0.4",
  "0.45",
  "0.5",
  "0.7",
  "0.8",
  "1.0",
  "1.25",
  "1.5",
];
const imperialFallbackPitches = [
  "standard",
  "56",
  "40",
  "32",
  "28",
  "24",
  "20",
  "18",
  "16",
  "13",
];
const metricFallbackLengths = [
  "3",
  "4",
  "5",
  "6",
  "8",
  "10",
  "12",
  "14",
  "16",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
  "60",
  "70",
  "75",
  "80",
  "90",
];
const imperialFallbackLengths = [
  "1/8",
  "3/16",
  "1/4",
  "5/16",
  "3/8",
  "1/2",
  "5/8",
  "3/4",
  "1",
  "1-1/4",
  "1-1/2",
  "2",
  "2-1/2",
  "3",
  "3-1/2",
  "4",
  "5",
  "6",
];
const fallbackPitchesBySystem: Record<MeasurementSystem, string[]> = {
  metric: metricFallbackPitches,
  imperial: imperialFallbackPitches,
};
const fallbackLengthsBySystem: Record<MeasurementSystem, string[]> = {
  metric: metricFallbackLengths,
  imperial: imperialFallbackLengths,
};
const defaultThreadDetailsBySystem: Record<
  MeasurementSystem,
  {
    threadSize: string;
    pitch: string;
    length: string;
  }
> = {
  metric: { threadSize: "M3", pitch: "standard", length: "20" },
  imperial: { threadSize: "#6", pitch: "standard", length: "1/2" },
};

const detailFields: Record<
  DetailFieldId,
  {
    label: string;
    layout?: "full" | "half";
  }
> = {
  itemName: { label: "Item Name", layout: "full" },
  primaryImage: { label: "Primary image", layout: "full" },
  secondaryImage: { label: "Secondary image", layout: "full" },
  standard: { label: "ISO / DIN standard", layout: "full" },
  threadSize: { label: "Thread Size", layout: "half" },
  pitch: { label: "Pitch", layout: "half" },
  length: { label: "Length", layout: "half" },
  measurementSystem: { label: "Units", layout: "full" },
  note: { label: "Additional Text", layout: "full" },
  qrUrl: { label: "QR Code URL", layout: "full" },
};

// Edit this map to control which Details fields are shown for each item type.
// The renderer below uses these field ids directly, so changing this list is
// the main place to audit or adjust item-specific detail behavior.
const detailFieldsByItemType: Record<ItemTypeId, DetailFieldId[]> = {
  screw: [
    "measurementSystem",
    "threadSize",
    "pitch",
    "length",
    "note",
    "standard",
    "qrUrl",
    "primaryImage",
    "secondaryImage",
  ],
  nut: [
    "measurementSystem",
    "threadSize",
    "note",
    "standard",
    "qrUrl",
    "primaryImage",
    "secondaryImage",
  ],
  washer: [
    "measurementSystem",
    "threadSize",
    "note",
    "standard",
    "qrUrl",
    "primaryImage",
    "secondaryImage",
  ],
  custom: [
    "itemName",
    "note",
    "qrUrl",
    "primaryImage",
    "secondaryImage",
  ],
};

const defaults = {
  fastenerId: "socket-cap" as FastenerId,
  driveId: defaultArtworkByFastener["socket-cap"].driveId,
  headProfileId: defaultArtworkByFastener["socket-cap"].headProfileId,
  itemName: "Custom item",
  sizeId: "35x12",
  expandedSections: {} as Record<string, boolean>,
  printerId: "brother-p750w",
  printerDpi: 360,
  printerDpiY: 180,
  marginsMm: getPrinterMargins("brother-p750w", 12)!,
  usePrinterMargins: true,
  showPrinterPreview: true,
  customWidthMm: 35,
  customHeightMm: 12,
  measurementSystem: "metric" as MeasurementSystem,
  threadSize: defaultThreadDetailsBySystem.metric.threadSize,
  pitch: defaultThreadDetailsBySystem.metric.pitch,
  length: defaultThreadDetailsBySystem.metric.length,
  note: "",
  qrUrl: "https://example.com/inventory/m3-socket-cap",
  standardMode: "both" as StandardMode,
  showStandard: false,
  showPrimaryImage: true,
  showSecondaryImage: true,
  showQr: true,
  isCustomArtwork: false,
};
const labelSettingsStorageKey = "gridfinity-label-generator-settings";

type LabelGeneratorSettings = typeof defaults & {
  customPrimaryImage: string;
  customSecondaryImage: string;
};

const defaultLabelSettings: LabelGeneratorSettings = {
  ...defaults,
  customPrimaryImage: "",
  customSecondaryImage: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function readNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function getItemTypeLabel(itemType: string) {
  if (itemType === "screw") {
    return "Screw / bolt";
  }

  if (itemType === "nut") {
    return "Hex nut";
  }

  if (itemType === "washer") {
    return "Flat washer";
  }

  if (itemType === "custom") {
    return "Custom";
  }

  return itemType;
}

function readStoredLabelSettings(): LabelGeneratorSettings {
  if (typeof window === "undefined") {
    return defaultLabelSettings;
  }

  const storedSettings = window.localStorage.getItem(labelSettingsStorageKey);

  if (!storedSettings) {
    return defaultLabelSettings;
  }

  try {
    const parsed = JSON.parse(storedSettings) as unknown;

    if (!isRecord(parsed)) {
      return defaultLabelSettings;
    }

    const storedFastenerId = readString(
      parsed.fastenerId,
      defaults.fastenerId,
      fasteners.map((fastener) => fastener.id),
    );
    const storedHeadProfileId = readString(
      parsed.headProfileId,
      defaultArtworkByFastener[storedFastenerId].headProfileId,
      headProfileOptions.map((option) => option.id),
    );
    const storedHeadProfile = getHeadProfileOption(storedHeadProfileId);
    const requestedDriveId = readString(
      parsed.driveId,
      defaultArtworkByFastener[storedFastenerId].driveId,
      driveOptions.map((option) => option.id),
    );
    const storedDriveId = (
      storedHeadProfile.driveIds as readonly DriveId[]
    ).includes(requestedDriveId)
      ? requestedDriveId
      : storedHeadProfile.defaultDriveId;

    const storedMargins = isRecord(parsed.marginsMm) ? parsed.marginsMm : {};
    const horizontalMargin = Math.max(
      readNumber(storedMargins.left, defaults.marginsMm.left, 0, maxLabelWidthMm),
      readNumber(storedMargins.right, defaults.marginsMm.right, 0, maxLabelWidthMm),
    );
    const verticalMargin = Math.max(
      readNumber(storedMargins.top, defaults.marginsMm.top, 0, maxLabelHeightMm),
      readNumber(storedMargins.bottom, defaults.marginsMm.bottom, 0, maxLabelHeightMm),
    );

    const printerId = readString(parsed.printerId, defaults.printerId, ["custom", ...printerPresets.map((printer) => printer.id)]);
    const preset = printerPresets.find((printer) => printer.id === printerId);
    const storedDpi = Math.round(readNumber(parsed.printerDpi, defaults.printerDpi, minPrinterDpi, maxPrinterDpi));
    const storedDpiY = Math.round(readNumber(parsed.printerDpiY, storedDpi, minPrinterDpi, maxPrinterDpi));
    // Legacy presets did not distinguish print modes. Use the preset default;
    // custom single-DPI settings retain their original square dot grid.
    const mode = preset && (typeof parsed.printerDpiY === "number"
      ? preset.modes.find((mode) => mode.dpiX === storedDpi && mode.dpiY === storedDpiY) ?? preset.modes[0]
      : preset.modes[0]);

    const storedSections = isRecord(parsed.expandedSections) ? parsed.expandedSections : {};
    const expandedSections = Object.fromEntries(
      Object.entries(storedSections).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
    );

    return {
      expandedSections,
      printerId,
      printerDpi: mode?.dpiX ?? storedDpi,
      printerDpiY: mode?.dpiY ?? storedDpiY,
      marginsMm: { left: horizontalMargin, right: horizontalMargin, top: verticalMargin, bottom: verticalMargin },
      usePrinterMargins: typeof parsed.usePrinterMargins === "boolean" ? parsed.usePrinterMargins : defaults.usePrinterMargins,
      showPrinterPreview: typeof parsed.showPrinterPreview === "boolean" ? parsed.showPrinterPreview : defaults.showPrinterPreview,
      fastenerId: storedFastenerId,
      driveId: storedDriveId,
      headProfileId: storedHeadProfileId,
      itemName:
        typeof parsed.itemName === "string"
          ? parsed.itemName
          : defaults.itemName,
      sizeId: readString(
        parsed.sizeId,
        defaults.sizeId,
        [...labelSizes.map((size) => size.id), customLabelSizeId],
      ),
      customWidthMm: readNumber(
        parsed.customWidthMm,
        defaults.customWidthMm,
        minLabelWidthMm,
        maxLabelWidthMm,
      ),
      customHeightMm: readNumber(
        parsed.customHeightMm,
        defaults.customHeightMm,
        minLabelHeightMm,
        maxLabelHeightMm,
      ),
      measurementSystem: readString(
        parsed.measurementSystem,
        defaults.measurementSystem,
        ["metric", "imperial"],
      ),
      threadSize:
        typeof parsed.threadSize === "string"
          ? parsed.threadSize
          : defaults.threadSize,
      pitch: typeof parsed.pitch === "string" ? parsed.pitch : defaults.pitch,
      length:
        typeof parsed.length === "string" ? parsed.length : defaults.length,
      note: typeof parsed.note === "string" ? parsed.note : defaults.note,
      qrUrl: typeof parsed.qrUrl === "string" ? parsed.qrUrl : defaults.qrUrl,
      standardMode: readString(
        parsed.standardMode,
        defaults.standardMode,
        ["iso", "din", "both"],
      ),
      showStandard:
        typeof parsed.showStandard === "boolean"
          ? parsed.showStandard
          : defaults.showStandard,
      showPrimaryImage:
        typeof parsed.showPrimaryImage === "boolean"
          ? parsed.showPrimaryImage
          : defaults.showPrimaryImage,
      showSecondaryImage:
        typeof parsed.showSecondaryImage === "boolean"
          ? parsed.showSecondaryImage
          : defaults.showSecondaryImage,
      showQr:
        typeof parsed.showQr === "boolean" ? parsed.showQr : defaults.showQr,
      isCustomArtwork:
        typeof parsed.isCustomArtwork === "boolean"
          ? parsed.isCustomArtwork
          : defaults.isCustomArtwork,
      customPrimaryImage:
        typeof parsed.customPrimaryImage === "string"
          ? parsed.customPrimaryImage
          : "",
      customSecondaryImage:
        typeof parsed.customSecondaryImage === "string"
          ? parsed.customSecondaryImage
          : "",
    };
  } catch {
    return defaultLabelSettings;
  }
}

function writeStoredLabelSettings(settings: LabelGeneratorSettings) {
  try {
    window.localStorage.setItem(
      labelSettingsStorageKey,
      JSON.stringify(settings),
    );
  } catch {
    try {
      window.localStorage.setItem(
        labelSettingsStorageKey,
        JSON.stringify({
          ...settings,
          customPrimaryImage: "",
          customSecondaryImage: "",
        }),
      );
    } catch {
      // Browser storage can be disabled or full; keep the editor usable.
    }
  }
}

function getFastener(id: FastenerId) {
  return fasteners.find((fastener) => fastener.id === id) ?? fasteners[0];
}

function getStandardParts(standard: string) {
  const parts = standard.split("/").map((part) => part.trim());

  return {
    iso: parts.find((part) => part.startsWith("ISO")) ?? "",
    din: parts.find((part) => part.startsWith("DIN")) ?? "",
  };
}

function getStandardText(standard: string, mode: StandardMode) {
  const parts = getStandardParts(standard);

  if (mode === "iso") {
    return parts.iso;
  }

  if (mode === "din") {
    return parts.din;
  }

  return [parts.iso, parts.din].filter(Boolean).join(" / ");
}

function FastenerPicture({
  compactSideProfile = false,
  driveId,
  headProfileId,
  id,
  profile,
}: {
  compactSideProfile?: boolean;
  driveId?: DriveId;
  headProfileId?: HeadProfileId;
  id: FastenerId;
  profile: "side" | "top";
}) {
  const artwork = defaultArtworkByFastener[id];
  const markup =
    id === "nut" || id === "washer"
      ? getHardwareSvgMarkup(id, profile)
      : profile === "top"
        ? getDriveSvgMarkup(driveId ?? artwork.driveId)
        : getHeadProfileSvgMarkup(
            headProfileId ?? artwork.headProfileId,
            compactSideProfile,
            driveId ?? artwork.driveId,
          );
  const artworkId =
    id === "nut" || id === "washer"
      ? id
      : profile === "top"
        ? (driveId ?? artwork.driveId)
        : (headProfileId ?? artwork.headProfileId);

  return (
    <span
      className={
        profile === "top" ? styles.topProfilePicture : styles.sideProfilePicture
      }
      data-artwork-id={artworkId}
      data-artwork-profile={profile}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function CustomArtworkImage({
  profile,
  src,
}: {
  profile: "side" | "top";
  src: string;
}) {
  return (
    <span
      className={
        profile === "top" ? styles.topProfilePicture : styles.sideProfilePicture
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.customArtworkImage} src={src} alt="" />
    </span>
  );
}

function CustomArtworkPlaceholder({ profile }: { profile: "side" | "top" }) {
  return (
    <span
      className={
        profile === "top" ? styles.topProfilePicture : styles.sideProfilePicture
      }
    >
      <span className={styles.customArtworkPlaceholder}>
        <ImagePlus aria-hidden="true" size={profile === "top" ? 22 : 16} />
      </span>
    </span>
  );
}

function ItemTypeArtwork({
  customPrimaryImage,
  customSecondaryImage,
  driveId,
  headProfileId,
  itemType,
}: {
  customPrimaryImage: string;
  customSecondaryImage: string;
  driveId: DriveId;
  headProfileId: HeadProfileId;
  itemType: ItemTypeId;
}) {
  const artworkFastenerId =
    itemType === "screw"
      ? fastenerIdByHeadProfile[headProfileId]
      : itemType === "nut" || itemType === "washer"
        ? itemType
        : null;
  const primaryArtwork =
    itemType === "custom" ? (
      customPrimaryImage ? (
        <CustomArtworkImage profile="top" src={customPrimaryImage} />
      ) : (
        <CustomArtworkPlaceholder profile="top" />
      )
    ) : artworkFastenerId ? (
      <FastenerPicture
        driveId={driveId}
        headProfileId={headProfileId}
        id={artworkFastenerId}
        profile="top"
      />
    ) : null;
  const secondaryArtwork =
    itemType === "custom" ? (
      customSecondaryImage ? (
        <CustomArtworkImage profile="side" src={customSecondaryImage} />
      ) : (
        <CustomArtworkPlaceholder profile="side" />
      )
    ) : artworkFastenerId ? (
      <FastenerPicture
        driveId={driveId}
        headProfileId={headProfileId}
        id={artworkFastenerId}
        profile="side"
      />
    ) : null;

  return (
    <span className={styles.itemTypeArtwork} aria-hidden="true">
      <span className={styles.itemTypePrimaryArt}>
        {primaryArtwork}
      </span>
      <span className={styles.itemTypeSecondaryArt}>
        {secondaryArtwork}
      </span>
    </span>
  );
}

function ItemTypeRow({
  customPrimaryImage,
  customSecondaryImage,
  driveId,
  headProfileId,
  itemType,
}: {
  customPrimaryImage: string;
  customSecondaryImage: string;
  driveId: DriveId;
  headProfileId: HeadProfileId;
  itemType: ItemTypeId;
}) {
  return (
    <>
      <span className={styles.itemTypeOptionText}>
        <strong>{getItemTypeLabel(itemType)}</strong>
        <span>{itemTypeDescriptions[itemType]}</span>
      </span>
      <ItemTypeArtwork
        customPrimaryImage={customPrimaryImage}
        customSecondaryImage={customSecondaryImage}
        driveId={driveId}
        headProfileId={headProfileId}
        itemType={itemType}
      />
    </>
  );
}

function ItemTypePicker({
  customPrimaryImage,
  customSecondaryImage,
  driveId,
  headProfileId,
  onChange,
  value,
}: {
  customPrimaryImage: string;
  customSecondaryImage: string;
  driveId: DriveId;
  headProfileId: HeadProfileId;
  onChange: (value: ItemTypeId) => void;
  value: ItemTypeId;
}) {
  const listboxId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return itemTypeOptions.filter((option) => {
      if (!normalizedQuery) {
        return true;
      }

      return getItemTypeLabel(option).toLowerCase().includes(normalizedQuery);
    });
  }, [query]);

  function openPicker() {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(Math.max(0, itemTypeOptions.indexOf(value)));
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function commitOption(option: ItemTypeId) {
    onChange(option);
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        Math.min(index + 1, Math.max(filteredOptions.length - 1, 0)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && filteredOptions[activeIndex]) {
      event.preventDefault();
      commitOption(filteredOptions[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className={styles.itemTypePicker}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Item Type"
        className={styles.itemTypeButton}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }

          openPicker();
        }}
        type="button"
      >
        <ItemTypeRow
          customPrimaryImage={customPrimaryImage}
          customSecondaryImage={customSecondaryImage}
          driveId={driveId}
          headProfileId={headProfileId}
          itemType={value}
        />
        <ChevronDown aria-hidden="true" size={16} />
      </button>

      {isOpen ? (
        <div
          className={styles.itemTypePopover}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        >
          <input
            ref={searchInputRef}
            aria-controls={listboxId}
            aria-label="Search Item Types"
            autoComplete="off"
            className={styles.itemTypeSearchInput}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search item types"
            value={query}
          />
          <Search aria-hidden="true" size={16} />
          <div className={styles.itemTypeListbox} id={listboxId} role="listbox">
            {filteredOptions.map((option, index) => (
              <button
                aria-selected={option === value}
                className={styles.itemTypeOption}
                id={`${listboxId}-${index}`}
                key={option}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commitOption(option)}
                role="option"
                type="button"
              >
                <ItemTypeRow
                  customPrimaryImage={customPrimaryImage}
                  customSecondaryImage={customSecondaryImage}
                  driveId={
                    option === "screw"
                      ? value === "screw"
                        ? driveId
                        : defaults.driveId
                      : option === "nut" || option === "washer"
                        ? defaultArtworkByFastener[option].driveId
                        : driveId
                  }
                  headProfileId={
                    option === "screw"
                      ? value === "screw"
                        ? headProfileId
                        : defaults.headProfileId
                      : option === "nut" || option === "washer"
                        ? defaultArtworkByFastener[option].headProfileId
                        : headProfileId
                  }
                  itemType={option}
                />
                {option === value ? <Check aria-hidden="true" size={15} /> : null}
              </button>
            ))}
            {filteredOptions.length === 0 ? (
              <p className={styles.itemTypeEmpty}>No item types found</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FastenerStylePicker({
  driveId,
  headProfileId,
  onChange,
}: {
  driveId: DriveId;
  headProfileId: HeadProfileId;
  onChange: (headProfileId: HeadProfileId, driveId: DriveId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const headProfile = getHeadProfileOption(headProfileId);
  const drive = getDriveOption(driveId);
  const compatibleDrives = headProfile.driveIds.map((id) =>
    getDriveOption(id),
  );
  const isFixedExternalHex =
    compatibleDrives.length === 1 && compatibleDrives[0].id === "external-hex";

  function selectHead(nextHeadProfileId: HeadProfileId) {
    const nextHeadProfile = getHeadProfileOption(nextHeadProfileId);
    const nextDriveId = (
      nextHeadProfile.driveIds as readonly DriveId[]
    ).includes(driveId)
      ? driveId
      : nextHeadProfile.defaultDriveId;

    onChange(nextHeadProfileId, nextDriveId);
  }

  return (
    <div className={styles.fastenerStylePicker}>
      <span className={styles.fastenerStyleLabel}>Fastener style</span>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Fastener Style"
        className={styles.fastenerStyleButton}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <span className={styles.fastenerStyleSummary}>
          <strong>{headProfile.label}</strong>
          <span>{drive.label}</span>
        </span>
        <span className={styles.fastenerStyleArtwork} aria-hidden="true">
          <span>
            <FastenerPicture
              driveId={driveId}
              headProfileId={headProfileId}
              id={fastenerIdByHeadProfile[headProfileId]}
              profile="top"
            />
          </span>
          <span>
            <FastenerPicture
              driveId={driveId}
              headProfileId={headProfileId}
              id={fastenerIdByHeadProfile[headProfileId]}
              profile="side"
            />
          </span>
        </span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>

      {isOpen ? (
        <div
          aria-label="Choose fastener style"
          className={styles.fastenerStylePopover}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setIsOpen(false);
            }
          }}
          role="dialog"
        >
          <div className={styles.fastenerStyleSection}>
            <strong>Head style</strong>
            <div
              aria-label="Head style"
              className={styles.fastenerHeadGrid}
              role="group"
            >
              {headProfileOptions.map((option) => (
                <button
                  aria-label={`Head: ${option.label}`}
                  aria-pressed={option.id === headProfileId}
                  key={option.id}
                  onClick={() => selectHead(option.id)}
                  type="button"
                >
                  <span aria-hidden="true">
                    <FastenerPicture
                      compactSideProfile
                      driveId={option.defaultDriveId}
                      headProfileId={option.id}
                      id={fastenerIdByHeadProfile[option.id]}
                      profile="side"
                    />
                  </span>
                  <small>{option.label}</small>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fastenerStyleSection}>
            <strong>Drive</strong>
            {isFixedExternalHex ? (
              <div className={styles.fixedFastenerDrive}>
                <span aria-hidden="true">
                  <FastenerPicture
                    driveId="external-hex"
                    headProfileId="hex"
                    id="hex-bolt"
                    profile="top"
                  />
                </span>
                <span>
                  <strong>External hex</strong>
                  <small>Fixed by the hex head style</small>
                </span>
              </div>
            ) : (
              <div
                aria-label="Drive"
                className={styles.fastenerDriveGrid}
                role="group"
              >
                {compatibleDrives.map((option) => (
                  <button
                    aria-label={`Drive: ${option.label}`}
                    aria-pressed={option.id === driveId}
                    key={option.id}
                    onClick={() => onChange(headProfileId, option.id)}
                    type="button"
                  >
                    <span aria-hidden="true">
                      <FastenerPicture
                        driveId={option.id}
                        headProfileId={headProfileId}
                        id={fastenerIdByHeadProfile[headProfileId]}
                        profile="top"
                      />
                    </span>
                    <small>{option.label}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : null}
    </div>
  );
}

export function LabelGeneratorApp({ accent }: GridfinityAppProps) {
  const previewSurfaceRef = useRef<HTMLDivElement | null>(null);
  const previewGridRef = useRef<HTMLCanvasElement | null>(null);
  const panStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | null>(null);
  const [hasLoadedStoredSettings, setHasLoadedStoredSettings] = useState(false);
  const [fastenerId, setFastenerId] = useState(defaults.fastenerId);
  const [driveId, setDriveId] = useState(defaults.driveId);
  const [headProfileId, setHeadProfileId] = useState(defaults.headProfileId);
  const [itemName, setItemName] = useState(defaults.itemName);
  const [sizeId, setSizeId] = useState(defaults.sizeId);
  const [printerId, setPrinterId] = useState(defaults.printerId);
  const [printerDpi, setPrinterDpi] = useState(defaults.printerDpi);
  const [printerDpiY, setPrinterDpiY] = useState(defaults.printerDpiY);
  const [marginsMm, setMarginsMm] = useState(defaults.marginsMm);
  const [usePrinterMargins, setUsePrinterMargins] = useState(defaults.usePrinterMargins);
  const [printerDpiDraft, setPrinterDpiDraft] = useState(String(defaults.printerDpi));
  const [printerDpiYDraft, setPrinterDpiYDraft] = useState(String(defaults.printerDpiY));
  const [showPrinterPreview, setShowPrinterPreview] = useState(defaults.showPrinterPreview);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [printRaster, setPrintRaster] = useState<{
    options: LabelRasterOptions; url: string; error: string;
  } | null>(null);
  const [customWidthMm, setCustomWidthMm] = useState(defaults.customWidthMm);
  const [customHeightMm, setCustomHeightMm] = useState(defaults.customHeightMm);
  const [customWidthDraft, setCustomWidthDraft] = useState(
    String(defaults.customWidthMm),
  );
  const [customHeightDraft, setCustomHeightDraft] = useState(
    String(defaults.customHeightMm),
  );
  const [measurementSystem, setMeasurementSystem] = useState(
    defaults.measurementSystem,
  );
  const [threadSize, setThreadSize] = useState(defaults.threadSize);
  const [pitch, setPitch] = useState(defaults.pitch);
  const [length, setLength] = useState(defaults.length);
  const [note, setNote] = useState(defaults.note);
  const [qrUrl, setQrUrl] = useState(defaults.qrUrl);
  const [standardMode, setStandardMode] = useState(defaults.standardMode);
  const [showStandard, setShowStandard] = useState(defaults.showStandard);
  const [showPrimaryImage, setShowPrimaryImage] = useState(
    defaults.showPrimaryImage,
  );
  const [showSecondaryImage, setShowSecondaryImage] = useState(
    defaults.showSecondaryImage,
  );
  const [showQr, setShowQr] = useState(defaults.showQr);
  const [isCustomArtwork, setIsCustomArtwork] = useState(
    defaults.isCustomArtwork,
  );
  const [customPrimaryImage, setCustomPrimaryImage] = useState("");
  const [customSecondaryImage, setCustomSecondaryImage] = useState("");
  const [qrCode, setQrCode] = useState({ source: "", dataUrl: "" });
  const [previewView, setPreviewView] = useState<PreviewView>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [isPreviewPanning, setIsPreviewPanning] = useState(false);
  const [expandedSections, setExpandedSections] = useState(defaults.expandedSections);
  const [previewSurfaceSize, setPreviewSurfaceSize] = useState({
    width: 0,
    height: 0,
  });

  const fastener = getFastener(fastenerId);
  const selectedItemTypeId: ItemTypeId = isCustomArtwork
    ? "custom"
    : fastenerId === "nut" || fastenerId === "washer"
      ? fastenerId
      : "screw";
  const itemTypeValue = selectedItemTypeId;
  const enabledDetailFields = detailFieldsByItemType[selectedItemTypeId];
  const visibleDetailFields = enabledDetailFields.filter(
    (fieldId) =>
      fieldId !== "primaryImage" &&
      fieldId !== "secondaryImage" &&
      fieldId !== "qrUrl",
  );
  const hasDetailField = (fieldId: DetailFieldId) =>
    enabledDetailFields.includes(fieldId);
  const labelSize = useMemo(() => {
    if (sizeId === customLabelSizeId) {
      return {
        id: customLabelSizeId,
        name: "Custom",
        widthMm: customWidthMm,
        heightMm: customHeightMm,
      };
    }

    return labelSizes.find((size) => size.id === sizeId) ?? labelSizes[0];
  }, [customHeightMm, customWidthMm, sizeId]);
  const trimmedItemName = itemName.trim();
  const trimmedThreadSize = threadSize.trim();
  const trimmedLength = length.trim();
  const trimmedPitch = pitch.trim();
  const activeThreadSizeOptions = threadSizeOptionsBySystem[measurementSystem];
  const threadSizes = Object.keys(activeThreadSizeOptions);
  const selectedThreadOptions = activeThreadSizeOptions[trimmedThreadSize];
  const pitchOptions =
    selectedThreadOptions?.pitches ??
    fallbackPitchesBySystem[measurementSystem];
  const lengthOptions =
    selectedThreadOptions?.lengths ??
    fallbackLengthsBySystem[measurementSystem];
  const standardPitch = pitchOptions.find((option) => option !== "standard");
  const standardPitchLabel =
    standardPitch && measurementSystem === "imperial"
      ? `${standardPitch} TPI`
      : standardPitch;
  const displayPitch = trimmedPitch === "standard" ? "" : trimmedPitch;
  const imperialDisplayPitch =
    trimmedPitch === "standard" ? standardPitch : trimmedPitch;
  const boltPrimaryText =
    measurementSystem === "imperial"
      ? [
          [trimmedThreadSize, imperialDisplayPitch].filter(Boolean).join("-"),
          trimmedLength,
        ]
          .filter(Boolean)
          .join(" x ")
      : [trimmedThreadSize, trimmedLength, displayPitch]
          .filter(Boolean)
          .join(" x ");
  const selectedStandard =
    selectedItemTypeId === "screw"
      ? getScrewStyleStandard(headProfileId, driveId)
      : selectedItemTypeId === "nut" || selectedItemTypeId === "washer"
        ? fastener.standard
        : "";
  const hasKnownStandard = selectedStandard.length > 0;
  const standardParts = getStandardParts(selectedStandard);
  const activeStandardMode =
    standardMode === "din" && !standardParts.din ? "both" : standardMode;
  const standardText = getStandardText(selectedStandard, activeStandardMode);
  const primaryText = isCustomArtwork
    ? trimmedItemName
    : hasDetailField("pitch") && hasDetailField("length")
      ? boltPrimaryText
      : [trimmedThreadSize, fastener.shortName].filter(Boolean).join(" ");
  const secondaryText = [
    showStandard && !isCustomArtwork && hasDetailField("standard")
      ? standardText
      : "",
    hasDetailField("note") ? note.trim() : "",
  ]
    .filter(Boolean)
    .join("  /  ");
  const trimmedQrUrl = qrUrl.trim();
  const canShowQr =
    showQr &&
    trimmedQrUrl.length > 0 &&
    qrCode.source === trimmedQrUrl &&
    qrCode.dataUrl.length > 0;
  const presetMargins = useMemo(() => getPrinterMargins(printerId, labelSize.heightMm), [printerId, labelSize.heightMm]);
  const appliedMargins = useMemo(() => fitLabelMargins(
    usePrinterMargins && presetMargins ? presetMargins : marginsMm,
    labelSize.widthMm, labelSize.heightMm,
  ), [usePrinterMargins, presetMargins, marginsMm, labelSize.widthMm, labelSize.heightMm]);
  const printableWidthMm = labelSize.widthMm - appliedMargins.left - appliedMargins.right;
  const printableHeightMm = labelSize.heightMm - appliedMargins.top - appliedMargins.bottom;

  function updateMargin(axis: "horizontal" | "vertical", value: string) {
    const next = Number(value);
    if (!value.trim() || !Number.isFinite(next)) return;
    const size = axis === "horizontal" ? labelSize.widthMm : labelSize.heightMm;
    const maximum = Math.max(0, (size - 1) / 2);
    const margin = Math.round(Math.min(maximum, Math.max(0, next)) * 100) / 100;
    setMarginsMm({ ...appliedMargins, ...(axis === "horizontal"
      ? { left: margin, right: margin } : { top: margin, bottom: margin }) });
    setUsePrinterMargins(false);
  }
  const selectedPrinter = printerPresets.find((printer) => printer.id === printerId);
  const printerPixelSize = getPrinterPixelSize(labelSize.widthMm, labelSize.heightMm, { dpiX: printerDpi, dpiY: printerDpiY });
  const rasterOptions = useMemo<LabelRasterOptions>(() => ({
    widthMm: labelSize.widthMm,
    heightMm: labelSize.heightMm,
    resolution: { dpiX: printerDpi, dpiY: printerDpiY },
    marginsMm: appliedMargins,
    primaryText,
    secondaryText,
    topSource: customPrimaryImage || (isCustomArtwork ? "" : svgToDataUrl(
      fastenerId === "nut" || fastenerId === "washer"
        ? getHardwareSvgMarkup(fastenerId, "top") : getDriveSvgMarkup(driveId),
    )),
    sideSource: customSecondaryImage || (isCustomArtwork ? "" : svgToDataUrl(
      fastenerId === "nut" || fastenerId === "washer"
        ? getHardwareSvgMarkup(fastenerId, "side") : getHeadProfileSvgMarkup(headProfileId, false, driveId),
    )),
    qrSource: canShowQr ? qrCode.dataUrl : "",
    showPrimary: showPrimaryImage,
    showSecondary: showSecondaryImage,
    showQr: canShowQr,
  }), [labelSize.widthMm, labelSize.heightMm, printerDpi, printerDpiY, appliedMargins, primaryText, secondaryText,
    customPrimaryImage, customSecondaryImage, isCustomArtwork, fastenerId, driveId,
    headProfileId, canShowQr, qrCode.dataUrl, showPrimaryImage, showSecondaryImage]);
  const currentPrintRaster = printRaster?.options === rasterOptions ? printRaster : null;
  useEffect(() => {
    if (!hasLoadedStoredSettings) return;
    let active = true;
    let url = "";
    renderPrinterPreviewPng(rasterOptions).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setPrintRaster({ options: rasterOptions, url, error: "" });
    }).catch((error: unknown) => {
      if (active) setPrintRaster({
        options: rasterOptions, url: "",
        error: error instanceof Error ? error.message : "Could not render the label.",
      });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [rasterOptions, hasLoadedStoredSettings]);

  function updatePrinterDpi(axis: "x" | "y", value: string) {
    (axis === "x" ? setPrinterDpiDraft : setPrinterDpiYDraft)(value);
    const next = Number(value);
    if (value.trim() && Number.isInteger(next) && next >= minPrinterDpi && next <= maxPrinterDpi) {
      (axis === "x" ? setPrinterDpi : setPrinterDpiY)(next);
    }
  }

  const previewRatio = `${labelSize.widthMm} / ${labelSize.heightMm}`;
  const previewWidthPx = labelSize.widthMm * previewPxPerMm;
  const previewHeightPx = labelSize.heightMm * previewPxPerMm;
  const boundedPreviewView = useMemo(
    () =>
      clampPreviewView(previewView, {
        labelHeight: previewHeightPx,
        labelWidth: previewWidthPx,
        surfaceHeight: previewSurfaceSize.height,
        surfaceWidth: previewSurfaceSize.width,
      }),
    [previewHeightPx, previewSurfaceSize, previewView, previewWidthPx],
  );
  // Resize the DOM/SVG drawing itself so zoom does not magnify a cached bitmap.
  const renderedPreviewWidth = previewWidthPx * boundedPreviewView.scale;
  const renderedPreviewHeight = previewHeightPx * boundedPreviewView.scale;
  const labelLayout = getLabelLayout(
    renderedPreviewWidth, renderedPreviewHeight, showPrimaryImage, showSecondaryImage, canShowQr,
    scaleLabelMargins(appliedMargins, renderedPreviewWidth / labelSize.widthMm, renderedPreviewHeight / labelSize.heightMm),
  );
  const labelTextRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const context = document.createElement("canvas").getContext("2d");
    if (!context || !labelTextRef.current) return;
    const textLayout = getLabelTextLayout(
      context, primaryText, secondaryText, labelLayout.contentWidth, labelLayout.copyHeight,
    );
    const primary = labelTextRef.current.querySelector("strong");
    const secondary = labelTextRef.current.querySelector("span");
    if (primary) Object.assign(primary.style, getLabelTextStyle(textLayout.primary));
    if (secondary) Object.assign(secondary.style, getLabelTextStyle(textLayout.secondary));
  }, [primaryText, secondaryText, labelLayout.contentWidth, labelLayout.copyHeight]);
  const previewTransformStyle = {
    "--preview-grid-size": `${
      previewGridSizeMm * previewPxPerMm * boundedPreviewView.scale
    }px`,
    "--preview-pan-x": `${boundedPreviewView.x}px`,
    "--preview-pan-y": `${boundedPreviewView.y}px`,
    "--preview-scale": boundedPreviewView.scale,
  } as CSSProperties;

  const sizeDescription = useMemo(
    () =>
      `${labelSize.widthMm}mm wide by ${labelSize.heightMm}mm high printable label`,
    [labelSize],
  );

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const settings = readStoredLabelSettings();

      setExpandedSections(settings.expandedSections);
      setFastenerId(settings.fastenerId);
      setDriveId(settings.driveId);
      setHeadProfileId(settings.headProfileId);
      setItemName(settings.itemName);
      setSizeId(settings.sizeId);
      setPrinterId(settings.printerId);
      setPrinterDpi(settings.printerDpi);
      setPrinterDpiY(settings.printerDpiY);
      setMarginsMm(settings.marginsMm);
      setUsePrinterMargins(settings.usePrinterMargins);
      setPrinterDpiDraft(String(settings.printerDpi));
      setPrinterDpiYDraft(String(settings.printerDpiY));
      setShowPrinterPreview(settings.showPrinterPreview);
      setCustomWidthMm(settings.customWidthMm);
      setCustomHeightMm(settings.customHeightMm);
      setCustomWidthDraft(String(settings.customWidthMm));
      setCustomHeightDraft(String(settings.customHeightMm));
      setMeasurementSystem(settings.measurementSystem);
      setThreadSize(settings.threadSize);
      setPitch(settings.pitch);
      setLength(settings.length);
      setNote(settings.note);
      setQrUrl(settings.qrUrl);
      setStandardMode(settings.standardMode);
      setShowStandard(settings.showStandard);
      setShowPrimaryImage(settings.showPrimaryImage);
      setShowSecondaryImage(settings.showSecondaryImage);
      setShowQr(settings.showQr);
      setIsCustomArtwork(settings.isCustomArtwork);
      setCustomPrimaryImage(settings.customPrimaryImage);
      setCustomSecondaryImage(settings.customSecondaryImage);
      setHasLoadedStoredSettings(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredSettings) {
      return;
    }

    writeStoredLabelSettings({
      expandedSections,
      fastenerId,
      driveId,
      headProfileId,
      itemName,
      sizeId,
      printerId,
      printerDpi,
      printerDpiY,
      marginsMm,
      usePrinterMargins,
      showPrinterPreview,
      customWidthMm,
      customHeightMm,
      measurementSystem,
      threadSize,
      pitch,
      length,
      note,
      qrUrl,
      standardMode,
      showStandard,
      showPrimaryImage,
      showSecondaryImage,
      showQr,
      isCustomArtwork,
      customPrimaryImage,
      customSecondaryImage,
    });
  }, [
    expandedSections,
    customPrimaryImage,
    customSecondaryImage,
    customHeightMm,
    customWidthMm,
    driveId,
    fastenerId,
    hasLoadedStoredSettings,
    headProfileId,
    isCustomArtwork,
    itemName,
    length,
    measurementSystem,
    note,
    pitch,
    qrUrl,
    showPrimaryImage,
    showQr,
    showSecondaryImage,
    showStandard,
    sizeId,
    printerId,
    printerDpi,
    printerDpiY,
    marginsMm,
    usePrinterMargins,
    showPrinterPreview,
    standardMode,
    threadSize,
  ]);

  useEffect(() => {
    let isCurrent = true;
    if (!showQr || trimmedQrUrl.length === 0) {
      return;
    }

    QRCode.toString(trimmedQrUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((svg) => {
        if (isCurrent) {
          setQrCode({ source: trimmedQrUrl, dataUrl: svgToDataUrl(svg) });
        }
      })
      .catch(() => {
        if (isCurrent) {
          setQrCode({ source: "", dataUrl: "" });
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [showQr, trimmedQrUrl]);

  useLayoutEffect(() => {
    const surface = previewSurfaceRef.current;
    if (!surface) {
      return;
    }

    const updatePreviewSurfaceSize = () => {
      const rect = surface.getBoundingClientRect();
      setPreviewSurfaceSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };
    const observer = new ResizeObserver(updatePreviewSurfaceSize);

    updatePreviewSurfaceSize();
    observer.observe(surface);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = previewGridRef.current;
    const surface = previewSurfaceRef.current;
    if (!canvas || !surface || previewSurfaceSize.width <= 0 || previewSurfaceSize.height <= 0) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    const width = previewSurfaceSize.width;
    const height = previewSurfaceSize.height;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.strokeStyle =
      getComputedStyle(surface).getPropertyValue("--grid-line").trim() ||
      "rgba(23, 33, 31, 0.08)";
    context.lineWidth = 1 / pixelRatio;

    const gridSize =
      previewGridSizeMm * previewPxPerMm * boundedPreviewView.scale;
    const originX = width / 2 + boundedPreviewView.x;
    const originY = height / 2 + boundedPreviewView.y;
    const alignToDevicePixel = (value: number) =>
      (Math.round(value * pixelRatio) + 0.5) / pixelRatio;

    context.beginPath();

    for (
      let x = originX - Math.ceil(originX / gridSize) * gridSize;
      x <= width;
      x += gridSize
    ) {
      const alignedX = alignToDevicePixel(x);
      context.moveTo(alignedX, 0);
      context.lineTo(alignedX, height);
    }

    for (
      let y = originY - Math.ceil(originY / gridSize) * gridSize;
      y <= height;
      y += gridSize
    ) {
      const alignedY = alignToDevicePixel(y);
      context.moveTo(0, alignedY);
      context.lineTo(width, alignedY);
    }

    context.stroke();
  }, [boundedPreviewView, previewSurfaceSize]);

  function updateCustomImage(
    event: ChangeEvent<HTMLInputElement>,
    setImage: (value: string) => void,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function resetLabel() {
    setFastenerId(defaultLabelSettings.fastenerId);
    setDriveId(defaultLabelSettings.driveId);
    setHeadProfileId(defaultLabelSettings.headProfileId);
    setItemName(defaultLabelSettings.itemName);
    setSizeId(defaultLabelSettings.sizeId);
    setPrinterId(defaultLabelSettings.printerId);
    setPrinterDpi(defaultLabelSettings.printerDpi);
    setPrinterDpiY(defaultLabelSettings.printerDpiY);
    setMarginsMm(defaultLabelSettings.marginsMm);
    setUsePrinterMargins(defaultLabelSettings.usePrinterMargins);
    setPrinterDpiDraft(String(defaultLabelSettings.printerDpi));
    setPrinterDpiYDraft(String(defaultLabelSettings.printerDpiY));
    setShowPrinterPreview(defaultLabelSettings.showPrinterPreview);
    setCustomWidthMm(defaultLabelSettings.customWidthMm);
    setCustomHeightMm(defaultLabelSettings.customHeightMm);
    setCustomWidthDraft(String(defaultLabelSettings.customWidthMm));
    setCustomHeightDraft(String(defaultLabelSettings.customHeightMm));
    setMeasurementSystem(defaultLabelSettings.measurementSystem);
    setThreadSize(defaultLabelSettings.threadSize);
    setPitch(defaultLabelSettings.pitch);
    setLength(defaultLabelSettings.length);
    setNote(defaultLabelSettings.note);
    setQrUrl(defaultLabelSettings.qrUrl);
    setStandardMode(defaultLabelSettings.standardMode);
    setShowStandard(defaultLabelSettings.showStandard);
    setShowPrimaryImage(defaultLabelSettings.showPrimaryImage);
    setShowSecondaryImage(defaultLabelSettings.showSecondaryImage);
    setShowQr(defaultLabelSettings.showQr);
    setIsCustomArtwork(defaultLabelSettings.isCustomArtwork);
    setCustomPrimaryImage(defaultLabelSettings.customPrimaryImage);
    setCustomSecondaryImage(defaultLabelSettings.customSecondaryImage);
    writeStoredLabelSettings(defaultLabelSettings);
  }

  function selectMeasurementSystem(system: MeasurementSystem) {
    if (system === measurementSystem) {
      return;
    }

    const nextDetails = defaultThreadDetailsBySystem[system];
    setMeasurementSystem(system);
    setThreadSize(nextDetails.threadSize);
    setPitch(nextDetails.pitch);
    setLength(nextDetails.length);
  }

  function selectItemType(itemType: ItemTypeId) {
    if (itemType === "custom") {
      setIsCustomArtwork(true);
      return;
    }

    if (itemType === "screw") {
      if (fastenerId === "nut" || fastenerId === "washer") {
        setFastenerId(defaults.fastenerId);
        setDriveId(defaults.driveId);
        setHeadProfileId(defaults.headProfileId);
      }
      setIsCustomArtwork(false);
      return;
    }

    if (itemType === "nut" || itemType === "washer") {
      const nextArtwork = defaultArtworkByFastener[itemType];
      setFastenerId(itemType);
      setDriveId(nextArtwork.driveId);
      setHeadProfileId(nextArtwork.headProfileId);
      setIsCustomArtwork(false);
    }
  }

  function selectFastenerStyle(
    nextHeadProfileId: HeadProfileId,
    nextDriveId: DriveId,
  ) {
    setFastenerId(fastenerIdByHeadProfile[nextHeadProfileId]);
    setHeadProfileId(nextHeadProfileId);
    setDriveId(nextDriveId);
    setShowStandard(false);
  }

  function updateCustomWidth(value: string) {
    setSizeId(customLabelSizeId);
    setCustomWidthDraft(value);
  }

  function updateCustomHeight(value: string) {
    setSizeId(customLabelSizeId);
    setCustomHeightDraft(value);
  }

  function commitCustomWidth() {
    const nextWidth = readNumber(
      Number(customWidthDraft),
      customWidthMm,
      minLabelWidthMm,
      maxLabelWidthMm,
    );

    setCustomWidthMm(nextWidth);
    setCustomWidthDraft(String(nextWidth));
  }

  function commitCustomHeight() {
    const nextHeight = readNumber(
      Number(customHeightDraft),
      customHeightMm,
      minLabelHeightMm,
      maxLabelHeightMm,
    );

    setCustomHeightMm(nextHeight);
    setCustomHeightDraft(String(nextHeight));
  }

  const isSectionExpanded = (section: string, defaultExpanded: boolean) =>
    expandedSections[section] ?? defaultExpanded;
  const setSectionExpanded = (section: string, expanded: boolean) => {
    setExpandedSections((current) => ({ ...current, [section]: expanded }));
  };

  function resetPreviewView() {
    setPreviewView({ x: 0, y: 0, scale: getHomePreviewScale(labelSize) });
  }

  function zoomPreview(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const surface = previewSurfaceRef.current;
    if (!surface) {
      return;
    }

    const rect = surface.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const cursorOffsetX = event.clientX - centerX;
    const cursorOffsetY = event.clientY - centerY;
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);

    setPreviewView((current) => {
      const nextScale = Math.min(
        maxPreviewScale,
        Math.max(minPreviewScale, current.scale * zoomFactor),
      );
      const scaleRatio = nextScale / current.scale;

      return {
        ...clampPreviewView(
          {
            scale: nextScale,
            x: cursorOffsetX - (cursorOffsetX - current.x) * scaleRatio,
            y: cursorOffsetY - (cursorOffsetY - current.y) * scaleRatio,
          },
          {
            labelHeight: previewHeightPx,
            labelWidth: previewWidthPx,
            surfaceHeight: previewSurfaceSize.height,
            surfaceWidth: previewSurfaceSize.width,
          },
        ),
      };
    });
  }

  function startPreviewPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    panStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: boundedPreviewView.x,
      y: boundedPreviewView.y,
    };
    setIsPreviewPanning(true);
  }

  function panPreview(event: ReactPointerEvent<HTMLDivElement>) {
    const panStart = panStartRef.current;

    if (!panStart || panStart.pointerId !== event.pointerId) {
      return;
    }

    setPreviewView((current) =>
      clampPreviewView(
        {
          ...current,
          x: panStart.x + event.clientX - panStart.clientX,
          y: panStart.y + event.clientY - panStart.clientY,
        },
        {
          labelHeight: previewHeightPx,
          labelWidth: previewWidthPx,
          surfaceHeight: previewSurfaceSize.height,
          surfaceWidth: previewSurfaceSize.width,
        },
      ),
    );
  }

  function stopPreviewPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (panStartRef.current?.pointerId !== event.pointerId) {
      return;
    }

    panStartRef.current = null;
    setIsPreviewPanning(false);
  }

  function renderArtworkFallback(profile: "side" | "top") {
    if (!isCustomArtwork) {
      return (
        <FastenerPicture
          driveId={driveId}
          headProfileId={headProfileId}
          id={fastenerId}
          profile={profile}
        />
      );
    }

    return (
      <span className={styles.artworkRecommendation}>
        <ImagePlus aria-hidden="true" size={profile === "top" ? 16 : 18} />
        <span>{profile === "top" ? "Square" : "Wide"}</span>
      </span>
    );
  }

  function renderArtworkPicker({
    disabled,
    image,
    onChange,
    profile,
  }: {
    disabled: boolean;
    image: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    profile: "side" | "top";
  }) {
    return (
      <label
        className={`${styles.artworkPicker} ${
          disabled ? styles.artworkPickerDisabled : ""
        }`}
        data-profile={profile}
      >
        <input
          accept="image/*"
          disabled={disabled}
          onChange={onChange}
          type="file"
        />
        <div
          className={styles.artworkPreview}
          data-profile={profile}
          data-has-custom-image={image ? "true" : "false"}
        >
          {image ? (
            <CustomArtworkImage profile={profile} src={image} />
          ) : (
            renderArtworkFallback(profile)
          )}
        </div>
        <span className={styles.fileAction}>
          <strong>
            <Upload aria-hidden="true" size={13} />
            Upload
          </strong>
          <small>{profile === "top" ? "1 x 1" : "22 x 7"}</small>
        </span>
      </label>
    );
  }

  function renderDetailField(fieldId: DetailFieldId) {
    const field = detailFields[fieldId];
    const className =
      field.layout === "full"
        ? `${styles.field} ${styles.fullDetailField}`
        : styles.field;

    switch (fieldId) {
      case "itemName":
        return (
          <label className={className} key={fieldId}>
            <span>{field.label}</span>
            <input
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
            />
          </label>
        );
      case "primaryImage":
        return (
          <div
            className={`${className} ${styles.imageField} ${
              !showPrimaryImage ? styles.disabledField : ""
            }`}
            key={fieldId}
          >
            <div className={styles.fieldHeader}>
              <span>{field.label}</span>
              <span className={styles.inlineCheckbox}>
                <span>Show</span>
                <input
                  checked={showPrimaryImage}
                  aria-label="Show primary image"
                  onChange={(event) =>
                    setShowPrimaryImage(event.target.checked)
                  }
                  type="checkbox"
                />
              </span>
            </div>
            {renderArtworkPicker({
              disabled: !showPrimaryImage,
              image: customPrimaryImage,
              onChange: (event) =>
                updateCustomImage(event, setCustomPrimaryImage),
              profile: "top",
            })}
          </div>
        );
      case "secondaryImage":
        return (
          <div
            className={`${className} ${styles.imageField} ${
              !showSecondaryImage ? styles.disabledField : ""
            }`}
            key={fieldId}
          >
            <div className={styles.fieldHeader}>
              <span>{field.label}</span>
              <span className={styles.inlineCheckbox}>
                <span>Show</span>
                <input
                  checked={showSecondaryImage}
                  aria-label="Show secondary image"
                  onChange={(event) =>
                    setShowSecondaryImage(event.target.checked)
                  }
                  type="checkbox"
                />
              </span>
            </div>
            {renderArtworkPicker({
              disabled: !showSecondaryImage,
              image: customSecondaryImage,
              onChange: (event) =>
                updateCustomImage(event, setCustomSecondaryImage),
              profile: "side",
            })}
          </div>
        );
      case "standard":
        return (
          <div
            className={`${className} ${
              !showStandard || !hasKnownStandard ? styles.disabledField : ""
            }`}
            key={fieldId}
          >
            <div className={styles.fieldHeader}>
              <span>{field.label}</span>
              <span className={styles.inlineCheckbox}>
                <span>Show</span>
                <input
                  aria-label="Show ISO / DIN standard"
                  checked={showStandard}
                  disabled={!hasKnownStandard}
                  onChange={(event) => setShowStandard(event.target.checked)}
                  type="checkbox"
                />
              </span>
            </div>
            <div
              className={styles.standardPicker}
              data-selected={activeStandardMode}
              role="group"
              aria-label={field.label}
            >
              <span className={styles.standardPickerThumb} aria-hidden="true" />
              <button
                aria-pressed={activeStandardMode === "iso"}
                disabled={!showStandard || !standardParts.iso}
                onClick={() => setStandardMode("iso")}
                type="button"
              >
                {standardParts.iso || "ISO"}
              </button>
              <button
                aria-pressed={activeStandardMode === "din"}
                disabled={!showStandard || !standardParts.din}
                onClick={() => setStandardMode("din")}
                type="button"
              >
                {standardParts.din || "DIN"}
              </button>
              <button
                aria-pressed={activeStandardMode === "both"}
                disabled={!showStandard}
                onClick={() => setStandardMode("both")}
                type="button"
              >
                Both
              </button>
            </div>
          </div>
        );
      case "threadSize":
        return (
          <label className={className} key={fieldId}>
            <span>{field.label}</span>
            <ComboboxInput
              ariaLabel={field.label}
              options={threadSizes}
              value={threadSize}
              onChange={setThreadSize}
            />
          </label>
        );
      case "pitch":
        return (
          <label className={className} key={fieldId}>
            <span>{field.label}</span>
            <ComboboxInput
              ariaLabel={field.label}
              getOptionLabel={(option) =>
                option === "standard" && standardPitchLabel
                  ? `Standard (${standardPitchLabel})`
                  : option
              }
              options={pitchOptions}
              value={pitch}
              onChange={setPitch}
            />
          </label>
        );
      case "length":
        return (
          <label className={className} key={fieldId}>
            <span>{field.label}</span>
            <ComboboxInput
              ariaLabel={field.label}
              options={lengthOptions}
              value={length}
              onChange={setLength}
            />
          </label>
        );
      case "measurementSystem":
        return (
          <div className={className} key={fieldId}>
            <span>{field.label}</span>
            <div
              className={styles.unitPicker}
              data-selected={measurementSystem}
              role="group"
              aria-label="Units"
            >
              <span className={styles.unitPickerThumb} aria-hidden="true" />
              <button
                aria-pressed={measurementSystem === "metric"}
                onClick={() => selectMeasurementSystem("metric")}
                type="button"
              >
                Metric
              </button>
              <button
                aria-pressed={measurementSystem === "imperial"}
                onClick={() => selectMeasurementSystem("imperial")}
                type="button"
              >
                Imperial
              </button>
            </div>
          </div>
        );
      case "note":
        return (
          <label className={className} key={fieldId}>
            <span>{field.label}</span>
            <input
              placeholder="insert text here"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        );
      case "qrUrl":
        return (
          <label
            className={`${className} ${!showQr ? styles.disabledField : ""}`}
            key={fieldId}
          >
            <div className={styles.fieldHeader}>
              <span>{field.label}</span>
              <span className={styles.inlineCheckbox}>
                <span>Show</span>
                <input
                  checked={showQr}
                  aria-label="Show QR code"
                  onChange={(event) => setShowQr(event.target.checked)}
                  type="checkbox"
                />
              </span>
            </div>
            <input
              disabled={!showQr}
              inputMode="url"
              placeholder="https://..."
              value={qrUrl}
              onChange={(event) => setQrUrl(event.target.value)}
            />
          </label>
        );
    }
  }

  async function downloadPng() {
    if (isExporting) return;
    setIsExporting(true);
    setExportError("");
    try {
      const blob = await renderLabelExportPng(rasterOptions);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `gridfinity-label-${labelSize.id}-${trimmedThreadSize.toLowerCase() || "custom"}.png`;
      link.href = url;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      captureEvent("label_exported", {
        label_size: labelSize.id,
        label_width_mm: labelSize.widthMm,
        label_height_mm: labelSize.heightMm,
        format: "png",
        export_dpi: labelExportDpi,
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export the label PNG.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <OpenScadGeneratorShell
      accent={accent}
      parametersPanel={
        <GeneratorPanel
          ariaLabel="Label Parameters"
          icon={<SlidersHorizontal aria-hidden="true" size={18} />}
          title="Label Parameters"
        >
          <GeneratorPanelBody>
            <CollapsibleSection
              title="Type"
              expanded={isSectionExpanded("Type", true)}
              onExpandedChange={(expanded) =>
                setSectionExpanded("Type", expanded)
              }
            >
              <div className={styles.fullDetailField}>
                <ItemTypePicker
                  customPrimaryImage={customPrimaryImage}
                  customSecondaryImage={customSecondaryImage}
                  driveId={driveId}
                  headProfileId={headProfileId}
                  onChange={selectItemType}
                  value={itemTypeValue}
                />
              </div>
              {selectedItemTypeId === "screw" ? (
                <FastenerStylePicker
                  driveId={driveId}
                  headProfileId={headProfileId}
                  onChange={selectFastenerStyle}
                />
              ) : null}
              <div className={`${styles.detailsGrid} ${styles.typeDetailsGrid}`}>
                {renderDetailField("primaryImage")}
                {renderDetailField("secondaryImage")}
                {renderDetailField("qrUrl")}
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Details"
              expanded={isSectionExpanded("Details", true)}
              onExpandedChange={(expanded) =>
                setSectionExpanded("Details", expanded)
              }
            >
              <div className={styles.detailsGrid}>
                {visibleDetailFields.map((fieldId) =>
                  renderDetailField(fieldId),
                )}
              </div>
            </CollapsibleSection>
          </GeneratorPanelBody>

          <GeneratorPanelActions>
            <button
              className={styles.secondaryButton}
              onClick={resetLabel}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={16} />
              Reset Label
            </button>
          </GeneratorPanelActions>
        </GeneratorPanel>
      }
      previewAriaLabel="Label Preview"
      previewTitle="Label Preview"
      previewControls={
        <div className={styles.previewModeControls}>
          <div className={styles.previewModeSelector} role="group" aria-label="Label preview mode">
            <button type="button" aria-pressed={!showPrinterPreview} onClick={() => setShowPrinterPreview(false)}>
              Design
            </button>
            <button type="button" aria-pressed={showPrinterPreview} onClick={() => setShowPrinterPreview(true)}>
              Print Preview
            </button>
          </div>
          {showPrinterPreview ? (
            <span className={styles.previewDpi} data-testid="preview-dpi" title="Horizontal × vertical printer resolution">
              {printerDpi} × {printerDpiY} DPI
            </span>
          ) : null}
        </div>
      }
      preview={
        <div
          aria-label="Label preview viewport"
          title={sizeDescription}
          className={styles.previewSurface}
          data-panning={isPreviewPanning}
          onPointerCancel={stopPreviewPan}
          onPointerDown={startPreviewPan}
          onPointerMove={panPreview}
          onPointerUp={stopPreviewPan}
          onWheel={zoomPreview}
          ref={previewSurfaceRef}
          style={previewTransformStyle}
        >
          <button
            aria-label="Home view"
            className={styles.previewHomeButton}
            onClick={(event) => {
              event.stopPropagation();
              resetPreviewView();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            title="Home view"
            type="button"
          >
            <Home aria-hidden="true" size={18} />
          </button>
          <canvas
            aria-hidden="true"
            className={styles.previewGrid}
            data-testid="label-preview-grid"
            ref={previewGridRef}
          />
          <div
            className={styles.labelShadow}
            data-testid="label-preview-transform"
          >
            <div
              className={styles.label}
              data-printer-preview={showPrinterPreview}
              style={{
                aspectRatio: previewRatio,
                width: `${renderedPreviewWidth}px`,
                height: `${renderedPreviewHeight}px`,
              } as CSSProperties}
            >
              {showPrimaryImage ? (
                <div
                  className={styles.topProfileSlot}
                  style={{
                    left: labelLayout.primaryLeft, top: labelLayout.top,
                    width: labelLayout.edgeSize, height: labelLayout.edgeSize,
                  }}
                >
                  {customPrimaryImage ? (
                    <CustomArtworkImage profile="top" src={customPrimaryImage} />
                  ) : isCustomArtwork ? (
                    <CustomArtworkPlaceholder profile="top" />
                  ) : (
                    <FastenerPicture
                      driveId={driveId}
                      headProfileId={headProfileId}
                      id={fastenerId}
                      profile="top"
                    />
                  )}
                </div>
              ) : null}
              <div
                className={styles.labelContent}
                style={{
                  left: labelLayout.contentLeft, top: labelLayout.contentTop,
                  width: labelLayout.contentWidth, height: labelLayout.contentHeight,
                  gridTemplateRows: showSecondaryImage
                    ? `${labelLayout.copyHeight}px minmax(0, 1fr)` : "1fr",
                  gap: labelLayout.rowGap,
                }}
              >
                <div className={styles.labelCopy} data-testid="label-text" ref={labelTextRef}>
                  <strong>
                    {primaryText}
                  </strong>
                  {secondaryText ? (
                    <span>
                      {secondaryText}
                    </span>
                  ) : null}
                </div>
                {showSecondaryImage ? (
                  <div className={styles.secondaryProfileSlot}>
                    {customSecondaryImage ? (
                      <CustomArtworkImage
                        profile="side"
                        src={customSecondaryImage}
                      />
                    ) : isCustomArtwork ? (
                      <CustomArtworkPlaceholder profile="side" />
                    ) : (
                      <FastenerPicture
                        driveId={driveId}
                        headProfileId={headProfileId}
                        id={fastenerId}
                        profile="side"
                      />
                    )}
                  </div>
                ) : null}
              </div>
              {canShowQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.qrImage}
                  data-testid="label-qr"
                  src={qrCode.dataUrl}
                  alt=""
                  style={{
                    left: labelLayout.qrLeft, top: labelLayout.qrTop,
                    width: labelLayout.qrSize, height: labelLayout.qrSize,
                  }}
                />
              ) : null}
              {showPrinterPreview ? (
                currentPrintRaster?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.printerRaster}
                    data-testid="label-printer-preview"
                    src={currentPrintRaster.url}
                    alt={`Printer simulation at ${printerDpi} × ${printerDpiY} DPI (horizontal × vertical): ${printerPixelSize.width} by ${printerPixelSize.height} dots`}
                    draggable={false}
                  />
                ) : (
                  <div className={styles.printerRasterPending} role="status">
                    {currentPrintRaster?.error || "Updating print preview…"}
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      }
      outputPanel={
        <GeneratorPanel
          ariaLabel="Output Settings"
          icon={<PanelLeft aria-hidden="true" size={18} />}
          title="Output Settings"
        >
          <GeneratorPanelBody>
            <CollapsibleSection
              title="Label size"
              expanded={isSectionExpanded("Label size", true)}
              onExpandedChange={(expanded) => setSectionExpanded("Label size", expanded)}
            >
              <div className={styles.sizeGrid}>
                {labelSizes.map((size) => (
                  <button
                    className={
                      size.id === sizeId
                        ? `${styles.sizeOption} ${styles.selectedOption}`
                        : styles.sizeOption
                    }
                    key={size.id}
                    onClick={() => {
                      setSizeId(size.id);
                      setCustomWidthMm(size.widthMm);
                      setCustomHeightMm(size.heightMm);
                      setCustomWidthDraft(String(size.widthMm));
                      setCustomHeightDraft(String(size.heightMm));
                    }}
                    type="button"
                  >
                    <span>{size.name}</span>
                    <small>mm</small>
                  </button>
                ))}
                <button
                  className={
                    sizeId === customLabelSizeId
                      ? `${styles.sizeOption} ${styles.selectedOption}`
                      : styles.sizeOption
                  }
                  onClick={() => setSizeId(customLabelSizeId)}
                  type="button"
                >
                  <span>Custom</span>
                  <small>mm</small>
                </button>
              </div>

              <div className={styles.customSizeGrid}>
                <label className={styles.field}>
                  <span>Width</span>
                  <div className={styles.inputWrap}>
                    <input
                      aria-label="Custom label width"
                      inputMode="decimal"
                      max={maxLabelWidthMm}
                      min={minLabelWidthMm}
                      onBlur={commitCustomWidth}
                      onChange={(event) => updateCustomWidth(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          commitCustomWidth();
                          event.currentTarget.blur();
                        }
                      }}
                      step="1"
                      type="text"
                      value={customWidthDraft}
                    />
                    <small>mm</small>
                  </div>
                </label>
                <label className={styles.field}>
                  <span>Height</span>
                  <div className={styles.inputWrap}>
                    <input
                      aria-label="Custom label height"
                      inputMode="decimal"
                      max={maxLabelHeightMm}
                      min={minLabelHeightMm}
                      onBlur={commitCustomHeight}
                      onChange={(event) => updateCustomHeight(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          commitCustomHeight();
                          event.currentTarget.blur();
                        }
                      }}
                      step="1"
                      type="text"
                      value={customHeightDraft}
                    />
                    <small>mm</small>
                  </div>
                </label>
              </div>

            </CollapsibleSection>
            <CollapsibleSection
              title="Printer"
              expanded={isSectionExpanded("Printer", true)}
              onExpandedChange={(expanded) => setSectionExpanded("Printer", expanded)}
            >
              <label className={styles.field}>
                <span>Label printer</span>
                <select
                  aria-label="Label printer"
                  value={printerId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setMarginsMm(appliedMargins);
                    setUsePrinterMargins(Boolean(getPrinterMargins(id, labelSize.heightMm)));
                    setPrinterId(id);
                    const preset = printerPresets.find((printer) => printer.id === id);
                    const mode = preset?.modes[0] ?? { dpiX: printerDpi, dpiY: printerDpiY };
                    setPrinterDpi(mode.dpiX);
                    setPrinterDpiY(mode.dpiY);
                    setPrinterDpiDraft(String(mode.dpiX));
                    setPrinterDpiYDraft(String(mode.dpiY));
                  }}
                >
                  {printerPresets.map((printer) => (
                    <option key={printer.id} value={printer.id}>{printer.name}</option>
                  ))}
                  <option value="custom">Other / custom DPI</option>
                </select>
              </label>
              {selectedPrinter ? (
                selectedPrinter.modes.length > 1 ? (
                  <label className={styles.field}>
                    <span>Print resolution</span>
                    <select
                      aria-label="Print resolution"
                      value={`${printerDpi}x${printerDpiY}`}
                      title="Horizontal × vertical DPI; match your printer's quality setting"
                      onChange={(event) => {
                        const mode = selectedPrinter.modes.find((mode) => `${mode.dpiX}x${mode.dpiY}` === event.target.value);
                        if (!mode) return;
                        setPrinterDpi(mode.dpiX);
                        setPrinterDpiY(mode.dpiY);
                      }}
                    >
                      {selectedPrinter.modes.map((mode) => (
                        <option key={`${mode.dpiX}x${mode.dpiY}`} value={`${mode.dpiX}x${mode.dpiY}`}>
                          {mode.name} · {mode.dpiX} × {mode.dpiY} DPI
                        </option>
                      ))}
                    </select>
                  </label>
                ) : <p className={styles.printHint}>{printerDpi} × {printerDpiY} DPI</p>
              ) : (
                <div className={styles.marginGrid}>
                  {(["x", "y"] as const).map((axis) => (
                    <label className={styles.field} key={axis}>
                      <span>{axis === "x" ? "Horizontal DPI" : "Vertical DPI"}</span>
                      <input
                        type="number"
                        min={minPrinterDpi}
                        max={maxPrinterDpi}
                        step="1"
                        value={axis === "x" ? printerDpiDraft : printerDpiYDraft}
                        onChange={(event) => updatePrinterDpi(axis, event.target.value)}
                        onBlur={() => axis === "x" ? setPrinterDpiDraft(String(printerDpi)) : setPrinterDpiYDraft(String(printerDpiY))}
                        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </CollapsibleSection>
            <CollapsibleSection
              title="Margins"
              expanded={isSectionExpanded("Margins", true)}
              onExpandedChange={(expanded) => setSectionExpanded("Margins", expanded)}
            >
              <label className={styles.toggleRow}>
                <span><strong>Use printer margins</strong></span>
                <input
                  type="checkbox"
                  checked={usePrinterMargins && Boolean(presetMargins)}
                  disabled={!presetMargins}
                  onChange={(event) => {
                    setMarginsMm(appliedMargins);
                    setUsePrinterMargins(event.target.checked);
                  }}
                />
              </label>
              <div className={styles.marginGrid}>
                {(["horizontal", "vertical"] as const).map((axis) => {
                  const value = appliedMargins[axis === "horizontal" ? "left" : "top"];
                  return (
                    <label className={styles.field} key={axis}>
                      <span>{axis === "horizontal" ? "Horizontal margin" : "Vertical margin"}</span>
                      <div className={styles.inputWrap}>
                        <input
                          key={`${axis}-${value}`}
                          type="number"
                          min="0"
                          step="0.01"
                          max={((axis === "horizontal" ? labelSize.widthMm : labelSize.heightMm) - 1) / 2}
                          title={axis === "horizontal" ? "Each left and right edge" : "Each top and bottom edge"}
                          defaultValue={Number(value.toFixed(2))}
                          onBlur={(event) => {
                            updateMargin(axis, event.target.value);
                            event.currentTarget.value = String(Number(value.toFixed(2)));
                          }}
                          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                        />
                        <small>mm</small>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className={styles.printHint} data-testid="printable-area-size">
                Printable: {Number(printableWidthMm.toFixed(2))} × {Number(printableHeightMm.toFixed(2))} mm
              </p>
            </CollapsibleSection>
          </GeneratorPanelBody>

          <GeneratorPanelActions>
            {currentPrintRaster?.error ? <p role="alert" className={styles.printHint}>{currentPrintRaster.error}</p> : null}
            {exportError ? <p role="alert" className={styles.printHint}>{exportError}</p> : null}
            <button
              className={styles.primaryButton}
              disabled={!hasLoadedStoredSettings || isExporting}
              aria-busy={isExporting}
              onClick={downloadPng}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Download PNG
            </button>
          </GeneratorPanelActions>
        </GeneratorPanel>
      }
    />
  );
}
