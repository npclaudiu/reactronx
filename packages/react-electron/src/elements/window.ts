import { BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import { ElectronElement } from "./types";
import { WebContentsElement, WebContentsSource } from "./webcontents";

interface WindowElementProps extends Record<string, unknown> {
    width?: number;
    height?: number;
    title?: string;
    preload?: string;
    onClose?: () => void;
}

export class WindowElement implements ElectronElement {
    public type = "window";
    public props: WindowElementProps;
    public window: BrowserWindow;

    private onCloseHandler?: () => void;

    constructor(props: Record<string, unknown>) {
        this.props = this.normalizeProps(props);

        const options: BrowserWindowConstructorOptions = {
            width: this.props.width ?? 800,
            height: this.props.height ?? 600,
            title: this.props.title ?? "Reactronx App",
            webPreferences: {
                preload: this.props.preload,
            },
        };

        this.window = new BrowserWindow(options);

        if (this.props.onClose) {
            this.onCloseHandler = this.props.onClose;
            this.window.on("closed", this.onCloseHandler);
        }
    }

    appendChild(child: ElectronElement) {
        if (child.type !== "webcontents") {
            return;
        }

        if (child instanceof WebContentsElement) {
            child.attachToWindow((source) => {
                this.loadSource(source);
            });
            return;
        }

        this.loadSourceFromProps(child.props);
    }

    removeChild(_child: ElectronElement) {
        // Remove child logic
    }

    updateProps(newProps: Record<string, unknown>) {
        const normalizedProps = this.normalizeProps(newProps);

        if (typeof normalizedProps.title === "string" && normalizedProps.title !== this.props.title) {
            this.window.setTitle(normalizedProps.title);
        }
        if (normalizedProps.width !== this.props.width || normalizedProps.height !== this.props.height) {
            this.window.setSize(
                normalizedProps.width ?? 800,
                normalizedProps.height ?? 600,
            );
        }

        const nextOnCloseHandler = normalizedProps.onClose;
        if (this.onCloseHandler !== nextOnCloseHandler) {
            if (this.onCloseHandler) {
                this.window.removeListener("closed", this.onCloseHandler);
            }
            if (nextOnCloseHandler) {
                this.window.on("closed", nextOnCloseHandler);
            }
            this.onCloseHandler = nextOnCloseHandler;
        }

        this.props = normalizedProps;
    }

    destroy() {
        if (this.onCloseHandler) {
            this.window.removeListener("closed", this.onCloseHandler);
        }
        if (!this.window.isDestroyed()) {
            this.window.destroy();
        }
    }

    private normalizeProps(props: Record<string, unknown>): WindowElementProps {
        return {
            ...props,
            width: typeof props.width === "number" ? props.width : undefined,
            height: typeof props.height === "number" ? props.height : undefined,
            title: typeof props.title === "string" ? props.title : undefined,
            preload: typeof props.preload === "string" ? props.preload : undefined,
            onClose: this.extractOnCloseHandler(props.onClose),
        };
    }

    private extractOnCloseHandler(value: unknown): (() => void) | undefined {
        if (typeof value !== "function") {
            return undefined;
        }
        return value as () => void;
    }

    private loadSourceFromProps(props: Record<string, unknown>) {
        if (typeof props.url === "string") {
            this.loadSource({ url: props.url });
            return;
        }
        if (typeof props.file === "string") {
            this.loadSource({ file: props.file });
        }
    }

    private loadSource(source: WebContentsSource) {
        if (source.url) {
            void this.window.loadURL(source.url);
            return;
        }
        if (source.file) {
            void this.window.loadFile(source.file);
        }
    }
}
