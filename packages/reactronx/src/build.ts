import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { builtinModules } from "node:module";
import { DefinePlugin, rspack, type Configuration, type Stats } from "@rspack/core";
import { BuildMode, DefineValue } from "./types";

type BuildTargetName = "main" | "preload" | "renderer";

interface BuildTarget {
    name: BuildTargetName;
    entry: string;
    target: "electron-main" | "electron-preload" | "electron-renderer";
    filename: string;
    externalizeNodeModules: boolean;
}

interface ExternalResolverData {
    request?: string;
}

type ExternalResolverCallback = (error?: Error | null, result?: string) => void;
type ExternalResolver = (data: ExternalResolverData, callback: ExternalResolverCallback) => void;

interface ClosableCompiler {
    close(callback: (error?: Error | null) => void): void;
}

export interface RunBuildOptions {
    cwd: string;
    mode: BuildMode;
    outDir: string;
    clean: boolean;
    sourcemap: boolean;
    minify: boolean;
    analyze: boolean;
    typecheck: boolean;
    define: Record<string, DefineValue>;
    external: string[];
    main: string;
    preload?: string;
    renderer?: string;
}

const nodeBuiltinModules = new Set<string>([
    ...builtinModules,
    ...builtinModules.map((moduleName) => `node:${moduleName}`),
]);

function isBareSpecifier(request: string): boolean {
    return !request.startsWith(".") && !path.isAbsolute(request) && !request.startsWith("data:");
}

function extractPackageName(request: string): string {
    const cleanedRequest = request.startsWith("node:") ? request.slice(5) : request;
    const [firstSegment, secondSegment] = cleanedRequest.split("/");
    if (firstSegment.startsWith("@") && secondSegment) {
        return `${firstSegment}/${secondSegment}`;
    }
    return firstSegment;
}

function shouldExternalizeRequest(
    request: string,
    extraExternals: Set<string>,
    externalizeNodeModules: boolean,
): boolean {
    if (request === "electron") {
        return true;
    }

    if (nodeBuiltinModules.has(request)) {
        return true;
    }

    if (!isBareSpecifier(request)) {
        return false;
    }

    if (externalizeNodeModules) {
        return true;
    }

    const packageName = extractPackageName(request);
    return extraExternals.has(request) || extraExternals.has(packageName);
}

function createExternalResolver(extraExternals: Set<string>, externalizeNodeModules: boolean): ExternalResolver {
    return (data, callback) => {
        const request = data.request;
        if (!request) {
            callback();
            return;
        }

        const requestWithoutQuery = request.split("?")[0];
        if (!shouldExternalizeRequest(requestWithoutQuery, extraExternals, externalizeNodeModules)) {
            callback();
            return;
        }

        callback(null, `commonjs ${requestWithoutQuery}`);
    };
}

function serializeDefineValues(values: Record<string, DefineValue>): Record<string, string> {
    return Object.entries(values).reduce<Record<string, string>>((accumulator, [key, value]) => {
        accumulator[key] = JSON.stringify(value);
        return accumulator;
    }, {});
}

function isClosableCompiler(candidate: unknown): candidate is ClosableCompiler {
    return typeof candidate === "object" && candidate !== null && "close" in candidate;
}

function closeCompiler(compiler: unknown): Promise<void> {
    if (!isClosableCompiler(compiler)) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        compiler.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function runRspackBuild(config: Configuration): Promise<Stats> {
    const compiler = rspack(config);
    return new Promise((resolve, reject) => {
        compiler.run(async (error, stats) => {
            try {
                await closeCompiler(compiler);
            } catch (closeError) {
                reject(closeError);
                return;
            }

            if (error) {
                reject(error);
                return;
            }

            if (!stats) {
                reject(new Error("Rspack did not return build stats."));
                return;
            }

            if (stats.hasErrors()) {
                reject(new Error(stats.toString({ all: false, errors: true, warnings: true })));
                return;
            }

            resolve(stats);
        });
    });
}

function ensureEntryExists(targetName: BuildTargetName, absolutePath: string): void {
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Missing ${targetName} entry file: ${absolutePath}`);
    }
}

async function writeAnalysis(target: BuildTargetName, outDir: string, stats: Stats): Promise<void> {
    const statsDirectory = path.join(outDir, ".reactronx-stats");
    await fs.promises.mkdir(statsDirectory, { recursive: true });

    const serializedStats = stats.toJson({
        all: false,
        hash: true,
        assets: true,
        chunks: true,
        chunkModules: true,
        timings: true,
        errors: true,
        warnings: true,
    });

    const outputPath = path.join(statsDirectory, `${target}.json`);
    await fs.promises.writeFile(outputPath, `${JSON.stringify(serializedStats, null, 2)}\n`, "utf8");
}

function createRspackConfig(
    target: BuildTarget,
    options: RunBuildOptions,
    shouldClean: boolean,
    extraExternals: Set<string>,
): Configuration {
    const defineValues = serializeDefineValues(options.define);
    const plugins =
        Object.keys(defineValues).length > 0 ? [new DefinePlugin(defineValues)] : [];

    return {
        context: options.cwd,
        mode: options.mode,
        target: target.target,
        entry: {
            [target.name]: target.entry,
        },
        output: {
            path: options.outDir,
            filename: target.filename,
            clean: shouldClean,
        },
        resolve: {
            extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    exclude: /node_modules/,
                    loader: "builtin:swc-loader",
                    options: {
                        sourceMaps: options.sourcemap,
                        jsc: {
                            target: "es2022",
                            parser: {
                                syntax: "typescript",
                                tsx: true,
                                dynamicImport: true,
                                decorators: true,
                            },
                            transform: {
                                react: {
                                    runtime: "automatic",
                                    development: options.mode === "development",
                                },
                            },
                        },
                    },
                },
                {
                    test: /\.jsx?$/,
                    exclude: /node_modules/,
                    loader: "builtin:swc-loader",
                    options: {
                        sourceMaps: options.sourcemap,
                        jsc: {
                            target: "es2022",
                            parser: {
                                syntax: "ecmascript",
                                jsx: true,
                                dynamicImport: true,
                            },
                            transform: {
                                react: {
                                    runtime: "automatic",
                                    development: options.mode === "development",
                                },
                            },
                        },
                    },
                },
            ],
        },
        externalsType: "commonjs",
        externals: [createExternalResolver(extraExternals, target.externalizeNodeModules)] as unknown as Configuration["externals"],
        optimization: {
            minimize: options.minify,
        },
        devtool: options.sourcemap ? "source-map" : false,
        plugins,
    };
}

function createBuildTargets(options: RunBuildOptions): BuildTarget[] {
    const targets: BuildTarget[] = [
        {
            name: "main",
            entry: path.resolve(options.cwd, options.main),
            target: "electron-main",
            filename: "main.js",
            externalizeNodeModules: true,
        },
    ];

    if (options.preload) {
        targets.push({
            name: "preload",
            entry: path.resolve(options.cwd, options.preload),
            target: "electron-preload",
            filename: "preload.js",
            externalizeNodeModules: true,
        });
    }

    if (options.renderer) {
        targets.push({
            name: "renderer",
            entry: path.resolve(options.cwd, options.renderer),
            target: "electron-renderer",
            filename: "renderer.js",
            externalizeNodeModules: false,
        });
    }

    return targets;
}

function runTypecheck(cwd: string): Promise<void> {
    const binary = process.platform === "win32" ? "tsc.cmd" : "tsc";
    return new Promise((resolve, reject) => {
        const child = spawn(binary, ["--noEmit"], {
            cwd,
            stdio: "inherit",
        });

        child.on("error", (error) => {
            reject(error);
        });

        child.on("exit", (exitCode) => {
            if (exitCode === 0) {
                resolve();
                return;
            }
            reject(new Error(`Typecheck failed with exit code ${exitCode ?? "unknown"}.`));
        });
    });
}

export async function runBuild(options: RunBuildOptions): Promise<void> {
    const targets = createBuildTargets(options);
    for (const target of targets) {
        ensureEntryExists(target.name, target.entry);
    }

    await fs.promises.mkdir(options.outDir, { recursive: true });

    if (options.typecheck) {
        console.log("Running typecheck...");
        await runTypecheck(options.cwd);
    }

    const extraExternals = new Set<string>(options.external);
    let shouldClean = options.clean;

    for (const target of targets) {
        console.log(`Building ${target.name} (${target.entry})...`);
        const config = createRspackConfig(target, options, shouldClean, extraExternals);
        const stats = await runRspackBuild(config);

        if (options.analyze) {
            await writeAnalysis(target.name, options.outDir, stats);
        }

        shouldClean = false;
    }
}
