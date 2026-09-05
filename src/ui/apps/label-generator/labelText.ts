export const labelFontFamily = "Arial, Helvetica, sans-serif";

type TextLine = {
  fontSize: number;
  height: number;
  top: number;
  baseline: number;
};

type LabelTextLayout = {
  primary: TextLine;
  secondary: TextLine;
};

// Measure at a fixed reference size so fitting scales identically for screen,
// zoom, and print. Fit visible glyphs rather than the font's empty line spacing.
export function getLabelTextLayout(
  context: CanvasRenderingContext2D,
  primary: string,
  secondary: string,
  width: number,
  height: number,
): LabelTextLayout {
  const inset = height * 0.04;
  const gap = primary && secondary ? height * 0.06 : 0;
  const availableHeight = height - inset * 2 - gap;

  function fit(text: string, weight: number, allocatedHeight: number) {
    context.font = `${weight} 100px ${labelFontFamily}`;
    const metrics = context.measureText(text);
    const measuredWidth = Math.max(
      metrics.width,
      metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
    );
    const inkAscent = metrics.actualBoundingBoxAscent;
    const inkDescent = metrics.actualBoundingBoxDescent;
    const inkHeight = Math.max(1, inkAscent + inkDescent);
    const fontSize = text ? Math.min(
      (width - inset * 2) * 100 / Math.max(measuredWidth, 1),
      allocatedHeight * 100 / inkHeight,
    ) : 0;
    const lineHeight = inkHeight * fontSize / 100;
    const ascent = metrics.fontBoundingBoxAscent * fontSize / 100;
    const descent = metrics.fontBoundingBoxDescent * fontSize / 100;
    const baseline = inkAscent * fontSize / 100;
    return {
      fontSize,
      height: lineHeight,
      // CSS centers the font box inside line-height. Offset that box so the
      // visible letters align with the same baseline used by the PNG renderer.
      top: baseline - ((lineHeight - ascent - descent) / 2 + ascent),
      baseline,
    };
  }

  const primaryLine = fit(primary, 800, availableHeight * (secondary ? 0.7 : 1));
  const secondaryLine = fit(secondary, 500, availableHeight * (primary ? 0.3 : 1));
  const start = (height - primaryLine.height - secondaryLine.height - gap) / 2;
  primaryLine.top += start;
  primaryLine.baseline += start;
  const secondaryStart = start + primaryLine.height + gap;
  secondaryLine.top += secondaryStart;
  secondaryLine.baseline += secondaryStart;

  return { primary: primaryLine, secondary: secondaryLine };
}

export function getLabelTextStyle(line: TextLine) {
  return {
    fontSize: `${line.fontSize}px`,
    height: `${line.height}px`,
    lineHeight: `${line.height}px`,
    top: `${line.top}px`,
  };
}
