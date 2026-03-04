import { ElectronElement } from "./types";

interface WebContentsProps extends Record<string, unknown> {
    url?: string;
    file?: string;
}

export interface WebContentsSource {
    url?: string;
    file?: string;
}

export class WebContentsElement implements ElectronElement {
    public type = "webcontents";
    public props: WebContentsProps;

    private loadSource?: (source: WebContentsSource) => void;

    constructor(props: Record<string, unknown>) {
        this.props = this.normalizeProps(props);
    }

    attachToWindow(loadSource: (source: WebContentsSource) => void) {
        this.loadSource = loadSource;
        this.loadCurrentSource();
    }

    updateProps(newProps: Record<string, unknown>) {
        const normalizedProps = this.normalizeProps(newProps);
        const shouldReload = normalizedProps.url !== this.props.url || normalizedProps.file !== this.props.file;
        this.props = normalizedProps;

        if (shouldReload) {
            this.loadCurrentSource();
        }
    }

    private normalizeProps(props: Record<string, unknown>): WebContentsProps {
        return {
            ...props,
            url: typeof props.url === "string" ? props.url : undefined,
            file: typeof props.file === "string" ? props.file : undefined,
        };
    }

    private loadCurrentSource() {
        if (!this.loadSource) {
            return;
        }

        if (this.props.url) {
            this.loadSource({ url: this.props.url });
            return;
        }

        if (this.props.file) {
            this.loadSource({ file: this.props.file });
        }
    }
}
