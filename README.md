# reactronx

> A set of NPM packages providing support for managing Electron.js resources using React.js.

This is a PNPM monorepo containing the core packages for the `reactronx` ecosystem. It enables developers to build
Electron applications declaratively by backing React components with Electron primitives.

## Packages

### `@reactronx/host`

Runs in the **Main Process** of an Electron application. It provides a custom React Reconciler backed by Electron
primitives (like `BrowserWindow`, `WebContentsView`, `Menu`, etc.), allowing you to manage your application's native
lifecycle with React.

### `@reactronx/guest`

Runs in the **Renderer Process** of an Electron application. It acts as the peer package communicating with
`@reactronx/host` via Electron IPC to facilitate renderer-side operations.

### `@reactronx/guest-preload`

Runs in the **Preload Script** of an Electron application. It has access to Electron-specific resources (such as IPC
bridges) and is responsible for securely exposing APIs to the `@reactronx/guest` renderer package.

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

## Releases & Dependency Management

This repository uses [Google Release Please](https://github.com/googleapis/release-please) to automate the publishing
pipeline.

When commits following [Conventional Commits](https://www.conventionalcommits.org/) are merged into the `main` branch,
Release Please automatically updates the changelogs, bumps the semantic versioning across all packages, and opens a
pending **Release PR**.

Merging this Release PR triggers the GitHub Actions workflow, which securely builds and publishes the packages to the
NPM registry. Thanks to the `linked-versions` plugin, `@reactronx/host`, `@reactronx/guest`, and
`@reactronx/guest-preload` will always be published bearing the exact same version number.

For information on how to configure the NPM registry to trust this GitHub Actions workflow, please refer to the
[NPM Provenance Guide](./docs/guides/npm-provenance.md).

### Dependabot

The repository is configured with Dependabot to automatically keep all workspace dependencies and GitHub Actions
strictly up to date. Dependabot runs weekly and groups its updates into categorized branches to reduce PR noise.

## License

BSD-2-Clause
