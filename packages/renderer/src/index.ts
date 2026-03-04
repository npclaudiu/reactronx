import { IpcTransport, DefaultElectronGuestTransport } from "./transport";

export class ReactronxRenderer {
    transport: IpcTransport;

    constructor(transport?: IpcTransport) {
        // Default to the window.__reactronx transport if none passed
        this.transport = transport || new DefaultElectronGuestTransport();
    }

    /**
     * Dispatch a message to the Main Process.
     */
    sendCommand(command: string, payload: unknown) {
        this.transport.send("reactronx:command", { command, payload });
    }

    /**
     * Listen for a state update or event from the Main Process to mutate the DOM.
     */
    onEvent(event: string, callback: (payload: unknown) => void) {
        return this.transport.on(`reactronx:event:${event}`, callback);
    }
}

export type { IpcTransport };
export { DefaultElectronGuestTransport };
