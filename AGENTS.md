# Agents.MD

1. Don't assume. Don't hide confusion. Surface tradeoffs.
2. Minimum code that solves the problem. Nothing speculative.
3. Touch only what you must. Clean up your own mess.
4. Define success criteria. Loop until verified.

## Repo Organization

This is one Next.js app that hosts multiple Gridfinity tools. Keep it as a single deployable app unless there is a concrete need for separate packages or deployments.

- `src/app/` is only for Next.js route entrypoints, layout, metadata, and global CSS. Keep route files thin.
- `src/server/` owns server-only code used by API routes, including R2 signing, OpenSCAD cache keys, source fingerprints, and native render orchestration.
- `src/ui/` owns browser-facing UI code, including the product shell, tool implementations, analytics client setup, browser workers, and shared UI primitives.
- `src/ui/shell/appRegistry.ts` is the source of truth for which apps are available in the shell.
- `src/ui/apps/<app-name>/` owns each tool implementation. Put app-specific components, helpers, state, and types inside that app folder.
- `src/ui/apps/types.ts` contains shared app registration types.
- `src/ui/components/ui/` is for shared, app-neutral UI primitives only after more than one app needs them.
- `src/shared/` is for code safe to import from both server and UI, such as Gridfinity/OpenSCAD parameter types, constants, and pure formatting helpers.

When adding or changing a tool, prefer working inside its app folder and only touch `src/ui/shell/appRegistry.ts` when registering or renaming apps. Do not put generator-specific behavior in the shell.

## Browser Testing

Use Playwright for UI bugs, navigation behavior, persistence, responsive layout checks, and other issues that need real browser feedback. Keep tests focused in `tests/e2e/` and prefer small smoke/regression coverage over broad brittle flows. Run `pnpm test:e2e` for the default Chromium suite, or `pnpm test:e2e:ui` while debugging interactively.
