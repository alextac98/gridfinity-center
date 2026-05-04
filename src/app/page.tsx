"use client";

import {
  ArrowRight,
  Box,
  Boxes,
  Download,
  Grid3X3,
  Layers3,
  Moon,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  SlidersHorizontal,
  Sun,
  Tag,
} from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

const apps = [
  {
    id: "label-maker",
    name: "Label Maker",
    eyebrow: "Labels",
    description:
      "Design printable labels for bins, drawers, and small part organizers.",
    icon: Tag,
    placeholderTitle: "Label canvas",
    leftPanelTitle: "Label settings",
    rightPanelTitle: "Export queue",
    accent: "orange",
  },
  {
    id: "bin-generator",
    name: "Bin Generator",
    eyebrow: "Bins",
    description:
      "Configure parametric Gridfinity bins, compartments, scoops, and magnet holes.",
    icon: Box,
    placeholderTitle: "Bin preview",
    leftPanelTitle: "Bin parameters",
    rightPanelTitle: "Model output",
    accent: "green",
  },
  {
    id: "grid-generator",
    name: "Grid Generator",
    eyebrow: "Baseplates",
    description:
      "Lay out baseplates, wall grids, weighted plates, and printable workbench grids.",
    icon: Grid3X3,
    placeholderTitle: "Grid layout",
    leftPanelTitle: "Grid dimensions",
    rightPanelTitle: "Print plan",
    accent: "blue",
  },
] as const;

const placeholderRows = ["Width", "Depth", "Height", "Style"];

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem("gridfinity-theme");

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function Home() {
  const [activeAppId, setActiveAppId] = useState<(typeof apps)[number]["id"]>(
    apps[0].id,
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const activeApp = apps.find((app) => app.id === activeAppId) ?? apps[0];
  const ActiveIcon = activeApp.icon;
  const isDark = theme === "dark";

  useEffect(() => {
    window.localStorage.setItem("gridfinity-theme", theme);
  }, [theme]);

  return (
    <main
      className={`${styles.page} ${
        isSidebarCollapsed ? styles.collapsedPage : ""
      } ${isDark ? styles.darkTheme : ""}`}
    >
      <aside
        className={`${styles.sidebar} ${
          isSidebarCollapsed ? styles.collapsedSidebar : ""
        }`}
      >
        <div className={styles.sidebarHeader}>
          <a className={styles.brand} href="#" aria-label="Gridfinity Center">
            <Boxes aria-hidden="true" size={24} />
            <span>Gridfinity Center</span>
          </a>

          <div className={styles.sidebarControls}>
            <button
              aria-label={
                isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              className={styles.sidebarIconButton}
              onClick={() =>
                setIsSidebarCollapsed((isCollapsed) => !isCollapsed)
              }
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              type="button"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen aria-hidden="true" size={18} />
              ) : (
                <PanelLeftClose aria-hidden="true" size={18} />
              )}
            </button>
          </div>
        </div>

        <div className={styles.appTabs} role="tablist" aria-label="Apps">
          {apps.map((app) => {
            const Icon = app.icon;
            const isActive = app.id === activeApp.id;

            return (
              <button
                aria-controls={`${app.id}-panel`}
                aria-selected={isActive}
                className={isActive ? styles.activeTab : styles.appTab}
                id={`${app.id}-tab`}
                key={app.id}
                onClick={() => setActiveAppId(app.id)}
                role="tab"
                title={app.name}
                type="button"
              >
                <Icon aria-hidden="true" size={19} />
                <span>{app.name}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.sidebarBottom}>
          <button
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={styles.themeToggle}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            type="button"
          >
            {isDark ? (
              <Sun aria-hidden="true" size={18} />
            ) : (
              <Moon aria-hidden="true" size={18} />
            )}
            <span>{isDark ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </aside>

      <section
        aria-labelledby={`${activeApp.id}-tab`}
        className={styles.workspace}
        id={`${activeApp.id}-panel`}
        role="tabpanel"
      >
        <header className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>{activeApp.eyebrow}</p>
            <h1>{activeApp.name}</h1>
            <p>{activeApp.description}</p>
          </div>
          <div className={styles.topbarActions}>
            <button type="button" aria-label="Save preset">
              <Save aria-hidden="true" size={18} />
            </button>
            <button type="button" aria-label="Export files">
              <Download aria-hidden="true" size={18} />
            </button>
          </div>
        </header>

        <div className={styles.appFrame} data-accent={activeApp.accent}>
          <section className={styles.panel} aria-label={activeApp.leftPanelTitle}>
            <div className={styles.panelHeader}>
              <SlidersHorizontal aria-hidden="true" size={18} />
              <h2>{activeApp.leftPanelTitle}</h2>
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

          <section className={styles.preview} aria-label={activeApp.placeholderTitle}>
            <div className={styles.previewToolbar}>
              <span>{activeApp.placeholderTitle}</span>
              <button type="button">
                <Layers3 aria-hidden="true" size={16} />
                Preview
              </button>
            </div>
            <div className={styles.previewSurface}>
              <div className={styles.previewMark}>
                <ActiveIcon aria-hidden="true" size={58} />
              </div>
              <p>App implementation area</p>
            </div>
          </section>

          <section className={styles.panel} aria-label={activeApp.rightPanelTitle}>
            <div className={styles.panelHeader}>
              <PanelLeft aria-hidden="true" size={18} />
              <h2>{activeApp.rightPanelTitle}</h2>
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
      </section>
    </main>
  );
}
