export type BuildMode = "production" | "development";
export type BuildProfile = "executable" | "library";
export type LibraryTarget = "node" | "web" | "electron-main" | "electron-preload" | "electron-renderer";

export type DefineValue = string | number | boolean | null;

export interface ReactronxBuildConfig {
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
    define?: Record<string, DefineValue>;
    external?: string[];
    clean?: boolean;
    typecheck?: boolean;
    declarations?: boolean;
    tsconfig?: string;
    externalizeDependencies?: boolean;
}

export interface ReactronxConfig {
    build?: ReactronxBuildConfig;
}

export function defineConfig(config: ReactronxConfig): ReactronxConfig {
    return config;
}
