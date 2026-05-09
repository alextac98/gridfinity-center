import { Box, Grid3X3, Tag } from "lucide-react";
import { BinGeneratorApp } from "@/apps/bin-generator/BinGeneratorApp";
import { LabelGeneratorApp } from "@/apps/label-generator/LabelGeneratorApp";
import type { GridfinityAppConfig } from "@/apps/types";

export const apps = [
  {
    id: "label-generator",
    name: "Label Generator",
    eyebrow: "Labels",
    description:
      "Design printable labels for bins, drawers, and small part organizers.",
    icon: Tag,
    Component: LabelGeneratorApp,
    accent: "blue",
  },
  {
    id: "bin-generator",
    name: "Bin Generator",
    eyebrow: "Bins",
    description:
      "Configure parametric Gridfinity bins, compartments, scoops, and magnet holes.",
    icon: Box,
    Component: BinGeneratorApp,
    accent: "blue",
  },
  {
    id: "grid-generator",
    name: "Grid Generator",
    eyebrow: "Baseplates",
    description:
      "Lay out baseplates, wall grids, weighted plates, and printable workbench grids.",
    icon: Grid3X3,
    comingSoon: true,
    accent: "blue",
  },
] as const satisfies readonly GridfinityAppConfig[];

export type RegisteredApp = (typeof apps)[number];
export type RegisteredAppId = RegisteredApp["id"];

export const defaultAppId = apps[0].id;

export function getAppPath(appId: RegisteredAppId) {
  return `/${appId}`;
}

export function isRegisteredAppId(appId: string): appId is RegisteredAppId {
  return apps.some((app) => app.id === appId);
}
