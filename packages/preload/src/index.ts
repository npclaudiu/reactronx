import { contextBridge, ipcRenderer } from "electron";

export function exposeReactronxIpc(namespace: string = "__reactronx") {
    contextBridge.exposeInMainWorld(namespace, {
        send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args),
        invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
        on: (channel: string, listener: (...args: unknown[]) => void) => {
            const subscription = (event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
            ipcRenderer.on(channel, subscription);
            return () => {
                ipcRenderer.removeListener(channel, subscription);
            };
        },
    });
}
