import * as React from "react";
import { render } from "@reactronx/react-electron";
import * as path from "path";
import { app as electronAppNative } from "electron";

type ContentVariant = "initial" | "updated";
type TestMainProcessGlobal = typeof globalThis & {
    __reactronxSetTestContent?: (variant: ContentVariant) => void;
};

const contentFiles: Record<ContentVariant, string> = {
    initial: path.join(__dirname, "../src/index.html"),
    updated: path.join(__dirname, "../src/index-updated.html"),
};

function App() {
    const [contentVariant, setContentVariant] = React.useState<ContentVariant>("initial");

    React.useEffect(() => {
        const mainProcessGlobal = globalThis as TestMainProcessGlobal;
        mainProcessGlobal.__reactronxSetTestContent = (variant: ContentVariant) => {
            setContentVariant(variant);
        };

        return () => {
            mainProcessGlobal.__reactronxSetTestContent = undefined;
        };
    }, []);

    console.log("[App] Rendering React Tree...");
    return (
        <app>
            <window title="Test Window" width={800} height={600} preload={path.join(__dirname, "preload.js")}>
                <webcontents file={contentFiles[contentVariant]} />
            </window>
        </app>
    );
}

electronAppNative.whenReady().then(() => {
    console.log("[App] Electron Native is ready");
});

render(<App />);
