# reactronx

> A set of NPM packages providing support for managing Electron.js resources using React.js.

This is a PNPM monorepo containing the core packages for the `reactronx` ecosystem. It enables developers to build
Electron applications declaratively by backing React components with Electron primitives.

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

## Architecture Deep Dive

The architecture of `reactronx` intrinsically reflects Electron's multi-process model, relying heavily on React
Reconciler to abstract away the asynchronous and complex API surface of native desktop applications.

### The Host Reconciler

Historically, building Electron apps means maintaining messy, imperative state machines to track when windows are
opened, closed, or moved. `@reactronx/react-electron` solves this by providing a
[React Custom Reconciler](https://github.com/facebook/react/tree/main/packages/react-reconciler).

When you render a `<window>` or `<menu>` component, the reconciler translates those React fiber nodes into actual
Electron API calls. Because the Main Process has direct, synchronous access to the underlying OS windowing systems, this
is the perfect environment for a React Reconciler to manipulate tree state efficiently.

### The IPC Bridge

Because Electron enforces Context Isolation for security, the web pages (Renderer Process) cannot require Node.js or
Electron native modules. Therefore, if a user clicks a button in the web page that needs to resize the window, that
command must cross the process boundary.

`@reactronx/preload` serves as this secure conduit. It utilizes `contextBridge.exposeInMainWorld` to attach specific,
heavily-scrutinized IPC event emitters and listeners to the `window` object of the web page.

### The Guest Renderer

`@reactronx/renderer` is a lightweight abstraction that sits in the Renderer process alongside standard `react-dom`. It
is fundamentally responsible for hooking into the APIs exposed by the preload script, allowing the frontend React
components to trigger effects or query states managed by the host reconciler in the Main Process.

---

## Packages

### `@reactronx/react-electron`

Runs in the **Main Process** of an Electron application. It provides a custom React Reconciler backed by Electron
primitives (like `BrowserWindow`, `WebContentsView`, `Menu`, etc.), allowing you to manage your application's native
lifecycle with React.

### `@reactronx/renderer`

Runs in the **Renderer Process** of an Electron application. It acts as the peer package communicating with
`@reactronx/react-electron` via Electron IPC to facilitate renderer-side operations.

### `@reactronx/preload`

Runs in the **Preload Script** of an Electron application. It has access to Electron-specific resources (such as IPC
bridges) and is responsible for securely exposing APIs to the `@reactronx/renderer` renderer package.

## Development

This project uses `pnpm` as its package manager and `webpack` for bundling.

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run typechecking
pnpm typecheck

# Lint the codebase
pnpm lint

# Format the codebase
pnpm format
```

## Releases & Dependency Management

This repository uses [Google Release Please](https://github.com/googleapis/release-please) to automate the publishing
pipeline.

When commits following [Conventional Commits](https://www.conventionalcommits.org/) are merged into the `main` branch,
Release Please automatically updates the changelogs, bumps the semantic versioning across all packages, and opens a
pending **Release PR**.

Merging this Release PR triggers the GitHub Actions workflow, which securely builds and publishes the packages to the
NPM registry. Thanks to the `linked-versions` plugin, `@reactronx/react-electron`, `@reactronx/renderer`, and
`@reactronx/preload` will always be published bearing the exact same version number.

For information on how to configure the NPM registry to trust this GitHub Actions workflow, please refer to the
[NPM Provenance Guide](./docs/guides/npm-provenance.md).

### Dependabot

The repository is configured with Dependabot to automatically keep all workspace dependencies and GitHub Actions
strictly up to date. Dependabot runs weekly and groups its updates into categorized branches to reduce PR noise.

## License

BSD-2-Clause
