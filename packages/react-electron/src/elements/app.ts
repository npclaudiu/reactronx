import { app } from "electron";
import { ElectronElement } from "./types";

export class AppElement implements ElectronElement {
    public type = "app";
    public props: Record<string, unknown>;

    constructor(props: Record<string, unknown>) {
        this.props = props;
    }

    appendChild(_child: ElectronElement) {
        // App is a container
    }

    removeChild(_child: ElectronElement) {
        // Handle child removal
    }

    updateProps(newProps: Record<string, unknown>) {
        this.props = newProps;
        // Bind app lifecycle events if passed (e.g., onReady, onWindowAllClosed)
        if (typeof this.props.onWindowAllClosed === "function") {
            app.on("window-all-closed", this.props.onWindowAllClosed as () => void);
        } else {
            app.on("window-all-closed", () => {
                if (process.platform !== "darwin") app.quit();
            });
        }
    }
}
