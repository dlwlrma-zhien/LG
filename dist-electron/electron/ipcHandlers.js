"use strict";
// electron/ipcHandlers.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeIpcHandlers = initializeIpcHandlers;
const electron_1 = require("electron");
const MethodLimiter_1 = require("./service/MethodLimiter");
const storeManager_1 = __importStar(require("./store/storeManager"));
const store_1 = require("./store/store");
const limiter = MethodLimiter_1.MethodLimiter.getInstance();
function initializeIpcHandlers(deps) {
    console.log("Initializing IPC handlers");
    // Credits handlers
    electron_1.ipcMain.handle("set-initial-credits", async (_event, credits) => {
        const mainWindow = deps.getMainWindow();
        if (!mainWindow)
            return;
        try {
            // Set the credits in a way that ensures atomicity
            await mainWindow.webContents.executeJavaScript(`window.__CREDITS__ = ${credits}`);
            mainWindow.webContents.send("credits-updated", credits);
        }
        catch (error) {
            console.error("Error setting initial credits:", error);
            throw error;
        }
    });
    // 在 initializeIpcHandlers 函数中
    electron_1.ipcMain.handle("get-api-key", () => {
        try {
            console.log("[Main] 正在获取 API Key...");
            const apiKey = store_1.store.get('apiKey');
            console.log("[Main] API Key 获取结果:", apiKey ? "存在" : "不存在");
            return { success: true, apiKey: apiKey || '' };
        }
        catch (error) {
            console.error("[Main] 获取 API Key 出错:", error);
            return { success: false, error: String(error) };
        }
    });
    electron_1.ipcMain.handle("save-api-key", (_event, key) => {
        try {
            console.log("[Main] 正在保存 API Key...");
            store_1.store.set('apiKey', key);
            limiter.updateApiKey(key);
            console.log("[Main] API Key 已保存!");
            return { success: true };
        }
        catch (error) {
            console.error("[Main] 保存 API Key 出错:", error);
            return { success: false, error: String(error) };
        }
    });
    // Language handlers
    electron_1.ipcMain.handle("get-language", () => {
        return storeManager_1.default.getCodeLanguage();
    });
    electron_1.ipcMain.handle("save-language", (_event, language) => {
        return storeManager_1.default.saveCodeLanguage(language);
    });
    // Language handlers
    electron_1.ipcMain.handle("get-output-language", () => (0, storeManager_1.getOutputLanguage)());
    electron_1.ipcMain.handle("save-output-language", (_event, language) => (0, storeManager_1.saveOutputLanguage)(language));
    // 处理获取剩余次数的请求
    electron_1.ipcMain.handle('get-remaining-times', async () => {
        try {
            const remainingTimes = await limiter.getRemainingTimes();
            if (remainingTimes === -1000) {
                console.debug('当前的key无效，导致返回的剩余次数为 ', remainingTimes);
            }
            return { success: true, remainingTimes };
        }
        catch (error) {
            console.error('获取剩余次数失败:', error);
            return { success: false, error: String(error) };
        }
    });
    electron_1.ipcMain.handle("decrement-credits", async () => {
        // No need to decrement credits since we're bypassing the credit system
        return;
    });
    // Screenshot queue handlers
    electron_1.ipcMain.handle("get-screenshot-queue", () => {
        return deps.getScreenshotQueue();
    });
    electron_1.ipcMain.handle("get-extra-screenshot-queue", () => {
        return deps.getExtraScreenshotQueue();
    });
    electron_1.ipcMain.handle("delete-screenshot", async (event, path) => {
        return deps.deleteScreenshot(path);
    });
    electron_1.ipcMain.handle("get-image-preview", async (event, path) => {
        return deps.getImagePreview(path);
    });
    // Screenshot processing handlers
    electron_1.ipcMain.handle("process-screenshots", async () => {
        await deps.processingHelper?.processScreenshots();
    });
    // Window dimension handlers
    electron_1.ipcMain.handle("update-content-dimensions", async (event, { width, height }) => {
        if (width && height) {
            deps.setWindowDimensions(width, height);
        }
    });
    // 添加IPC监听器处理鼠标穿透状态切换
    electron_1.ipcMain.handle('toggle-mouse-passthrough', async (_, ignore) => {
        try {
            const mainWindow = deps.getMainWindow();
            if (mainWindow) {
                mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
            }
            return { success: true };
        }
        catch (error) {
            console.error('Failed to toggle mouse passthrough:', error);
            return { success: false, error: error.message };
        }
    });
    // 添加IPC监听器处理鼠标穿透状态切换
    electron_1.ipcMain.handle('windows-focus-on', async (_, focusable) => {
        try {
            const mainWindow = deps.getMainWindow();
            if (mainWindow) {
                const old = mainWindow.isFocusable();
                if (old !== focusable) {
                    mainWindow.setFocusable(focusable);
                }
            }
            return { success: true };
        }
        catch (error) {
            console.error('windows-focus-on error:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle("set-window-dimensions", (event, width, height) => {
        deps.setWindowDimensions(width, height);
    });
    // Screenshot management handlers
    electron_1.ipcMain.handle("get-screenshots", async () => {
        try {
            let previews = [];
            const currentView = deps.getView();
            if (currentView === "queue") {
                const queue = deps.getScreenshotQueue();
                previews = await Promise.all(queue.map(async (path) => ({
                    path,
                    preview: await deps.getImagePreview(path)
                })));
            }
            else {
                const extraQueue = deps.getExtraScreenshotQueue();
                previews = await Promise.all(extraQueue.map(async (path) => ({
                    path,
                    preview: await deps.getImagePreview(path)
                })));
            }
            return previews;
        }
        catch (error) {
            console.error("Error getting screenshots:", error);
            throw error;
        }
    });
    // Screenshot trigger handlers
    electron_1.ipcMain.handle("trigger-screenshot", async () => {
        const mainWindow = deps.getMainWindow();
        if (mainWindow) {
            try {
                const screenshotPath = await deps.takeScreenshot();
                const preview = await deps.getImagePreview(screenshotPath);
                mainWindow.webContents.send("screenshot-taken", {
                    path: screenshotPath,
                    preview
                });
                return { success: true };
            }
            catch (error) {
                console.error("Error triggering screenshot:", error);
                return { error: "Failed to trigger screenshot" };
            }
        }
        return { error: "No main window available" };
    });
    electron_1.ipcMain.handle("take-screenshot", async () => {
        try {
            const screenshotPath = await deps.takeScreenshot();
            return { success: true, path: screenshotPath };
        }
        catch (error) {
            console.error("Error taking screenshot:", error);
            return { success: false, error: String(error) };
        }
    });
    // Cancel processing handler
    electron_1.ipcMain.handle("cancel-processing", () => {
        deps.processingHelper?.cancelProcessing();
        return { success: true };
    });
    // External link handler
    electron_1.ipcMain.handle("open-external-link", async (event, url) => {
        try {
            await electron_1.shell.openExternal(url);
            return { success: true };
        }
        catch (error) {
            console.error("Error opening external link:", error);
            return { success: false, error: String(error) };
        }
    });
    // Window management handlers
    electron_1.ipcMain.handle("toggle-window", () => {
        try {
            deps.toggleMainWindow();
            return { success: true };
        }
        catch (error) {
            console.error("Error toggling window:", error);
            return { error: "Failed to toggle window" };
        }
    });
    electron_1.ipcMain.handle("reset-queues", async () => {
        try {
            deps.clearQueues();
            return { success: true };
        }
        catch (error) {
            console.error("Error resetting queues:", error);
            return { error: "Failed to reset queues" };
        }
    });
    // Process screenshot handlers
    electron_1.ipcMain.handle("trigger-process-screenshots", async () => {
        try {
            await deps.processingHelper?.processScreenshots();
            return { success: true };
        }
        catch (error) {
            console.error("Error processing screenshots:", error);
            return { error: "Failed to process screenshots" };
        }
    });
    // Reset handlers
    electron_1.ipcMain.handle("trigger-reset", () => {
        try {
            // First cancel any ongoing requests
            deps.processingHelper?.cancelProcessing();
            // Clear all queues immediately
            deps.clearQueues();
            // Reset view to queue
            deps.setView("queue");
            // Get main window and send reset events
            const mainWindow = deps.getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                // Send reset events in sequence
                mainWindow.webContents.send("reset-view");
                mainWindow.webContents.send("reset");
            }
            return { success: true };
        }
        catch (error) {
            console.error("Error triggering reset:", error);
            return { error: "Failed to trigger reset" };
        }
    });
    // Window movement handlers
    electron_1.ipcMain.handle("trigger-move-left", () => {
        try {
            deps.moveWindowLeft();
            return { success: true };
        }
        catch (error) {
            console.error("Error moving window left:", error);
            return { error: "Failed to move window left" };
        }
    });
    electron_1.ipcMain.handle("trigger-move-right", () => {
        try {
            deps.moveWindowRight();
            return { success: true };
        }
        catch (error) {
            console.error("Error moving window right:", error);
            return { error: "Failed to move window right" };
        }
    });
    electron_1.ipcMain.handle("trigger-move-up", () => {
        try {
            deps.moveWindowUp();
            return { success: true };
        }
        catch (error) {
            console.error("Error moving window up:", error);
            return { error: "Failed to move window up" };
        }
    });
    electron_1.ipcMain.handle("trigger-move-down", () => {
        try {
            deps.moveWindowDown();
            return { success: true };
        }
        catch (error) {
            console.error("Error moving window down:", error);
            return { error: "Failed to move window down" };
        }
    });
}
