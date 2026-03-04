import fs from "node:fs";
import path from "node:path";
import { Command, InvalidOptionArgumentError } from "commander";
import { loadReactronxConfig, DEFAULT_CONFIG_PATH } from "./config";
import { runBuild } from "./build";
import { BuildMode, DefineValue, ReactronxBuildConfig } from "./types";

interface BuildCliOptions {
    config?: string;
    main?: string;
    preload?: string;
    renderer?: string;
    outDir?: string;
    mode?: BuildMode;
    sourcemap?: boolean;
    minify?: boolean;
    analyze?: boolean;
    define: string[];
    external: string[];
    clean: boolean;
    typecheck?: boolean;
}

type CommanderValueSource = "default" | "config" | "env" | "cli" | "implied" | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseBuildMode(value: string): BuildMode {
    if (value === "production" || value === "development") {
        return value;
    }

    throw new InvalidOptionArgumentError(`Invalid mode '${value}'. Use 'production' or 'development'.`);
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
            if (typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean" || parsed === null) {
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
    if (source !== "default") {
        return Boolean(cliValue);
    }

    if (typeof configValue === "boolean") {
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

function resolveMode(options: BuildCliOptions, buildConfig: ReactronxBuildConfig, source: CommanderValueSource): BuildMode {
    if (source !== "default" && options.mode) {
        return options.mode;
    }

    return buildConfig.mode ?? "production";
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

    program.name("reactronx").description("Build Electron applications with Rspack + SWC.").version(readPackageVersion());

    program
        .command("build")
        .description("Build Electron main/preload/renderer entrypoints.")
        .option("-c, --config <path>", "Path to reactronx config file.", DEFAULT_CONFIG_PATH)
        .option("--main <path>", "Main process entry file.")
        .option("--preload <path>", "Preload process entry file.")
        .option("--renderer <path>", "Renderer entry file.")
        .option("--outDir <path>", "Output directory.", "dist")
        .option("--mode <mode>", "Build mode: production or development.", parseBuildMode, "production")
        .option("--sourcemap", "Generate source maps.")
        .option("--minify", "Enable minification.")
        .option("--analyze", "Write per-target stats JSON into .reactronx-stats.")
        .option("--define <key=value>", "Define replacement values.", collectRepeatedValues, [])
        .option("--external <pkg>", "Mark package as external (repeatable).", collectRepeatedValues, [])
        .option("--no-clean", "Do not clean outDir before building.")
        .option("--typecheck", "Run tsc --noEmit before building.")
        .action(async (options: BuildCliOptions, command: Command) => {
            try {
                const cwd = process.cwd();
                const configSource = command.getOptionValueSource("config") as CommanderValueSource;
                const configPathArg = configSource === "default" ? undefined : options.config;
                const { config, configPath } = loadReactronxConfig(cwd, configPathArg);
                const buildConfig = config.build ?? {};

                const modeSource = command.getOptionValueSource("mode") as CommanderValueSource;
                const mode = resolveMode(options, buildConfig, modeSource);

                const main = options.main ?? buildConfig.main;
                if (!main) {
                    throw new Error(
                        "Missing required main entry. Provide it via --main or in reactronx.config.ts under build.main.",
                    );
                }

                const outDirSource = command.getOptionValueSource("outDir") as CommanderValueSource;
                const outDirValue = outDirSource !== "default" ? options.outDir : buildConfig.outDir ?? "dist";
                const outDir = path.resolve(cwd, outDirValue ?? "dist");

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
                    mode === "production",
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

                const preload = options.preload ?? buildConfig.preload;
                const renderer = options.renderer ?? buildConfig.renderer;

                const external = [...(buildConfig.external ?? []), ...options.external];
                const defineValues = mergeDefineValues(buildConfig, options.define);

                if (configPath) {
                    console.log(`Loaded config: ${configPath}`);
                }

                await runBuild({
                    cwd,
                    mode,
                    outDir,
                    clean,
                    sourcemap,
                    minify,
                    analyze,
                    typecheck: Boolean(options.typecheck),
                    define: defineValues,
                    external,
                    main,
                    preload,
                    renderer,
                });

                console.log(`Build completed in ${outDir}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Build failed: ${errorMessage}`);
                process.exitCode = 1;
            }
        });

    await program.parseAsync(argv);
}
