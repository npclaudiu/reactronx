import fs from "node:fs";
import path from "node:path";
import { Command, InvalidOptionArgumentError } from "commander";
import { loadReactronxConfig, DEFAULT_CONFIG_PATH } from "./config";
import { runBuild } from "./build";
import { BuildMode, BuildProfile, DefineValue, LibraryTarget, ReactronxBuildConfig } from "./types";

interface BuildCliOptions {
    config?: string;
    profile?: BuildProfile;
    main?: string;
    preload?: string;
    renderer?: string;
    entry?: string;
    target?: LibraryTarget;
    filename?: string;
    outDir?: string;
    mode?: BuildMode;
    sourcemap?: boolean;
    minify?: boolean;
    analyze?: boolean;
    define: string[];
    external: string[];
    clean: boolean;
    typecheck?: boolean;
    declarations?: boolean;
    tsconfig?: string;
    externalizeDependencies: boolean;
}

type CommanderValueSource = "default" | "config" | "env" | "cli" | "implied" | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isOptionExplicit(source: CommanderValueSource): boolean {
    return source === "cli" || source === "env" || source === "implied";
}

function parseBuildMode(value: string): BuildMode {
    if (value === "production" || value === "development") {
        return value;
    }

    throw new InvalidOptionArgumentError(`Invalid mode '${value}'. Use 'production' or 'development'.`);
}

function parseBuildProfile(value: string): BuildProfile {
    if (value === "executable" || value === "library") {
        return value;
    }

    throw new InvalidOptionArgumentError(`Invalid profile '${value}'. Use 'executable' or 'library'.`);
}

function parseLibraryTarget(value: string): LibraryTarget {
    const supportedTargets: LibraryTarget[] = ["node", "web", "electron-main", "electron-preload", "electron-renderer"];

    if (supportedTargets.includes(value as LibraryTarget)) {
        return value as LibraryTarget;
    }

    throw new InvalidOptionArgumentError(
        `Invalid library target '${value}'. Use one of: ${supportedTargets.join(", ")}.`,
    );
}

function collectRepeatedValues(value: string, previous: string[]): string[] {
    return [...previous, value];
}

function parseDefineLiteral(rawValue: string): DefineValue {
    const trimmedValue = rawValue.trim();

    if (trimmedValue === "true") {
        return true;
    }

    if (trimmedValue === "false") {
        return false;
    }

    if (trimmedValue === "null") {
        return null;
    }

    const parsedNumber = Number(trimmedValue);
    if (trimmedValue !== "" && Number.isFinite(parsedNumber)) {
        return parsedNumber;
    }

    if (
        (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) ||
        (trimmedValue.startsWith("[") && trimmedValue.endsWith("]")) ||
        (trimmedValue.startsWith('"') && trimmedValue.endsWith('"'))
    ) {
        try {
            const parsed = JSON.parse(trimmedValue) as unknown;
            if (
                typeof parsed === "string" ||
                typeof parsed === "number" ||
                typeof parsed === "boolean" ||
                parsed === null
            ) {
                return parsed;
            }
        } catch {
            return trimmedValue;
        }
    }

    return trimmedValue;
}

function parseDefineOption(entry: string): [string, DefineValue] {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
        throw new Error(`Invalid --define option '${entry}'. Expected format KEY=VALUE.`);
    }

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1);

    if (key.length === 0) {
        throw new Error(`Invalid --define option '${entry}'. KEY cannot be empty.`);
    }

    return [key, parseDefineLiteral(value)];
}

function getBooleanOptionValue(
    cliValue: boolean | undefined,
    source: CommanderValueSource,
    configValue: boolean | undefined,
    fallbackValue: boolean,
): boolean {
    if (isOptionExplicit(source)) {
        return Boolean(cliValue);
    }

    if (typeof configValue === "boolean") {
        return configValue;
    }

    return fallbackValue;
}

function getStringOptionValue(
    cliValue: string | undefined,
    source: CommanderValueSource,
    configValue: string | undefined,
    fallbackValue: string,
): string {
    if (isOptionExplicit(source) && cliValue) {
        return cliValue;
    }

    if (typeof configValue === "string" && configValue.length > 0) {
        return configValue;
    }

    return fallbackValue;
}

function normalizeDefineRecord(candidate: unknown): Record<string, DefineValue> {
    if (!isRecord(candidate)) {
        return {};
    }

    const defineEntries = Object.entries(candidate).reduce<Record<string, DefineValue>>((accumulator, [key, value]) => {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
            accumulator[key] = value;
        }
        return accumulator;
    }, {});

    return defineEntries;
}

function mergeDefineValues(configBuild: ReactronxBuildConfig, cliDefineEntries: string[]): Record<string, DefineValue> {
    const mergedValues = { ...normalizeDefineRecord(configBuild.define) };

    for (const entry of cliDefineEntries) {
        const [key, value] = parseDefineOption(entry);
        mergedValues[key] = value;
    }

    return mergedValues;
}

function resolveMode(
    options: BuildCliOptions,
    buildConfig: ReactronxBuildConfig,
    source: CommanderValueSource,
): BuildMode {
    if (isOptionExplicit(source) && options.mode) {
        return options.mode;
    }

    return buildConfig.mode ?? "production";
}

function resolveProfile(
    options: BuildCliOptions,
    buildConfig: ReactronxBuildConfig,
    source: CommanderValueSource,
): BuildProfile {
    if (isOptionExplicit(source) && options.profile) {
        return options.profile;
    }

    return buildConfig.profile ?? "executable";
}

function resolveLibraryTarget(
    options: BuildCliOptions,
    buildConfig: ReactronxBuildConfig,
    source: CommanderValueSource,
): LibraryTarget {
    if (isOptionExplicit(source) && options.target) {
        return options.target;
    }

    return buildConfig.target ?? "node";
}

function readPackageVersion(): string {
    const packageJsonPath = path.resolve(__dirname, "../package.json");
    if (!fs.existsSync(packageJsonPath)) {
        return "0.0.0";
    }

    const packageJsonRaw = fs.readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonRaw) as unknown;

    if (!isRecord(packageJson)) {
        return "0.0.0";
    }

    const version = packageJson.version;
    return typeof version === "string" ? version : "0.0.0";
}

export async function runCli(argv: string[]): Promise<void> {
    const program = new Command();

    program
        .name("reactronx")
        .description("Build Electron applications and libraries with Rspack/SWC and TypeScript.")
        .version(readPackageVersion());

    program
        .command("build")
        .description("Build executable Electron targets or library bundles.")
        .option("-c, --config <path>", "Path to reactronx config file.", DEFAULT_CONFIG_PATH)
        .option("--profile <profile>", "Build profile: executable or library.", parseBuildProfile, "executable")
        .option("--main <path>", "Main process entry file (executable profile).")
        .option("--preload <path>", "Preload process entry file (executable profile).")
        .option("--renderer <path>", "Renderer entry file (executable profile).")
        .option("--entry <path>", "Library entry file (library profile).")
        .option("--target <target>", "Library target.", parseLibraryTarget)
        .option("--filename <name>", "Library output filename.")
        .option("--declarations", "Emit .d.ts files using TypeScript (library profile).")
        .option("--tsconfig <path>", "tsconfig used for typecheck/declaration emission.")
        .option("--no-externalize-dependencies", "Do not auto-externalize package dependencies (library profile).")
        .option("--outDir <path>", "Output directory.", "dist")
        .option("--mode <mode>", "Build mode: production or development.", parseBuildMode, "production")
        .option("--sourcemap", "Generate source maps.")
        .option("--minify", "Enable minification.")
        .option("--analyze", "Write per-target stats JSON into .reactronx-stats.")
        .option("--define <key=value>", "Define replacement values.", collectRepeatedValues, [])
        .option("--external <pkg>", "Mark package as external (repeatable).", collectRepeatedValues, [])
        .option("--no-clean", "Do not clean outDir before building.")
        .option("--typecheck", "Run TypeScript typecheck before build (executable profile).")
        .action(async (options: BuildCliOptions, command: Command) => {
            try {
                const cwd = process.cwd();
                const configSource = command.getOptionValueSource("config") as CommanderValueSource;
                const configPathArg = isOptionExplicit(configSource) ? options.config : undefined;
                const { config, configPath } = loadReactronxConfig(cwd, configPathArg);
                const buildConfig = config.build ?? {};

                const profile = resolveProfile(
                    options,
                    buildConfig,
                    command.getOptionValueSource("profile") as CommanderValueSource,
                );

                const modeSource = command.getOptionValueSource("mode") as CommanderValueSource;
                const mode = resolveMode(options, buildConfig, modeSource);

                const outDir = path.resolve(
                    cwd,
                    getStringOptionValue(
                        options.outDir,
                        command.getOptionValueSource("outDir") as CommanderValueSource,
                        buildConfig.outDir,
                        "dist",
                    ),
                );

                const sourcemap = getBooleanOptionValue(
                    options.sourcemap,
                    command.getOptionValueSource("sourcemap") as CommanderValueSource,
                    buildConfig.sourcemap,
                    false,
                );

                const minify = getBooleanOptionValue(
                    options.minify,
                    command.getOptionValueSource("minify") as CommanderValueSource,
                    buildConfig.minify,
                    profile === "executable" ? mode === "production" : false,
                );

                const analyze = getBooleanOptionValue(
                    options.analyze,
                    command.getOptionValueSource("analyze") as CommanderValueSource,
                    buildConfig.analyze,
                    false,
                );

                const clean = getBooleanOptionValue(
                    options.clean,
                    command.getOptionValueSource("clean") as CommanderValueSource,
                    buildConfig.clean,
                    true,
                );

                const typecheck = getBooleanOptionValue(
                    options.typecheck,
                    command.getOptionValueSource("typecheck") as CommanderValueSource,
                    buildConfig.typecheck,
                    false,
                );

                const tsconfigPath = path.resolve(
                    cwd,
                    getStringOptionValue(
                        options.tsconfig,
                        command.getOptionValueSource("tsconfig") as CommanderValueSource,
                        buildConfig.tsconfig,
                        "tsconfig.json",
                    ),
                );

                const external = [...(buildConfig.external ?? []), ...options.external];
                const defineValues = mergeDefineValues(buildConfig, options.define);

                if (configPath) {
                    console.log(`Loaded config: ${configPath}`);
                }

                if (profile === "executable") {
                    const main = options.main ?? buildConfig.main;
                    if (!main) {
                        throw new Error(
                            "Missing required main entry. Provide it via --main or in reactronx.config.ts under build.main.",
                        );
                    }

                    await runBuild({
                        profile,
                        cwd,
                        mode,
                        outDir,
                        clean,
                        sourcemap,
                        minify,
                        analyze,
                        define: defineValues,
                        external,
                        typecheck,
                        tsconfigPath,
                        main,
                        preload: options.preload ?? buildConfig.preload,
                        renderer: options.renderer ?? buildConfig.renderer,
                    });
                } else {
                    const entry = options.entry ?? buildConfig.entry;
                    if (!entry) {
                        throw new Error(
                            "Missing required library entry. Provide it via --entry or in reactronx.config.ts under build.entry.",
                        );
                    }

                    const externalizeDependencies = getBooleanOptionValue(
                        options.externalizeDependencies,
                        command.getOptionValueSource("externalizeDependencies") as CommanderValueSource,
                        buildConfig.externalizeDependencies,
                        true,
                    );

                    const declarations = getBooleanOptionValue(
                        options.declarations,
                        command.getOptionValueSource("declarations") as CommanderValueSource,
                        buildConfig.declarations,
                        true,
                    );

                    const libraryTarget = resolveLibraryTarget(
                        options,
                        buildConfig,
                        command.getOptionValueSource("target") as CommanderValueSource,
                    );

                    const filename = getStringOptionValue(
                        options.filename,
                        command.getOptionValueSource("filename") as CommanderValueSource,
                        buildConfig.filename,
                        "index.js",
                    );

                    await runBuild({
                        profile,
                        cwd,
                        mode,
                        outDir,
                        clean,
                        sourcemap,
                        minify,
                        analyze,
                        define: defineValues,
                        external,
                        typecheck,
                        tsconfigPath,
                        entry,
                        target: libraryTarget,
                        filename,
                        declarations,
                        externalizeDependencies,
                    });
                }

                console.log(`Build completed in ${outDir}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Build failed: ${errorMessage}`);
                process.exitCode = 1;
            }
        });

    await program.parseAsync(argv);
}
