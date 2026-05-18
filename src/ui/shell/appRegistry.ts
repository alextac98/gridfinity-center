import { Box, Grid3X3, Tag } from "lucide-react";
import { BinGeneratorApp } from "@/ui/apps/bin-generator/BinGeneratorApp";
import { GridGeneratorApp } from "@/ui/apps/grid-generator/GridGeneratorApp";
import { LabelGeneratorApp } from "@/ui/apps/label-generator/LabelGeneratorApp";
import type { GridfinityAppConfig } from "@/ui/apps/types";

export const apps = [
  {
    id: "bin-generator",
    name: "Bin Generator",
    eyebrow: "Bins",
    description:
      "Generate Gridfinity bins, complete with compartments, scoops, and magnet holes.",
    attribution: {
      label: "Gridfinity Extended",
      href: "https://github.com/ostat/gridfinity_extended_openscad",
    },
    icon: Box,
    Component: BinGeneratorApp,
    accent: "blue",
  },
  {
    id: "grid-generator",
    name: "Grid Generator",
    eyebrow: "Baseplates",
    description: "Generate Gridfinity standard grids for all sizes and shapes.",
    attribution: {
      label: "Gridfinity Extended",
      href: "https://github.com/ostat/gridfinity_extended_openscad",
    },
    icon: Grid3X3,
    Component: GridGeneratorApp,
    statusTag: "alpha",
    accent: "blue",
  },
  {
    id: "label-generator",
    name: "Label Generator",
    eyebrow: "Labels",
    description:
      "Design printable labels for bins, drawers, and small part organizers.",
    icon: Tag,
    Component: LabelGeneratorApp,
    statusTag: "alpha",
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
