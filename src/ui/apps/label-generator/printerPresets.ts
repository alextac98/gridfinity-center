import type { LabelMargins } from "./labelLayout";

export type PrinterResolution = { dpiX: number; dpiY: number };

// X is along the horizontal label's length (tape feed); Y is across the tape.
// Brother's specifications often list these axes in the opposite order.
// Axis reference: https://download.brother.com/welcome/docp100064/cv_pte550wp750wp710bt_eng_raster_102.pdf §2.3.1.
// First mode is the default. The P750W defaults to the user's high-resolution workflow.
export const printerPresets = [
  {
    id: "brother-p750w",
    name: "Brother PT-P750W",
    modes: [
      { name: "High resolution", dpiX: 360, dpiY: 180 },
      { name: "Standard", dpiX: 180, dpiY: 180 },
    ],
    source: "https://www.brother.co.jp/product/labelprinter/ptp750w/spec/index.aspx",
  },
  {
    id: "brother-p710bt",
    name: "Brother PT-P710BT",
    modes: [
      { name: "Standard", dpiX: 180, dpiY: 180 },
      { name: "High resolution (computer only)", dpiX: 360, dpiY: 180 },
    ],
    source: "https://www.brother.co.jp/product/labelwriter/ptp710bt/spec/index.aspx",
  },
  {
    id: "brother-p300bt",
    name: "Brother PT-P300BT",
    modes: [{ name: "Standard", dpiX: 180, dpiY: 180 }],
    source: "https://www.brother.co.jp/product/labelwriter/ptp300bt/spec/index.aspx",
  },
  {
    id: "brother-p910bt",
    name: "Brother PT-P910BT",
    // Unlike the P900 series, P910BT has no 720 DPI mode; see §2.3.1:
    // https://download.brother.com/welcome/docp100407/cv_ptp900_eng_raster_102.pdf
    modes: [{ name: "Standard", dpiX: 360, dpiY: 360 }],
    source: "https://support.brother.com/g/b/spec.aspx?c=us&lang=en&prod=p910bteus",
  },
  {
    id: "niimbot-d110",
    name: "NIIMBOT D110",
    modes: [{ name: "Standard", dpiX: 203, dpiY: 203 }],
    source: "https://niimbot.com.sg/products/niimbot-d110-label-maker",
  },
];

export const minPrinterDpi = 72;
export const maxPrinterDpi = 1200;

// Source: https://download.brother.com/welcome/docp100064/cv_pte550wp750wp710bt_eng_raster_102.pdf

// TZe printable dot counts from section 2.3.5; 2 mm feed margins from 2.3.4.
// Across-tape dimensions become top/bottom on our horizontal labels. Compute
// offsets against the nominal tape width used by the label size controls.
export function getPrinterMargins(printerId: string, tapeWidthMm: number): LabelMargins | null {
  if (printerId !== "brother-p750w" && printerId !== "brother-p710bt") return null;
  const printableDots: Record<number, number> = { 3.5: 24, 6: 32, 9: 50, 12: 70, 18: 112, 24: 128 };
  const dots = printableDots[tapeWidthMm];
  if (!dots) return null;
  const margin = Math.max(0, Math.round((tapeWidthMm - dots * 25.4 / 180) / 2 * 100) / 100);
  return { left: 2, right: 2, top: margin, bottom: margin };
}

export function getPrinterPixelSize(widthMm: number, heightMm: number, { dpiX, dpiY }: PrinterResolution) {
  return {
    width: Math.max(1, Math.round(widthMm * dpiX / 25.4)),
    height: Math.max(1, Math.round(heightMm * dpiY / 25.4)),
  };
}
