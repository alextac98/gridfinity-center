"use client";

import {
  Download,
  ExternalLink,
  ImagePlus,
  Link,
  QrCode,
  RotateCcw,
  Ruler,
  Settings2,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ComboboxInput } from "@/ui/components/ui/ComboboxInput";
import { captureEvent } from "@/ui/analytics/posthog";
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

const labelSizes: LabelSize[] = [
  { id: "35x12", name: "35 x 12", widthMm: 35, heightMm: 12 },
  { id: "42x12", name: "42 x 12", widthMm: 42, heightMm: 12 },
  { id: "50x15", name: "50 x 15", widthMm: 50, heightMm: 15 },
  { id: "60x20", name: "60 x 20", widthMm: 60, heightMm: 20 },
  { id: "70x25", name: "70 x 25", widthMm: 70, heightMm: 25 },
];

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
  primaryImage: { label: "Primary image", layout: "half" },
  secondaryImage: { label: "Secondary image", layout: "half" },
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
    "measurementSystem",
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
        labelSizes.map((size) => size.id),
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

export function LabelGeneratorApp({ accent }: GridfinityAppProps) {
  const [hasLoadedStoredSettings, setHasLoadedStoredSettings] = useState(false);
  const [fastenerId, setFastenerId] = useState(defaults.fastenerId);
  const [itemName, setItemName] = useState(defaults.itemName);
  const [sizeId, setSizeId] = useState(defaults.sizeId);
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

  const fastener = getFastener(fastenerId);
  const selectedItemTypeId: ItemTypeId = isCustomArtwork
    ? "custom"
    : fastenerId;
  const enabledDetailFields = detailFieldsByItemType[selectedItemTypeId];
  const hasDetailField = (fieldId: DetailFieldId) =>
    enabledDetailFields.includes(fieldId);
  const labelSize =
    labelSizes.find((size) => size.id === sizeId) ?? labelSizes[0];
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
  const previewWidthPx = labelSize.widthMm * 11;
  const previewHeightPx = labelSize.heightMm * 11;

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
            className={`${className} ${
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
            <input
              accept="image/*"
              disabled={!showPrimaryImage}
              onChange={(event) =>
                updateCustomImage(event, setCustomPrimaryImage)
              }
              type="file"
            />
          </div>
        );
      case "secondaryImage":
        return (
          <div
            className={`${className} ${
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
            <input
              accept="image/*"
              disabled={!showSecondaryImage}
              onChange={(event) =>
                updateCustomImage(event, setCustomSecondaryImage)
              }
              type="file"
            />
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
    <div className={styles.appFrame} data-accent={accent}>
      <section className={styles.panel} aria-label="Label controls">
        <div className={styles.panelHeader}>
          <Settings2 aria-hidden="true" size={18} />
          <div>
            <h2>Label Creator</h2>
            <p>Configure labels with item artwork and QR links.</p>
          </div>
          <button className={styles.iconButton} onClick={resetLabel} title="Reset label" type="button">
            <RotateCcw aria-hidden="true" size={16} />
          </button>
        </div>

        <div className={styles.controlGroup}>
          <div className={styles.sectionHeader}>
            <h3>Item Type</h3>
          </div>
          <div className={styles.fastenerGrid}>
            {fasteners.map((option) => (
              <button
                className={
                  !isCustomArtwork && option.id === fastenerId
                    ? `${styles.fastenerOption} ${styles.selectedOption}`
                    : styles.fastenerOption
                }
                key={option.id}
                onClick={() => {
                  setFastenerId(option.id);
                  setIsCustomArtwork(false);
                }}
                type="button"
              >
                <span className={styles.fastenerOptionPictures}>
                  <FastenerPicture id={option.id} profile="top" />
                  <FastenerPicture id={option.id} profile="side" />
                </span>
                <span>{option.shortName}</span>
              </button>
            ))}
            <button
              className={
                isCustomArtwork
                  ? `${styles.fastenerOption} ${styles.selectedOption}`
                  : styles.fastenerOption
              }
              onClick={() => setIsCustomArtwork(true)}
              type="button"
            >
              <span className={styles.fastenerOptionPictures}>
                {customPrimaryImage ? (
                  <CustomArtworkImage profile="top" src={customPrimaryImage} />
                ) : (
                  <CustomArtworkPlaceholder profile="top" />
                )}
                {customSecondaryImage ? (
                  <CustomArtworkImage
                    profile="side"
                    src={customSecondaryImage}
                  />
                ) : (
                  <CustomArtworkPlaceholder profile="side" />
                )}
              </span>
              <span>Custom</span>
            </button>
          </div>
        </div>

        <div className={styles.detailsSection}>
          <div className={styles.sectionHeader}>
            <h3>Details</h3>
          </div>
          <div className={styles.detailsGrid}>
            {enabledDetailFields.map((fieldId) => renderDetailField(fieldId))}
          </div>
        </div>
      </section>

      <section className={styles.previewPanel} aria-label="Label preview">
        <div className={styles.previewToolbar}>
          <div>
            <h2>Label Preview</h2>
            <p>{sizeDescription}</p>
          </div>
          <button className={styles.primaryButton} onClick={downloadPng} type="button">
            <Download aria-hidden="true" size={16} />
            Download PNG
          </button>
        </div>

        <div className={styles.previewSurface}>
          <div className={styles.labelShadow}>
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
      </section>

      <section className={styles.panel} aria-label="Label settings">
        <div className={styles.panelHeader}>
          <Ruler aria-hidden="true" size={18} />
          <div>
            <h2>Output Settings</h2>
            <p>Pick the tape size and what appears on the printed label.</p>
          </div>
        </div>

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
                onClick={() => setSizeId(size.id)}
                type="button"
              >
                <span>{size.name}</span>
                <small>mm</small>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.summaryCard}>
          <div>
            <QrCode aria-hidden="true" size={18} />
            <span>{canShowQr ? "QR ready" : "QR disabled"}</span>
          </div>
          <div>
            <Link aria-hidden="true" size={18} />
            <span>{qrUrl || "No URL"}</span>
          </div>
          {qrUrl ? (
            <a href={qrUrl} target="_blank" rel="noreferrer">
              Open URL
              <ExternalLink aria-hidden="true" size={14} />
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
