// The preview and PNG use the same proportions, in their respective pixel units.
export function getLabelLayout(
  width: number,
  height: number,
  showPrimary: boolean,
  showSecondary: boolean,
  showQr: boolean,
) {
  const padding = Math.min(width, height) * 0.07;
  const gap = Math.min(width, height) * 0.05;
  const innerWidth = width - padding * 2;
  const edgeSize = Math.min(height - padding * 2, innerWidth * 0.22);
  const top = (height - edgeSize) / 2;
  const contentLeft = padding + (showPrimary ? edgeSize + gap : 0);
  const contentWidth = innerWidth -
    (showPrimary ? edgeSize + gap : 0) - (showQr ? edgeSize + gap : 0);
  // Use the label's full inner height for the center column; its artwork should
  // not be constrained by the smaller square icons on either side.
  const contentTop = padding;
  const contentHeight = height - padding * 2;
  const rowGap = showSecondary ? contentHeight * 0.02 : 0;
  const sideHeight = showSecondary ? contentHeight * 0.35 : 0;
  const copyHeight = contentHeight - sideHeight - rowGap;

  return {
    padding,
    borderWidth: Math.min(width, height) * 0.012,
    borderRadius: Math.min(width, height) * 0.06,
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
    qrLeft: width - padding - edgeSize,
  };
}
