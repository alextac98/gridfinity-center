# Label artwork sources

## CAD-derived technical drawings

`cadArtwork.json` is adapted from the SVG catalog in
[kamilpajak/gridfinity-label-generator](https://github.com/kamilpajak/gridfinity-label-generator/tree/fe3c4ef54565084aaaa73be82a2652d057015d74/catalog)
at commit `fe3c4ef54565084aaaa73be82a2652d057015d74`, by Kamil Pajak and
contributors. The imported drawings retain the upstream **AGPL-3.0** license;
the full license and upstream third-party notices are in `vendor/`.

| Artwork | Upstream catalog SVG |
| --- | --- |
| Socket cap / hex socket | `iso4762.svg` |
| Socket cap / Torx side | `iso14579.svg` |
| Button head | `iso7380.svg` |
| Countersunk / hex | `din7991.svg` |
| Low profile | `din7984.svg` |
| Pan / Phillips | `iso7045.svg` |
| Countersunk / Phillips | `iso7046.svg` |
| Countersunk / slot | `din963.svg` |
| Pan / slot | `din85.svg` |
| External hex / bolt | `iso4014.svg` |
| Hex nut | `iso4032.svg` |
| Flat washer | `iso7089.svg` |

The upstream `catalog/dimensions/` files record dimension references and
representative simplifications; `catalog/models/` and `catalog/render.py` are
the corresponding CAD generation source. Obtain the exact source from the
[pinned source archive](https://github.com/kamilpajak/gridfinity-label-generator/archive/fe3c4ef54565084aaaa73be82a2652d057015d74.tar.gz).

Regenerate from that extracted checkout:

```sh
python3 src/ui/apps/label-generator/artwork/import_catalog.py /path/to/checkout
```

Local adaptations: separate the face and side projections, rotate nut/washer
side views to match the existing horizontal slots, trim empty margins, remove
hidden edges and centerlines from face views, suppress hidden edges coincident
with visible edges, simplify sampled polylines within 0.002 source mm, and use
black strokes with heavier outlines for label legibility. Side-view margins
are 0.4 source mm, just larger than half the 0.65 mm outline stroke, to avoid
wasting label space while keeping the strokes unclipped. Compact picker
thumbnails crop the shaft; full label drawings preserve their aspect ratio.

These are representative type illustrations, not dimensioned manufacturing
drawings. Changing label length or thread size does not rescale the geometry.
The upstream screw shafts are smooth envelopes, without thread lines. The
generic wafer/low-profile option uses the DIN 7984 low cylindrical head, not a
dimensioned wafer-head standard. Head/drive combinations absent from the
catalog reuse the head's representative side projection; the face icon
identifies the selected drive. The hex-bolt illustration uses the ISO 4014
envelope (the smooth shaft does not distinguish its thread length from ISO 4017).

## Drive symbols

Hex socket and Phillips face icons use ISO 4762 and ISO 7045 respectively
for every head style, keeping recess proportions consistent when switching
heads. The side projection continues to identify the selected head style.

The Torx face retains the previous established
[Wikimedia Commons CC0 geometry](https://commons.wikimedia.org/wiki/File:Screw_Head_-_Torx.svg),
changed from a filled cutout to an outline. The upstream CAD Torx face is a
representative six-lobe construction; the existing CC0 curve reads more clearly.
Pozidriv uses the CAD Phillips projection plus four secondary identification
marks; it is a representative symbol, not a dimensioned recess.

The retained square-drive geometry follows
[GFLabel](https://github.com/ndevenish/gflabel)'s screw-drive fragments,
changed from a filled cutout to an outline. The previous silhouette artwork
also followed GFLabel. Its attribution is retained below.

GFLabel is licensed under the BSD 3-Clause License:

Copyright (c) 2024 Nicholas Devenish

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
