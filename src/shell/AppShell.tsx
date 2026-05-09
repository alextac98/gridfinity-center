"use client";

import {
  Boxes,
  Info,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppUpcoming } from "@/apps/AppUpcoming";
import { ToastProvider } from "./ToastProvider";
import { apps, getAppPath, type RegisteredAppId } from "./appRegistry";
import styles from "./AppShell.module.css";

function getPreferredTheme(): "light" | "dark" {
  const storedTheme = window.localStorage.getItem("gridfinity-theme");

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getServerThemeSnapshot(): "light" {
  return "light";
}

function subscribeToThemeStore(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("gridfinity-theme-change", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("gridfinity-theme-change", onStoreChange);
  };
}

function setStoredTheme(theme: "light" | "dark") {
  window.localStorage.setItem("gridfinity-theme", theme);
  window.dispatchEvent(new Event("gridfinity-theme-change"));
}

type AppShellProps = {
  activeAppId: RegisteredAppId;
};

function GitHubMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="currentColor"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.16c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.24 3.35.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18.92-.26 1.9-.38 2.88-.39.98 0 1.96.13 2.88.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.08 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function AppShell({ activeAppId }: AppShellProps) {
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const theme = useSyncExternalStore(
    subscribeToThemeStore,
    getPreferredTheme,
    getServerThemeSnapshot,
  );
  const activeApp = apps.find((app) => app.id === activeAppId) ?? apps[0];
  const isDark = theme === "dark";
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!isAboutOpen) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAboutOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isAboutOpen]);

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
                onClick={() =>
                  router.push(getAppPath(app.id), { scroll: false })
                }
                role="tab"
                title={app.name}
                type="button"
              >
                <Icon aria-hidden="true" size={19} />
                <span>{app.name}</span>
                {"comingSoon" in app && app.comingSoon ? (
                  <small className={styles.soonBadge}>Soon</small>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className={styles.sidebarBottom}>
          <button
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={`${styles.utilityButton} ${styles.themeUtilityButton}`}
            onClick={() => setStoredTheme(isDark ? "light" : "dark")}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            type="button"
          >
            {isDark ? (
              <Sun aria-hidden="true" size={18} />
            ) : (
              <Moon aria-hidden="true" size={18} />
            )}
          </button>
          <a
            aria-label="Open project on GitHub"
            className={`${styles.utilityButton} ${styles.secondaryUtilityButton}`}
            href="https://github.com/alextac98/gridfinity-viewer"
            rel="noreferrer"
            target="_blank"
            title="Open project on GitHub"
          >
            <GitHubMark />
          </a>
          <button
            aria-label="About Gridfinity Center"
            className={`${styles.utilityButton} ${styles.secondaryUtilityButton}`}
            onClick={() => setIsAboutOpen(true)}
            title="About Gridfinity Center"
            type="button"
          >
            <Info aria-hidden="true" size={18} />
          </button>
        </div>
      </aside>

      <ToastProvider>
        <section
          aria-labelledby={`${activeApp.id}-tab`}
          className={styles.workspace}
          id={`${activeApp.id}-panel`}
          role="tabpanel"
        >
          <header className={styles.topbar}>
            <div className={styles.topbarTitle}>
              <h1>{activeApp.name}</h1>
            </div>
            <p className={styles.topbarDescription}>{activeApp.description}</p>
          </header>

          {"Component" in activeApp ? (
            <activeApp.Component accent={activeApp.accent} />
          ) : (
            <AppUpcoming
              accent={activeApp.accent}
              description={activeApp.description}
              icon={activeApp.icon}
              name={activeApp.name}
            />
          )}
        </section>
      </ToastProvider>

      {isAboutOpen ? (
        <div
          className={styles.aboutOverlay}
          onClick={() => setIsAboutOpen(false)}
          role="presentation"
        >
          <section
            aria-labelledby="about-title"
            aria-modal="true"
            className={styles.aboutDialog}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={styles.aboutHeader}>
              <h2 id="about-title">Gridfinity Center</h2>
              <button
                aria-label="Close about"
                className={styles.aboutCloseButton}
                onClick={() => setIsAboutOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <p>
              A browser-based workspace for generating Gridfinity and related
              projects. Powered by{" "}
              <a
                className={styles.aboutSourceLink}
                href="https://openscad.org"
                rel="noreferrer"
                target="_blank"
              >
                OpenSCAD
              </a>
              and{" "}
              <a
                className={styles.aboutSourceLink}
                href="https://threejs.org"
                rel="noreferrer"
                target="_blank"
              >
                three.js
              </a>
            </p>
            <p>
              Models are generated locally in the browser, with cloud caching
              for faster repeat downloads and slicer handoff.
            </p>
            <a
              className={styles.aboutSourceLink}
              href="https://github.com/alextac98/gridfinity-viewer"
              rel="noreferrer"
              target="_blank"
            >
              View source on GitHub
            </a>
            <p className={styles.aboutCredit}>
              Made with &hearts; by{" "}
              <a href="https://alextac.com" rel="noreferrer" target="_blank">
                Alex Tacescu
              </a>{" "}
              &copy; {currentYear}
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}
