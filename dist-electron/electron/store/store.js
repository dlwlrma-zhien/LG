"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const electron_store_1 = __importDefault(require("electron-store"));
const fs_1 = __importDefault(require("fs"));
// 创建确保目录存在的函数
function createStore() {
    // 获取应用数据目录
    const userDataPath = electron_1.app.getPath('userData');
    const configPath = path_1.default.join(userDataPath, 'config');
    try {
        // 尝试创建存储实例
        return new electron_store_1.default({
            defaults: {
                apiKey: '',
                language: 'python', // Add default language
                outputLanguage: '中文'
            },
            cwd: configPath
        });
    }
    catch (error) {
        console.error('[Store] 初始化存储失败，将重置配置:', error);
        const storeFilePath = path_1.default.join(configPath, 'config.json');
        if (fs_1.default.existsSync(storeFilePath)) {
            try {
                fs_1.default.unlinkSync(storeFilePath);
                console.log(`[Store] 已删除损坏的配置文件`);
            }
            catch (deleteError) {
                console.error('[Store] 删除损坏文件失败:', deleteError);
            }
        }
        // 重新创建存储实例
        return new electron_store_1.default({
            defaults: {
                apiKey: '',
                language: 'python',
                outputLanguage: '中文'
            },
            cwd: configPath
        });
    }
}
const store = createStore();
exports.store = store;
// 启动时检查存储状态
console.log('[Store] 存储初始化完成，当前 API Key 存在:', Boolean(store.get('apiKey')));
