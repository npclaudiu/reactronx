import ReactReconciler from "react-reconciler";
import { DefaultEventPriority } from "react-reconciler/constants";
import { AppElement } from "./elements/app";
import { WindowElement } from "./elements/window";
import { WebContentsElement } from "./elements/webcontents";
import { app } from "electron";
import { ElectronElement } from "./elements/types";

type Type = string;
type Props = Record<string, unknown>;
type Container = RootContainer;
type Instance = ElectronElement;
type TextInstance = never;
type SuspenseInstance = never;
type HydratableInstance = never;
type PublicInstance = Instance;
type HostContext = Record<string, unknown>;
type UpdatePayload = Record<string, unknown>;
type ChildSet = never;
type TimeoutHandle = ReturnType<typeof setTimeout>;
type NoTimeout = -1;

const hostConfig: ReactReconciler.HostConfig<
    Type,
    Props,
    Container,
    Instance,
    TextInstance,
    SuspenseInstance,
    HydratableInstance,
    PublicInstance,
    HostContext,
    UpdatePayload,
    ChildSet,
    TimeoutHandle,
    NoTimeout
> = {
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,

    createInstance(type, props, _rootContainer, _hostContext, _internalHandle) {
        switch (type) {
            case "app":
                return new AppElement(props);
            case "window":
                return new WindowElement(props);
            case "webcontents":
                return new WebContentsElement(props);
            case "menu":
            case "menuitem":
                // Menu logic to be implemented later
                return { type, props } as ElectronElement;
            default:
                throw new Error(`Unsupported element type: ${type}`);
        }
    },

    appendInitialChild(parentInstance, child) {
        if (parentInstance.appendChild) {
            parentInstance.appendChild(child);
        }
    },

    appendChild(parentInstance, child) {
        if (parentInstance.appendChild) {
            parentInstance.appendChild(child);
        }
    },

    appendChildToContainer(container, child) {
        if (container.appendChild) {
            container.appendChild(child);
        }
    },

    removeChild(parentInstance, child) {
        if (child.destroy) {
            child.destroy();
        }
        if (parentInstance.removeChild) {
            parentInstance.removeChild(child);
        }
    },

    removeChildFromContainer(container, child) {
        if (child.destroy) {
            child.destroy();
        }
        if (container.removeChild) {
            container.removeChild(child);
        }
    },

    commitUpdate(instance, updatePayload, type, prevProps, nextProps) {
        if (instance.updateProps) {
            instance.updateProps(nextProps);
        }
    },

    finalizeInitialChildren() {
        return false;
    },
    prepareUpdate() {
        return {};
    },
    shouldSetTextContent() {
        return false;
    },
    getRootHostContext() {
        return {};
    },
    getChildHostContext() {
        return {};
    },
    getPublicInstance(instance) {
        return instance;
    },
    prepareForCommit() {
        return null;
    },
    resetAfterCommit() {},
    commitMount() {},
    preparePortalMount() {},
    createTextInstance() {
        throw new Error("Text is not allowed in Electron tree.");
    },
    clearContainer() {},

    // We do not schedule updates differently in Electron Main
    scheduleTimeout: setTimeout,
    cancelTimeout: clearTimeout,
    noTimeout: -1,
    isPrimaryRenderer: true,
    getCurrentEventPriority() {
        return DefaultEventPriority;
    },
    getInstanceFromNode() {
        return null;
    },
    beforeActiveInstanceBlur() {},
    afterActiveInstanceBlur() {},
    prepareScopeUpdate() {},
    getInstanceFromScope() {
        return null;
    },
    detachDeletedInstance() {},
};

const reconciler = ReactReconciler(hostConfig);

class RootContainer {
    children: ElectronElement[] = [];

    appendChild(child: ElectronElement) {
        this.children.push(child);
    }

    removeChild(child: ElectronElement) {
        this.children = this.children.filter((c) => c !== child);
    }
}

export function render(reactElement: React.ReactNode) {
    const container = new RootContainer();
    const fiberRoot = reconciler.createContainer(
        container,
        0, // LegacyRoot
        null, // hydration callbacks
        false, // isStrictMode
        null, // concurrentUpdatesByDefaultOverride
        "", // identifierPrefix
        (error) => console.error(error), // onRecoverableError
        null, // transitionCallbacks
    );

    app.whenReady().then(() => {
        reconciler.updateContainer(reactElement, fiberRoot, null, () => {});
    });
}
