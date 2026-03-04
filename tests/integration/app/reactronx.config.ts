export default {
    build: {
        profile: "executable",
        main: "src/main.tsx",
        preload: "src/preload.ts",
        renderer: "src/renderer.ts",
        outDir: "dist",
    },
};
