import { defineConfig } from "reactronx";

export default defineConfig({
    build: {
        profile: "library",
        entry: "src/index.ts",
        target: "web",
        filename: "index.js",
        declarations: true,
    },
});
