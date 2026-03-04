export interface IpcTransport {
    send(channel: string, ...args: unknown[]): void;
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, listener: (...args: unknown[]) => void): () => void;
}

export class DefaultElectronGuestTransport implements IpcTransport {
    private namespace: string;

    constructor(namespace: string = "__reactronx") {
        this.namespace = namespace;
        if (typeof window === "undefined" || !(window as unknown as Record<string, IpcTransport>)[this.namespace]) {
            console.warn(
                `Reactronx: Window namespace '${this.namespace}' not found. Did you run exposeReactronxIpc() in the preload script?`,
            );
        }
    }

    send(channel: string, ...args: unknown[]): void {
        (window as unknown as Record<string, IpcTransport>)[this.namespace]?.send(channel, ...args);
    }

    invoke(channel: string, ...args: unknown[]): Promise<unknown> {
        return (
            (window as unknown as Record<string, IpcTransport>)[this.namespace]?.invoke(channel, ...args) ||
            Promise.reject("IPC Bridge not found")
        );
    }

    on(channel: string, listener: (...args: unknown[]) => void): () => void {
        return (window as unknown as Record<string, IpcTransport>)[this.namespace]?.on(channel, listener) || (() => {});
    }
}
