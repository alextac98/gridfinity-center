import type { LucideIcon } from "lucide-react";

export type GridfinityAppAccent = "orange" | "green" | "blue";

export type GridfinityAppProps = {
  accent: GridfinityAppAccent;
};

export type GridfinityReadyStatusTag = "alpha" | "beta";
export type GridfinityUpcomingStatusTag = "soon";

type GridfinityAppBaseConfig = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  attribution?: {
    label: string;
    href: string;
  };
  icon: LucideIcon;
  accent: GridfinityAppAccent;
};

export type GridfinityReadyAppConfig = GridfinityAppBaseConfig & {
  comingSoon?: false;
  statusTag?: GridfinityReadyStatusTag;
  Component: React.ComponentType<GridfinityAppProps>;
};

export type GridfinityUpcomingAppConfig = GridfinityAppBaseConfig & {
  comingSoon: true;
  statusTag?: GridfinityUpcomingStatusTag;
  Component?: never;
};

export type GridfinityAppConfig =
  | GridfinityReadyAppConfig
  | GridfinityUpcomingAppConfig;
