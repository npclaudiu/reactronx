import { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import { ElectronElement } from "./types";

export class WindowElement implements ElectronElement {
    public type = "window";
    public props: Record<string, unknown>;
    public window: BrowserWindow;

    constructor(props: Record<string, unknown>) {
        this.props = props;

        const options: BrowserWindowConstructorOptions = {
            width: typeof props.width === "number" ? props.width : 800,
            height: typeof props.height === "number" ? props.height : 600,
            title: typeof props.title === "string" ? props.title : "Reactronx App",
            webPreferences: {
                preload: typeof props.preload === "string" ? props.preload : undefined,
            },
        };

        this.window = new BrowserWindow(options);

        if (typeof props.onClose === "function") {
            this.window.on("closed", props.onClose as () => void);
        }
    }

    appendChild(child: ElectronElement) {
        if (child.type === "webcontents") {
            if (typeof child.props.url === "string") {
                this.window.loadURL(child.props.url);
            } else if (typeof child.props.file === "string") {
                this.window.loadFile(child.props.file);
            }
        }
    }

    removeChild(_child: ElectronElement) {
        // Remove child logic
    }

    updateProps(newProps: Record<string, unknown>) {
        if (typeof newProps.title === "string" && newProps.title !== this.props.title) {
            this.window.setTitle(newProps.title);
        }
        if (newProps.width !== this.props.width || newProps.height !== this.props.height) {
            this.window.setSize(
                typeof newProps.width === "number" ? newProps.width : 800,
                typeof newProps.height === "number" ? newProps.height : 600,
            );
        }
        this.props = newProps;
    }

    destroy() {
        if (!this.window.isDestroyed()) {
            this.window.destroy();
        }
    }
}
