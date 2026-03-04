export interface ElectronElement {
    type: string;
    props: Record<string, unknown>;
    appendChild?: (child: ElectronElement) => void;
    removeChild?: (child: ElectronElement) => void;
    updateProps?: (newProps: Record<string, unknown>) => void;
    destroy?: () => void;
}
