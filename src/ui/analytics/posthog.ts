import posthog from "posthog-js";

export type AnalyticsEventProperties = Record<string, unknown>;

const postHogToken =
  process.env.NEXT_PUBLIC_POSTHOG_TOKEN ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;

const isPostHogEnabled =
  Boolean(postHogToken) &&
  (process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "true");
const buildCommitSha = process.env.NEXT_PUBLIC_GRIDFINITY_COMMIT_SHA ?? "";
const buildCommitShortSha = buildCommitSha ? buildCommitSha.slice(0, 7) : "";

const buildProperties = buildCommitSha
  ? {
      app_build_commit: buildCommitSha,
      app_build_commit_short: buildCommitShortSha,
    }
  : {};

export function initializePostHog() {
  if (!isPostHogEnabled || !postHogToken) {
    return;
  }

  posthog.init(postHogToken, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "true",
  });
}

export function captureEvent(
  eventName: string,
  properties?: AnalyticsEventProperties,
) {
  if (!isPostHogEnabled) {
    return;
  }

  posthog.capture(eventName, {
    ...properties,
    ...buildProperties,
  });
}
