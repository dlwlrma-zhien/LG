"use strict";
// StoreManager类 - 单例模式
// 定义在store.ts中，所以store相关操作都放在这里
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOutputLanguage = getOutputLanguage;
exports.saveOutputLanguage = saveOutputLanguage;
const store_1 = require("./store");
class StoreManager {
    constructor() {
        this._outputLanguage = '中文';
        this._codeLanguage = 'python';
        this.initializeFromStore();
    }
    // 获取单例
    static getInstance() {
        if (!StoreManager.instance) {
            StoreManager.instance = new StoreManager();
        }
        return StoreManager.instance;
    }
    initializeFromStore() {
        try {
            // 从存储中读取设置到内存
            this._outputLanguage = store_1.store.get('outputLanguage') || '中文';
            this._codeLanguage = store_1.store.get('language') || 'python';
            console.debug("[StoreManager] 输出语言初始化完成：", this._outputLanguage, this._codeLanguage);
        }
        catch (error) {
            console.error('[StoreManager] 从存储中加载设置时出错:', error);
            this._outputLanguage = '中文';
            this._codeLanguage = 'python';
        }
    }
    getOutputLanguage() {
        return {
            success: true,
            outputLanguage: this._outputLanguage
        };
    }
    saveOutputLanguage(language) {
        // 值发生变化时才保存
        if (language === this._outputLanguage) {
            return { success: true };
        }
        try {
            this._outputLanguage = language;
            store_1.store.set('outputLanguage', language);
            console.debug("[StoreManager] 成功保存输出语言设置");
            return { success: true };
        }
        catch (error) {
            console.error("[StoreManager] 保存输出语言设置出错:", error);
            return { success: false, error: String(error) };
        }
    }
    getCodeLanguage() {
        return {
            success: true,
            language: this._codeLanguage
        };
    }
    saveCodeLanguage(language) {
        // 值发生变化时才保存
        if (language === this._codeLanguage) {
            return { success: true };
        }
        try {
            this._codeLanguage = language;
            store_1.store.set('language', language);
            console.debug("[StoreManager] 成功保存Code语言设置");
            return { success: true };
        }
        catch (error) {
            console.error("[StoreManager] 保存Code语言设置出错:", error);
            return { success: false, error: String(error) };
        }
    }
}
// 创建单例实例
const storeManager = StoreManager.getInstance();
//所有的获取与存储方法应该在这里声明 前端调用通过ipc 后端就直接调用即可
// 全部都是同步的
function getOutputLanguage() {
    return storeManager.getOutputLanguage();
}
function saveOutputLanguage(language) {
    return storeManager.saveOutputLanguage(language);
}
exports.default = storeManager;
