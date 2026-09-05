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
// zoom, and print. Reserve a small inset for glyph overhang and rounding.
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
    const fontSize = text ? Math.min(
      (width - inset * 2) * 100 / Math.max(measuredWidth, 1),
      allocatedHeight / 1.15,
    ) : 0;
    const lineHeight = fontSize * 1.15;
    const ascent = metrics.fontBoundingBoxAscent * fontSize / 100;
    const descent = metrics.fontBoundingBoxDescent * fontSize / 100;
    return {
      fontSize,
      height: lineHeight,
      top: 0,
      baseline: (lineHeight - ascent - descent) / 2 + ascent,
    };
  }

  const primaryLine = fit(primary, 800, availableHeight * (secondary ? 0.7 : 1));
  const secondaryLine = fit(secondary, 500, availableHeight * (primary ? 0.3 : 1));
  const start = (height - primaryLine.height - secondaryLine.height - gap) / 2;
  primaryLine.top = start;
  primaryLine.baseline += start;
  secondaryLine.top = start + primaryLine.height + gap;
  secondaryLine.baseline += secondaryLine.top;

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
