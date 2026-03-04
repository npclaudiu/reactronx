export type BuildMode = "production" | "development";

export type DefineValue = string | number | boolean | null;

export interface ReactronxBuildConfig {
    main?: string;
    preload?: string;
    renderer?: string;
    outDir?: string;
    mode?: BuildMode;
    sourcemap?: boolean;
    minify?: boolean;
    analyze?: boolean;
    define?: Record<string, DefineValue>;
    external?: string[];
    clean?: boolean;
}

export interface ReactronxConfig {
    build?: ReactronxBuildConfig;
}

export function defineConfig(config: ReactronxConfig): ReactronxConfig {
    return config;
}
