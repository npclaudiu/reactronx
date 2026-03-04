const path = require("path");

const commonConfig = {
    mode: "development",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist"),
    },
};

const mainConfig = {
    ...commonConfig,
    target: "electron-main",
    entry: {
        main: "./src/main.tsx",
    },
};

const preloadConfig = {
    ...commonConfig,
    target: "electron-preload",
    entry: {
        preload: "./src/preload.ts",
    },
};

const rendererConfig = {
    ...commonConfig,
    target: "web",
    entry: {
        renderer: "./src/renderer.ts",
    },
};

module.exports = [mainConfig, preloadConfig, rendererConfig];
