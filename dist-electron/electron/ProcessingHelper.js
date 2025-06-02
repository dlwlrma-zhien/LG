"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingHelper = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const modelCall_1 = require("./service/modelCall");
const storeManager_1 = __importDefault(require("./store/storeManager"));
class ProcessingHelper {
    constructor(deps) {
        this.deps = deps;
        this.screenshotHelper = deps.getScreenshotHelper();
    }
    /**
     * 等待主窗口初始化完成
     */
    async waitForInitialization(mainWindow) {
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds total
        while (attempts < maxAttempts) {
            const isInitialized = await mainWindow.webContents.executeJavaScript("window.__IS_INITIALIZED__");
            if (isInitialized)
                return;
            await new Promise((resolve) => setTimeout(resolve, 100));
            attempts++;
        }
        throw new Error("App failed to initialize after 5 seconds");
    }
    /**
     * 获取当前编程语言
     */
    async getLanguage() {
        const res = storeManager_1.default.getCodeLanguage();
        return res.success ? res.language : "python";
        // const mainWindow = this.deps.getMainWindow()
        // if (!mainWindow) return "python"
        // try {
        //   await this.waitForInitialization(mainWindow)
        //   const language = await mainWindow.webContents.executeJavaScript(
        //     "window.__LANGUAGE__"
        //   )
        //   if (
        //     typeof language !== "string" ||
        //     language === undefined ||
        //     language === null
        //   ) {
        //     console.warn("Language not properly initialized")
        //     return "python"
        //   }
        //   return language
        // } catch (error) {
        //   console.error("Error getting language:", error)
        //   return "python"
        // }
    }
    /**
     * 处理截图并根据当前视图执行相应操作
     */
    async processScreenshots() {
        const mainWindow = this.deps.getMainWindow();
        if (!mainWindow)
            return;
        const view = this.deps.getView();
        console.log("Processing screenshots in view:", view);
        if (view === "queue") {
            // 通知前端开始处理
            mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_START);
            const screenshotQueue = this.screenshotHelper.getScreenshotQueue();
            console.log("Processing main queue screenshots:", screenshotQueue);
            // 检查是否有截图
            if (screenshotQueue.length === 0) {
                mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
                return;
            }
            try {
                // 读取所有截图数据
                const screenshots = await Promise.all(screenshotQueue.map(async (path) => ({
                    path,
                    preview: await this.screenshotHelper.getImagePreview(path),
                    data: node_fs_1.default.readFileSync(path).toString("base64")
                })));
                const result = await this.processScreenshotsHelper(screenshots);
                if (!result.success) {
                    console.log("Processing failed:", result.error);
                    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, result.error);
                    // 错误时重置为队列视图
                    console.log("Resetting view to queue due to error");
                    this.deps.setView("queue");
                    return;
                }
                // 处理成功后切换到解决方案视图
                console.log("Setting view to solutions after successful processing");
                mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS, result.data);
                this.deps.setView("solutions");
            }
            catch (error) {
                mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, error.message || "Error processing screenshots");
                console.error("Processing error:", error);
                // 错误时重置为队列视图
                console.log("Resetting view to queue due to error");
                this.deps.setView("queue");
            }
        }
        else {
            // 处理debug视图下的额外截图
            const extraScreenshotQueue = this.screenshotHelper.getExtraScreenshotQueue();
            console.log("Processing extra queue screenshots:", extraScreenshotQueue);
            if (extraScreenshotQueue.length === 0) {
                mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS);
                return;
            }
            // 通知前端开始debug处理
            mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_START);
            try {
                // 合并所有截图数据
                const screenshots = await Promise.all([
                    ...this.screenshotHelper.getScreenshotQueue(),
                    ...extraScreenshotQueue
                ].map(async (path) => ({
                    path,
                    preview: await this.screenshotHelper.getImagePreview(path),
                    data: node_fs_1.default.readFileSync(path).toString("base64")
                })));
                console.log("Combined screenshots for processing:", screenshots.map((s) => s.path));
                const result = await this.processExtraScreenshotsHelper(screenshots);
                if (result.success) {
                    this.deps.setHasDebugged(true);
                    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_SUCCESS, result.data);
                }
                else {
                    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_ERROR, result.error);
                }
            }
            catch (error) {
                mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.DEBUG_ERROR, error.message || "Error debugging solution");
            }
        }
    }
    /**
    * 处理主队列截图，提取问题并生成解决方案
    */
    async processScreenshotsHelper(screenshots) {
        try {
            const imageDataList = screenshots.map((screenshot) => screenshot.data);
            const mainWindow = this.deps.getMainWindow();
            const language = await this.getLanguage();
            // 提取问题信息
            try {
                const problemInfo = await (0, modelCall_1.extract)(imageDataList, language);
                // 存储问题信息
                this.deps.setProblemInfo(problemInfo);
                // 发送问题提取成功事件
                if (mainWindow) {
                    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problemInfo);
                    // 生成解决方案
                    const solutionsResult = await (0, modelCall_1.generate)(problemInfo, language);
                    // 获取基本解决方案
                    const baseSolution = solutionsResult.solutions[0];
                    // 获取从API解析到的复杂度信息，如果存在的话
                    const solutionComplexity = baseSolution.time_complexity ? {
                        time: baseSolution.time_complexity,
                        space: baseSolution.space_complexity || 'O(n)'
                    } : {
                        time: 'O(n)',
                        space: 'O(n)'
                    };
                    // 转换为前端期望的数据格式
                    const transformedSolution = {
                        ...baseSolution,
                        thoughts: baseSolution.initial_thoughts,
                        // 使用从解决方案中获取的复杂度或默认值
                        time_complexity: solutionComplexity.time,
                        space_complexity: solutionComplexity.space
                    };
                    // 清除额外截图队列
                    this.screenshotHelper.clearExtraScreenshotQueue();
                    // 发送解决方案成功事件
                    mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.SOLUTION_SUCCESS, transformedSolution);
                    return { success: true, data: transformedSolution };
                }
            }
            catch (error) {
                console.error("Processing error:", error);
                return {
                    success: false,
                    error: error.message || "Failed to process screenshots"
                };
            }
        }
        catch (error) {
            return { success: false, error: error.message };
        }
        return {
            success: false,
            error: "Failed to process screenshots. Please try again."
        };
    }
    /**
     * 处理额外截图队列，用于调试和优化解决方案
     */
    async processExtraScreenshotsHelper(screenshots) {
        try {
            const imageDataList = screenshots.map((screenshot) => screenshot.data);
            const problemInfo = this.deps.getProblemInfo();
            const language = await this.getLanguage();
            if (!problemInfo) {
                throw new Error("No problem info available");
            }
            // 调用debug方法处理
            const debugResult = await (0, modelCall_1.debug)(imageDataList, problemInfo, language);
            // 获取基本改进解决方案
            const baseImprovedSolution = debugResult.improvedSolution;
            // 获取从API解析到的复杂度信息，如果存在的话
            const debugComplexity = {
                time: baseImprovedSolution.time_complexity || 'NULL',
                space: baseImprovedSolution.space_complexity || 'NULL'
            };
            // 转换为前端期望的数据格式
            const transformedDebugSolution = {
                ...baseImprovedSolution,
                thoughts: baseImprovedSolution.initial_thoughts,
                time_complexity: debugComplexity.time,
                space_complexity: debugComplexity.space,
                new_code: baseImprovedSolution.code
            };
            return { success: true, data: transformedDebugSolution };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || "Failed to process debug request"
            };
        }
    }
    /**
     * 取消所有进行中的处理
     */
    cancelProcessing() {
        // 重置应用状态
        this.deps.setHasDebugged(false);
        this.deps.setProblemInfo(null);
        // const mainWindow = this.deps.getMainWindow()
        // if (mainWindow && !mainWindow.isDestroyed()) {
        //   // 通知用户处理已取消
        //   mainWindow.webContents.send(this.deps.PROCESSING_EVENTS.NO_SCREENSHOTS)
        // }
    }
}
exports.ProcessingHelper = ProcessingHelper;
