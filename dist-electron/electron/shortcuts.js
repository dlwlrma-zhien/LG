"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShortcutsHelper = void 0;
const electron_1 = require("electron");
const storeManager_1 = __importDefault(require("./store/storeManager"));
class ShortcutsHelper {
    constructor(deps) {
        this.deps = deps;
        this.firstCodeLanguage = storeManager_1.default.getCodeLanguage().language;
    }
    // 添加cancelProcessing方法到ProcessingHelper类
    cancelProcessing() {
        if (this.deps.processingHelper) {
            // 如果processingHelper存在cancelProcessing方法，则调用它
            if ('cancelProcessing' in this.deps.processingHelper) {
                this.deps.processingHelper.cancelProcessing();
            }
        }
    }
    registerGlobalShortcuts() {
        electron_1.globalShortcut.register("CommandOrControl+H", async () => {
            const mainWindow = this.deps.getMainWindow();
            if (mainWindow) {
                console.log("Taking screenshot...");
                try {
                    const screenshotPath = await this.deps.takeScreenshot();
                    const preview = await this.deps.getImagePreview(screenshotPath);
                    mainWindow.webContents.send("screenshot-taken", {
                        path: screenshotPath,
                        preview
                    });
                }
                catch (error) {
                    console.error("Error capturing screenshot:", error);
                }
            }
        });
        electron_1.globalShortcut.register("CommandOrControl+Enter", async () => {
            await this.deps.processingHelper?.processScreenshots();
        });
        electron_1.globalShortcut.register("CommandOrControl+R", () => {
            console.log("Command + R pressed. Canceling requests and resetting queues...");
            // Cancel ongoing API requests
            this.cancelProcessing();
            // Clear both screenshot queues
            this.deps.clearQueues();
            console.log("Cleared queues.");
            // Update the view state to 'queue'
            this.deps.setView("queue");
            // Notify renderer process to switch view to 'queue'
            const mainWindow = this.deps.getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("reset-view");
                mainWindow.webContents.send("reset");
                mainWindow.setPosition(40, 20); // 重置一下窗口位置 避免溢出后找不到
            }
        });
        // New shortcuts for moving the window
        electron_1.globalShortcut.register("CommandOrControl+Left", () => {
            console.log("Command/Ctrl + Left pressed. Moving window left.");
            this.deps.moveWindowLeft();
        });
        electron_1.globalShortcut.register("CommandOrControl+Right", () => {
            console.log("Command/Ctrl + Right pressed. Moving window right.");
            this.deps.moveWindowRight();
        });
        electron_1.globalShortcut.register("CommandOrControl+Down", () => {
            console.log("Command/Ctrl + down pressed. Moving window down.");
            this.deps.moveWindowDown();
        });
        electron_1.globalShortcut.register("CommandOrControl+Up", () => {
            console.log("Command/Ctrl + Up pressed. Moving window Up.");
            this.deps.moveWindowUp();
        });
        electron_1.globalShortcut.register("CommandOrControl+B", () => {
            this.deps.toggleMainWindow();
        });
        // 将编程语言和SQL相互切换
        electron_1.globalShortcut.register("CommandOrControl+L", () => {
            console.debug("快捷切换语言触发...");
            const curCodeLanguage = storeManager_1.default.getCodeLanguage().language;
            if (curCodeLanguage !== "sql") {
                // 切换到SQL
                this.firstCodeLanguage = curCodeLanguage;
                const res = storeManager_1.default.saveCodeLanguage("sql");
                if (res.success) {
                    const mainWindow = this.deps.getMainWindow();
                    mainWindow.webContents.send("code_language-quick_changed", "sql");
                }
                else {
                    console.error("快速切换到SQL失败:", res.error);
                }
            }
            else {
                // 切换回之前的语言
                const res = storeManager_1.default.saveCodeLanguage(this.firstCodeLanguage);
                if (res.success) {
                    const mainWindow = this.deps.getMainWindow();
                    mainWindow.webContents.send("code_language-quick_changed", this.firstCodeLanguage);
                }
                else {
                    console.error("快速从SQL切换回之前的语言失败:", res.error);
                }
            }
        });
        // 添加这段代码来注册退出快捷键
        electron_1.globalShortcut.register("CommandOrControl+Q", () => {
            console.log("Quit shortcut pressed, closing application...");
            electron_1.app.quit();
        });
        // Unregister shortcuts when quitting
        electron_1.app.on("will-quit", () => {
            electron_1.globalShortcut.unregisterAll();
        });
    }
    /**
   * 注册全局快捷键，并处理成功/失败日志及失败时的前端通知。
   * @param {BrowserWindow | null} mainWindow - 用于发送通知的目标渲染进程窗口实例。如果为 null 或无效，则失败时不会发送通知。
   * @param {string} accelerator - 要注册的快捷键字符串 (例如 'CommandOrControl+R').
   * @param {() => void} callback - 当快捷键被按下时执行的回调函数。
   * @returns {boolean} - 返回快捷键是否注册成功。
   */
    registerGlobalShortcutWithLog(accelerator, callback) {
        let success = false;
        try {
            success = electron_1.globalShortcut.register(accelerator, callback);
            if (!success) {
                console.error(`全局快捷键注册失败: ${accelerator}，可能已被其他程序占用。`);
                const mainWindow = this.deps.getMainWindow();
                // 检查 mainWindow 是否有效，再发送通知
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('shortcut-registration-failed', accelerator, "conflict");
                }
            }
        }
        catch (error) {
            // 理论上 globalShortcut.register 不会因为冲突抛出错误，而是返回 false
            console.error(`注册快捷键 ${accelerator} 时发生意外错误:`, error);
            success = false; // 确保在异常时 success 状态为 false
            const mainWindow = this.deps.getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('shortcut-registration-failed', accelerator, "error");
            }
        }
    }
}
exports.ShortcutsHelper = ShortcutsHelper;
