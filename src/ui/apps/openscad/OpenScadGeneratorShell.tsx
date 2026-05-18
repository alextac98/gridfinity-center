"use client";

import { Layers3 } from "lucide-react";
import type { ReactNode } from "react";
import type { GridfinityAppAccent } from "../types";
import styles from "./generator.module.css";

type OpenScadGeneratorShellProps = {
  accent: GridfinityAppAccent;
  parametersPanel: ReactNode;
  previewAriaLabel: string;
  previewTitle: string;
  previewStatus: ReactNode;
  preview: ReactNode;
  outputPanel: ReactNode;
};

type GeneratorPanelProps = {
  title: string;
  icon: ReactNode;
  ariaLabel: string;
  children: ReactNode;
};

export function GeneratorPanel({
  title,
  icon,
  ariaLabel,
  children,
}: GeneratorPanelProps) {
  return (
    <section className={styles.panel} aria-label={ariaLabel}>
      <div className={styles.panelHeader}>
        {icon}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function LoadingPanel({ children }: { children: ReactNode }) {
  return <div className={styles.loadingPanel}>{children}</div>;
}

export function PreviewLoading({ children }: { children: ReactNode }) {
  return <div className={styles.previewLoading}>{children}</div>;
}

export function OpenScadGeneratorShell({
  accent,
  parametersPanel,
  previewAriaLabel,
  previewTitle,
  previewStatus,
  preview,
  outputPanel,
}: OpenScadGeneratorShellProps) {
  return (
    <div className={styles.appFrame} data-accent={accent}>
      {parametersPanel}

      <section className={styles.preview} aria-label={previewAriaLabel}>
        <div className={styles.previewToolbar}>
          <span>{previewTitle}</span>
          <div className={styles.toolbarStatus}>
            <Layers3 aria-hidden="true" size={16} />
            {previewStatus}
          </div>
        </div>
        {preview}
      </section>

      {outputPanel}
    </div>
  );
}
