## Repo Organization

This is one Next.js app that hosts multiple Gridfinity tools. Keep it as a single deployable app unless there is a concrete need for separate packages or deployments.

- `src/app/` is only for Next.js route entrypoints, layout, metadata, and global CSS. Keep route files thin.
- `src/shell/` owns the product shell: sidebar navigation, app selection, theme state, and the app registry.
- `src/shell/appRegistry.ts` is the source of truth for which apps are available in the shell.
- `src/apps/<app-name>/` owns each tool implementation. Put app-specific components, helpers, state, and types inside that app folder.
- `src/apps/types.ts` contains shared app registration types.
- `src/components/ui/` is for shared, app-neutral UI primitives only after more than one app needs them.
- `src/lib/gridfinity/` is for shared Gridfinity domain logic such as constants, units, geometry helpers, and future OpenSCAD parameter builders.

When adding or changing a tool, prefer working inside its app folder and only touch `src/shell/appRegistry.ts` when registering or renaming apps. Do not put generator-specific behavior in the shell.
