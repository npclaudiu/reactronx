import { defineConfig } from "reactronx";

export default defineConfig({
    build: {
        profile: "library",
        entry: "src/index.ts",
        target: "electron-main",
        filename: "index.js",
        declarations: true,
    },
});
