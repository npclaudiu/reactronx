import { ElectronElement } from "./types";

export class WebContentsElement implements ElectronElement {
    public type = "webcontents";
    public props: Record<string, unknown>;

    constructor(props: Record<string, unknown>) {
        this.props = props;
    }

    updateProps(newProps: Record<string, unknown>) {
        this.props = newProps;
    }
}
