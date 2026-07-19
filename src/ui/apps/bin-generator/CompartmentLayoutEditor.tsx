"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  getMinimumWallThicknessMm,
  type OpenScadDefineValue,
} from "@/shared/gridfinityExtended";
import { GRIDFINITY_STANDARD_CLEARANCE_MM } from "@/shared/gridfinity/constants";
import {
  convertBinSizeValue,
  type BinGeneratorSettings,
} from "./binOptions";
import { UnitPicker } from "@/ui/apps/openscad/parameterControls";
import styles from "./binGenerator.module.css";
import {
  compartmentUnitOptions,
  compartmentUnitStep,
  formatCompartmentValue,
  fromMillimeters,
  toMillimeters,
  type CompartmentUnit,
} from "./compartmentUnits";

const gridfinityPitchMm = 42;
const minimumCompartmentSizeMm = 19;
const positionToleranceMm = 0.01;
const smartSnapFractions = [
  { numerator: 1, denominator: 4, label: "¼" },
  { numerator: 1, denominator: 3, label: "⅓" },
  { numerator: 1, denominator: 2, label: "½" },
  { numerator: 2, denominator: 3, label: "⅔" },
  { numerator: 3, denominator: 4, label: "¾" },
] as const;

type Axis = "x" | "y";

type Divider = {
  positionMm: number;
  serialized: string;
};

type AxisConfig = {
  axis: Axis;
  chambersKey: "verticalChambers" | "horizontalChambers";
  configKey: "vertical_separator_config" | "horizontal_separator_config";
  irregularKey:
    | "vertical_irregular_subdivisions"
    | "horizontal_irregular_subdivisions";
  lengthMm: number;
  cavityInsetMm: number;
};

type CompartmentLayoutEditorProps = {
  params: BinGeneratorSettings;
  unit: CompartmentUnit;
  disabled?: boolean;
  onUnitChange: (unit: CompartmentUnit) => void;
  onChange: (params: BinGeneratorSettings) => void;
};

function parseDividers(
  value: OpenScadDefineValue | undefined,
  cavityInsetMm: number,
  lengthMm: number,
) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split("|")
    .map((serialized) => ({
      positionMm:
        Number(serialized.split(",")[0]?.trim()) + cavityInsetMm,
      serialized: serialized.trim(),
    }))
    .filter(
      (divider) =>
        Number.isFinite(divider.positionMm) &&
        divider.positionMm > cavityInsetMm &&
        divider.positionMm < lengthMm - cavityInsetMm,
    )
    .sort((left, right) => left.positionMm - right.positionMm);
}

function formatPosition(value: number) {
  return String(Number(value.toFixed(3)));
}

function replaceSerializedPosition(
  divider: Divider,
  positionMm: number,
  cavityInsetMm: number,
) {
  const parts = divider.serialized.split(",");
  parts[0] = formatPosition(positionMm - cavityInsetMm);
  return parts.join(",");
}

function serializeDividers(dividers: Divider[]) {
  return [...dividers]
    .sort((left, right) => left.positionMm - right.positionMm)
    .map((divider) => divider.serialized)
    .join("|");
}

function getEqualDividerPositions(
  chambers: number,
  lengthMm: number,
  cavityInsetMm: number,
  dividerThicknessMm: number,
) {
  const dividerCount = Math.max(0, chambers - 1);
  const cavityLengthMm = lengthMm - cavityInsetMm * 2;
  const compartmentSizeMm =
    (cavityLengthMm - dividerThicknessMm * dividerCount) / chambers;

  return Array.from({ length: dividerCount }, (_, index) =>
    cavityInsetMm +
    (index + 1) * compartmentSizeMm +
    index * dividerThicknessMm +
    dividerThicknessMm / 2,
  );
}

function getSmartSnapPositionMm(
  snap: (typeof smartSnapFractions)[number],
  axis: AxisConfig,
  dividerThicknessMm: number,
) {
  return getEqualDividerPositions(
    snap.denominator,
    axis.lengthMm,
    axis.cavityInsetMm,
    dividerThicknessMm,
  )[snap.numerator - 1];
}

function isSamePosition(left: number, right: number) {
  return Math.abs(left - right) < positionToleranceMm;
}

function positionLabel(positionMm: number, unit: CompartmentUnit) {
  return `${formatCompartmentValue(fromMillimeters(positionMm, unit), unit)} ${unit}`;
}

function dividerOrientation(axis: Axis) {
  return axis === "x" ? "Y" : "X";
}

function getDividerThicknessMm(value: OpenScadDefineValue | undefined) {
  if (!Array.isArray(value)) {
    return 0;
  }

  const bottomThickness = value[0];
  return typeof bottomThickness === "number" && Number.isFinite(bottomThickness)
    ? Math.max(0, bottomThickness)
    : 0;
}

function getCompartmentSpans(
  dividers: Divider[],
  startMm: number,
  endMm: number,
  dividerThicknessMm: number,
) {
  const boundaries = [
    startMm,
    ...dividers.map((divider) => divider.positionMm),
    endMm,
  ];

  return boundaries.slice(0, -1).map((start, index) => ({
    start,
    size: boundaries[index + 1] - start,
    clearSize: Math.max(
      0,
      boundaries[index + 1] -
        start -
        (index > 0 ? dividerThicknessMm / 2 : 0) -
        (index < dividers.length ? dividerThicknessMm / 2 : 0),
    ),
  }));
}

function hasMinimumCompartmentSize(
  dividers: Divider[],
  axis: AxisConfig,
  dividerThicknessMm: number,
) {
  const sortedDividers = [...dividers].sort(
    (left, right) => left.positionMm - right.positionMm,
  );

  return getCompartmentSpans(
    sortedDividers,
    axis.cavityInsetMm,
    axis.lengthMm - axis.cavityInsetMm,
    dividerThicknessMm,
  ).every(
    (span) =>
      span.clearSize >= minimumCompartmentSizeMm - positionToleranceMm,
  );
}

export function CompartmentLayoutEditor({
  params,
  unit,
  disabled = false,
  onUnitChange,
  onChange,
}: CompartmentLayoutEditorProps) {
  const [selectedDivider, setSelectedDivider] = useState<{
    axis: Axis;
    positionMm: number;
  } | null>(null);
  const [positionDraftMm, setPositionDraftMm] = useState("");
  const [draggingAxis, setDraggingAxis] = useState<Axis | null>(null);
  const [hoverDivider, setHoverDivider] = useState<{
    axis: Axis;
    positionMm: number;
  } | null>(null);
  const [hoveredExistingDivider, setHoveredExistingDivider] = useState<{
    axis: Axis;
    positionMm: number;
  } | null>(null);
  const lastPointerPosition = useRef<{ x: number; y: number } | null>(null);
  const [spanDraft, setSpanDraft] = useState<{
    axis: Axis;
    index: number;
    value: string;
  } | null>(null);
  const dividerThicknessMm = getDividerThicknessMm(
    params.extraDefines.chamber_wall_thickness,
  );
  const heightUnits = convertBinSizeValue(
    params.heightUnits,
    "heightUnits",
    params.heightUnit,
    "u",
  );
  const outerWallThicknessMm =
    params.wallThicknessUnit === "auto"
      ? getMinimumWallThicknessMm(heightUnits)
      : convertBinSizeValue(
          params.wallThicknessMm,
          "wallThicknessMm",
          params.wallThicknessUnit,
          "mm",
        );
  const cavityInsetMm =
    GRIDFINITY_STANDARD_CLEARANCE_MM + outerWallThicknessMm;
  const axes: Record<Axis, AxisConfig> = {
    x: {
      axis: "x",
      chambersKey: "verticalChambers",
      configKey: "vertical_separator_config",
      irregularKey: "vertical_irregular_subdivisions",
      lengthMm:
        convertBinSizeValue(
          params.widthUnits,
          "widthUnits",
          params.widthUnit,
          "u",
        ) * gridfinityPitchMm,
      cavityInsetMm,
    },
    y: {
      axis: "y",
      chambersKey: "horizontalChambers",
      configKey: "horizontal_separator_config",
      irregularKey: "horizontal_irregular_subdivisions",
      lengthMm:
        convertBinSizeValue(
          params.depthUnits,
          "depthUnits",
          params.depthUnit,
          "u",
        ) * gridfinityPitchMm,
      cavityInsetMm,
    },
  };
  const axisState = Object.fromEntries(
    Object.values(axes).map((axis) => {
      const custom = params.extraDefines[axis.irregularKey] === true;
      const dividers = custom
        ? parseDividers(
            params.extraDefines[axis.configKey],
            axis.cavityInsetMm,
            axis.lengthMm,
          )
        : getEqualDividerPositions(
            params[axis.chambersKey],
            axis.lengthMm,
            axis.cavityInsetMm,
            dividerThicknessMm,
          ).map((positionMm) => ({
            positionMm,
            serialized: formatPosition(positionMm - axis.cavityInsetMm),
          }));

      return [
        axis.axis,
        {
          custom,
          dividers,
          count: custom ? dividers.length + 1 : params[axis.chambersKey],
        },
      ];
    }),
  ) as Record<Axis, { custom: boolean; dividers: Divider[]; count: number }>;

  const updateAxis = (axis: AxisConfig, dividers: Divider[]) => {
    const nextDividers = dividers
      .filter(
        (divider) =>
          divider.positionMm > axis.cavityInsetMm &&
          divider.positionMm < axis.lengthMm - axis.cavityInsetMm,
      )
      .sort((left, right) => left.positionMm - right.positionMm);
    const custom = nextDividers.length > 0;

    onChange({
      ...params,
      [axis.chambersKey]: nextDividers.length + 1,
      extraDefines: {
        ...params.extraDefines,
        [axis.irregularKey]: custom,
        [axis.configKey]: serializeDividers(nextDividers),
      },
    });
  };

  const canAddDivider = (axisName: Axis) => {
    const axis = axes[axisName];
    const state = axisState[axisName];

    if (!state.custom) {
      const nextDividers = getEqualDividerPositions(
        state.count + 1,
        axis.lengthMm,
        axis.cavityInsetMm,
        dividerThicknessMm,
      ).map((positionMm) => ({ positionMm, serialized: "" }));

      return hasMinimumCompartmentSize(
        nextDividers,
        axis,
        dividerThicknessMm,
      );
    }

    return getCompartmentSpans(
      state.dividers,
      axis.cavityInsetMm,
      axis.lengthMm - axis.cavityInsetMm,
      dividerThicknessMm,
    ).some(
      (span) =>
        span.clearSize >=
        minimumCompartmentSizeMm * 2 + dividerThicknessMm,
    );
  };

  const setEqualCount = (axis: AxisConfig, count: number) => {
    const nextCount = Math.max(1, count);
    setSelectedDivider(null);
    onChange({
      ...params,
      [axis.chambersKey]: nextCount,
      extraDefines: {
        ...params.extraDefines,
        [axis.irregularKey]: false,
      },
    });
  };

  const toggleDivider = (axis: AxisConfig, positionMm: number) => {
    const dividers = axisState[axis.axis].dividers;
    const existing = dividers.find((divider) =>
      isSamePosition(divider.positionMm, positionMm),
    );

    if (existing) {
      setSelectedDivider(null);
      setPositionDraftMm("");
      updateAxis(
        axis,
        dividers.filter((divider) => divider !== existing),
      );
      return;
    }

    updateAxis(axis, [
      ...dividers,
      {
        positionMm,
        serialized: formatPosition(positionMm - axis.cavityInsetMm),
      },
    ]);
  };

  const selectDivider = (axis: Axis, divider: Divider) => {
    setSelectedDivider({ axis, positionMm: divider.positionMm });
    setPositionDraftMm(
      formatCompartmentValue(fromMillimeters(divider.positionMm, unit), unit),
    );
  };

  const selected = selectedDivider
    ? axisState[selectedDivider.axis].dividers.find((divider) =>
        isSamePosition(divider.positionMm, selectedDivider.positionMm),
      )
    : undefined;

  useEffect(() => {
    if (!selectedDivider) {
      return;
    }

    const deselectOnClickAway = (event: globalThis.PointerEvent) => {
      const target = event.target;

      if (
        !(target instanceof Element) ||
        target.closest(`.${styles.layoutDivider}`) ||
        target.closest(`.${styles.dividerEdgeRemove}`) ||
        target.closest(`.${styles.compartmentSpan}`) ||
        target.closest(`.${styles.selectedDividerEditor}`)
      ) {
        return;
      }

      setSelectedDivider(null);
      setPositionDraftMm("");
    };

    document.addEventListener("pointerdown", deselectOnClickAway);
    return () => document.removeEventListener("pointerdown", deselectOnClickAway);
  }, [selectedDivider]);

  const commitSpanSize = (axisName: Axis, index: number, draft: string) => {
    const requestedClearSize = toMillimeters(Number(draft), unit);
    const axis = axes[axisName];
    const dividers = axisState[axisName].dividers;
    const maxMm = axis.lengthMm;
    const boundaries = [
      axis.cavityInsetMm,
      ...dividers.map((divider) => divider.positionMm),
      maxMm - axis.cavityInsetMm,
    ];

    if (
      !Number.isFinite(requestedClearSize) ||
      requestedClearSize < minimumCompartmentSizeMm
    ) {
      return;
    }

    const dividerIndex = index < dividers.length ? index : index - 1;
    const divider = dividers[dividerIndex];

    if (!divider) {
      return;
    }

    const requestedCenterSpan =
      requestedClearSize +
      (index > 0 ? dividerThicknessMm / 2 : 0) +
      (index < dividers.length ? dividerThicknessMm / 2 : 0);
    const nextPosition =
      index < dividers.length
        ? boundaries[index] + requestedCenterSpan
        : maxMm - axis.cavityInsetMm - requestedCenterSpan;
    const minimum = boundaries[dividerIndex] + 1;
    const maximum = boundaries[dividerIndex + 2] - 1;

    if (nextPosition < minimum || nextPosition > maximum) {
      return;
    }

    const nextDividers = dividers.map((candidate) =>
      candidate === divider
        ? {
            positionMm: nextPosition,
            serialized: replaceSerializedPosition(
              candidate,
              nextPosition,
              axis.cavityInsetMm,
            ),
          }
        : candidate,
    );

    if (
      !hasMinimumCompartmentSize(
        nextDividers,
        axis,
        dividerThicknessMm,
      )
    ) {
      return;
    }

    setSelectedDivider({ axis: axisName, positionMm: nextPosition });
    setPositionDraftMm(
      formatCompartmentValue(fromMillimeters(nextPosition, unit), unit),
    );
    updateAxis(axis, nextDividers);
  };

  const commitSelectedPosition = () => {
    if (!selectedDivider || !selected) {
      return;
    }

    const axis = axes[selectedDivider.axis];
    const nextPositionMm = toMillimeters(Number(positionDraftMm), unit);

    if (
      !Number.isFinite(nextPositionMm) ||
      nextPositionMm <= axis.cavityInsetMm ||
      nextPositionMm >= axis.lengthMm - axis.cavityInsetMm
    ) {
      setPositionDraftMm(
        formatCompartmentValue(fromMillimeters(selected.positionMm, unit), unit),
      );
      return;
    }

    const nextDividers = axisState[selectedDivider.axis].dividers
      .filter(
        (divider) =>
          divider === selected ||
          !isSamePosition(divider.positionMm, nextPositionMm),
      )
      .map((divider) =>
        divider === selected
          ? {
              positionMm: nextPositionMm,
              serialized: replaceSerializedPosition(
                divider,
                nextPositionMm,
                axis.cavityInsetMm,
              ),
            }
          : divider,
      );

    if (
      !hasMinimumCompartmentSize(
        nextDividers,
        axis,
        dividerThicknessMm,
      )
    ) {
      setPositionDraftMm(
        formatCompartmentValue(fromMillimeters(selected.positionMm, unit), unit),
      );
      return;
    }

    setSelectedDivider({
      axis: selectedDivider.axis,
      positionMm: nextPositionMm,
    });
    setPositionDraftMm(
      formatCompartmentValue(fromMillimeters(nextPositionMm, unit), unit),
    );
    updateAxis(axis, nextDividers);
  };

  const addDivider = (axisName: Axis) => {
    const axis = axes[axisName];
    const currentCount = axisState[axisName].count;

    if (!canAddDivider(axisName)) {
      return;
    }

    if (!axisState[axisName].custom) {
      setEqualCount(axis, currentCount + 1);
      return;
    }

    const maxMm = axis.lengthMm;
    const spans = getCompartmentSpans(
      axisState[axisName].dividers,
      axis.cavityInsetMm,
      maxMm - axis.cavityInsetMm,
      dividerThicknessMm,
    );
    const largestSpan = spans.reduce((largest, span) =>
      span.clearSize > largest.clearSize ? span : largest,
    );
    const spanIndex = spans.indexOf(largestSpan);
    const leadingDividerInset =
      spanIndex > 0 ? dividerThicknessMm / 2 : 0;
    const nextClearSize =
      (largestSpan.clearSize - dividerThicknessMm) / 2;
    const positionMm =
      largestSpan.start +
      leadingDividerInset +
      nextClearSize +
      dividerThicknessMm / 2;

    const divider = {
      positionMm,
      serialized: formatPosition(positionMm - axis.cavityInsetMm),
    };
    updateAxis(axis, [...axisState[axisName].dividers, divider]);
    selectDivider(axisName, divider);
  };

  const addDividerAt = (axisName: Axis, positionMm: number) => {
    const axis = axes[axisName];
    const dividers = axisState[axisName].dividers;

    if (
      disabled ||
      !hasMinimumCompartmentSize(
        [
          ...dividers,
          {
            positionMm,
            serialized: formatPosition(positionMm - axis.cavityInsetMm),
          },
        ],
        axis,
        dividerThicknessMm,
      ) ||
      dividers.some(
        (divider) => Math.abs(divider.positionMm - positionMm) < 1,
      )
    ) {
      return;
    }

    const divider = {
      positionMm,
      serialized: formatPosition(positionMm - axis.cavityInsetMm),
    };
    updateAxis(axis, [...dividers, divider]);
    selectDivider(axisName, divider);
    setHoverDivider(null);
  };

  const getPointerDivider = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target;

    if (
      disabled ||
      draggingAxis ||
      !(target instanceof Element) ||
      target.closest("button, input")
    ) {
      return null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const yRatio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const snapRailDepthPx = 24;
    const snapHitRadiusPx = 12;
    const snapHits = smartSnapFractions.flatMap((snap) => {
      const hits: { axis: Axis; distance: number; positionMm: number }[] = [];
      const bottomDistance = rect.bottom - event.clientY;
      const bottomPositionMm = getSmartSnapPositionMm(
        snap,
        axes.x,
        dividerThicknessMm,
      );
      const bottomTickX =
        rect.left + (bottomPositionMm / axes.x.lengthMm) * rect.width;
      const bottomTickDistance = Math.abs(event.clientX - bottomTickX);

      if (
        bottomDistance >= 0 &&
        bottomDistance <= snapRailDepthPx &&
        bottomTickDistance <= snapHitRadiusPx
      ) {
        hits.push({
          axis: "x",
          distance: Math.hypot(bottomTickDistance, bottomDistance),
          positionMm: bottomPositionMm,
        });
      }

      const rightDistance = rect.right - event.clientX;
      const rightPositionMm = getSmartSnapPositionMm(
        snap,
        axes.y,
        dividerThicknessMm,
      );
      const rightTickY =
        rect.top + (1 - rightPositionMm / axes.y.lengthMm) * rect.height;
      const rightTickDistance = Math.abs(event.clientY - rightTickY);

      if (
        rightDistance >= 0 &&
        rightDistance <= snapRailDepthPx &&
        rightTickDistance <= snapHitRadiusPx
      ) {
        hits.push({
          axis: "y",
          distance: Math.hypot(rightDistance, rightTickDistance),
          positionMm: rightPositionMm,
        });
      }

      return hits;
    });
    const closestSnapHit = snapHits.reduce<
      { axis: Axis; distance: number; positionMm: number } | undefined
    >(
      (closest, hit) =>
        !closest || hit.distance < closest.distance ? hit : closest,
      undefined,
    );
    const previousPointerPosition = lastPointerPosition.current;
    const deltaX = previousPointerPosition
      ? event.clientX - previousPointerPosition.x
      : 0;
    const deltaY = previousPointerPosition
      ? event.clientY - previousPointerPosition.y
      : 0;
    const hasDirectionalMovement = Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 2;
    const axisName: Axis =
      closestSnapHit?.axis ??
      (hasDirectionalMovement
        ? Math.abs(deltaX) >= Math.abs(deltaY)
          ? "x"
          : "y"
        : hoverDivider?.axis ?? "x");
    lastPointerPosition.current = { x: event.clientX, y: event.clientY };
    const axis = axes[axisName];
    const rawPositionMm = closestSnapHit
      ? closestSnapHit.positionMm
      : (axisName === "x" ? xRatio : 1 - yRatio) * axis.lengthMm;
    const roundedPositionMm = closestSnapHit
      ? rawPositionMm
      : Math.round(rawPositionMm * 10) / 10;
    const positionMm = Math.min(
      axis.lengthMm - axis.cavityInsetMm - 1,
      Math.max(axis.cavityInsetMm + 1, roundedPositionMm),
    );
    const candidateDivider = {
      positionMm,
      serialized: formatPosition(positionMm - axis.cavityInsetMm),
    };
    const unavailable =
      !hasMinimumCompartmentSize(
        [...axisState[axisName].dividers, candidateDivider],
        axis,
        dividerThicknessMm,
      ) ||
      axisState[axisName].dividers.some(
        (divider) => Math.abs(divider.positionMm - positionMm) < 1,
      );

    return unavailable ? null : { axis: axisName, positionMm };
  };

  const moveDivider = (
    axisName: Axis,
    divider: Divider,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const surface = event.currentTarget.parentElement;

    if (!surface) {
      return;
    }

    const axis = axes[axisName];
    const maxMm = axis.lengthMm;
    const rect = surface.getBoundingClientRect();
    const ratio =
      axisName === "x"
        ? (event.clientX - rect.left) / rect.width
        : 1 - (event.clientY - rect.top) / rect.height;
    const increment = 0.1;
    let requestedPosition =
      Math.round((ratio * maxMm) / increment) * increment;
    const axisLength = axisName === "x" ? rect.width : rect.height;
    const snapToleranceMm = (10 / axisLength) * maxMm;
    const pointerInSnapRail =
      axisName === "x"
        ? rect.bottom - event.clientY <= 22
        : rect.right - event.clientX <= 22;

    if (pointerInSnapRail) {
      const snapPositions = smartSnapFractions.map((snap) =>
        getSmartSnapPositionMm(snap, axis, dividerThicknessMm),
      );
      const closestSnapPosition = snapPositions.reduce((closest, positionMm) =>
        Math.abs(positionMm - requestedPosition) <
        Math.abs(closest - requestedPosition)
          ? positionMm
          : closest,
      );

      if (
        Math.abs(closestSnapPosition - requestedPosition) <=
        snapToleranceMm
      ) {
        requestedPosition = closestSnapPosition;
      }
    }
    const dividers = axisState[axisName].dividers;
    const dividerIndex = dividers.findIndex((candidate) =>
      isSamePosition(candidate.positionMm, divider.positionMm),
    );
    const minimum =
      dividerIndex > 0
        ? dividers[dividerIndex - 1].positionMm +
          dividerThicknessMm +
          minimumCompartmentSizeMm
        : axis.cavityInsetMm +
          dividerThicknessMm / 2 +
          minimumCompartmentSizeMm;
    const maximum =
      dividerIndex < dividers.length - 1
        ? dividers[dividerIndex + 1].positionMm -
          dividerThicknessMm -
          minimumCompartmentSizeMm
        : maxMm -
          axis.cavityInsetMm -
          dividerThicknessMm / 2 -
          minimumCompartmentSizeMm;

    if (minimum > maximum) {
      return;
    }
    const positionMm = Math.min(maximum, Math.max(minimum, requestedPosition));

    if (isSamePosition(positionMm, divider.positionMm)) {
      return;
    }

    const nextDividers = dividers.map((candidate) =>
      candidate === divider
        ? {
            positionMm,
            serialized: replaceSerializedPosition(
              candidate,
              positionMm,
              axis.cavityInsetMm,
            ),
          }
        : candidate,
    );

    setSelectedDivider({ axis: axisName, positionMm });
    setHoveredExistingDivider({ axis: axisName, positionMm });
    setPositionDraftMm(
      formatCompartmentValue(fromMillimeters(positionMm, unit), unit),
    );
    updateAxis(axis, nextDividers);
  };

  return (
    <div
      className={styles.compartmentEditor}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape" || !selectedDivider) {
          return;
        }

        event.preventDefault();
        setSelectedDivider(null);
        setPositionDraftMm("");
        if (
          event.target instanceof HTMLElement &&
          !(event.target instanceof HTMLInputElement)
        ) {
          event.target.blur();
        }
      }}
    >
      <div className={styles.compartmentEditorHeader}>
        <div>
          <strong>Compartment Layout</strong>
          <span>Move across empty space to choose a divider, then click.</span>
        </div>
        <b>{axisState.x.count * axisState.y.count} total</b>
      </div>

      <UnitPicker
        ariaLabel="Compartment units"
        value={unit}
        options={compartmentUnitOptions}
        onChange={(nextUnit) => {
          setSelectedDivider(null);
          setSpanDraft(null);
          setPositionDraftMm("");
          onUnitChange(nextUnit);
        }}
      />

      <div className={styles.layoutStage}>
        <div
          aria-label="Compartment layout"
          className={`${styles.layoutCanvas} ${
            axes.y.lengthMm > axes.x.lengthMm
              ? styles.layoutCanvasTall
              : styles.layoutCanvasWide
          } ${disabled ? styles.layoutCanvasDisabled : ""}`}
          role="group"
          style={{ aspectRatio: `${axes.x.lengthMm} / ${axes.y.lengthMm}` }}
          onPointerLeave={() => setHoveredExistingDivider(null)}
        >
        <div
          className={styles.layoutSurface}
          data-testid="compartment-surface"
          onPointerDown={(event) => {
            const nextDivider = getPointerDivider(event);
            if (nextDivider) {
              event.preventDefault();
              addDividerAt(nextDivider.axis, nextDivider.positionMm);
            }
          }}
          onPointerLeave={() => {
            lastPointerPosition.current = null;
            setHoverDivider(null);
          }}
          onPointerMove={(event) => setHoverDivider(getPointerDivider(event))}
        >
          {hoverDivider ? (
            <span
              aria-hidden="true"
              className={`${styles.layoutLine} ${styles.layoutDividerPreview} ${styles[`layout${hoverDivider.axis.toUpperCase()}`]}`}
              style={{
                [hoverDivider.axis === "x" ? "left" : "top"]:
                  `${
                    (hoverDivider.axis === "x"
                      ? hoverDivider.positionMm /
                        axes[hoverDivider.axis].lengthMm
                      : 1 -
                        hoverDivider.positionMm /
                          axes[hoverDivider.axis].lengthMm) * 100
                  }%`,
              }}
            >
              <Plus size={13} />
            </span>
          ) : null}
          {(["x", "y"] as const).flatMap((axisName) =>
            smartSnapFractions.map((snap) => {
              const axis = axes[axisName];
              const positionRatio =
                getSmartSnapPositionMm(snap, axis, dividerThicknessMm) /
                axis.lengthMm;

              return (
                <span
                  aria-hidden="true"
                  className={`${styles.edgeSnap} ${styles[`edgeSnap${axisName.toUpperCase()}`]} ${draggingAxis === axisName ? styles.edgeSnapActive : ""}`}
                  key={`edge-${axisName}-${snap.label}`}
                  style={{
                    [axisName === "x" ? "left" : "top"]:
                      `${(axisName === "x" ? positionRatio : 1 - positionRatio) * 100}%`,
                  }}
                >
                  {snap.label}
                </span>
              );
            }),
          )}
          {(["x", "y"] as const).flatMap((axisName) => {
            const maxMm = axes[axisName].lengthMm;
            const spans = getCompartmentSpans(
              axisState[axisName].dividers,
              axes[axisName].cavityInsetMm,
              maxMm - axes[axisName].cavityInsetMm,
              dividerThicknessMm,
            );

            return spans.map((span, index) => {
              const isEditing =
                spanDraft?.axis === axisName && spanDraft.index === index;
              const measurementValue = isEditing
                ? spanDraft.value
                : formatCompartmentValue(
                    fromMillimeters(span.clearSize, unit),
                    unit,
                  );
              const measurementWidthCh = Math.min(
                7,
                Math.max(4, measurementValue.length),
              );

              return (
              <label
                className={`${styles.compartmentSpan} ${styles[`compartmentSpan${axisName.toUpperCase()}`]}`}
                key={`span-${axisName}-${index}`}
                style={
                  axisName === "x"
                    ? {
                        left: `${(span.start / maxMm) * 100}%`,
                        width: `${(span.size / maxMm) * 100}%`,
                      }
                    : {
                        top: `${(1 - (span.start + span.size) / maxMm) * 100}%`,
                        height: `${(span.size / maxMm) * 100}%`,
                      }
                }
              >
                <span className={styles.compartmentMeasurement}>
                  <input
                    aria-label={`${axisName.toUpperCase()} compartment ${index + 1} size ${unit}`}
                    disabled={disabled}
                    inputMode="decimal"
                    style={{ width: `${measurementWidthCh}ch` }}
                    type="text"
                    value={measurementValue}
                    onBlur={() => {
                      if (isEditing) {
                        commitSpanSize(axisName, index, spanDraft.value);
                      }
                      setSpanDraft(null);
                    }}
                    onChange={(event) =>
                      setSpanDraft({
                        axis: axisName,
                        index,
                        value: event.target.value,
                      })
                    }
                    onFocus={(event) =>
                      setSpanDraft({
                        axis: axisName,
                        index,
                        value: event.target.value,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                      if (event.key === "Escape") {
                        setSpanDraft(null);
                        event.currentTarget.blur();
                      }
                    }}
                  />
                </span>
              </label>
              );
            });
          })}
          {(["x", "y"] as const).flatMap((axisName) => {
            const maxMm = axes[axisName].lengthMm;
            const dividers = axisState[axisName].dividers;

            return dividers.map((divider, index) => {
              const isSelected =
                selectedDivider?.axis === axisName &&
                isSamePosition(
                  selectedDivider.positionMm,
                  divider.positionMm,
                );

              return (
                <button
                  aria-label={`Select ${dividerOrientation(axisName)} divider at ${positionLabel(divider.positionMm, unit)}`}
                  aria-pressed={isSelected}
                  className={`${styles.layoutLine} ${styles.layoutDivider} ${styles[`layout${axisName.toUpperCase()}`]}`}
                  data-dragging={draggingAxis === axisName || undefined}
                  disabled={disabled}
                  key={`divider-${axisName}-${index}`}
                  style={{
                    [axisName === "x" ? "left" : "top"]:
                      `${
                        (axisName === "x"
                          ? divider.positionMm / maxMm
                          : 1 - divider.positionMm / maxMm) * 100
                      }%`,
                  }}
                  title={`${dividerOrientation(axisName)} divider at ${positionLabel(divider.positionMm, unit)}`}
                  type="button"
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDraggingAxis(axisName);
                    selectDivider(axisName, divider);
                  }}
                  onPointerEnter={() => {
                    setHoverDivider(null);
                    setHoveredExistingDivider({
                      axis: axisName,
                      positionMm: divider.positionMm,
                    });
                  }}
                  onPointerMove={(event) =>
                    moveDivider(axisName, divider, event)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      selectDivider(axisName, divider);
                    }
                  }}
                  onPointerCancel={() => setDraggingAxis(null)}
                  onPointerUp={() => setDraggingAxis(null)}
                />
              );
            });
          })}
        </div>
        <div className={styles.axisControls}>
          <button
            aria-label="Add X divider"
            className={`${styles.axisControl} ${styles.axisControlX}`}
            disabled={disabled || !canAddDivider("y")}
            title={
              canAddDivider("y")
                ? "Add a horizontal divider"
                : "Compartments must remain at least 19 mm wide"
            }
            type="button"
            onClick={() => addDivider("y")}
          >
            <span className={styles.axisControlLabel}>X</span>
            <span className={styles.axisControlPlus}>
              <Plus aria-hidden="true" size={12} />
            </span>
          </button>
          <button
            aria-label="Add Y divider"
            className={`${styles.axisControl} ${styles.axisControlY}`}
            disabled={disabled || !canAddDivider("x")}
            title={
              canAddDivider("x")
                ? "Add a vertical divider"
                : "Compartments must remain at least 19 mm wide"
            }
            type="button"
            onClick={() => addDivider("x")}
          >
            <span className={styles.axisControlLabel}>Y</span>
            <span className={styles.axisControlPlus}>
              <Plus aria-hidden="true" size={12} />
            </span>
          </button>
        </div>
        {(["x", "y"] as const).flatMap((axisName) => {
          const maxMm = axes[axisName].lengthMm;

          return axisState[axisName].dividers.map((divider, index) => {
            const isHovered =
              hoveredExistingDivider?.axis === axisName &&
              isSamePosition(
                hoveredExistingDivider.positionMm,
                divider.positionMm,
              );

            return isHovered ? (
              <button
                aria-label={`Remove ${dividerOrientation(axisName)} divider at ${positionLabel(divider.positionMm, unit)}`}
                className={`${styles.dividerEdgeRemove} ${styles[`dividerEdgeRemove${axisName.toUpperCase()}`]}`}
                disabled={disabled}
                key={`remove-${axisName}-${index}`}
                style={{
                  [axisName === "x" ? "left" : "top"]:
                    `${
                      (axisName === "x"
                        ? divider.positionMm / maxMm
                        : 1 - divider.positionMm / maxMm) * 100
                    }%`,
                }}
                title={`Remove ${dividerOrientation(axisName)} divider at ${positionLabel(divider.positionMm, unit)}`}
                type="button"
                onClick={() => {
                  toggleDivider(axes[axisName], divider.positionMm);
                  setHoveredExistingDivider(null);
                }}
                onPointerEnter={() =>
                  setHoveredExistingDivider({
                    axis: axisName,
                    positionMm: divider.positionMm,
                  })
                }
              >
                <X aria-hidden="true" size={11} />
              </button>
            ) : null;
          });
        })}
      </div>
      </div>

      {selectedDivider && selected ? (
        <div className={styles.selectedDividerEditor}>
          <label>
            <span>{dividerOrientation(selectedDivider.axis)} position</span>
            <div>
              <input
                aria-label={`${dividerOrientation(selectedDivider.axis)} divider position ${unit}`}
                disabled={disabled}
                inputMode="decimal"
                max={fromMillimeters(
                  axes[selectedDivider.axis].lengthMm -
                    axes[selectedDivider.axis].cavityInsetMm,
                  unit,
                )}
                min={fromMillimeters(
                  axes[selectedDivider.axis].cavityInsetMm,
                  unit,
                )}
                step={compartmentUnitStep(unit)}
                type="number"
                value={positionDraftMm}
                onBlur={commitSelectedPosition}
                onChange={(event) => setPositionDraftMm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              <small>{unit}</small>
            </div>
          </label>
          <button
            aria-label={`Remove ${dividerOrientation(selectedDivider.axis)} divider`}
            disabled={disabled}
            title={`Remove ${dividerOrientation(selectedDivider.axis)} divider`}
            type="button"
            onClick={() =>
              toggleDivider(axes[selectedDivider.axis], selected.positionMm)
            }
          >
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
