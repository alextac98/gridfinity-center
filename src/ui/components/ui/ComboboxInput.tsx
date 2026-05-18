"use client";

import { ChevronDown } from "lucide-react";
import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import styles from "./combobox-input.module.css";

type ComboboxInputProps = {
  ariaLabel: string;
  options: readonly string[];
  placeholder?: string;
  value: string;
  getOptionLabel?: (option: string) => string;
  onChange: (value: string) => void;
};

function fuzzyScore(option: string, query: string, label = option) {
  const normalizedOption = option.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return 1;
  }

  if (normalizedOption === normalizedQuery || normalizedLabel === normalizedQuery) {
    return 1000;
  }

  if (
    normalizedOption.startsWith(normalizedQuery) ||
    normalizedLabel.startsWith(normalizedQuery)
  ) {
    return 800 - normalizedLabel.length;
  }

  const index = normalizedLabel.indexOf(normalizedQuery);

  if (index >= 0) {
    return 600 - index - normalizedLabel.length;
  }

  let score = 0;
  let queryIndex = 0;

  for (let optionIndex = 0; optionIndex < normalizedLabel.length; optionIndex += 1) {
    if (normalizedLabel[optionIndex] === normalizedQuery[queryIndex]) {
      score += 20 - optionIndex;
      queryIndex += 1;
    }

    if (queryIndex === normalizedQuery.length) {
      return score;
    }
  }

  return -1;
}

export function ComboboxInput({
  ariaLabel,
  options,
  placeholder,
  value,
  getOptionLabel = (option) => option,
  onChange,
}: ComboboxInputProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldFilter, setShouldFilter] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestionQuery = shouldFilter ? value : "";
  const filteredOptions = useMemo(
    () =>
      options
        .map((option) => ({
          option,
          score: fuzzyScore(option, suggestionQuery, getOptionLabel(option)),
        }))
        .filter(({ score }) => score >= 0)
        .sort((first, second) => second.score - first.score)
        .map(({ option }) => option)
        .slice(0, 8),
    [getOptionLabel, options, suggestionQuery],
  );

  function commitOption(option: string) {
    onChange(option);
    setIsOpen(false);
    setShouldFilter(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setShouldFilter(false);
      setActiveIndex((index) =>
        Math.min(index + 1, Math.max(filteredOptions.length - 1, 0)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && isOpen && filteredOptions[activeIndex]) {
      event.preventDefault();
      commitOption(filteredOptions[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className={styles.combobox}>
      <input
        ref={inputRef}
        aria-activedescendant={
          isOpen && filteredOptions[activeIndex]
            ? `${listboxId}-${activeIndex}`
            : undefined
        }
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        autoComplete="off"
        className={styles.input}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
          setShouldFilter(true);
          setActiveIndex(0);
        }}
        onFocus={() => {
          setIsOpen(true);
          setShouldFilter(false);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        value={isOpen ? value : getOptionLabel(value)}
      />
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Hide suggestions" : "Show suggestions"}
        className={styles.toggleButton}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setIsOpen((open) => {
            const nextOpen = !open;

            if (nextOpen) {
              setShouldFilter(false);
              setActiveIndex(0);
            }

            return nextOpen;
          });
          inputRef.current?.focus();
        }}
        type="button"
      >
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      {isOpen && filteredOptions.length > 0 ? (
        <div className={styles.listbox} id={listboxId} role="listbox">
          {filteredOptions.map((option, index) => (
            <button
              aria-selected={index === activeIndex}
              className={styles.option}
              id={`${listboxId}-${index}`}
              key={option}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => commitOption(option)}
              role="option"
              type="button"
            >
              {getOptionLabel(option)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
