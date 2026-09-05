import cadArtwork from "./cadArtwork.json";

export type DriveId =
  | "hex"
  | "phillips"
  | "pozidriv"
  | "slot"
  | "torx"
  | "square"
  | "external-hex";

export type HeadProfileId =
  | "socket"
  | "button"
  | "countersunk"
  | "pan"
  | "hex"
  | "wafer";

export const driveOptions = [
  { id: "hex", label: "Hex socket" },
  { id: "phillips", label: "Phillips" },
  { id: "pozidriv", label: "Pozidriv" },
  { id: "slot", label: "Slotted" },
  { id: "torx", label: "Torx" },
  { id: "square", label: "Square / Robertson" },
  { id: "external-hex", label: "External hex" },
] as const satisfies readonly { id: DriveId; label: string }[];

export const headProfileOptions = [
  {
    id: "socket",
    label: "Socket cap",
    defaultDriveId: "hex",
    driveIds: ["hex", "torx"],
  },
  {
    id: "wafer",
    label: "Wafer / low profile",
    defaultDriveId: "phillips",
    driveIds: ["phillips", "pozidriv", "torx", "hex", "square"],
  },
  {
    id: "button",
    label: "Button / round",
    defaultDriveId: "hex",
    driveIds: ["hex", "torx", "phillips", "slot"],
  },
  {
    id: "countersunk",
    label: "Countersunk",
    defaultDriveId: "phillips",
    driveIds: ["phillips", "pozidriv", "slot", "torx", "hex", "square"],
  },
  {
    id: "pan",
    label: "Pan",
    defaultDriveId: "phillips",
    driveIds: ["phillips", "pozidriv", "slot", "torx", "square"],
  },
  {
    id: "hex",
    label: "Hex head",
    defaultDriveId: "external-hex",
    driveIds: ["external-hex"],
  },
] as const satisfies readonly {
  id: HeadProfileId;
  label: string;
  defaultDriveId: DriveId;
  driveIds: readonly DriveId[];
}[];

export function getDriveOption(id: DriveId) {
  return driveOptions.find((option) => option.id === id) ?? driveOptions[0];
}

export function getHeadProfileOption(id: HeadProfileId) {
  return (
    headProfileOptions.find((option) => option.id === id) ??
    headProfileOptions[0]
  );
}

function svgMarkup(viewBox: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}

type CatalogId = keyof typeof cadArtwork;

function catalogMarkup(id: CatalogId, profile: "top" | "side", compact = false) {
  const artwork = cadArtwork[id][profile];
  let viewBox = artwork.viewBox;
  if (compact) {
    const [x, y, , height] = viewBox.split(" ").map(Number);
    viewBox = `${x} ${y} ${height * 1.25} ${height}`;
  }
  return svgMarkup(viewBox, artwork.body);
}

const headCatalog: Record<HeadProfileId, CatalogId> = {
  socket: "iso4762",
  button: "iso7380",
  countersunk: "din7991",
  pan: "iso7045",
  hex: "iso4014",
  wafer: "din7984",
};

function screwCatalog(id: HeadProfileId, driveId?: DriveId): CatalogId {
  if (id === "socket" && driveId === "torx") return "iso14579";
  if (id === "countersunk") {
    if (driveId === "phillips" || driveId === "pozidriv") return "iso7046";
    if (driveId === "slot") return "din963";
  }
  if (id === "pan" && driveId === "slot") return "din85";
  return headCatalog[id];
}

export function getDriveSvgMarkup(id: DriveId) {
  if (id === "external-hex") return catalogMarkup("iso4014", "top");
  // Keep drive symbols consistent across head styles; the side view shows the head.
  if (id === "hex") return catalogMarkup("iso4762", "top");
  if (id === "phillips") return catalogMarkup("iso7045", "top");
  if (id === "slot") return catalogMarkup("din963", "top");

  // Established drive symbols for forms the CAD catalog does not faithfully
  // depict. Torx retains the existing CC0 geometry (see SOURCES.md).
  let recess: string;
  if (id === "torx") {
    recess = `<path d="m200 350c-38-1-18-43-51-62s-61 20-80-13 28-37 29-75-48-42-29-75 47 6 80-13 13-63 51-62 18 43 51 62 61-20 80 13-28 37-29 75 48 42 29 75-47-6-80 13-13 63-51 62z" transform="translate(10 10) scale(.2)" stroke-width="26"/>`;
  } else if (id === "square") {
    recess = `<rect x="31" y="31" width="38" height="38" transform="rotate(45 50 50)"/>`;
  } else {
    // Pozidriv's four secondary marks distinguish it from Phillips.
    return svgMarkup(
      cadArtwork.iso7045.top.viewBox,
      cadArtwork.iso7045.top.body +
        `<path d="M-4.6,-4.6 -6.3,-6.3 M4.6,-4.6 6.3,-6.3 M4.6,4.6 6.3,6.3 M-4.6,4.6 -6.3,6.3" fill="none" stroke="black" stroke-width=".8"/>`,
    );
  }
  return svgMarkup(
    "0 0 100 100",
    `<g fill="none" stroke="black" stroke-width="5.2" stroke-linejoin="round"><circle cx="50" cy="50" r="44"/>${recess}</g>`,
  );
}

export function getHeadProfileSvgMarkup(
  id: HeadProfileId,
  compact = false,
  driveId?: DriveId,
) {
  return catalogMarkup(screwCatalog(id, driveId), "side", compact);
}

export function getHardwareSvgMarkup(
  id: "nut" | "washer",
  profile: "side" | "top",
) {
  return catalogMarkup(id === "nut" ? "iso4032" : "iso7089", profile);
}
