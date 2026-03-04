# Reactronx AGENTS.md

This file contains crucial context for AI coding agents working on the Reactronx monorepo.

## Project Overview

Reactronx is a suite for building Electron applications where the UI/resource tree is reconciled from React in the Main
Process via a custom reconciler.

### Packages

- `@reactronx/react-electron`: Main Process reconciler. Manages `<app>`, `<window>`, `<webcontents>` nodes.
- `@reactronx/preload`: Secure context bridge exposing a constrained IPC transport to renderer code.
- `@reactronx/renderer`: Lightweight renderer-side transport client (vanilla DOM/runtime package, no React dependency).
- `reactronx`: CLI package used to build executable Electron apps and Reactronx libraries.
- `e2e-test-app` (`tests/integration/app`): Local integration app used by Playwright tests.

## Environment & Build Rules

- **Package Manager:** Use `pnpm`. Do not use `npm` or `yarn`.
- **Monorepo:** `packages/*` are workspace packages; integration app lives under `tests/integration/app`.
- **Build Tooling:**
    - `reactronx build --profile executable` uses Rspack + `builtin:swc-loader`.
    - `reactronx build --profile library` uses TypeScript emit for JS and optional `.d.ts` generation.
    - TypeScript runtime resolution in CLI: prefer consumer/project `typescript`, fallback to bundled CLI `typescript`.
    - `tests/integration/app` is built via `reactronx build`.
- **Useful Commands:**
    - `pnpm install` - Install dependencies.
    - `pnpm build` - Build workspace packages.
    - `pnpm lint` - Run ESLint.
    - `pnpm format` - Run Prettier.
    - `pnpm typecheck` - Run `tsc -b` for workspace packages.
    - `pnpm test:integration` - Build workspace packages, build `tests/integration/app` with `reactronx`, then run
      Playwright.

## Code Conventions & Constraints

- **Strict Typing:** `any` is forbidden. Use `unknown`, `Record<string, unknown>`, or exact interfaces.
- **Unused Variables:** Prefix intentionally unused identifiers with `_`.
- **JSX Intrinsic Elements:** Use lowercase intrinsic names for built-in Electron resources (`<webcontents>`, not
  `<WebContents>`).
- **Renderer Package:** Keep `@reactronx/renderer` framework-agnostic; do not introduce React into that package unless
  explicitly requested.
- **Testing:** Integration tests are Playwright-based. For Electron windows managed by reconciler updates, always
  `await electronApp.firstWindow()` before assertions. Results are written to `tests/integration/results`.

## Release & Publishing

- Publishing uses NPM Provenance (Trusted Publishing / OIDC).
- GitHub Actions + Release Please handles release automation.
