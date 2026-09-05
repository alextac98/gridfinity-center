"use client";

import { ChevronUp } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import styles from "./generator-sidebar.module.css";

export function GeneratorPanel({
  title,
  icon,
  ariaLabel,
  headerActions,
  children,
}: {
  title: string;
  icon: ReactNode;
  ariaLabel: string;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel} aria-label={ariaLabel}>
      <div className={styles.header}>
        {icon}
        <h2>{title}</h2>
        {headerActions}
      </div>
      {children}
    </section>
  );
}

export function GeneratorPanelBody({ children }: { children: ReactNode }) {
  return (
    <div className={styles.body}>
      <div className={styles.sections}>{children}</div>
    </div>
  );
}

export function GeneratorPanelActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export function CollapsibleSection({
  title,
  columns = false,
  defaultCollapsed = false,
  expanded,
  onExpandedChange,
  children,
}: {
  title: string;
  columns?: boolean;
  defaultCollapsed?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children: ReactNode;
}) {
  const [internalExpanded, setInternalExpanded] = useState(!defaultCollapsed);
  const isExpanded = expanded ?? internalExpanded;
  const setExpanded = onExpandedChange ?? setInternalExpanded;
  const contentId = useId();

  return (
    <section className={styles.section}>
      <button
        aria-expanded={isExpanded}
        aria-controls={contentId}
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
      <div
        id={contentId}
        hidden={!isExpanded}
        className={`${styles.sectionFields} ${columns ? styles.twoColumnFields : ""}`}
      >
        {children}
      </div>
    </section>
  );
}
