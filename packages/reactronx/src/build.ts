import fs from "node:fs";
import path from "node:path";
import { builtinModules, createRequire } from "node:module";
import { DefinePlugin, rspack, type Configuration, type Stats } from "@rspack/core";
import type * as TypeScript from "typescript";
import { BuildMode, BuildProfile, DefineValue, LibraryTarget } from "./types";

type TypeScriptModule = typeof import("typescript");
type TypeScriptRuntimeSource = "workspace" | "bundled";
type BuildStatsName = "main" | "preload" | "renderer";

interface TypeScriptRuntime {
    ts: TypeScriptModule;
    source: TypeScriptRuntimeSource;
    resolvedPath: string;
}

interface ExternalResolverData {
    request?: string;
}

type ExternalResolverCallback = (error?: Error | null, result?: string) => void;
type ExternalResolver = (data: ExternalResolverData, callback: ExternalResolverCallback) => void;

interface ClosableCompiler {
    close(callback: (error?: Error | null) => void): void;
}

interface BaseRunBuildOptions {
    profile: BuildProfile;
    cwd: string;
    mode: BuildMode;
    outDir: string;
    clean: boolean;
    sourcemap: boolean;
    minify: boolean;
    analyze: boolean;
    define: Record<string, DefineValue>;
    external: string[];
    typecheck: boolean;
    tsconfigPath: string;
}

interface ExecutableRunBuildOptions extends BaseRunBuildOptions {
    profile: "executable";
    main: string;
    preload?: string;
    renderer?: string;
}

interface LibraryRunBuildOptions extends BaseRunBuildOptions {
    profile: "library";
    entry: string;
    target: LibraryTarget;
    filename: string;
    declarations: boolean;
    externalizeDependencies: boolean;
}

export type RunBuildOptions = ExecutableRunBuildOptions | LibraryRunBuildOptions;

interface RspackBuildJob {
    name: BuildStatsName;
    entry: string;
    target: LibraryTarget;
    filename: string;
    externalizeNodeModules: boolean;
    externals: Set<string>;
    emitCommonJsLibrary: boolean;
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

function ensureEntryExists(entryLabel: string, absolutePath: string): void {
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Missing ${entryLabel} entry file: ${absolutePath}`);
    }
}

async function writeAnalysis(target: BuildStatsName, outDir: string, stats: Stats): Promise<void> {
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

function createRspackConfig(job: RspackBuildJob, options: BaseRunBuildOptions, shouldClean: boolean): Configuration {
    const defineValues = serializeDefineValues(options.define);
    const plugins = Object.keys(defineValues).length > 0 ? [new DefinePlugin(defineValues)] : [];

    return {
        context: options.cwd,
        mode: options.mode,
        target: job.target,
        entry: {
            [job.name]: job.entry,
        },
        output: {
            path: options.outDir,
            filename: job.filename,
            library: job.emitCommonJsLibrary ? { type: "commonjs2" } : undefined,
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
        externals: [
            createExternalResolver(job.externals, job.externalizeNodeModules),
        ] as unknown as Configuration["externals"],
        optimization: {
            minimize: options.minify,
        },
        devtool: options.sourcemap ? "source-map" : false,
        plugins,
    };
}

function createExecutableBuildJobs(options: ExecutableRunBuildOptions): RspackBuildJob[] {
    const sharedExternals = new Set<string>(options.external);

    const jobs: RspackBuildJob[] = [
        {
            name: "main",
            entry: path.resolve(options.cwd, options.main),
            target: "electron-main",
            filename: "main.js",
            externalizeNodeModules: true,
            externals: sharedExternals,
            emitCommonJsLibrary: false,
        },
    ];

    if (options.preload) {
        jobs.push({
            name: "preload",
            entry: path.resolve(options.cwd, options.preload),
            target: "electron-preload",
            filename: "preload.js",
            // Bundle preload dependencies so sandboxed preload scripts don't rely on Node module resolution.
            externalizeNodeModules: false,
            externals: sharedExternals,
            emitCommonJsLibrary: false,
        });
    }

    if (options.renderer) {
        jobs.push({
            name: "renderer",
            entry: path.resolve(options.cwd, options.renderer),
            target: "electron-renderer",
            filename: "renderer.js",
            externalizeNodeModules: false,
            externals: sharedExternals,
            emitCommonJsLibrary: false,
        });
    }

    return jobs;
}

function resolveTypeScriptRuntime(cwd: string): TypeScriptRuntime {
    const workspaceRequire = createRequire(path.join(cwd, "package.json"));
    try {
        const resolvedPath = workspaceRequire.resolve("typescript");
        const ts = workspaceRequire(resolvedPath) as TypeScriptModule;
        return {
            ts,
            source: "workspace",
            resolvedPath,
        };
    } catch {
        // fall through to bundled resolution
    }

    const bundledRequire = createRequire(__filename);
    try {
        const resolvedPath = bundledRequire.resolve("typescript");
        const ts = bundledRequire(resolvedPath) as TypeScriptModule;
        return {
            ts,
            source: "bundled",
            resolvedPath,
        };
    } catch {
        throw new Error(
            "TypeScript runtime is unavailable. Install 'typescript' in your project or use a reactronx version that bundles it.",
        );
    }
}

function formatTypeScriptDiagnostics(ts: TypeScriptModule, diagnostics: readonly TypeScript.Diagnostic[]): string {
    if (diagnostics.length === 0) {
        return "";
    }

    const host: TypeScript.FormatDiagnosticsHost = {
        getCanonicalFileName: (fileName) => (ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => ts.sys.newLine,
    };

    return ts.formatDiagnosticsWithColorAndContext(diagnostics, host);
}

function loadTsConfig(
    ts: TypeScriptModule,
    cwd: string,
    tsconfigPath: string,
    overrides: TypeScript.CompilerOptions,
): TypeScript.ParsedCommandLine {
    const absoluteTsconfigPath = path.resolve(cwd, tsconfigPath);
    if (!fs.existsSync(absoluteTsconfigPath)) {
        throw new Error(`tsconfig file not found: ${absoluteTsconfigPath}`);
    }

    const configFileResult = ts.readConfigFile(absoluteTsconfigPath, ts.sys.readFile);
    if (configFileResult.error) {
        throw new Error(formatTypeScriptDiagnostics(ts, [configFileResult.error]));
    }

    const parsed = ts.parseJsonConfigFileContent(
        configFileResult.config,
        ts.sys,
        path.dirname(absoluteTsconfigPath),
        overrides,
        absoluteTsconfigPath,
    );

    if (parsed.errors.length > 0) {
        throw new Error(formatTypeScriptDiagnostics(ts, parsed.errors));
    }

    return parsed;
}

function runTypecheck(runtime: TypeScriptRuntime, cwd: string, tsconfigPath: string): void {
    const parsed = loadTsConfig(runtime.ts, cwd, tsconfigPath, {
        noEmit: true,
    });

    const program = runtime.ts.createProgram({
        rootNames: parsed.fileNames,
        options: parsed.options,
        projectReferences: parsed.projectReferences,
    });

    const diagnostics = runtime.ts.getPreEmitDiagnostics(program);
    if (diagnostics.length > 0) {
        throw new Error(formatTypeScriptDiagnostics(runtime.ts, diagnostics));
    }
}

function getLibraryModuleKind(ts: TypeScriptModule, target: LibraryTarget): TypeScript.ModuleKind {
    switch (target) {
        case "node":
        case "electron-main":
        case "electron-preload":
            return ts.ModuleKind.CommonJS;
        case "web":
        case "electron-renderer":
            return ts.ModuleKind.ESNext;
    }
}

function warnForIgnoredLibraryOptions(options: LibraryRunBuildOptions): void {
    const ignoredFlags: string[] = [];

    if (options.minify) {
        ignoredFlags.push("--minify");
    }

    if (options.analyze) {
        ignoredFlags.push("--analyze");
    }

    if (Object.keys(options.define).length > 0) {
        ignoredFlags.push("--define");
    }

    if (options.external.length > 0) {
        ignoredFlags.push("--external");
    }

    if (!options.externalizeDependencies) {
        ignoredFlags.push("--no-externalize-dependencies");
    }

    if (ignoredFlags.length === 0) {
        return;
    }

    console.warn(`Library builds use TypeScript emit; ignoring ${ignoredFlags.join(", ")}.`);
}

function runTypeScriptLibraryBuild(runtime: TypeScriptRuntime, options: LibraryRunBuildOptions): void {
    if (options.clean) {
        fs.rmSync(options.outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(options.outDir, { recursive: true });

    const absoluteEntryPath = path.resolve(options.cwd, options.entry);
    ensureEntryExists("library", absoluteEntryPath);

    warnForIgnoredLibraryOptions(options);

    const parsed = loadTsConfig(runtime.ts, options.cwd, options.tsconfigPath, {
        outDir: options.outDir,
        noEmit: false,
        declaration: options.declarations,
        emitDeclarationOnly: false,
        sourceMap: options.sourcemap,
        module: getLibraryModuleKind(runtime.ts, options.target),
        target: runtime.ts.ScriptTarget.ES2022,
        noEmitOnError: options.typecheck,
    });

    const normalizePath = (filePath: string) => {
        const absolutePath = path.resolve(filePath);
        return runtime.ts.sys.useCaseSensitiveFileNames ? absolutePath : absolutePath.toLowerCase();
    };

    const includedSourceFiles = new Set(parsed.fileNames.map(normalizePath));
    if (!includedSourceFiles.has(normalizePath(absoluteEntryPath))) {
        throw new Error(
            `Library entry '${absoluteEntryPath}' is not included by tsconfig '${path.resolve(options.cwd, options.tsconfigPath)}'.`,
        );
    }

    const program = runtime.ts.createProgram({
        rootNames: parsed.fileNames,
        options: parsed.options,
        projectReferences: parsed.projectReferences,
    });

    const preEmitDiagnostics = options.typecheck ? runtime.ts.getPreEmitDiagnostics(program) : [];
    const emitResult = program.emit();
    const allDiagnostics = [...preEmitDiagnostics, ...emitResult.diagnostics];

    if (allDiagnostics.length > 0) {
        throw new Error(formatTypeScriptDiagnostics(runtime.ts, allDiagnostics));
    }

    const outputFileNames = runtime.ts.getOutputFileNames(
        parsed,
        absoluteEntryPath,
        !runtime.ts.sys.useCaseSensitiveFileNames,
    );
    const emittedEntryJs = outputFileNames.find((outputPath) => outputPath.endsWith(".js"));

    if (!emittedEntryJs) {
        throw new Error(`TypeScript did not emit a JavaScript output for entry '${absoluteEntryPath}'.`);
    }

    const expectedEntryJsPath = path.resolve(options.outDir, options.filename);
    const actualEntryJsPath = path.resolve(emittedEntryJs);

    if (expectedEntryJsPath !== actualEntryJsPath) {
        throw new Error(
            `Library filename '${options.filename}' is incompatible with TypeScript output '${path.relative(
                options.outDir,
                actualEntryJsPath,
            )}'. Use a matching filename or adjust the library entry path.`,
        );
    }
}

export async function runBuild(options: RunBuildOptions): Promise<void> {
    if (options.profile === "executable") {
        await fs.promises.mkdir(options.outDir, { recursive: true });

        if (options.typecheck) {
            const runtime = resolveTypeScriptRuntime(options.cwd);
            console.log(`Running typecheck with TypeScript (${runtime.source}) from ${runtime.resolvedPath}...`);
            runTypecheck(runtime, options.cwd, options.tsconfigPath);
        }

        const buildJobs = createExecutableBuildJobs(options);

        for (const job of buildJobs) {
            ensureEntryExists(job.name, job.entry);
        }

        let shouldClean = options.clean;
        for (const job of buildJobs) {
            console.log(`Building ${job.name} (${job.entry})...`);
            const stats = await runRspackBuild(createRspackConfig(job, options, shouldClean));

            if (options.analyze) {
                await writeAnalysis(job.name, options.outDir, stats);
            }

            shouldClean = false;
        }

        return;
    }

    const runtime = resolveTypeScriptRuntime(options.cwd);
    console.log(`Building library with TypeScript (${runtime.source}) from ${runtime.resolvedPath}...`);
    runTypeScriptLibraryBuild(runtime, options);
}
