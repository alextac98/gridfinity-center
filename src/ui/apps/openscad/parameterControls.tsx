"use client";

import { ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { OpenScadDefineValue } from "@/shared/openscad-defines";
import type { ParameterOption, UnitSuffix } from "./parameterTypes";
import styles from "./generator.module.css";

type CollapsibleSectionProps = {
  title: string;
  columns?: boolean;
  defaultCollapsed?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children: ReactNode;
};

export function CollapsibleSection({
  title,
  columns = false,
  defaultCollapsed = false,
  expanded,
  onExpandedChange,
  children,
}: CollapsibleSectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(!defaultCollapsed);
  const isExpanded = expanded ?? internalExpanded;
  const setExpanded = onExpandedChange ?? setInternalExpanded;

  return (
    <section
      className={`${styles.formSection} ${isExpanded ? "" : styles.formSectionCollapsed}`}
    >
      <button
        aria-expanded={isExpanded}
        className={styles.sectionToggle}
        onClick={() => setExpanded(!isExpanded)}
        type="button"
      >
        <h3>{title}</h3>
        <ChevronUp
          aria-hidden="true"
          className={isExpanded ? "" : styles.sectionChevronCollapsed}
          size={16}
        />
      </button>
      {isExpanded ? (
        <div
          className={`${styles.sectionFields} ${columns ? styles.twoColumnFields : ""}`}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

type NumberInputFieldProps = {
  label: string;
  value: string | number;
  inputMode?: "decimal" | "numeric";
  type?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onEnter?: () => void;
};

export function NumberInputField({
  label,
  value,
  inputMode = "decimal",
  type = "text",
  min,
  max,
  step,
  suffix,
  fullWidth = false,
  disabled = false,
  onBlur,
  onChange,
  onEnter,
}: NumberInputFieldProps) {
  return (
    <label
      className={`${styles.field} ${fullWidth ? styles.fullWidthField : ""} ${
        disabled ? styles.fieldDisabled : ""
      }`}
    >
      <span>{label}</span>
      <div className={styles.inputWrap}>
        <input
          disabled={disabled}
          inputMode={inputMode}
          type={type}
          min={min}
          max={max}
          step={step}
          value={value}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onEnter?.();
              event.currentTarget.blur();
            }
          }}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix ? <small>{suffix}</small> : null}
      </div>
    </label>
  );
}

type SelectFieldProps<T extends string = string> = {
  label: string;
  value: T;
  options: readonly { value: string; label: string }[];
  fullWidth?: boolean;
  disabled?: boolean;
  onChange: (value: T) => void;
};

export function SelectField<T extends string = string>({
  label,
  value,
  options,
  fullWidth = false,
  disabled = false,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label
      className={`${styles.field} ${fullWidth ? styles.fullWidthField : ""} ${
        disabled ? styles.fieldDisabled : ""
      }`}
    >
      <span>{label}</span>
      <select
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type BooleanFieldProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onChange: (checked: boolean) => void;
};

export function BooleanField({
  label,
  checked,
  disabled = false,
  fullWidth = false,
  onChange,
}: BooleanFieldProps) {
  return (
    <div
      className={`${styles.field} ${fullWidth ? styles.fullWidthField : ""} ${
        disabled ? styles.fieldDisabled : ""
      }`}
    >
      <span>{label}</span>
      <label className={styles.booleanControl}>
        <input
          disabled={disabled}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <strong>{checked ? "Enabled" : "Disabled"}</strong>
      </label>
    </div>
  );
}

type TupleFieldProps = {
  label: string;
  value: readonly OpenScadDefineValue[];
  labels?: readonly string[];
  step?: number;
  suffix?: UnitSuffix;
  disabled?: boolean;
  onChange: (index: number, value: number) => void;
};

type BooleanTupleFieldProps = {
  label: string;
  value: readonly OpenScadDefineValue[];
  labels?: readonly string[];
  disabled?: boolean;
  onChange: (index: number, value: number) => void;
};

type FingerSlideSidesFieldProps = {
  label: string;
  value: readonly OpenScadDefineValue[];
  labels?: readonly string[];
  disabled?: boolean;
  onChange: (index: number, value: number) => void;
};

function getTupleSuffix(suffix: UnitSuffix | undefined, index: number) {
  return Array.isArray(suffix) ? suffix[index] : suffix;
}

function getTupleLabel(labels: readonly string[] | undefined, index: number) {
  return labels?.[index] ?? String(index + 1);
}

function getTupleAriaLabel(
  labels: readonly string[] | undefined,
  suffix: UnitSuffix | undefined,
  index: number,
) {
  const unit = getTupleSuffix(suffix, index);
  const label = getTupleLabel(labels, index);

  return unit ? `${label} ${unit}` : label;
}

export function TupleField({
  label,
  value,
  labels,
  step = 0.1,
  suffix,
  disabled = false,
  onChange,
}: TupleFieldProps) {
  return (
    <label
      className={`${styles.field} ${styles.tupleField} ${
        disabled ? styles.fieldDisabled : ""
      }`}
    >
      <span>{label}</span>
      <div className={styles.tupleGrid}>
        {value.map((tupleValue, index) => {
          const tupleLabel = getTupleLabel(labels, index);
          const tupleSuffix = getTupleSuffix(suffix, index);
          const ariaLabel = getTupleAriaLabel(labels, suffix, index);

          return (
            <div className={styles.tupleItem} key={`${label}-${index}`}>
              <span className={styles.tupleSubLabel}>{tupleLabel}</span>
              <div className={styles.inputWrap}>
                <input
                  disabled={disabled}
                  inputMode="decimal"
                  type="number"
                  step={step}
                  value={typeof tupleValue === "number" ? tupleValue : 0}
                  aria-label={`${label} ${ariaLabel}`}
                  onChange={(event) => onChange(index, Number(event.target.value))}
                />
                {tupleSuffix ? <small>{tupleSuffix}</small> : null}
              </div>
            </div>
          );
        })}
      </div>
    </label>
  );
}

export function BooleanTupleField({
  label,
  value,
  labels,
  disabled = false,
  onChange,
}: BooleanTupleFieldProps) {
  return (
    <div
      className={`${styles.field} ${styles.tupleField} ${
        disabled ? styles.fieldDisabled : ""
      }`}
    >
      <span>{label}</span>
      <div className={styles.tupleGrid}>
        {value.map((tupleValue, index) => {
          const tupleLabel = getTupleLabel(labels, index);
          const checked =
            tupleValue === true ||
            (typeof tupleValue === "number" && tupleValue !== 0);

          return (
            <BooleanField
              key={`${label}-${index}`}
              label={tupleLabel}
              checked={checked}
              disabled={disabled}
              onChange={(nextChecked) => onChange(index, nextChecked ? 1 : 0)}
            />
          );
        })}
      </div>
    </div>
  );
}

function getNumericTupleValue(value: OpenScadDefineValue) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return value === true ? 1 : 0;
}

function getSideName(label: string) {
  return label.replace(/^Enable On /, "");
}

function getCustomSideRadiusValue(value: number) {
  return value !== 0 && value !== 1 ? value : 8;
}

export function FingerSlideSidesField({
  label,
  value,
  labels,
  disabled = false,
  onChange,
}: FingerSlideSidesFieldProps) {
  return (
    <div
      className={`${styles.field} ${styles.tupleField} ${
        disabled ? styles.fieldDisabled : ""
      }`}
    >
      <span>{label}</span>
      <div className={styles.sideOverrideGrid}>
        {value.map((tupleValue, index) => {
          const tupleLabel = getTupleLabel(labels, index);
          const sideName = getSideName(tupleLabel);
          const numericValue = getNumericTupleValue(tupleValue);
          const sideEnabled = numericValue !== 0;
          const hasCustomRadius = numericValue !== 0 && numericValue !== 1;

          return (
            <div className={styles.sideOverrideItem} key={`${label}-${index}`}>
              <BooleanField
                label={tupleLabel}
                checked={sideEnabled}
                disabled={disabled}
                onChange={(nextChecked) =>
                  onChange(
                    index,
                    nextChecked
                      ? hasCustomRadius
                        ? getCustomSideRadiusValue(numericValue)
                        : 1
                      : 0,
                    )
                }
              />
              <BooleanField
                label={`Use Custom ${sideName} Radius`}
                checked={hasCustomRadius}
                disabled={disabled || !sideEnabled}
                onChange={(nextChecked) =>
                  onChange(
                    index,
                    nextChecked ? getCustomSideRadiusValue(numericValue) : 1,
                  )
                }
              />
              <NumberInputField
                label={`${sideName} Radius`}
                step={0.1}
                suffix="mm"
                type="number"
                value={getCustomSideRadiusValue(numericValue)}
                disabled={disabled || !sideEnabled || !hasCustomRadius}
                onChange={(nextValue) => {
                  const parsed = Number(nextValue);
                  onChange(
                    index,
                    Number.isFinite(parsed)
                      ? parsed
                      : getCustomSideRadiusValue(numericValue),
                  );
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ExtraOptionFieldProps = {
  option: ParameterOption;
  value: OpenScadDefineValue | undefined;
  disabled?: boolean;
  onChange: (key: string, value: OpenScadDefineValue) => void;
};

export function ExtraOptionField({
  option,
  value,
  disabled = false,
  onChange,
}: ExtraOptionFieldProps) {
  if (option.type === "boolean") {
    return (
      <BooleanField
        label={option.label}
        checked={value === true}
        disabled={disabled}
        fullWidth={option.fullWidth}
        onChange={(checked) => onChange(option.key, checked)}
      />
    );
  }

  if (option.type === "select") {
    return (
      <SelectField
        label={option.label}
        value={String(value)}
        disabled={disabled}
        fullWidth={option.fullWidth}
        options={option.options.map((selectOption) => ({
          value: String(selectOption.value),
          label: selectOption.label,
        }))}
        onChange={(nextValue) => {
          const selectedOption = option.options.find(
            (candidate) => String(candidate.value) === nextValue,
          );
          onChange(option.key, selectedOption?.value ?? nextValue);
        }}
      />
    );
  }

  if (option.type === "text") {
    return (
      <label className={`${styles.field} ${disabled ? styles.fieldDisabled : ""}`}>
        <span>{option.label}</span>
        <input
          disabled={disabled}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(option.key, event.target.value)}
        />
      </label>
    );
  }

  if (option.type === "tuple") {
    const tuple = Array.isArray(value) ? value : [];

    if (option.valueKind === "fingerSlideSides") {
      return (
        <FingerSlideSidesField
          label={option.label}
          value={tuple}
          labels={option.labels}
          disabled={disabled}
          onChange={(index, nextValue) => {
            const nextTuple = [...tuple];
            nextTuple[index] = nextValue;
            onChange(option.key, nextTuple);
          }}
        />
      );
    }

    if (option.valueKind === "boolean") {
      return (
        <BooleanTupleField
          label={option.label}
          value={tuple}
          labels={option.labels}
          disabled={disabled}
          onChange={(index, nextValue) => {
            const nextTuple = [...tuple];
            nextTuple[index] = nextValue;
            onChange(option.key, nextTuple);
          }}
        />
      );
    }

    return (
      <TupleField
        label={option.label}
        value={tuple}
        labels={option.labels}
        step={option.step}
        suffix={option.suffix}
        disabled={disabled}
        onChange={(index, nextValue) => {
          const nextTuple = [...tuple];
          nextTuple[index] = Number.isFinite(nextValue) ? nextValue : 0;
          onChange(option.key, nextTuple);
        }}
      />
    );
  }

  return (
    <NumberInputField
      label={option.label}
      type="number"
      min={option.min}
      max={option.max}
      step={option.step ?? 0.1}
      suffix={option.suffix}
      value={typeof value === "number" ? value : 0}
      disabled={disabled}
      fullWidth={option.fullWidth}
      onChange={(nextValue) => {
        const parsed = Number(nextValue);
        const numericValue = Number.isFinite(parsed) ? parsed : 0;
        onChange(
          option.key,
          typeof option.min === "number"
            ? Math.max(numericValue, option.min)
            : numericValue,
        );
      }}
    />
  );
}
