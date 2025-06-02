"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.state = void 0;
exports.createWindow = createWindow;
exports.hideMainWindow = hideMainWindow;
exports.showMainWindow = showMainWindow;
exports.toggleMainWindow = toggleMainWindow;
exports.setWindowDimensions = setWindowDimensions;
exports.moveWindowHorizontal = moveWindowHorizontal;
exports.moveWindowVertical = moveWindowVertical;
exports.getMainWindow = getMainWindow;
exports.getView = getView;
exports.setView = setView;
exports.getScreenshotHelper = getScreenshotHelper;
exports.getProblemInfo = getProblemInfo;
exports.setProblemInfo = setProblemInfo;
exports.getScreenshotQueue = getScreenshotQueue;
exports.getExtraScreenshotQueue = getExtraScreenshotQueue;
exports.clearQueues = clearQueues;
exports.takeScreenshot = takeScreenshot;
exports.getImagePreview = getImagePreview;
exports.deleteScreenshot = deleteScreenshot;
exports.setHasDebugged = setHasDebugged;
exports.getHasDebugged = getHasDebugged;
// electron/main.ts
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const ipcHandlers_1 = require("./ipcHandlers");
const ProcessingHelper_1 = require("./ProcessingHelper");
const ScreenshotHelper_1 = require("./ScreenshotHelper");
const shortcuts_1 = require("./shortcuts");
const autoUpdater_1 = require("./autoUpdater");
const dotenv = __importStar(require("dotenv"));
// Constants
const isDev = process.env.NODE_ENV === "development" || !electron_1.app.isPackaged;
// Application State
const state = {
    // Window management properties
    mainWindow: null,
    isWindowVisible: false,
    windowPosition: null,
    windowSize: null,
    screenWidth: 0,
    screenHeight: 0,
    step: 0,
    currentX: 0,
    currentY: 0,
    // Application helpers
    screenshotHelper: null,
    shortcutsHelper: null,
    processingHelper: null,
    // View and state management
    view: "queue",
    problemInfo: null,
    hasDebugged: false,
    // Processing events
    PROCESSING_EVENTS: {
        UNAUTHORIZED: "processing-unauthorized",
        NO_SCREENSHOTS: "processing-no-screenshots",
        OUT_OF_CREDITS: "out-of-credits",
        API_KEY_INVALID: "processing-api-key-invalid",
        INITIAL_START: "initial-start",
        PROBLEM_EXTRACTED: "problem-extracted",
        SOLUTION_SUCCESS: "solution-success",
        INITIAL_SOLUTION_ERROR: "solution-error",
        DEBUG_START: "debug-start",
        DEBUG_SUCCESS: "debug-success",
        DEBUG_ERROR: "debug-error"
    }
};
exports.state = state;
// Initialize helpers
function initializeHelpers() {
    state.screenshotHelper = new ScreenshotHelper_1.ScreenshotHelper(state.view);
    state.processingHelper = new ProcessingHelper_1.ProcessingHelper({
        getScreenshotHelper,
        getMainWindow,
        getView,
        setView,
        getProblemInfo,
        setProblemInfo,
        getScreenshotQueue,
        getExtraScreenshotQueue,
        clearQueues,
        takeScreenshot,
        getImagePreview,
        deleteScreenshot,
        setHasDebugged,
        getHasDebugged,
        PROCESSING_EVENTS: state.PROCESSING_EVENTS
    });
    state.shortcutsHelper = new shortcuts_1.ShortcutsHelper({
        getMainWindow,
        takeScreenshot,
        getImagePreview,
        processingHelper: state.processingHelper,
        clearQueues,
        setView,
        isVisible: () => state.isWindowVisible,
        toggleMainWindow,
        moveWindowLeft: () => moveWindowHorizontal((x) => Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)),
        moveWindowRight: () => moveWindowHorizontal((x) => Math.min(state.screenWidth - (state.windowSize?.width || 0) / 2, x + state.step)),
        moveWindowUp: () => moveWindowVertical((y) => y - state.step),
        moveWindowDown: () => moveWindowVertical((y) => y + state.step)
    });
}
// Window management functions
async function createWindow() {
    if (state.mainWindow) {
        if (state.mainWindow.isMinimized())
            state.mainWindow.restore();
        state.mainWindow.focus();
        return;
    }
    const primaryDisplay = electron_1.screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workAreaSize;
    state.screenWidth = workArea.width;
    state.screenHeight = workArea.height;
    state.step = 60;
    state.currentY = 20;
    state.currentX = 40;
    const windowSettings = {
        height: 600,
        x: state.currentX,
        y: state.currentY,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: isDev
                ? path_1.default.join(__dirname, "../dist-electron/preload.js")
                : path_1.default.join(__dirname, "preload.js"),
            scrollBounce: true
        },
        show: true,
        frame: false,
        transparent: true,
        fullscreenable: false,
        hasShadow: false,
        backgroundColor: "#00000000",
        focusable: false, // 设置窗口不可聚焦
        skipTaskbar: true,
        type: "panel",
        paintWhenInitiallyHidden: true,
        titleBarStyle: "hidden",
        enableLargerThanScreen: true,
        movable: true
    };
    state.mainWindow = new electron_1.BrowserWindow(windowSettings);
    state.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    // Add more detailed logging for window events
    state.mainWindow.webContents.on("did-finish-load", () => {
        console.log("Window finished loading");
    });
    state.mainWindow.webContents.on("did-fail-load", async (event, errorCode, errorDescription) => {
        console.error("Window failed to load:", errorCode, errorDescription);
        // Always try to load the built files on failure
        console.log("Attempting to load built files...");
        setTimeout(() => {
            state.mainWindow?.loadFile(path_1.default.join(__dirname, "../dist/index.html")).catch((error) => {
                console.error("Failed to load built files on retry:", error);
            });
        }, 1000);
    });
    // Load the app - always load from built files
    console.log("Loading application from built files...");
    state.mainWindow?.loadFile(path_1.default.join(__dirname, "../dist/index.html")).catch((error) => {
        console.error("Failed to load built files:", error);
    });
    // Configure window behavior
    state.mainWindow.webContents.setZoomFactor(1);
    if (isDev) {
        state.mainWindow.webContents.openDevTools();
    }
    state.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Allow opening URLs in external browser
        electron_1.shell.openExternal(url);
        return { action: "deny" };
    });
    // Enhanced screen capture resistance
    state.mainWindow.setContentProtection(true);
    state.mainWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true
    });
    state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
    // Additional screen capture resistance settings
    if (process.platform === "darwin") {
        // Prevent window from being captured in screenshots
        state.mainWindow.setHiddenInMissionControl(true);
        state.mainWindow.setWindowButtonVisibility(false);
        state.mainWindow.setBackgroundColor("#00000000");
        // Prevent window from being included in window switcher
        state.mainWindow.setSkipTaskbar(true);
        // Disable window shadow
        state.mainWindow.setHasShadow(false);
    }
    // Prevent the window from being captured by screen recording
    state.mainWindow.webContents.setBackgroundThrottling(false);
    state.mainWindow.webContents.setFrameRate(60);
    // Set up window listeners
    state.mainWindow.on("move", handleWindowMove);
    state.mainWindow.on("resize", handleWindowResize);
    state.mainWindow.on("closed", handleWindowClosed);
    // Initialize window state
    const bounds = state.mainWindow.getBounds();
    state.windowPosition = { x: bounds.x, y: bounds.y };
    state.windowSize = { width: bounds.width, height: bounds.height };
    state.currentX = bounds.x;
    state.currentY = bounds.y;
    state.isWindowVisible = true;
}
function handleWindowMove() {
    if (!state.mainWindow)
        return;
    const bounds = state.mainWindow.getBounds();
    state.windowPosition = { x: bounds.x, y: bounds.y };
    state.currentX = bounds.x;
    state.currentY = bounds.y;
}
function handleWindowResize() {
    if (!state.mainWindow)
        return;
    const bounds = state.mainWindow.getBounds();
    state.windowSize = { width: bounds.width, height: bounds.height };
}
function handleWindowClosed() {
    state.mainWindow = null;
    state.isWindowVisible = false;
    state.windowPosition = null;
    state.windowSize = null;
}
// Window visibility functions
function hideMainWindow() {
    if (!state.mainWindow?.isDestroyed()) {
        const bounds = state.mainWindow.getBounds();
        state.windowPosition = { x: bounds.x, y: bounds.y };
        state.windowSize = { width: bounds.width, height: bounds.height };
        state.mainWindow.setIgnoreMouseEvents(true, { forward: true });
        state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
        state.mainWindow.setVisibleOnAllWorkspaces(true, {
            visibleOnFullScreen: true
        });
        state.mainWindow.setOpacity(0);
        state.mainWindow.hide();
        state.isWindowVisible = false;
    }
}
function showMainWindow() {
    if (!state.mainWindow?.isDestroyed()) {
        if (state.windowPosition && state.windowSize) {
            state.mainWindow.setBounds({
                ...state.windowPosition,
                ...state.windowSize
            });
        }
        state.mainWindow.setIgnoreMouseEvents(true, { forward: true });
        state.mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
        state.mainWindow.setVisibleOnAllWorkspaces(true, {
            visibleOnFullScreen: true
        });
        state.mainWindow.setContentProtection(true);
        state.mainWindow.setOpacity(0);
        state.mainWindow.showInactive();
        state.mainWindow.setOpacity(1);
        state.isWindowVisible = true;
    }
}
function toggleMainWindow() {
    state.isWindowVisible ? hideMainWindow() : showMainWindow();
}
// Window movement functions
function moveWindowHorizontal(updateFn) {
    if (!state.mainWindow)
        return;
    state.currentX = updateFn(state.currentX);
    state.mainWindow.setPosition(Math.round(state.currentX), Math.round(state.currentY));
}
function moveWindowVertical(updateFn) {
    if (!state.mainWindow)
        return;
    const newY = updateFn(state.currentY);
    // Allow window to go 2/3 off screen in either direction
    const maxUpLimit = (-(state.windowSize?.height || 0) * 2) / 3;
    const maxDownLimit = state.screenHeight + ((state.windowSize?.height || 0) * 2) / 3;
    // Log the current state and limits
    console.log({
        newY,
        maxUpLimit,
        maxDownLimit,
        screenHeight: state.screenHeight,
        windowHeight: state.windowSize?.height,
        currentY: state.currentY
    });
    // Only update if within bounds
    if (newY >= maxUpLimit && newY <= maxDownLimit) {
        state.currentY = newY;
        state.mainWindow.setPosition(Math.round(state.currentX), Math.round(state.currentY));
    }
}
// Window dimension functions
function setWindowDimensions(width, height) {
    if (!state.mainWindow?.isDestroyed()) {
        const [currentX, currentY] = state.mainWindow.getPosition();
        const primaryDisplay = electron_1.screen.getPrimaryDisplay();
        const workArea = primaryDisplay.workAreaSize;
        const maxWidth = Math.floor(workArea.width * 0.5);
        state.mainWindow.setBounds({
            x: Math.min(currentX, workArea.width - maxWidth),
            y: currentY,
            width: Math.min(width, maxWidth),
            height: Math.ceil(height)
        });
    }
}
// Environment setup
function loadEnvVariables() {
    try {
        dotenv.config();
        console.log("Environment variables loaded:", {
            NODE_ENV: process.env.NODE_ENV,
            // Remove Supabase references
            OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY ? "exists" : "missing"
        });
    }
    catch (error) {
        console.error("Error loading environment variables:", error);
    }
}
// Initialize application
async function initializeApp() {
    try {
        loadEnvVariables();
        initializeHelpers();
        (0, ipcHandlers_1.initializeIpcHandlers)({
            getMainWindow,
            setWindowDimensions,
            getScreenshotQueue,
            getExtraScreenshotQueue,
            deleteScreenshot,
            getImagePreview,
            processingHelper: state.processingHelper,
            PROCESSING_EVENTS: state.PROCESSING_EVENTS,
            takeScreenshot,
            getView,
            toggleMainWindow,
            clearQueues,
            setView,
            setHasDebugged,
            moveWindowLeft: () => moveWindowHorizontal((x) => Math.max(-(state.windowSize?.width || 0) / 2, x - state.step)),
            moveWindowRight: () => moveWindowHorizontal((x) => Math.min(state.screenWidth - (state.windowSize?.width || 0) / 2, x + state.step)),
            moveWindowUp: () => moveWindowVertical((y) => y - state.step),
            moveWindowDown: () => moveWindowVertical((y) => y + state.step)
        });
        await createWindow();
        state.shortcutsHelper?.registerGlobalShortcuts();
        // Initialize auto-updater regardless of environment
        (0, autoUpdater_1.initAutoUpdater)();
        console.log("Auto-updater initialized in", isDev ? "development" : "production", "mode");
    }
    catch (error) {
        console.error("Failed to initialize application:", error);
        electron_1.app.quit();
    }
}
// State getter/setter functions
function getMainWindow() {
    return state.mainWindow;
}
function getView() {
    return state.view;
}
function setView(view) {
    state.view = view;
    state.screenshotHelper?.setView(view);
}
function getScreenshotHelper() {
    return state.screenshotHelper;
}
function getProblemInfo() {
    return state.problemInfo;
}
function setProblemInfo(problemInfo) {
    state.problemInfo = problemInfo;
}
function getScreenshotQueue() {
    return state.screenshotHelper?.getScreenshotQueue() || [];
}
function getExtraScreenshotQueue() {
    return state.screenshotHelper?.getExtraScreenshotQueue() || [];
}
function clearQueues() {
    state.screenshotHelper?.clearQueues();
    state.problemInfo = null;
    setView("queue");
}
async function takeScreenshot() {
    if (!state.mainWindow)
        throw new Error("No main window available");
    return (state.screenshotHelper?.takeScreenshot(() => hideMainWindow(), () => showMainWindow()) || "");
}
async function getImagePreview(filepath) {
    return state.screenshotHelper?.getImagePreview(filepath) || "";
}
async function deleteScreenshot(path) {
    return (state.screenshotHelper?.deleteScreenshot(path) || {
        success: false,
        error: "Screenshot helper not initialized"
    });
}
function setHasDebugged(value) {
    state.hasDebugged = value;
}
function getHasDebugged() {
    return state.hasDebugged;
}
electron_1.app.whenReady().then(initializeApp);
