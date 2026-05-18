export type OpenScadDefineValue =
  | string
  | number
  | boolean
  | readonly OpenScadDefineValue[];

export function formatScadValue(value: OpenScadDefineValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatScadValue(item)).join(", ")}]`;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "0";
  }

  return JSON.stringify(value);
}
