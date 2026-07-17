"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type PointerEvent } from "react";
import type {
  OpenScadDefineValue,
} from "@/shared/gridfinityExtended";
import type { BinGeneratorSettings } from "./binOptions";
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
const positionToleranceMm = 0.01;
const smartSnapFractions = [
  { value: 1 / 4, label: "¼" },
  { value: 1 / 3, label: "⅓" },
  { value: 1 / 2, label: "½" },
  { value: 2 / 3, label: "⅔" },
  { value: 3 / 4, label: "¾" },
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
  units: number;
};

type CompartmentLayoutEditorProps = {
  params: BinGeneratorSettings;
  unit: CompartmentUnit;
  disabled?: boolean;
  onUnitChange: (unit: CompartmentUnit) => void;
  onChange: (params: BinGeneratorSettings) => void;
};

function parseDividers(value: OpenScadDefineValue | undefined, maxMm: number) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split("|")
    .map((serialized) => ({
      positionMm: Number(serialized.split(",")[0]?.trim()),
      serialized: serialized.trim(),
    }))
    .filter(
      (divider) =>
        Number.isFinite(divider.positionMm) &&
        divider.positionMm > 0 &&
        divider.positionMm < maxMm,
    )
    .sort((left, right) => left.positionMm - right.positionMm);
}

function formatPosition(value: number) {
  return String(Number(value.toFixed(3)));
}

function replaceSerializedPosition(divider: Divider, positionMm: number) {
  const parts = divider.serialized.split(",");
  parts[0] = formatPosition(positionMm);
  return parts.join(",");
}

function serializeDividers(dividers: Divider[]) {
  return [...dividers]
    .sort((left, right) => left.positionMm - right.positionMm)
    .map((divider) => divider.serialized)
    .join("|");
}

function getEqualDividerPositions(chambers: number, units: number) {
  return Array.from({ length: Math.max(0, chambers - 1) }, (_, index) =>
    ((index + 1) * units * gridfinityPitchMm) / chambers,
  );
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

  const topThickness = value[1] ?? value[0];
  return typeof topThickness === "number" && Number.isFinite(topThickness)
    ? Math.max(0, topThickness)
    : 0;
}

function getCompartmentSpans(
  dividers: Divider[],
  maxMm: number,
  dividerThicknessMm: number,
) {
  const boundaries = [0, ...dividers.map((divider) => divider.positionMm), maxMm];

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
  const [spanDraft, setSpanDraft] = useState<{
    axis: Axis;
    index: number;
    value: string;
  } | null>(null);
  const axes: Record<Axis, AxisConfig> = {
    x: {
      axis: "x",
      chambersKey: "verticalChambers",
      configKey: "vertical_separator_config",
      irregularKey: "vertical_irregular_subdivisions",
      units: params.widthUnits,
    },
    y: {
      axis: "y",
      chambersKey: "horizontalChambers",
      configKey: "horizontal_separator_config",
      irregularKey: "horizontal_irregular_subdivisions",
      units: params.depthUnits,
    },
  };
  const axisState = Object.fromEntries(
    Object.values(axes).map((axis) => {
      const custom = params.extraDefines[axis.irregularKey] === true;
      const dividers = custom
        ? parseDividers(
            params.extraDefines[axis.configKey],
            axis.units * gridfinityPitchMm,
          )
        : getEqualDividerPositions(params[axis.chambersKey], axis.units).map(
            (positionMm) => ({
              positionMm,
              serialized: formatPosition(positionMm),
            }),
          );

      return [axis.axis, { custom, dividers }];
    }),
  ) as Record<Axis, { custom: boolean; dividers: Divider[] }>;
  const dividerThicknessMm = getDividerThicknessMm(
    params.extraDefines.chamber_wall_thickness,
  );

  const updateAxis = (axis: AxisConfig, dividers: Divider[]) => {
    const nextDividers = dividers
      .filter(
        (divider) =>
          divider.positionMm > 0 &&
          divider.positionMm < axis.units * gridfinityPitchMm,
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

  const setEqualCount = (axis: AxisConfig, count: number) => {
    const nextCount = Math.min(8, Math.max(1, count));
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
      { positionMm, serialized: formatPosition(positionMm) },
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
    const maxMm = axis.units * gridfinityPitchMm;
    const boundaries = [
      0,
      ...dividers.map((divider) => divider.positionMm),
      maxMm,
    ];

    if (!Number.isFinite(requestedClearSize) || requestedClearSize < 1) {
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
        : maxMm - requestedCenterSpan;
    const minimum = boundaries[dividerIndex] + 1;
    const maximum = boundaries[dividerIndex + 2] - 1;

    if (nextPosition < minimum || nextPosition > maximum) {
      return;
    }

    const nextDividers = dividers.map((candidate) =>
      candidate === divider
        ? {
            positionMm: nextPosition,
            serialized: replaceSerializedPosition(candidate, nextPosition),
          }
        : candidate,
    );

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
      nextPositionMm <= 0 ||
      nextPositionMm >= axis.units * gridfinityPitchMm
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
              serialized: replaceSerializedPosition(divider, nextPositionMm),
            }
          : divider,
      );

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
    const currentCount = params[axis.chambersKey];

    if (currentCount >= 8) {
      return;
    }

    if (!axisState[axisName].custom) {
      setEqualCount(axis, currentCount + 1);
      return;
    }

    const maxMm = axis.units * gridfinityPitchMm;
    const spans = getCompartmentSpans(
      axisState[axisName].dividers,
      maxMm,
      dividerThicknessMm,
    );
    const largestSpan = spans.reduce((largest, span) =>
      span.size > largest.size ? span : largest,
    );
    const positionMm = largestSpan.start + largestSpan.size / 2;

    const divider = {
      positionMm,
      serialized: formatPosition(positionMm),
    };
    updateAxis(axis, [...axisState[axisName].dividers, divider]);
    selectDivider(axisName, divider);
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
    const maxMm = axis.units * gridfinityPitchMm;
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
      const closestSnap = smartSnapFractions.reduce((closest, snap) =>
        Math.abs(snap.value * maxMm - requestedPosition) <
        Math.abs(closest.value * maxMm - requestedPosition)
          ? snap
          : closest,
      );

      if (
        Math.abs(closestSnap.value * maxMm - requestedPosition) <=
        snapToleranceMm
      ) {
        requestedPosition = closestSnap.value * maxMm;
      }
    }
    const dividers = axisState[axisName].dividers;
    const dividerIndex = dividers.findIndex((candidate) =>
      isSamePosition(candidate.positionMm, divider.positionMm),
    );
    const minimum = dividerIndex > 0 ? dividers[dividerIndex - 1].positionMm + 1 : 1;
    const maximum =
      dividerIndex < dividers.length - 1
        ? dividers[dividerIndex + 1].positionMm - 1
        : maxMm - 1;
    const positionMm = Math.min(maximum, Math.max(minimum, requestedPosition));

    if (isSamePosition(positionMm, divider.positionMm)) {
      return;
    }

    const nextDividers = dividers.map((candidate) =>
      candidate === divider
        ? {
            positionMm,
            serialized: replaceSerializedPosition(candidate, positionMm),
          }
        : candidate,
    );

    setSelectedDivider({ axis: axisName, positionMm });
    setPositionDraftMm(
      formatCompartmentValue(fromMillimeters(positionMm, unit), unit),
    );
    updateAxis(axis, nextDividers);
  };

  return (
    <div className={styles.compartmentEditor}>
      <div className={styles.compartmentEditorHeader}>
        <div>
          <strong>Compartment Layout</strong>
          <span>Drag freely inside. Move to an edge to snap.</span>
        </div>
        <b>{params.verticalChambers * params.horizontalChambers} total</b>
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
            params.depthUnits > params.widthUnits
              ? styles.layoutCanvasTall
              : styles.layoutCanvasWide
          } ${disabled ? styles.layoutCanvasDisabled : ""}`}
          role="group"
          style={{ aspectRatio: `${params.widthUnits} / ${params.depthUnits}` }}
        >
        <button
          aria-label="Add X divider"
          className={`${styles.axisAddButton} ${styles.axisAddButtonX}`}
          disabled={disabled || params.horizontalChambers >= 8}
          title="Add an X divider"
          type="button"
          onClick={() => addDivider("y")}
        >
          <span className={styles.axisAddLabel}>X</span>
          <i aria-hidden="true" />
          <Plus aria-hidden="true" size={16} />
          <i aria-hidden="true" />
        </button>
        <button
          aria-label="Add Y divider"
          className={`${styles.axisAddButton} ${styles.axisAddButtonY}`}
          disabled={disabled || params.verticalChambers >= 8}
          title="Add a Y divider"
          type="button"
          onClick={() => addDivider("x")}
        >
          <span className={styles.axisAddLabel}>Y</span>
          <i aria-hidden="true" />
          <Plus aria-hidden="true" size={16} />
          <i aria-hidden="true" />
        </button>
        <div className={styles.layoutSurface} data-testid="compartment-surface">
          {(["x", "y"] as const).flatMap((axisName) =>
            smartSnapFractions.map((snap) => (
              <span
                aria-hidden="true"
                className={`${styles.edgeSnap} ${styles[`edgeSnap${axisName.toUpperCase()}`]} ${draggingAxis === axisName ? styles.edgeSnapActive : ""}`}
                key={`edge-${axisName}-${snap.label}`}
                style={{
                  [axisName === "x" ? "left" : "top"]:
                    `${(axisName === "x" ? snap.value : 1 - snap.value) * 100}%`,
                }}
              >
                {snap.label}
              </span>
            )),
          )}
          {(["x", "y"] as const).flatMap((axisName) => {
            const maxMm = axes[axisName].units * gridfinityPitchMm;
            const spans = getCompartmentSpans(
              axisState[axisName].dividers,
              maxMm,
              dividerThicknessMm,
            );

            return spans.map((span, index) => {
              const isEditing =
                spanDraft?.axis === axisName && spanDraft.index === index;

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
                    type="text"
                    value={
                      isEditing
                        ? spanDraft.value
                        : formatCompartmentValue(
                            fromMillimeters(span.clearSize, unit),
                            unit,
                          )
                    }
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
            const maxMm = axes[axisName].units * gridfinityPitchMm;
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
        {(["x", "y"] as const).flatMap((axisName) => {
          const maxMm = axes[axisName].units * gridfinityPitchMm;

          return axisState[axisName].dividers.map((divider, index) => {
            const isSelected =
              selectedDivider?.axis === axisName &&
              isSamePosition(
                selectedDivider.positionMm,
                divider.positionMm,
              );

            return isSelected ? (
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
                onClick={() =>
                  toggleDivider(axes[axisName], divider.positionMm)
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
            <span>{dividerOrientation(selectedDivider.axis)} divider position</span>
            <div>
              <input
                aria-label={`${dividerOrientation(selectedDivider.axis)} divider position ${unit}`}
                disabled={disabled}
                inputMode="decimal"
                max={fromMillimeters(
                  axes[selectedDivider.axis].units * gridfinityPitchMm,
                  unit,
                )}
                min={0}
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
            <em>
              {formatCompartmentValue(
                fromMillimeters(selected.positionMm, unit),
                unit,
              )} {unit} from
              the {selectedDivider.axis === "x" ? "left" : "front"} edge
            </em>
          </label>
          <button
            aria-label={`Remove ${dividerOrientation(selectedDivider.axis)} divider`}
            disabled={disabled}
            type="button"
            onClick={() =>
              toggleDivider(axes[selectedDivider.axis], selected.positionMm)
            }
          >
            <Trash2 aria-hidden="true" size={15} />
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}
