# Gridfinity Center

Gridfinity Center is a browser-based workspace for generating Gridfinity bins, grids, and (soon) labels, with a strong focus on user experience. I was inspired by apps like [Perplexing Labs Gridfinity Generator](https://gridfinity.perplexinglabs.com), [Gridfinity Label Generator](https://gridfinitylabels.com), and [Gridfinity Generator](https://gridfinitygenerator), but wanted something that embodies the open-source spirit of the Gridfinity project. Enjoy!

## Tools

- **Bin Generator**: create Gridfinity bins with compartments, scoops, lips, labels, magnet holes, and other common options.
- **Grid Generator**: create Gridfinity baseplates in standard sizes and supported layout variants.
- **Label Generator**: design printable labels for bins, drawers, and small-parts organizers. This tool is currently alpha.

## How It Works

Gridfinity Center uses bundled OpenSCAD models to generate STL models from the parameters you choose in the UI. For fast full model generation, the app defaults to using a native OpenSCAD render service, but will fall back to a WebAssembly version of OpenSCAD running in the browser if the render service is unavailable.

## Interested In Contributing?

Contributions are welcome and encouraged, especially practical improvements from people using Gridfinity Center for real prints.

Helpful ways to contribute include:

- filing bug reports with the tool, settings, browser, and expected behavior
- suggesting generator options, workflow improvements, or confusing UI areas
- submitting bug fixes and focused feature improvements
- improving documentation, screenshots, attributions, and setup notes

For setup, common commands, and pull request expectations, see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Documentation

- [Contributing](docs/CONTRIBUTING.md): local setup, common commands, GitHub workflow, UI development, and backend development.
- [Architecture](docs/ARCHITECTURE.md): high-level app structure, frontend data flow, API design, native rendering, and R2 cache flow.
- [Slicer icon sources](public/slicer-icons/SOURCES.md): source notes for bundled slicer icons.

## Attribution

Thank you to the following projects and creators whose work is used in Gridfinity Center:

- [Gridfinity Extended](https://github.com/ostat/gridfinity_extended_openscad) by Chris Heazlewood
- [Gridfinity](https://www.youtube.com/watch?v=ra_9zU-mnl8) by Zack Freedman and the wonderful community
- [OpenSCAD](https://openscad.org/) by Marius Kintel and the OpenSCAD contributors
- [3JS](https://threejs.org/)
- And many many more smaller libraries, tools, and resources!

## License

Gridfinity Center is distributed under GPLv3 - no copying without maintaining open-source. Bundled third-party assets and OpenSCAD sources retain their own upstream licenses.
