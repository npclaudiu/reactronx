import fs from "node:fs";
import path from "node:path";
import createJiti from "jiti";
import { ReactronxConfig } from "./types";

export const DEFAULT_CONFIG_PATH = "reactronx.config.ts";

export interface LoadedConfig {
    config: ReactronxConfig;
    configPath?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function normalizeConfigModule(value: unknown): ReactronxConfig {
    if (!isRecord(value)) {
        throw new Error("Reactronx config must export an object.");
    }

    const candidateBuild = value.build;
    if (typeof candidateBuild !== "undefined" && !isRecord(candidateBuild)) {
        throw new Error("Reactronx config 'build' field must be an object when provided.");
    }

    return value as ReactronxConfig;
}

function extractModuleValue(moduleExports: unknown): unknown {
    if (!isRecord(moduleExports)) {
        return moduleExports;
    }

    if ("default" in moduleExports) {
        return moduleExports.default;
    }

    return moduleExports;
}

export function loadReactronxConfig(cwd: string, configPathArg?: string): LoadedConfig {
    const requestedPath = configPathArg ?? DEFAULT_CONFIG_PATH;
    const absoluteConfigPath = path.resolve(cwd, requestedPath);
    const configExists = fs.existsSync(absoluteConfigPath);

    if (!configExists && configPathArg) {
        throw new Error(`Config file not found: ${absoluteConfigPath}`);
    }

    if (!configExists) {
        return { config: {} };
    }

    const jiti = createJiti(__filename, { interopDefault: true });
    const loadedModule = jiti(absoluteConfigPath) as unknown;
    const config = normalizeConfigModule(extractModuleValue(loadedModule));

    return {
        config,
        configPath: absoluteConfigPath,
    };
}
