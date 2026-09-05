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
  previewStatus?: ReactNode;
  previewControls?: ReactNode;
  preview: ReactNode;
  outputPanel: ReactNode;
};

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
  previewControls,
  preview,
  outputPanel,
}: OpenScadGeneratorShellProps) {
  return (
    <div className={styles.appFrame} data-accent={accent}>
      {parametersPanel}

      <section className={styles.preview} aria-label={previewAriaLabel}>
        <div className={`${styles.previewToolbar} ${previewControls ? styles.previewToolbarWithControls : ""}`}>
          <span>{previewTitle}</span>
          {previewControls}
          {previewStatus ? <div className={styles.toolbarStatus}>
            <Layers3 aria-hidden="true" size={16} />
            {previewStatus}
          </div> : null}
        </div>
        {preview}
      </section>

      {outputPanel}
    </div>
  );
}
