"use client";

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
  GeneratorPanel,
  OpenScadGeneratorShell,
} from "@/ui/apps/openscad/OpenScadGeneratorShell";
import { CollapsibleSection } from "@/ui/apps/openscad/parameterControls";
import type { GridfinityAppProps } from "../types";
import styles from "./label-generator.module.css";

type FastenerId =
  | "socket-cap"
  | "button-head"
  | "flat-head"
  | "hex-bolt"
  | "nut"
  | "washer";
type ItemTypeId = FastenerId | "custom";
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
  ...fasteners.map((fastener) => fastener.id),
  "custom",
] as const satisfies readonly ItemTypeId[];

const itemTypeDescriptions: Record<ItemTypeId, string> = {
  "socket-cap": "Cylindrical hex socket cap screws",
  "button-head": "Low profile rounded socket screws",
  "flat-head": "Countersunk socket flat head screws",
  "hex-bolt": "External hex head threaded bolts",
  nut: "Hexagonal internally threaded nuts",
  washer: "Flat round spacing and load washers",
  custom: "User supplied artwork and label text",
};

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
  "socket-cap": [
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
  "button-head": [
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
  "hex-bolt": [
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
  "flat-head": [
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
  itemName: "Custom item",
  sizeId: "35x12",
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
  if (itemType === "custom") {
    return "Custom";
  }

  return fasteners.find((fastener) => fastener.id === itemType)?.name ?? itemType;
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

    return {
      fastenerId: readString(
        parsed.fastenerId,
        defaults.fastenerId,
        fasteners.map((fastener) => fastener.id),
      ),
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

function getSideProfileSvgMarkup(id: FastenerId) {
  if (id === "nut") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 70"><path d="M34 14h152l24 21-24 21H34L10 35 34 14Z" fill="white" stroke="black" stroke-width="7" stroke-linejoin="round"/><path d="M76 18c-13 11-13 23 0 34M144 18c13 11 13 23 0 34" fill="none" stroke="black" stroke-width="6" stroke-linecap="round"/><path d="M55 35h110" stroke="black" stroke-width="4" stroke-linecap="round"/></svg>`;
  }

  if (id === "washer") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 70"><path d="M20 27h180v16H20V27Z" fill="white" stroke="black" stroke-width="7" stroke-linejoin="round"/><path d="M72 28v14M148 28v14" stroke="black" stroke-width="5"/></svg>`;
  }

  const head =
    id === "hex-bolt"
      ? `<path d="M15 20h27l14 20-14 20H15L4 40 15 20Z" fill="white" stroke="black" stroke-width="6" stroke-linejoin="round"/>`
      : id === "flat-head"
        ? `<path d="M6 49 32 18h18l10 31H6Z" fill="white" stroke="black" stroke-width="6" stroke-linejoin="round"/><path d="M24 42h20" stroke="black" stroke-width="5" stroke-linecap="round"/>`
      : id === "button-head"
        ? `<path d="M6 45C10 18 49 18 55 45v13H6V45Z" fill="white" stroke="black" stroke-width="6" stroke-linejoin="round"/><path d="M22 39h18" stroke="black" stroke-width="5" stroke-linecap="round"/>`
        : `<path d="M8 15h48v50H8V15Z" fill="white" stroke="black" stroke-width="6" stroke-linejoin="round"/><path d="M22 28h20M22 40h20M22 52h20" stroke="black" stroke-width="4" stroke-linecap="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 70">${head}<path d="M53 29h147l9 6-9 6H53V29Z" fill="white" stroke="black" stroke-width="6" stroke-linejoin="round"/><path d="M66 29v12M76 29v12M86 29v12M96 29v12M106 29v12M116 29v12M126 29v12M136 29v12M146 29v12M156 29v12M166 29v12M176 29v12M186 29v12" stroke="black" stroke-width="2.4"/><path d="M59 22h139M59 48h139" stroke="black" stroke-width="3" stroke-linecap="round"/></svg>`;
}

function getTopProfileSvgMarkup(id: FastenerId) {
  if (id === "nut") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M28 10h44l23 40-23 40H28L5 50 28 10Z" fill="white" stroke="black" stroke-width="7" stroke-linejoin="round"/><circle cx="50" cy="50" r="20" fill="white" stroke="black" stroke-width="7"/><path d="M35 24h30M35 76h30" stroke="black" stroke-width="4" stroke-linecap="round"/></svg>`;
  }

  if (id === "washer") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="39" fill="white" stroke="black" stroke-width="7"/><circle cx="50" cy="50" r="17" fill="white" stroke="black" stroke-width="7"/></svg>`;
  }

  const outer =
    id === "hex-bolt"
      ? `<path d="M28 10h44l23 40-23 40H28L5 50 28 10Z" fill="white" stroke="black" stroke-width="7" stroke-linejoin="round"/>`
      : id === "flat-head"
        ? `<circle cx="50" cy="50" r="39" fill="white" stroke="black" stroke-width="7"/><path d="M31 50h38" stroke="black" stroke-width="7" stroke-linecap="round"/>`
      : id === "button-head"
        ? `<circle cx="50" cy="50" r="38" fill="white" stroke="black" stroke-width="7"/><circle cx="50" cy="50" r="24" fill="none" stroke="black" stroke-width="3" opacity=".55"/>`
        : `<circle cx="50" cy="50" r="39" fill="white" stroke="black" stroke-width="7"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${outer}<path d="M50 28 69 39v22L50 72 31 61V39l19-11Z" fill="white" stroke="black" stroke-width="6" stroke-linejoin="round"/></svg>`;
}

function FastenerPicture({
  id,
  profile,
}: {
  id: FastenerId;
  profile: "side" | "top";
}) {
  return (
    <span
      className={
        profile === "top" ? styles.topProfilePicture : styles.sideProfilePicture
      }
      dangerouslySetInnerHTML={{
        __html:
          profile === "top"
            ? getTopProfileSvgMarkup(id)
            : getSideProfileSvgMarkup(id),
      }}
    />
  );
}

function fitCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: (size: number) => string,
  startSize: number,
  minSize: number,
) {
  let size = startSize;
  context.font = font(size);

  while (context.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    context.font = font(size);
  }

  return size;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function drawImageContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const boxRatio = width / height;
  const drawWidth = imageRatio > boxRatio ? width : height * imageRatio;
  const drawHeight = imageRatio > boxRatio ? width / imageRatio : height;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
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
  itemType,
}: {
  customPrimaryImage: string;
  customSecondaryImage: string;
  itemType: ItemTypeId;
}) {
  const primaryArtwork =
    itemType === "custom" ? (
      customPrimaryImage ? (
        <CustomArtworkImage profile="top" src={customPrimaryImage} />
      ) : (
        <CustomArtworkPlaceholder profile="top" />
      )
    ) : (
      <FastenerPicture id={itemType} profile="top" />
    );
  const secondaryArtwork =
    itemType === "custom" ? (
      customSecondaryImage ? (
        <CustomArtworkImage profile="side" src={customSecondaryImage} />
      ) : (
        <CustomArtworkPlaceholder profile="side" />
      )
    ) : (
      <FastenerPicture id={itemType} profile="side" />
    );

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
  itemType,
}: {
  customPrimaryImage: string;
  customSecondaryImage: string;
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
        itemType={itemType}
      />
    </>
  );
}

function ItemTypePicker({
  customPrimaryImage,
  customSecondaryImage,
  onChange,
  value,
}: {
  customPrimaryImage: string;
  customSecondaryImage: string;
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
  const [itemName, setItemName] = useState(defaults.itemName);
  const [sizeId, setSizeId] = useState(defaults.sizeId);
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
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [previewSurfaceSize, setPreviewSurfaceSize] = useState({
    width: 0,
    height: 0,
  });

  const fastener = getFastener(fastenerId);
  const selectedItemTypeId: ItemTypeId = isCustomArtwork
    ? "custom"
    : fastenerId;
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
  const standardParts = getStandardParts(fastener.standard);
  const activeStandardMode =
    standardMode === "din" && !standardParts.din ? "both" : standardMode;
  const standardText = getStandardText(fastener.standard, activeStandardMode);
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

      setFastenerId(settings.fastenerId);
      setItemName(settings.itemName);
      setSizeId(settings.sizeId);
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
      fastenerId,
      itemName,
      sizeId,
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
    customPrimaryImage,
    customSecondaryImage,
    customHeightMm,
    customWidthMm,
    fastenerId,
    hasLoadedStoredSettings,
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
    standardMode,
    threadSize,
  ]);

  useEffect(() => {
    let isCurrent = true;
    if (!showQr || trimmedQrUrl.length === 0) {
      return;
    }

    QRCode.toDataURL(trimmedQrUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (isCurrent) {
          setQrCode({ source: trimmedQrUrl, dataUrl: url });
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
    setItemName(defaultLabelSettings.itemName);
    setSizeId(defaultLabelSettings.sizeId);
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

  function selectItemType(itemType: string) {
    if (itemType === "custom") {
      setIsCustomArtwork(true);
      return;
    }

    if (itemTypeOptions.includes(itemType as ItemTypeId)) {
      setFastenerId(itemType as FastenerId);
      setIsCustomArtwork(false);
    }
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
      return <FastenerPicture id={fastenerId} profile={profile} />;
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
            className={`${className} ${!showStandard ? styles.disabledField : ""}`}
            key={fieldId}
          >
            <div className={styles.fieldHeader}>
              <span>{field.label}</span>
              <span className={styles.inlineCheckbox}>
                <span>Show</span>
                <input
                  checked={showStandard}
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
    const pxPerMm = 28;
    const width = Math.round(labelSize.widthMm * pxPerMm);
    const height = Math.round(labelSize.heightMm * pxPerMm);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#d8d8d8";
    context.lineWidth = Math.max(2, Math.round(height * 0.012));
    context.strokeRect(1, 1, width - 2, height - 2);

    const padding = Math.round(height * 0.09);
    const gap = Math.round(height * 0.07);
    const qrSize = Math.round(height - padding * 2);
    const qrX = width - padding - qrSize;
    const contentX = padding;
    const contentWidth = Math.max(height, qrX - gap - contentX);
    const topRowHeight = Math.round((height - padding * 2 - gap) * 0.48);
    const topArtworkSource =
      customPrimaryImage ||
      (isCustomArtwork ? "" : svgToDataUrl(getTopProfileSvgMarkup(fastenerId)));
    const sideArtworkSource =
      customSecondaryImage ||
      (isCustomArtwork ? "" : svgToDataUrl(getSideProfileSvgMarkup(fastenerId)));
    const shouldDrawPrimary = showPrimaryImage && topArtworkSource;
    const shouldDrawSecondary = showSecondaryImage && sideArtworkSource;
    const primaryIconSize = shouldDrawPrimary ? topRowHeight : 0;
    const textX = contentX + (shouldDrawPrimary ? primaryIconSize + gap : 0);
    const textWidth = Math.max(height, contentWidth - (textX - contentX));
    const secondaryY = padding + topRowHeight + gap;
    const secondaryHeight = height - padding - secondaryY;

    if (shouldDrawPrimary) {
      const image = await loadImage(topArtworkSource);
      context.drawImage(image, contentX, padding, primaryIconSize, primaryIconSize);
    }

    const primarySize = fitCanvasText(
      context,
      primaryText,
      textWidth,
      (size) => `800 ${size}px Arial, Helvetica, sans-serif`,
      Math.round(topRowHeight * 0.48),
      Math.round(topRowHeight * 0.22),
    );

    context.fillStyle = "#000000";
    context.textBaseline = "alphabetic";
    context.font = `800 ${primarySize}px Arial, Helvetica, sans-serif`;
    context.fillText(
      primaryText,
      textX,
      padding + Math.round(topRowHeight * 0.54),
    );

    const secondarySize = fitCanvasText(
      context,
      secondaryText,
      textWidth,
      (size) => `500 ${size}px Arial, Helvetica, sans-serif`,
      Math.round(topRowHeight * 0.22),
      Math.round(topRowHeight * 0.12),
    );
    context.font = `500 ${secondarySize}px Arial, Helvetica, sans-serif`;
    context.fillText(
      secondaryText,
      textX,
      padding + Math.round(topRowHeight * 0.84),
    );

    if (shouldDrawSecondary) {
      const image = await loadImage(sideArtworkSource);
      drawImageContained(
        context,
        image,
        contentX,
        secondaryY,
        contentWidth,
        secondaryHeight,
      );
    }

    if (canShowQr) {
      const image = await loadImage(qrCode.dataUrl);
      context.drawImage(image, qrX, padding, qrSize, qrSize);
    }

    captureEvent("label_exported", {
      label_size: labelSize.id,
      label_width_mm: labelSize.widthMm,
      label_height_mm: labelSize.heightMm,
      format: "png",
    });
    const link = document.createElement("a");
    link.download = `gridfinity-label-${labelSize.id}-${trimmedThreadSize.toLowerCase() || "custom"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
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
          <div className={styles.panelScroll}>
            <div className={styles.formShell}>
              <div data-parameter-section="Type">
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
                      onChange={selectItemType}
                      value={itemTypeValue}
                    />
                  </div>
                  <div className={`${styles.detailsGrid} ${styles.typeDetailsGrid}`}>
                    {renderDetailField("primaryImage")}
                    {renderDetailField("secondaryImage")}
                    {renderDetailField("qrUrl")}
                  </div>
                </CollapsibleSection>
              </div>

              <div data-parameter-section="Details">
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
              </div>
            </div>
          </div>

          <div className={styles.panelActions}>
            <button
              className={styles.secondaryButton}
              onClick={resetLabel}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={16} />
              Reset Label
            </button>
          </div>
        </GeneratorPanel>
      }
      previewAriaLabel="Label Preview"
      previewTitle="Label Preview"
      previewStatus={sizeDescription}
      preview={
        <div
          aria-label="Label preview viewport"
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
              style={{
                aspectRatio: previewRatio,
                width: `${previewWidthPx}px`,
                height: `${previewHeightPx}px`,
              }}
            >
              <div className={styles.labelContent}>
                <div className={styles.labelTopRow}>
                  {showPrimaryImage ? (
                    <div className={styles.topProfileSlot}>
                      {customPrimaryImage ? (
                        <CustomArtworkImage
                          profile="top"
                          src={customPrimaryImage}
                        />
                      ) : isCustomArtwork ? (
                        <CustomArtworkPlaceholder profile="top" />
                      ) : (
                        <FastenerPicture id={fastenerId} profile="top" />
                      )}
                    </div>
                  ) : null}
                  <div className={styles.labelCopy}>
                    <strong>{primaryText}</strong>
                    <span>{secondaryText}</span>
                  </div>
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
                      <FastenerPicture id={fastenerId} profile="side" />
                    )}
                  </div>
                ) : null}
              </div>
              {canShowQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.qrImage} src={qrCode.dataUrl} alt="" />
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
          <div className={styles.panelScroll}>
            <div className={styles.controlGroup}>
              <label className={styles.fieldLabel}>Label Size</label>
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

          </div>

          <div className={styles.panelActions}>
            <button
              className={styles.primaryButton}
              onClick={downloadPng}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Download PNG
            </button>
          </div>
        </GeneratorPanel>
      }
    />
  );
}
