# @reactronx/react-electron

`@reactronx/react-electron` is a library for building Electron apps where React runs in the **Main Process** through a
custom reconciler.

> Note: This is a project in an early stage of development. Things might break, change, or be removed at any time.

## High-Level Usage Guide

To use the library in your Electron application, you will need to import `@reactronx/react-electron` in your Electron
entry point. Instead of imperatively creating `new BrowserWindow()` instances, you will write standard React code that
orchestrates your Electron primitives and use the custom reconciler to render them.

### Example: Managing Electron with React

Instead of writing imperative EventEmitters and arrays to track open windows, `@reactronx/react-electron` allows you to
define your desktop application layout cleanly, just like a web page:

```tsx
import React, { useState } from "react";
import { render } from "@reactronx/react-electron";

function App() {
    const [preferencesOpen, setPreferencesOpen] = useState(false);

    return (
        <app>
            <menu>
                <menuitem label="File">
                    <menuitem label="Preferences" onClick={() => setPreferencesOpen(true)} />
                    <menuitem label="Quit" role="quit" />
                </menuitem>
            </menu>

            {/* The Main Application Window */}
            <window title="My Reactronx App" width={800} height={600} onClose={() => console.log("Main window closed")}>
                <webcontents url="http://localhost:3000" />
            </window>

            {/* Conditionally render a Preferences Window */}
            {preferencesOpen && (
                <window title="Preferences" width={400} height={300} onClose={() => setPreferencesOpen(false)}>
                    <webcontents url="http://localhost:3000/preferences" />
                </window>
            )}
        </app>
    );
}

// Render the application to the Electron environment
render(<App />);
```

## License

BSD-2-Clause
