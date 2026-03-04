const path = require("path");

module.exports = {
    mode: "production",
    target: "electron-main",
    entry: "./src/index.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "index.js",
        library: {
            type: "commonjs",
        },
        clean: true,
    },
    externals: ["electron", "react", "react-reconciler"],
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [{ loader: "ts-loader", options: { compilerOptions: { noEmit: false } } }],
                exclude: /node_modules/,
            },
        ],
    },
};
