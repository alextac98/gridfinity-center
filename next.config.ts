import type { NextConfig } from "next";
import { execSync } from "node:child_process";

function getCommitSha() {
  const fromEnv =
    process.env.GRIDFINITY_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv) {
    return fromEnv;
  }

  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  // Standalone output is only needed for the Docker image; it makes `next start` warn.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  env: {
    NEXT_PUBLIC_GRIDFINITY_COMMIT_SHA: getCommitSha(),
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
