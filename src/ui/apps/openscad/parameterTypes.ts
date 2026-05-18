import type { OpenScadDefineValue } from "@/shared/openscad-defines";

export type ParameterOptionBase = {
  key: string;
  label: string;
  fullWidth?: boolean;
};

export type UnitSuffix = string | readonly (string | undefined)[];

export type ParameterOption =
  | (ParameterOptionBase & {
      type: "boolean";
    })
  | (ParameterOptionBase & {
      type: "number";
      min?: number;
      max?: number;
      step?: number;
      suffix?: string;
    })
  | (ParameterOptionBase & {
      type: "text";
    })
  | (ParameterOptionBase & {
      type: "select";
      options: readonly { value: string | number; label: string }[];
    })
  | (ParameterOptionBase & {
      type: "tuple";
      labels?: readonly string[];
      valueKind?: "number" | "boolean" | "fingerSlideSides";
      step?: number;
      suffix?: UnitSuffix;
    });

export type ParameterOptionGroup = {
  title: string;
  columns?: boolean;
  options: readonly ParameterOption[];
};

export type ParameterOptionValue = OpenScadDefineValue | undefined;
