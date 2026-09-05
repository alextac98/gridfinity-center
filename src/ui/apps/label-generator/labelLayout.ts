export type LabelMargins = { left: number; right: number; top: number; bottom: number };

// Keep at least 1 mm usable in each direction when changing label sizes.
export function fitLabelMargins(margins: LabelMargins, widthMm: number, heightMm: number): LabelMargins {
  const horizontal = Math.min(1, (widthMm - 1) / Math.max(1, margins.left + margins.right));
  const vertical = Math.min(1, (heightMm - 1) / Math.max(1, margins.top + margins.bottom));
  return {
    left: margins.left * horizontal, right: margins.right * horizontal,
    top: margins.top * vertical, bottom: margins.bottom * vertical,
  };
}

export function scaleLabelMargins(margins: LabelMargins, scaleX: number, scaleY: number): LabelMargins {
  return {
    left: margins.left * scaleX, right: margins.right * scaleX,
    top: margins.top * scaleY, bottom: margins.bottom * scaleY,
  };
}

// All positions use the printable rectangle; no additional outer padding.
export function getLabelLayout(
  width: number,
  height: number,
  showPrimary: boolean,
  showSecondary: boolean,
  showQr: boolean,
  margins: LabelMargins,
) {
  const innerWidth = width - margins.left - margins.right;
  const innerHeight = height - margins.top - margins.bottom;
  const gap = Math.min(innerWidth, innerHeight) * 0.03;
  // Prioritize a full-height QR code. On narrow labels, reserve half the
  // printable width for the other content so every column still fits.
  const qrSize = Math.min(innerHeight, innerWidth * 0.5);
  const edgeSize = Math.min(innerHeight, innerWidth * (showQr ? 0.18 : 0.22));
  const top = margins.top + (innerHeight - edgeSize) / 2;
  const contentLeft = margins.left + (showPrimary ? edgeSize + gap : 0);
  const contentWidth = innerWidth -
    (showPrimary ? edgeSize + gap : 0) - (showQr ? qrSize + gap : 0);
  const contentTop = margins.top;
  const contentHeight = innerHeight;
  const rowGap = showSecondary ? contentHeight * 0.02 : 0;
  const sideHeight = showSecondary ? contentHeight * 0.6 : 0;
  const copyHeight = contentHeight - sideHeight - rowGap;

  return {
    primaryLeft: margins.left,
    edgeSize,
    top,
    contentLeft,
    contentWidth,
    contentTop,
    contentHeight,
    copyHeight,
    rowGap,
    sideTop: contentTop + copyHeight + rowGap,
    sideHeight,
    qrSize,
    qrTop: margins.top + (innerHeight - qrSize) / 2,
    qrLeft: width - margins.right - qrSize,
  };
}
