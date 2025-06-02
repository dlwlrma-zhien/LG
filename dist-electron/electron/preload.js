"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROCESSING_EVENTS = void 0;
console.log("Preload script starting...");
const electron_1 = require("electron");
const { shell } = require("electron");
exports.PROCESSING_EVENTS = {
    //global states
    UNAUTHORIZED: "procesing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",
    OUT_OF_CREDITS: "out-of-credits",
    //states for generating the initial solution
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",
    RESET: "reset",
    //states for processing the debugging
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
};
// At the top of the file
console.log("Preload script is running");
const electronAPI = {
    // 切换鼠标穿透状态
    toggleMousePassthrough: (ignore) => electron_1.ipcRenderer.invoke('toggle-mouse-passthrough', ignore),
    toggleWindowsFocusOn: (focusable) => electron_1.ipcRenderer.invoke('windows-focus-on', focusable),
    // 新添加的 API key 方法实现
    getApiKey: () => electron_1.ipcRenderer.invoke('get-api-key'),
    saveApiKey: (apiKey) => electron_1.ipcRenderer.invoke('save-api-key', apiKey),
    getLanguage: () => electron_1.ipcRenderer.invoke('get-language'),
    saveLanguage: (language) => electron_1.ipcRenderer.invoke('save-language', language),
    getOutputLanguage: () => electron_1.ipcRenderer.invoke('get-output-language'),
    saveOutputLanguage: (language) => electron_1.ipcRenderer.invoke('save-output-language', language),
    // 添加获取剩余次数的实现
    getRemainingTimes: () => electron_1.ipcRenderer.invoke('get-remaining-times'),
    updateContentDimensions: (dimensions) => electron_1.ipcRenderer.invoke("update-content-dimensions", dimensions),
    clearStore: () => electron_1.ipcRenderer.invoke("clear-store"),
    getScreenshots: () => electron_1.ipcRenderer.invoke("get-screenshots"),
    deleteScreenshot: (path) => electron_1.ipcRenderer.invoke("delete-screenshot", path),
    toggleMainWindow: async () => {
        console.log("toggleMainWindow called from preload");
        try {
            const result = await electron_1.ipcRenderer.invoke("toggle-window");
            console.log("toggle-window result:", result);
            return result;
        }
        catch (error) {
            console.error("Error in toggleMainWindow:", error);
            throw error;
        }
    },
    // Event listeners
    onScreenshotTaken: (callback) => {
        const subscription = (_, data) => callback(data);
        electron_1.ipcRenderer.on("screenshot-taken", subscription);
        return () => {
            electron_1.ipcRenderer.removeListener("screenshot-taken", subscription);
        };
    },
    onResetView: (callback) => {
        const subscription = () => callback();
        electron_1.ipcRenderer.on("reset-view", subscription);
        return () => {
            electron_1.ipcRenderer.removeListener("reset-view", subscription);
        };
    },
    onSolutionStart: (callback) => {
        const subscription = () => callback();
        electron_1.ipcRenderer.on(exports.PROCESSING_EVENTS.INITIAL_START, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(exports.PROCESSING_EVENTS.INITIAL_START, subscription);
        };
    },
    onDebugStart: (callback) => {
        const subscription = () => callback();
        electron_1.ipcRenderer.on(exports.PROCESSING_EVENTS.DEBUG_START, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(exports.PROCESSING_EVENTS.DEBUG_START, subscription);
        };
    },
    onDebugSuccess: (callback) => {
        electron_1.ipcRenderer.on("debug-success", (_event, data) => callback(data));
        return () => {
            electron_1.ipcRenderer.removeListener("debug-success", (_event, data) => callback(data));
        };
    },
    onDebugError: (callback) => {
        const subscription = (_, error) => callback(error);
        electron_1.ipcRenderer.on(exports.PROCESSING_EVENTS.DEBUG_ERROR, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(exports.PROCESSING_EVENTS.DEBUG_ERROR, subscription);
        };
    },
    onSolutionError: (callback) => {
        const subscription = (_, error) => callback(error);
        electron_1.ipcRenderer.on(exports.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(exports.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, subscription);
        };
    },
    onProcessingNoScreenshots: (callback) => {
        const subscription = () => callback();
        electron_1.ipcRenderer.on(exports.PROCESSING_EVENTS.NO_SCREENSHOTS, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(exports.PROCESSING_EVENTS.NO_SCREENSHOTS, subscription);
        };
    },
    onOutOfCredits: (callback) => {
        const subscription = () => callback();
        electron_1.ipcRenderer.on(exports.PROCESSING_EVENTS.OUT_OF_CREDITS, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(exports.PROCESSING_EVENTS.OUT_OF_CREDITS, subscription);
        };
    },
    onProblemExtracted: (callback) => {
        const subscription = (_, data) => callback(data);
        electron_1.ipcRenderer.on(exports.PROCESSING_EVENTS.PROBLEM_EXTRACTED, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(exports.PROCESSING_EVENTS.PROBLEM_EXTRACTED, subscription);
        };
    },
    onSolutionSuccess: (callback) => {
        const subscription = (_, data) => callback(data);
        electron_1.ipcRenderer.on(exports.PROCESSING_EVENTS.SOLUTION_SUCCESS, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(exports.PROCESSING_EVENTS.SOLUTION_SUCCESS, subscription);
        };
    },
    onUnauthorized: (callback) => {
        const subscription = () => callback();
        electron_1.ipcRenderer.on(exports.PROCESSING_EVENTS.UNAUTHORIZED, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(exports.PROCESSING_EVENTS.UNAUTHORIZED, subscription);
        };
    },
    // 将其修改为：
    openExternal: (url) => {
        console.log("尝试通过IPC打开链接:", url);
        return electron_1.ipcRenderer.invoke("open-external-link", url)
            .catch(err => {
            console.error("通过IPC打开链接失败:", err);
            // 尝试直接使用 shell 作为备用方案
            try {
                const { shell } = require("electron");
                return shell.openExternal(url);
            }
            catch (e) {
                console.error("所有打开链接方法都失败:", e);
                throw e;
            }
        });
    },
    triggerScreenshot: () => electron_1.ipcRenderer.invoke("trigger-screenshot"),
    triggerProcessScreenshots: () => electron_1.ipcRenderer.invoke("trigger-process-screenshots"),
    triggerReset: () => electron_1.ipcRenderer.invoke("trigger-reset"),
    triggerMoveLeft: () => electron_1.ipcRenderer.invoke("trigger-move-left"),
    triggerMoveRight: () => electron_1.ipcRenderer.invoke("trigger-move-right"),
    triggerMoveUp: () => electron_1.ipcRenderer.invoke("trigger-move-up"),
    triggerMoveDown: () => electron_1.ipcRenderer.invoke("trigger-move-down"),
    startUpdate: () => electron_1.ipcRenderer.invoke("start-update"),
    installUpdate: () => electron_1.ipcRenderer.invoke("install-update"),
    onUpdateAvailable: (callback) => {
        const subscription = (_, info) => callback(info);
        electron_1.ipcRenderer.on("update-available", subscription);
        return () => {
            electron_1.ipcRenderer.removeListener("update-available", subscription);
        };
    },
    onUpdateDownloaded: (callback) => {
        const subscription = (_, info) => callback(info);
        electron_1.ipcRenderer.on("update-downloaded", subscription);
        return () => {
            electron_1.ipcRenderer.removeListener("update-downloaded", subscription);
        };
    },
    decrementCredits: () => electron_1.ipcRenderer.invoke("decrement-credits"),
    onCreditsUpdated: (callback) => {
        const subscription = (_event, credits) => callback(credits);
        electron_1.ipcRenderer.on("credits-updated", subscription);
        return () => {
            electron_1.ipcRenderer.removeListener("credits-updated", subscription);
        };
    },
    getPlatform: () => process.platform,
    // 新增：用于监听语code语言快速切换事件的函数
    onCodeLanguageQuickChanged: (callback) => {
        // 定义一个事件处理函数，当接收到消息时，调用从 React 传来的 callback
        const handler = (_event, newLanguage) => {
            // 这个 callback 就是你在 React 组件中传递给 onCodeLanguageQuickChanged 的函数
            callback(newLanguage);
        };
        // 使用 ipcRenderer.on 来监听后端主进程发送的 'code_language-quick_changed' 事件
        electron_1.ipcRenderer.on('code_language-quick_changed', handler);
        // 当 React 组件卸载或者不再需要监听时，会调用这个返回的函数。
        return () => {
            electron_1.ipcRenderer.removeListener('code_language-quick_changed', handler);
            console.log('[Preload] Removed listener for code_language-quick_changed'); // 可选的日志
        };
    }
};
// Before exposing the API
console.log("About to expose electronAPI with methods:", Object.keys(electronAPI));
// Add this focus restoration handler
window.addEventListener("focus", () => {
    console.log("Window focused");
});
// Expose the API to the renderer process
electron_1.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
// Expose platform info
electron_1.contextBridge.exposeInMainWorld("platform", process.platform);
// Log that preload is complete
console.log("Preload script completed");
