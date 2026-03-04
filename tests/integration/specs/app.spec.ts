import { _electron as electron } from "@playwright/test";
import { test, expect } from "@playwright/test";
import * as path from "path";

type ElectronAppInstance = Awaited<ReturnType<typeof electron.launch>>;

interface IpcPolicyProbeResult {
    bridgeFound: boolean;
    allowedSend: boolean;
    blockedSend: boolean;
    blockedInvoke: boolean;
    allowedOn: boolean;
    blockedOn: boolean;
}

test.describe("Reactronx App Integration", () => {
    let electronApp: ElectronAppInstance | undefined;

    const getElectronApp = (): ElectronAppInstance => {
        if (!electronApp) {
            throw new Error("Electron app failed to launch.");
        }
        return electronApp;
    };

    test.beforeEach(async () => {
        // Launch Electron app explicitly providing the binary path
        electronApp = await electron.launch({
            args: [path.join(__dirname, "../app/dist/main.js")],
        });
    });

    test.afterEach(async () => {
        if (electronApp) {
            await electronApp.close();
            electronApp = undefined;
        }
    });

    test("should instantiate an Electron BrowserWindow via Reactronx reconciler", async () => {
        const launchedElectronApp = getElectronApp();

        // Wait for React to asynchronously flush and create the window
        await launchedElectronApp.firstWindow();

        // Evaluate code in the Main Process to verify exactly 1 window was managed
        const windowCount = await launchedElectronApp.evaluate(({ BrowserWindow }: typeof import("electron")) => {
            return BrowserWindow.getAllWindows().length;
        });

        expect(windowCount).toBe(1);

        const windowBounds = await launchedElectronApp.evaluate(({ BrowserWindow }: typeof import("electron")) => {
            return BrowserWindow.getAllWindows()[0].getBounds();
        });

        expect(windowBounds.width).toBe(800);
        expect(windowBounds.height).toBe(600);
    });

    test("should enforce preload IPC channel policy", async () => {
        const launchedElectronApp = getElectronApp();
        const window = await launchedElectronApp.firstWindow();

        const policyProbe = await window.evaluate<IpcPolicyProbeResult>(() => {
            type RendererBridge = {
                send: (channel: string, ...args: unknown[]) => void;
                invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
                on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
            };

            const bridgeCandidate = (window as Window & { __reactronx?: unknown }).__reactronx;
            if (!bridgeCandidate || typeof bridgeCandidate !== "object") {
                return {
                    bridgeFound: false,
                    allowedSend: false,
                    blockedSend: false,
                    blockedInvoke: false,
                    allowedOn: false,
                    blockedOn: false,
                };
            }

            const bridge = bridgeCandidate as RendererBridge;

            let allowedSend = false;
            try {
                bridge.send("reactronx:command", { command: "noop" });
                allowedSend = true;
            } catch {}

            let blockedSend = false;
            try {
                bridge.send("forbidden:send", { command: "noop" });
            } catch {
                blockedSend = true;
            }

            let blockedInvoke = false;
            try {
                void bridge.invoke("forbidden:invoke", { command: "noop" });
            } catch {
                blockedInvoke = true;
            }

            let allowedOn = false;
            try {
                const unsubscribe = bridge.on("reactronx:event:test", () => {});
                unsubscribe();
                allowedOn = true;
            } catch {}

            let blockedOn = false;
            try {
                bridge.on("forbidden:event", () => {});
            } catch {
                blockedOn = true;
            }

            return {
                bridgeFound: true,
                allowedSend,
                blockedSend,
                blockedInvoke,
                allowedOn,
                blockedOn,
            };
        });

        expect(policyProbe.bridgeFound).toBe(true);
        expect(policyProbe.allowedSend).toBe(true);
        expect(policyProbe.blockedSend).toBe(true);
        expect(policyProbe.blockedInvoke).toBe(true);
        expect(policyProbe.allowedOn).toBe(true);
        expect(policyProbe.blockedOn).toBe(true);
    });

    test("should navigate when <webcontents> file prop changes", async () => {
        const launchedElectronApp = getElectronApp();
        const window = await launchedElectronApp.firstWindow();

        await expect(window.locator("#test-header")).toHaveText("Reactronx Integration Test");

        await launchedElectronApp.evaluate(() => {
            const mainProcessGlobal = globalThis as typeof globalThis & {
                __reactronxSetTestContent?: (variant: "initial" | "updated") => void;
            };

            if (!mainProcessGlobal.__reactronxSetTestContent) {
                throw new Error("Missing test content setter.");
            }
            mainProcessGlobal.__reactronxSetTestContent("updated");
        });

        await expect(window.locator("#test-header-updated")).toHaveText("Reactronx Integration Test Updated");
        await expect(window.locator("#test-header")).toHaveCount(0);
    });
});
