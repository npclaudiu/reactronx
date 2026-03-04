import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/integration/specs",
    outputDir: "./tests/integration/results",
    timeout: 30000,
    expect: {
        timeout: 5000,
    },
    fullyParallel: false,
    workers: 1, // Electron tests often conflict if run in parallel due to port/display bindings
    reporter: "list",
    use: {
        trace: "on-first-retry",
    },
});
