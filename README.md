# reactronx

> A set of NPM packages providing support for managing Electron.js resources
> using React.js.

This is a PNPM monorepo containing the core packages for the `reactronx`
ecosystem. It enables developers to build Electron applications declaratively by
backing React components with Electron primitives.

## Packages

### `@reactronx/host`

Runs in the **Main Process** of an Electron application. It provides a custom
React Reconciler backed by Electron primitives (like `BrowserWindow`,
`WebContentsView`, `Menu`, etc.), allowing you to manage your application's
native lifecycle with React.

### `@reactronx/guest`

Runs in the **Renderer Process** of an Electron application. It acts as the peer
package communicating with `@reactronx/host` via Electron IPC to facilitate
renderer-side operations.

## Development

This project uses `pnpm` as its package manager and `tsup` for bundling.

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

## License

BSD-2-Clause
