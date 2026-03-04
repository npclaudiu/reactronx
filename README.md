# reactronx

Reactronx is a set of packages for building Electron apps where React runs in the **Main Process** through a custom
reconciler.

## High-Level Usage Guide

To use `reactronx` in your Electron application, you will need to orchestrate the three core packages across Electron's
distinct process boundaries.

1. **Main Process (`@reactronx/react-electron`)**: In your Electron entry point (typically `main.js` or `index.ts`), you
   will initialize `@reactronx/react-electron`. Instead of imperatively creating `new BrowserWindow()` instances, you
   will write standard React code that orchestrates your Electron primitives and use the custom reconciler to render
   them.

2. **Preload Script (`@reactronx/preload`)**: Inject `@reactronx/preload` into your `preload.js` script. This package
   will execute within the context isolation boundary, securely bridging the IPC channels required for the renderer to
   communicate with the host reconciler.

3. **Renderer Process (`@reactronx/renderer`)**: In your web bundles (e.g., your Vite or Webpack frontend), import and
   initialize `@reactronx/renderer`. This acts as the peer React tree that communicates with the `host` over the
   injected IPC bridge, completing the loop.

### Example: Managing Electron with React

Instead of writing imperative EventEmitters and arrays to track open windows, `@reactronx/react-electron` allows you to
define your desktop application layout cleanly, just like a web page:

```tsx
import React, { useState } from "react";
import { render } from "@reactronx/react-electron";

function App() {
    const [preferencesOpen, setPreferencesOpen] = useState(false);

    return (
        <app>
            <menu>
                <menuitem label="File">
                    <menuitem label="Preferences" onClick={() => setPreferencesOpen(true)} />
                    <menuitem label="Quit" role="quit" />
                </menuitem>
            </menu>

            {/* The Main Application Window */}
            <window title="My Reactronx App" width={800} height={600} onClose={() => console.log("Main window closed")}>
                <webcontents url="http://localhost:3000" />
            </window>

            {/* Conditionally render a Preferences Window */}
            {preferencesOpen && (
                <window title="Preferences" width={400} height={300} onClose={() => setPreferencesOpen(false)}>
                    <webcontents url="http://localhost:3000/preferences" />
                </window>
            )}
        </app>
    );
}

// Render the application to the Electron environment
render(<App />);
```

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
