export { render } from "./reconciler";

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
