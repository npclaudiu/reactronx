import { contextBridge, ipcRenderer } from "electron";

type ChannelPattern = string;

interface ChannelPolicy {
    send: readonly ChannelPattern[];
    invoke: readonly ChannelPattern[];
    on: readonly ChannelPattern[];
}

interface ExposeReactronxIpcOptions {
    policy?: Partial<ChannelPolicy>;
}

const defaultChannelPolicy: ChannelPolicy = {
    send: ["reactronx:command"],
    invoke: [],
    on: ["reactronx:event:*"],
};

function isChannelAllowed(channel: string, patterns: readonly ChannelPattern[]): boolean {
    return patterns.some((pattern) => {
        if (pattern.endsWith("*")) {
            const prefix = pattern.slice(0, -1);
            return channel.startsWith(prefix);
        }
        return channel === pattern;
    });
}

function assertChannelAllowed(operation: keyof ChannelPolicy, channel: string, policy: ChannelPolicy): void {
    if (!isChannelAllowed(channel, policy[operation])) {
        throw new Error(`Reactronx preload blocked '${operation}' on disallowed channel '${channel}'.`);
    }
}

export function exposeReactronxIpc(namespace: string = "__reactronx", options: ExposeReactronxIpcOptions = {}) {
    const policy: ChannelPolicy = {
        send: options.policy?.send ?? defaultChannelPolicy.send,
        invoke: options.policy?.invoke ?? defaultChannelPolicy.invoke,
        on: options.policy?.on ?? defaultChannelPolicy.on,
    };

    contextBridge.exposeInMainWorld(namespace, {
        send: (channel: string, ...args: unknown[]) => {
            assertChannelAllowed("send", channel, policy);
            ipcRenderer.send(channel, ...args);
        },
        invoke: (channel: string, ...args: unknown[]) => {
            assertChannelAllowed("invoke", channel, policy);
            return ipcRenderer.invoke(channel, ...args);
        },
        on: (channel: string, listener: (...args: unknown[]) => void) => {
            assertChannelAllowed("on", channel, policy);
            const subscription = (event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
            ipcRenderer.on(channel, subscription);
            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        },
    });
}
