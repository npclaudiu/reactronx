import * as React from "react";
import { render } from "@reactronx/react-electron";
import * as path from "path";
import { app as electronAppNative, BrowserWindow } from "electron";

function App() {
    console.log("[App] Rendering React Tree...");
    return (
        <app>
            <window title="Test Window" width={800} height={600} preload={path.join(__dirname, "preload.js")}>
                <webcontents file={path.join(__dirname, "../src/index.html")} />
            </window>
        </app>
    );
}

electronAppNative.whenReady().then(() => {
    console.log("[App] Electron Native is ready");
});

render(<App />);
