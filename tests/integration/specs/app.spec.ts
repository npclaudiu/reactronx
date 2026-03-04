import { _electron as electron } from "@playwright/test";
import { test, expect } from "@playwright/test";
import * as path from "path";

test.describe("Reactronx App Integration", () => {
    let electronApp: any;

    test.beforeAll(async () => {
        // Launch Electron app explicitly providing the binary path
        electronApp = await electron.launch({
            args: [path.join(__dirname, "../app/dist/main.js")],
        });
    });

    test.afterAll(async () => {
        if (electronApp) {
            await electronApp.close();
        }
    });

    test("should instantiate an Electron BrowserWindow via Reactronx reconciler", async () => {
        // Wait for React to asynchronously flush and create the window
        await electronApp.firstWindow();

        // Evaluate code in the Main Process to verify exactly 1 window was managed
        const windowCount = await electronApp.evaluate(({ BrowserWindow }: typeof import("electron")) => {
            return BrowserWindow.getAllWindows().length;
        });

        expect(windowCount).toBe(1);

        const windowTitle = await electronApp.evaluate(({ BrowserWindow }: typeof import("electron")) => {
            return BrowserWindow.getAllWindows()[0].getTitle();
        });

        expect(windowTitle).toBe("Test Window");
    });

    test("should load the Reactronx renderer and DOM successfully", async () => {
        // Wait for the first window (the web contents)
        const window = await electronApp.firstWindow();

        // Assert the renderer injected the DOM successfully
        const header = window.locator("#test-header");
        await expect(header).toBeVisible();
        await expect(header).toHaveText("Reactronx Integration Test");
    });
});
