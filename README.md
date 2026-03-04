# reactronx

Reactronx is a set of packages for building Electron apps where React runs in the **Main Process** through a custom
reconciler.

## Packages

- `@reactronx/react-electron`: Main Process reconciler for Electron resources (`<app>`, `<window>`, `<webcontents>`).
- `@reactronx/preload`: Secure preload bridge exposing constrained IPC APIs.
- `@reactronx/renderer`: Renderer-side transport client.
- `reactronx`: CLI for building executable apps and libraries.

## Build Model

`reactronx build` supports two profiles:

- `executable`: builds `main`, optional `preload`, optional `renderer` with **Rspack + SWC**.
- `library`: builds from a single `entry` using **TypeScript emit** so JavaScript and declarations remain in sync.

TypeScript runtime used by CLI:

1. project-local `typescript` (if installed in consuming project)
2. bundled `typescript` inside `reactronx`

## Configuration

`reactronx` reads `reactronx.config.ts` from the current working directory.

### Executable Example

```ts
import { defineConfig } from "reactronx";

export default defineConfig({
    build: {
        profile: "executable",
        main: "src/main.ts",
        preload: "src/preload.ts",
        renderer: "src/renderer.ts",
        outDir: "dist",
    },
});
```

### Library Example

```ts
import { defineConfig } from "reactronx";

export default defineConfig({
    build: {
        profile: "library",
        entry: "src/index.ts",
        target: "electron-main",
        filename: "index.js",
        declarations: true,
        tsconfig: "tsconfig.json",
    },
});
```

## Development

```bash
# Install dependencies
pnpm install

# Build workspace packages
pnpm build

# Lint
pnpm lint

# Typecheck workspace packages
pnpm typecheck

# Format
pnpm format

# Build workspace packages, build integration app with reactronx, then run Playwright tests
pnpm test:integration
```

## Integration Tests

- Test app lives in `tests/integration/app`.
- It is built with the installed local dependency binary (`reactronx build`) using
  `tests/integration/app/reactronx.config.ts`.
- Playwright specs live in `tests/integration/specs`.
- Results are written to `tests/integration/results`.

## Release

Release automation is handled by Release Please and GitHub Actions, with NPM Provenance enabled for publishing.

## License

BSD-2-Clause
