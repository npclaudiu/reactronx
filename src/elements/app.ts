import { app } from "electron";
import type { ElectronElement } from "./types";

interface AppElementProps extends Record<string, unknown> {
    onWindowAllClosed?: () => void;
}

export class AppElement implements ElectronElement {
    public type = "app";
    public props: AppElementProps;

    private readonly defaultWindowAllClosedHandler = () => {
        if (process.platform !== "darwin") {
            app.quit();
        }
    };
    private windowAllClosedHandler: () => void;

    constructor(props: AppElementProps) {
        this.props = props;
        this.windowAllClosedHandler = this.resolveWindowAllClosedHandler(props);
        app.on("window-all-closed", this.windowAllClosedHandler);
    }

    appendChild(_child: ElectronElement) {
        // App is a container
    }

    removeChild(_child: ElectronElement) {
        // Handle child removal
    }

    updateProps(newProps: AppElementProps) {
        const nextHandler = this.resolveWindowAllClosedHandler(newProps);
        if (this.windowAllClosedHandler !== nextHandler) {
            app.removeListener("window-all-closed", this.windowAllClosedHandler);
            this.windowAllClosedHandler = nextHandler;
            app.on("window-all-closed", this.windowAllClosedHandler);
        }
        this.props = newProps;
    }

    destroy() {
        app.removeListener("window-all-closed", this.windowAllClosedHandler);
    }

    private resolveWindowAllClosedHandler(props: AppElementProps): () => void {
        return props.onWindowAllClosed ?? this.defaultWindowAllClosedHandler;
    }
}
