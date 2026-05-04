import { Box, Cuboid, Grid3X3, Tag } from "lucide-react";
import { BinGeneratorApp } from "@/apps/bin-generator/BinGeneratorApp";
import { GridGeneratorApp } from "@/apps/grid-generator/GridGeneratorApp";
import { LabelMakerApp } from "@/apps/label-maker/LabelMakerApp";
import type { GridfinityAppConfig } from "@/apps/types";

export const apps = [
  {
    id: "label-maker",
    name: "Label Maker",
    eyebrow: "Labels",
    description:
      "Design printable labels for bins, drawers, and small part organizers.",
    icon: Tag,
    Component: LabelMakerApp,
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
    Component: GridGeneratorApp,
    accent: "blue",
  },
  {
    id: "model-viewer",
    name: "Model Viewer",
    eyebrow: "Preview",
    description:
      "Inspect STL and 3MF files, review print orientation, and compare generated model variants.",
    icon: Cuboid,
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
