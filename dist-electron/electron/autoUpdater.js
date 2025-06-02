"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAutoUpdater = initAutoUpdater;
// electron/autoUpdater.ts
const electron_1 = require("electron");
const JianguoyunWebDAV_1 = require("./service/JianguoyunWebDAV");
// 固定的更新日志URL
const UPDATE_LOG_URL = '/LeetGo/配置/版本更新日志.txt';
const webdav = JianguoyunWebDAV_1.JianguoyunWebDAV.getInstance();
function initAutoUpdater() {
    // 延迟3秒后检查更新，避免影响启动速度
    setTimeout(async () => {
        try {
            const result = await checkForUpdates();
            if (result.hasUpdate) {
                // 向渲染进程发送更新信息
                electron_1.BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('update-available', {
                        latestVersion: result.latestVersion,
                        updateDate: result.updateDate,
                        updateLog: result.updateLog
                    });
                });
            }
        }
        catch (error) {
            console.error('[AutoUpdater] 检查更新失败:', error);
        }
    }, 1000);
}
// 检查更新
async function checkForUpdates() {
    const currentVersion = electron_1.app.getVersion();
    console.log('[AutoUpdater] 检查更新中, currentVersion = ', currentVersion);
    try {
        // 获取更新日志TXT文件
        const updateLogResult = await webdav.getTxtFile(UPDATE_LOG_URL);
        if (!updateLogResult.success || !updateLogResult.data) {
            console.error('获取更新日志失败:', updateLogResult.message);
            return { hasUpdate: false };
        }
        // 使用data字段获取文本内容
        const content = updateLogResult.data;
        // 移除多余空行
        const cleanContent = content.replace(/\n\s*\n/g, '\n\n');
        // 取第一个版本号
        const versionMatch = cleanContent.match(/version\{([0-9.]+)\}.*?\{([0-9.]+)\}([\s\S]+?)(?=version|\Z)/);
        console.debug('[AutoUpdater] 获取到版本日志内容 = ', cleanContent);
        if (!versionMatch) {
            console.error('[AutoUpdater] 更新日志格式错误，未匹配到任何版本号信息');
            return { hasUpdate: false, currentVersion };
        }
        const latestVersion = versionMatch[1];
        const updateDate = versionMatch[2];
        const updateLog = versionMatch[3].trim();
        var downloadInstructions = '';
        const formattedLog = formatUpdateLog(updateLog);
        const downloadInstructionsIndex = cleanContent.indexOf('下载说明');
        if (downloadInstructionsIndex !== -1) {
            // 提取"下载说明"及其后面的所有内容
            downloadInstructions = formatUpdateLog(cleanContent.substring(downloadInstructionsIndex));
            console.debug('[AutoUpdater] 检测到下载说明');
        }
        const fullFormattedLog = formattedLog + '\n\n' + downloadInstructions;
        // 比较版本
        if (compareVersions(latestVersion, currentVersion) > 0) {
            console.log(`[AutoUpdater] 发现新版本: ${latestVersion}`);
            return {
                hasUpdate: true,
                currentVersion,
                latestVersion,
                updateDate,
                updateLog: fullFormattedLog
            };
        }
        else {
            console.log(`[AutoUpdater] 已是最新版本: ${currentVersion}`);
        }
        return { hasUpdate: false, currentVersion };
    }
    catch (error) {
        console.error('[AutoUpdater] 获取或解析更新日志失败:', error);
        return { hasUpdate: false, currentVersion };
    }
}
/**
 * 清理更新日志文本，保留换行并去除多余空格
 */
function formatUpdateLog(updateLog) {
    if (!updateLog)
        return '';
    return updateLog
        .split('\n')
        .map(line => line.trim()) // 去除每行首尾空白
        .filter(line => line) // 移除空行
        .join('\n'); // 重新用换行符连接
}
// 简单的版本比较函数
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = i < parts1.length ? parts1[i] : 0;
        const num2 = i < parts2.length ? parts2[i] : 0;
        if (num1 > num2)
            return 1;
        if (num1 < num2)
            return -1;
    }
    return 0;
}
