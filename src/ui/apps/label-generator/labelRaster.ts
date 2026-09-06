import { getLabelLayout, scaleLabelMargins, type LabelMargins } from "./labelLayout";
import { getLabelTextLayout, labelFontFamily } from "./labelText";
import { getPrinterPixelSize, type PrinterResolution } from "./printerPresets";

export const labelExportDpi = 1200;

export type LabelRasterOptions = {
  widthMm: number;
  heightMm: number;
  resolution: PrinterResolution;
  marginsMm: LabelMargins;
  primaryText: string;
  secondaryText: string;
  topSource: string;
  sideSource: string;
  qrSource: string;
  showPrimary: boolean;
  showSecondary: boolean;
  showQr: boolean;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load label artwork. Try replacing the custom image."));
    image.src = src;
  });
}

function drawContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number, y: number, width: number, height: number,
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

// Canvas PNGs normally advertise 96 DPI. Replace pHYs so printing applications
// can recover the intended physical size instead of enlarging a printer raster.
async function pngAtDpi(canvas: HTMLCanvasElement, { dpiX, dpiY }: PrinterResolution): Promise<Blob> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not encode the label PNG.")), "image/png");
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4); // pHYs
  view.setUint32(8, Math.round(dpiX / 0.0254));
  view.setUint32(12, Math.round(dpiY / 0.0254));
  chunk[16] = 1; // Pixels per metre.
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const parts: BlobPart[] = [bytes.slice(0, 33), chunk]; // Signature and IHDR.
  const sourceView = new DataView(bytes.buffer);
  for (let offset = 33; offset < bytes.length;) {
    const length = sourceView.getUint32(offset) + 12;
    const isDensity = bytes[offset + 4] === 112 && bytes[offset + 5] === 72 &&
      bytes[offset + 6] === 89 && bytes[offset + 7] === 115;
    if (!isDensity) parts.push(bytes.slice(offset, offset + length));
    offset += length;
  }
  return new Blob(parts, { type: "image/png" });
}

export function renderPrinterPreviewPng(options: LabelRasterOptions): Promise<Blob> {
  return renderLabelRaster(options, true);
}

// Always render from the original artwork at export resolution. Printer
// DPI and the preview's monochrome conversion must never affect exports.
export function renderLabelExportPng(options: Omit<LabelRasterOptions, "resolution">): Promise<Blob> {
  return renderLabelRaster({ ...options, resolution: { dpiX: labelExportDpi, dpiY: labelExportDpi } }, false);
}

async function renderLabelRaster(options: LabelRasterOptions, monochrome: boolean): Promise<Blob> {
  const { width, height } = getPrinterPixelSize(options.widthMm, options.heightMm, options.resolution);
  // Firefox distorts SVG images drawn under a nonuniform canvas transform.
  // Composite at the finer printer resolution with square pixels first, then
  // resample the finished bitmap onto the printer's rectangular dot grid.
  const renderDpi = Math.max(options.resolution.dpiX, options.resolution.dpiY);
  const renderSize = getPrinterPixelSize(options.widthMm, options.heightMm, { dpiX: renderDpi, dpiY: renderDpi });
  const [top, side, qr] = await Promise.all([
    loadImage(options.showPrimary ? options.topSource : ""),
    loadImage(options.showSecondary ? options.sideSource : ""),
    loadImage(options.showQr ? options.qrSource : ""),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = renderSize.width;
  canvas.height = renderSize.height;
  const context = canvas.getContext("2d", { willReadFrequently: monochrome });
  if (!context) throw new Error("Your browser could not create a print preview.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const layout = getLabelLayout(
    canvas.width, canvas.height, options.showPrimary, options.showSecondary, options.showQr,
    scaleLabelMargins(options.marginsMm, canvas.width / options.widthMm, canvas.height / options.heightMm),
  );
  if (top) drawContained(context, top, layout.primaryLeft, layout.top, layout.edgeSize, layout.edgeSize);

  const textLayout = getLabelTextLayout(context, options.primaryText, options.secondaryText, layout.contentWidth, layout.copyHeight);
  context.fillStyle = "#000000";
  context.textBaseline = "alphabetic";
  context.textAlign = "center";
  for (const [text, weight, line] of [
    [options.primaryText, 800, textLayout.primary],
    [options.secondaryText, 500, textLayout.secondary],
  ] as const) {
    if (!text) continue;
    context.font = `${weight} ${line.fontSize}px ${labelFontFamily}`;
    context.fillText(text, layout.contentLeft + layout.contentWidth / 2, layout.contentTop + line.baseline);
  }
  if (side) drawContained(context, side, layout.contentLeft, layout.sideTop, layout.contentWidth, layout.sideHeight);
  if (qr) context.drawImage(qr, layout.qrLeft, layout.qrTop, layout.qrSize, layout.qrSize);

  let outputCanvas = canvas;
  let outputContext = context;
  if (canvas.width !== width || canvas.height !== height) {
    outputCanvas = document.createElement("canvas");
    outputCanvas.width = width;
    outputCanvas.height = height;
    const printerContext = outputCanvas.getContext("2d", { willReadFrequently: monochrome });
    if (!printerContext) throw new Error("Your browser could not create a print preview.");
    printerContext.drawImage(canvas, 0, 0, width, height);
    outputContext = printerContext;
  }

  // Thermal printers place black dots, not antialiased gray pixels. Threshold
  // only after compositing everything onto white, including uploaded artwork.
  if (monochrome) {
    const pixels = outputContext.getImageData(0, 0, width, height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const luminance = pixels.data[i] * 0.2126 + pixels.data[i + 1] * 0.7152 + pixels.data[i + 2] * 0.0722;
      const value = luminance < 128 ? 0 : 255;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
    outputContext.putImageData(pixels, 0, 0);
  }
  return pngAtDpi(outputCanvas, options.resolution);
}
