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
  { id: "torx", label: "Hexalobular / Torx" },
  { id: "square", label: "Square / Robertson" },
  { id: "external-hex", label: "External hex" },
] as const satisfies readonly { id: DriveId; label: string }[];

export const headProfileOptions = [
  { id: "socket", label: "Socket cap" },
  { id: "button", label: "Button / round" },
  { id: "countersunk", label: "Countersunk / flat" },
  { id: "pan", label: "Pan" },
  { id: "hex", label: "Hex" },
  { id: "wafer", label: "Wafer / low profile" },
] as const satisfies readonly { id: HeadProfileId; label: string }[];

function svgMarkup(viewBox: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}

function torxCutoutMarkup() {
  const lobes = Array.from({ length: 6 }, (_, index) => {
    const angle = (index * Math.PI) / 3;
    const x = 50 + Math.cos(angle) * 21;
    const y = 50 + Math.sin(angle) * 21;

    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="10.5"/>`;
  }).join("");

  return `<g fill="white"><circle cx="50" cy="50" r="22"/>${lobes}</g>`;
}

function driveCutoutMarkup(id: Exclude<DriveId, "external-hex">) {
  switch (id) {
    case "phillips":
      return `<g fill="white"><rect x="15" y="43" width="70" height="14" rx="2"/><rect x="43" y="15" width="14" height="70" rx="2"/><rect x="35" y="35" width="30" height="30" rx="2" transform="rotate(45 50 50)"/></g>`;
    case "pozidriv":
      return `<g fill="white"><rect x="15" y="43" width="70" height="14" rx="2"/><rect x="43" y="15" width="14" height="70" rx="2"/><rect x="35" y="35" width="30" height="30" rx="2" transform="rotate(45 50 50)"/><rect x="20" y="46" width="60" height="8" rx="2" transform="rotate(45 50 50)"/><rect x="20" y="46" width="60" height="8" rx="2" transform="rotate(-45 50 50)"/></g>`;
    case "slot":
      return `<rect x="10" y="43" width="80" height="14" rx="3" fill="white"/>`;
    case "hex":
      return `<path d="M50 25 72 37.5v25L50 75 28 62.5v-25L50 25Z" fill="white"/>`;
    case "square":
      return `<rect x="31" y="31" width="38" height="38" rx="2" fill="white" transform="rotate(45 50 50)"/>`;
    case "torx":
      return torxCutoutMarkup();
  }
}

export function getDriveSvgMarkup(id: DriveId) {
  if (id === "external-hex") {
    return svgMarkup(
      "0 0 100 100",
      `<path d="M50 4 90 27v46L50 96 10 73V27L50 4Z" fill="black"/>`,
    );
  }

  return svgMarkup(
    "0 0 100 100",
    `<circle cx="50" cy="50" r="46" fill="black"/>${driveCutoutMarkup(id)}`,
  );
}

function machineScrewProfilePath(id: HeadProfileId) {
  switch (id) {
    case "socket":
      return "M36 26 H214 V54 H36 V72 H8 V8 H36 Z";
    case "button":
      return "M36 26 H214 V54 H36 V72 C20 72 8 58 8 40 C8 22 20 8 36 8 Z";
    case "countersunk":
      return "M36 26 H214 V54 H36 L8 72 V8 Z";
    case "pan":
      return "M36 26 H214 V54 H36 V72 H19 Q8 72 8 61 V19 Q8 8 19 8 H36 Z";
    case "hex":
      return "M36 26 H214 V54 H36 V68 H14 L8 62 V18 L14 12 H36 Z";
    case "wafer":
      return "M36 26 H214 V54 H36 V72 H27 V8 H36 Z";
  }
}

export function getHeadProfileSvgMarkup(id: HeadProfileId) {
  return svgMarkup(
    "0 0 220 80",
    `<path d="${machineScrewProfilePath(id)}" fill="black"/>`,
  );
}

export function getHardwareSvgMarkup(
  id: "nut" | "washer",
  profile: "side" | "top",
) {
  if (id === "nut" && profile === "top") {
    return svgMarkup(
      "0 0 100 100",
      `<path d="M28 7h44l25 43-25 43H28L3 50 28 7Z" fill="black"/><circle cx="50" cy="50" r="20" fill="white"/>`,
    );
  }

  if (id === "nut") {
    return svgMarkup(
      "0 0 220 80",
      `<path d="M28 12h164l25 28-25 28H28L3 40 28 12Z" fill="black"/><path d="M70 20c-12 13-12 27 0 40M150 20c12 13 12 27 0 40" fill="none" stroke="white" stroke-width="7" stroke-linecap="round"/>`,
    );
  }

  if (profile === "top") {
    return svgMarkup(
      "0 0 100 100",
      `<circle cx="50" cy="50" r="44" fill="black"/><circle cx="50" cy="50" r="19" fill="white"/>`,
    );
  }

  return svgMarkup(
    "0 0 220 80",
    `<rect x="7" y="29" width="206" height="22" rx="4" fill="black"/><rect x="75" y="29" width="12" height="22" fill="white"/><rect x="133" y="29" width="12" height="22" fill="white"/>`,
  );
}
