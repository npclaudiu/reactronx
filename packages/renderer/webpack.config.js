const path = require("path");

module.exports = {
    mode: "production",
    target: "web",
    entry: "./src/index.ts",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "index.js",
        library: {
            type: "commonjs",
        },
        clean: true,
    },
    externals: ["react", "react-dom"],
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
