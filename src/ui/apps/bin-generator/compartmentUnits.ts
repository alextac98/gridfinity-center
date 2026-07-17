export type CompartmentUnit = "mm" | "in" | "u";

const millimetersPerUnit: Record<CompartmentUnit, number> = {
  mm: 1,
  in: 25.4,
  u: 42,
};

export const compartmentUnitOptions = [
  { value: "mm", label: "mm", ariaLabel: "Millimeters" },
  { value: "in", label: "in", ariaLabel: "Inches" },
  { value: "u", label: "u", ariaLabel: "Grid units" },
] as const;

export function fromMillimeters(value: number, unit: CompartmentUnit) {
  return value / millimetersPerUnit[unit];
}

export function toMillimeters(value: number, unit: CompartmentUnit) {
  return value * millimetersPerUnit[unit];
}

export function formatCompartmentValue(
  value: number,
  unit: CompartmentUnit,
) {
  const precision = unit === "mm" ? 3 : unit === "in" ? 3 : 4;
  return String(Number(value.toFixed(precision)));
}

export function compartmentUnitStep(unit: CompartmentUnit) {
  return unit === "mm" ? 0.1 : 0.01;
}
