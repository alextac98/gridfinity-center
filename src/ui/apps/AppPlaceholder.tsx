import {
  ArrowRight,
  Layers3,
  PanelLeft,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GridfinityAppAccent } from "./types";
import styles from "./app-shell-placeholder.module.css";

const placeholderRows = ["Width", "Depth", "Height", "Style"];

type AppPlaceholderProps = {
  accent: GridfinityAppAccent;
  icon: LucideIcon;
  leftPanelTitle: string;
  placeholderTitle: string;
  rightPanelTitle: string;
};

export function AppPlaceholder({
  accent,
  icon: Icon,
  leftPanelTitle,
  placeholderTitle,
  rightPanelTitle,
}: AppPlaceholderProps) {
  return (
    <div className={styles.appFrame} data-accent={accent}>
      <section className={styles.panel} aria-label={leftPanelTitle}>
        <div className={styles.panelHeader}>
          <SlidersHorizontal aria-hidden="true" size={18} />
          <h2>{leftPanelTitle}</h2>
        </div>
        <div className={styles.formShell}>
          {placeholderRows.map((row) => (
            <div className={styles.placeholderField} key={row}>
              <span>{row}</span>
              <div />
            </div>
          ))}
        </div>
      </section>

      <section className={styles.preview} aria-label={placeholderTitle}>
        <div className={styles.previewToolbar}>
          <span>{placeholderTitle}</span>
          <button type="button">
            <Layers3 aria-hidden="true" size={16} />
            Preview
          </button>
        </div>
        <div className={styles.previewSurface}>
          <div className={styles.previewMark}>
            <Icon aria-hidden="true" size={58} />
          </div>
          <p>App implementation area</p>
        </div>
      </section>

      <section className={styles.panel} aria-label={rightPanelTitle}>
        <div className={styles.panelHeader}>
          <PanelLeft aria-hidden="true" size={18} />
          <h2>{rightPanelTitle}</h2>
        </div>
        <div className={styles.outputList}>
          <div>
            <span>Preset</span>
            <strong>Draft</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>Ready for app code</strong>
          </div>
          <button type="button">
            Open module
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
