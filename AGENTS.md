# Reactronx AGENTS.md

This file contains crucial context for AI coding agents working on the Reactronx monorepo.

## Project Overview

Reactronx is a suite of libraries designed to build Electron applications where the architecture is driven entirely by
React running on the **Main Process** (using a custom Reconciler), rather than the traditional approach of running React
in the Renderer process.

### Packages

- `@reactronx/react-electron`: The React Reconciler for Electron. Runs in the Main Process. Manages `<app>`, `<window>`,
  and `<webcontents>` nodes.
- `@reactronx/preload`: The secure context bridge that exposes the IPC transport to the Renderer.
- `@reactronx/renderer`: A minimal, vanilla DOM interactor running in the Renderer process (no React dependency here) to
  accept instructions from the Main Process Reconciler.
- `@reactronx/cli`: Empty CLI scaffolding (future).
- `e2e-test-app` (under `tests/integration/app`): A local mock Electron app used purely for testing the integration of
  the above packages.

## Environment & Build Rules

- **Package Manager:** Use `pnpm`. Do not use `npm` or `yarn`.
- **Monorepo:** Standard `pnpm` workspaces are used.
- **Build Tooling:** `tsup` is used for compiling the library packages. `webpack` is used for compiling the integration
  test app.
- **Useful Commands:**
    - `pnpm install` - Installs all dependencies across the workspace.
    - `pnpm build` - Builds all packages using `tsup` and `webpack`.
    - `pnpm lint` - Runs ESLint.
    - `pnpm format` - Runs Prettier to format codebase (e.g. `prettier --write "**/*.{ts,tsx,js,jsx,json,md}"`).
    - `pnpm typecheck` - Runs `tsc -b` to validate strict typing.
    - `pnpm test:integration` - Runs the Playwright integration test suite.

## Code Conventions & Constraints

- **Strict Typing:** The use of the `any` type is **strictly forbidden**. You must use `unknown`,
  `Record<string, unknown>`, or exact TypeScript interfaces.
- **Unused Variables:** Always prefix unused variables/arguments with an underscore (e.g., `_args`).
- **JSX Intrinsic Elements:** Use entirely lowercase letters for built-in Electron resources. Example: `<webcontents>`
  instead of `<WebContents>`.
- **DOM Renderer:** `@reactronx/renderer` uses direct, Vanilla DOM manipulations. Do not introduce React to the Renderer
  package unless instructed for specific client-components logic.
- **Testing:** Integration tests are written in Playwright. Native Electron windows managed by the Reconciler require
  asynchronous queue flushing, so always `await electronApp.firstWindow()` before asserting window instances. Test
  results output to `tests/integration/results`.

## Release & Publishing

- The repository relies on NPM Provenance (Trusted Publishing/OIDC).
- GitHub Actions handles the deployment via Release Please.
