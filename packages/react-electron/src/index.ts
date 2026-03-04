export { render } from "./reconciler";
export type { IpcTransport } from "./transport";
export { DefaultElectronMainTransport } from "./transport";

// Add global JSX declarations
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        interface IntrinsicElements {
            app: Record<string, unknown>;
            window: Record<string, unknown>;
            webcontents: Record<string, unknown>;
        }
    }
}
