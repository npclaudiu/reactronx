export interface IpcTransport {
    send(channel: string, ...args: unknown[]): void;
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, listener: (...args: unknown[]) => void): () => void;
}

import { ipcMain } from "electron";

export class DefaultElectronMainTransport implements IpcTransport {
    send(channel: string, ...args: unknown[]): void {
        // Broadly sending to all windows for the default transport unless specified.
        // In a more robust system, you'd target specific WebContents.
        import("electron").then(({ BrowserWindow }) => {
            BrowserWindow.getAllWindows().forEach((win) => {
                win.webContents.send(channel, ...args);
            });
        });
    }

    invoke(_channel: string, ..._args: unknown[]): Promise<unknown> {
        throw new Error("Main process cannot invoke renderer directly without specific WebContents targeting.");
    }

    on(channel: string, listener: (...args: unknown[]) => void): () => void {
        const handler = (event: Electron.IpcMainEvent, ...args: unknown[]) => listener(event, ...args);
        ipcMain.on(channel, handler);
        return () => {
            ipcMain.removeListener(channel, handler);
        };
    }
}
