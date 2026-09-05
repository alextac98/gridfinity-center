"""Import reviewed CAD projections; run with a pinned upstream checkout path.

Usage: python3 import_catalog.py /path/to/gridfinity-label-generator
See SOURCES.md for the upstream revision, license, and illustration limits.
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

CATALOG_IDS = (
    "iso4762", "iso14579", "iso7380", "din7991", "din7984",
    "iso7045", "iso7046", "din963", "din85", "iso4014", "iso4032", "iso7089",
)
NS = "{http://www.w3.org/2000/svg}"


def points(path):
    # The pinned catalog discretizes all CAD edges to M/L polylines.
    if path.tag == NS + "line":
        return [(float(path.attrib[f"x{i}"]), float(path.attrib[f"y{i}"])) for i in (1, 2)]
    d = path.attrib.get("d", path.attrib.get("points", ""))
    assert d
    assert not re.search(r"[A-KN-Za-kn-z]", d), d
    values = [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", d)]
    return list(zip(values[::2], values[1::2]))


def simplify(coords, tolerance=0.002):
    """Remove redundant samples, keeping the CAD curve within 0.002 mm."""
    if len(coords) <= 2:
        return coords
    a, b = coords[0], coords[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    length_sq = dx * dx + dy * dy
    distances = []
    for x, y in coords[1:-1]:
        t = max(0, min(1, ((x-a[0])*dx + (y-a[1])*dy) / length_sq)) if length_sq else 0
        distances.append(((x-a[0]-t*dx)**2 + (y-a[1]-t*dy)**2)**0.5)
    distance = max(distances)
    if distance <= tolerance:
        return [a, b]
    index = distances.index(distance) + 1
    return simplify(coords[:index+1])[:-1] + simplify(coords[index:])


def number(value):
    return f"{value:.4f}".rstrip("0").rstrip(".") if value else "0"


def overlaps_visible(path, visible):
    # Hidden rear edges of a symmetric solid can coincide with its front edges.
    # Keep the visible stroke alone, rather than overprinting it with dashes.
    segments = [(a, b) for p in visible for a, b in zip(p, p[1:])]
    for x, y in path:
        matched = False
        for (ax, ay), (bx, by) in segments:
            dx, dy = bx-ax, by-ay
            length_sq = dx*dx + dy*dy
            t = max(0, min(1, ((x-ax)*dx + (y-ay)*dy) / length_sq)) if length_sq else 0
            if (x-ax-t*dx)**2 + (y-ay-t*dy)**2 < 0.005**2:
                matched = True
                break
        if not matched:
            return False
    return True


def drawing(layers, profile, rotate):
    converted = {}
    for name, paths in layers.items():
        # Hidden rear edges and center crosses clutter the tiny face icons.
        if profile == "top" and name != "Visible":
            continue
        if name == "Hidden":
            paths = [p for p in paths if not overlaps_visible(p, layers["Visible"])]
        converted[name] = [
            [(y, x) if rotate else (x, -y) for x, y in simplify(p)]
            for p in paths
        ]
    coords = [p for paths in converted.values() for path in paths for p in path]
    xmin, ymin = (min(p[i] for p in coords) for i in (0, 1))
    xmax, ymax = (max(p[i] for p in coords) for i in (0, 1))
    # Side views need only enough clearance for the 0.65 mm outline stroke.
    margin = 0.4 if profile == "side" else 1.2
    body = []
    for name, paths in converted.items():
        weight = {"Visible": 0.65, "Hidden": 0.35, "Center": 0.25}[name]
        dash = {"Visible": "", "Hidden": ' stroke-dasharray="2 1"',
                "Center": ' stroke-dasharray="6 1.5 1 1.5"'}[name]
        commands = []
        for path in paths:
            commands.append("M" + " L".join(f"{number(x)},{number(y)}" for x, y in path))
        body.append(f'<path fill="none" stroke="black" stroke-width="{weight}" '
                    f'stroke-linecap="round" stroke-linejoin="round"{dash} d="{" ".join(commands)}"/>')
    return {
        "viewBox": " ".join(number(n) for n in (xmin-margin, ymin-margin,
                                                 xmax-xmin+margin*2, ymax-ymin+margin*2)),
        "body": "".join(body),
    }


def main():
    upstream = Path(sys.argv[1])
    output = {}
    for name in CATALOG_IDS:
        root = ET.parse(upstream / "catalog/out" / f"{name}.svg").getroot()
        layers = {g.attrib["id"]: [points(p) for p in g] for g in root.iter(NS+"g") if "id" in g.attrib}
        # Face geometry is centered on x=0; the side is placed 4 mm to its right.
        split = -min(x for p in layers["Visible"] for x, _ in p) + 2
        views = {"top": {}, "side": {}}
        for layer, paths in layers.items():
            for profile in views:
                if layer == "Center":
                    selected = paths[:4] if profile == "top" else paths[4:]
                else:
                    selected = [p for p in paths if (min(x for x, _ in p) > split) == (profile == "side")]
                views[profile][layer] = selected
        output[name] = {
            profile: drawing(layers, profile, profile == "side" and name in ("iso4032", "iso7089"))
            for profile, layers in views.items()
        }
    destination = Path(__file__).with_name("cadArtwork.json")
    destination.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Wrote {destination} ({destination.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
