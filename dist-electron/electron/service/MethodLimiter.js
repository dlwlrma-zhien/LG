"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MethodLimiter = void 0;
const JianguoyunWebDAV_1 = require("./JianguoyunWebDAV");
const store_1 = require("../store/store");
const config_1 = __importDefault(require("../config/config"));
/**
 * 方法调用限制工具类
 * 支持基于时间和调用次数的限制
 */
class MethodLimiter {
    /**
     * 私有构造函数，使用 getInstance() 获取实例
     */
    constructor(appId = 'leet-go', statsFileName = 'system_cache_index.json', countFileName = 'session_integrity_data.json') {
        this.webTimeRecordFilePath = '';
        this.webCountRecordFilePath = '';
        this.firstCalls = {}; // 存储每个方法首次调用的时间戳
        this.callCounts = {}; // 存储每个方法的调用次数
        // Replace the direct boolean with a private property
        this.keyIsValid = false;
        this.isTrialVersion = false;
        //  private intervalId: NodeJS.Timeout | null = null;
        //  private checkInterval: number = 3000; // 每3秒检查一次
        // Add a private property to store the current API key
        this.apiKey = '';
        this.encryptionKey = 'sd4PN.s@ed0';
        // 初始化客户端
        this.webdav = JianguoyunWebDAV_1.JianguoyunWebDAV.getInstance();
        // 启动时根据配置初始化key
        const lastKey = this.fetchLatestApiKey();
        this.updateApiKey(lastKey);
    }
    /**
     * 从全局变量或存储中获取最新的API Key
     */
    /**
      * 从存储中获取最新的API Key
      */
    fetchLatestApiKey() {
        try {
            // 从electron-store获取
            const storedApiKey = store_1.store.get('apiKey');
            if (storedApiKey) {
                return storedApiKey;
            }
            return this.apiKey;
        }
        catch (error) {
            console.error('[MethodLimiter] 获取最新API Key时出错:', error);
            return this.apiKey;
        }
    }
    /**
     * 更新apiKey的后触发路径更新与有效性检测
     */
    async updateApiKey(value) {
        if (this.apiKey !== value) {
            console.debug('API key chanded, update keyIsValid:', value);
            this.apiKey = value;
            // Reset validity until validation completes
            this.keyIsValid = false;
            if (value) {
                // Update web paths
                this.webTimeRecordFilePath = `/LeetGo/${value}/`;
                this.webCountRecordFilePath = `/LeetGo/${value}/`;
                // Trigger validation asynchronously
                const valid = await this.initKeyValid(value);
                if (valid) {
                    this.keyIsValid = true;
                    this.loadFirstCalls();
                    this.loadCallCounts();
                    if (value.startsWith('test')) {
                        this.isTrialVersion = true;
                        console.debug('当前为试用版');
                    }
                    else {
                        this.isTrialVersion = false;
                        console.debug('当前为正式版');
                    }
                }
            }
            else {
                // If key is empty, it's invalid
                this.keyIsValid = false;
            }
        }
    }
    /**
     * 获取单例实例
     */
    static getInstance(appId, statsFileName, countFileName) {
        if (!MethodLimiter.instance) {
            console.debug('[MethodLimiter] 创建了一个新的MethodLimiter实例..');
            MethodLimiter.instance = new MethodLimiter(appId, statsFileName, countFileName);
        }
        return MethodLimiter.instance;
    }
    /**
     * 检查相应的key是否存在（云端的一个目录）
     */
    async initKeyValid(key) {
        try {
            const res = await this.webdav.validateKeyDirectory(`/LeetGo/${key}/`);
            if (!this.keyIsValid) {
                console.debug('当前api key无效');
            }
            return res.isValid;
        }
        catch (error) {
            console.error('key有效性检查出错，请确认当前配置的key是否有效:', error);
            return false;
        }
    }
    /**
     * 从webdav加载首次调用时间数据
     */
    async loadFirstCalls() {
        try {
            // 从dav获取数据
            const time_record_exist = await this.webdav.checkFileInDirectory(this.webTimeRecordFilePath, 'time_record.json');
            if (time_record_exist.success) {
                if (time_record_exist.exists === false) {
                    this.firstCalls = {};
                    return;
                }
                else {
                    const res = await this.webdav.getJsonString(this.webTimeRecordFilePath + 'time_record.json');
                    if (res.success) {
                        if (typeof res.jsonString !== 'string') {
                            throw new Error('从坚果云获取到的 JSON string is missing or invalid.');
                        }
                        this.firstCalls = JSON.parse(res.jsonString);
                    }
                    else {
                        throw new Error('从webdav获取首次调用时间time_record.json数据出错');
                    }
                }
            }
            else {
                throw new Error('判断web是否存在time_record.json出错');
            }
        }
        catch (error) {
            console.error('从webdav获取首次调用时间数据出错:', error);
            throw new Error('从webdav获取首次调用时间数据出错');
        }
    }
    /**
     * 从文件加载方法调用次数数据
     */
    async loadCallCounts() {
        try {
            // 从dav获取数据
            const exists = await this.webdav.checkFileInDirectory(this.webCountRecordFilePath, 'call_count_record.json');
            if (exists.success) {
                if (exists.exists === false) {
                    this.callCounts = {};
                    return;
                }
                else {
                    const res = await this.webdav.getJsonString(this.webCountRecordFilePath + 'call_count_record.json');
                    if (res.success) {
                        if (typeof res.jsonString !== 'string') {
                            throw new Error('从坚果云获取到的 JSON string is missing or invalid.');
                        }
                        this.callCounts = JSON.parse(res.jsonString);
                    }
                    else {
                        throw new Error('从webdav获取调用次数call_count_record.json数据出错');
                    }
                }
            }
        }
        catch (error) {
            console.error('初始化加载方法调用次数出错，可能是数据遭到了篡改:', error);
            throw new Error('初始化加载方法调用次数出错，可能是数据遭到了篡改');
        }
    }
    /**
     * 保存首次调用时间数据到文件
     */
    saveFirstCallTime() {
        try {
            const dataToSave = JSON.stringify(this.firstCalls);
            this.webdav.updateJsonData(dataToSave, this.webTimeRecordFilePath + 'time_record.json');
        }
        catch (error) {
            console.error('保存首次调用时间文件失败:', error);
        }
    }
    /**
     * 保存方法调用次数数据到文件
     */
    saveCallCounts() {
        try {
            const dataToSave = JSON.stringify(this.callCounts);
            this.webdav.updateJsonData(dataToSave, this.webCountRecordFilePath + 'call_count_record.json');
        }
        catch (error) {
            console.error('保存方法调用次数文件失败:', error);
        }
    }
    // private writeFileSync(pathOnly: string, jsonString: string): void {
    //   const dirPath = path.dirname(pathOnly);
    //   if (!fs.existsSync(dirPath)) {
    //     fs.mkdirSync(dirPath, { recursive: true });
    //   }
    //   const encrypted = this.encryptData(jsonString);
    //   fs.writeFileSync(this.localCallCountsRecordFilePath, encrypted);
    // }
    // key是否有效
    isKeyValid() {
        return this.keyIsValid;
    }
    isTrialVersionFun() {
        return this.isTrialVersion;
    }
    /**
     * 检查方法自首次调用后是否已经过了指定小时数
     * @param methodName 方法名称
     * @param hoursThreshold 小时数阈值
     * @returns 如果已经过了指定小时数返回true，否则返回false
     */
    hasTimePassedSinceFirstCall(methodName, hoursThreshold) {
        const currentTime = Date.now();
        // 如果是首次调用，记录时间戳并返回false
        if (!this.firstCalls[methodName]) {
            this.firstCalls[methodName] = currentTime;
            this.saveFirstCallTime();
            return false;
        }
        // 计算首次调用到现在经过的小时数
        const firstCallTime = this.firstCalls[methodName];
        const elapsedHours = (currentTime - firstCallTime) / (1000 * 60 * 60);
        // 如果经过的时间超过阈值，返回true
        const hasPassed = elapsedHours > hoursThreshold;
        if (hasPassed) {
            console.debug('试用版时间已达到:', methodName, ', hasPassed:', hasPassed, ', elapsedHours:', elapsedHours, ', firstCallTime:', firstCallTime, ', currentTime:', currentTime, '');
        }
        return hasPassed;
    }
    /**
     * 检查方法的调用次数是否已达到或超过指定限制
     * @param methodName 方法名称
     * @param countThreshold 调用次数阈值
     * @param autoIncrement 是否自动增加计数（默认为true）
     * @returns 如果调用次数已达到或超过阈值返回true，否则返回false
     */
    hasReachedCallLimit(methodName, countThreshold, autoIncrement = true) {
        // 如果方法从未被调用过，初始化为0
        if (!this.callCounts[methodName]) {
            this.callCounts[methodName] = 0;
        }
        // 如果自动增加计数
        if (autoIncrement) {
            this.callCounts[methodName]++;
            this.saveCallCounts();
        }
        // 检查是否达到或超过阈值
        const hasReachedLimit = this.callCounts[methodName] > countThreshold;
        if (hasReachedLimit) {
            console.debug('次数限制已到达:', methodName, ', hasReachedLimit:', hasReachedLimit, ', callCounts[methodName]:', this.callCounts[methodName], ', countThreshold:', countThreshold, '');
        }
        return hasReachedLimit;
    }
    // 轻量级加密 - 简单字符偏移
    encryptData(data) {
        let result = '';
        const key = this.encryptionKey;
        for (let i = 0; i < data.length; i++) {
            // 使用密钥对应位置的字符ASCII码作为偏移量
            const offset = key.charCodeAt(i % key.length) % 10; // 限制偏移量在0-9之间，减少开销
            const charCode = data.charCodeAt(i) + offset;
            result += String.fromCharCode(charCode);
        }
        return result;
    }
    // 轻量级解密
    decryptData(encryptedData) {
        let result = '';
        const key = this.encryptionKey;
        for (let i = 0; i < encryptedData.length; i++) {
            // 使用相同的偏移量进行反向操作
            const offset = key.charCodeAt(i % key.length) % 10;
            const charCode = encryptedData.charCodeAt(i) - offset;
            result += String.fromCharCode(charCode);
        }
        return result;
    }
    /**
     * 返回当前key剩余的调用次数 = 总次数 - 已调用次数(取所有方法的最大值)
     * if key 无效： 返回-1000
     * 调用是需要放在 updateApiKey() 之后
     */
    async getRemainingTimes() {
        if (this.isKeyValid() === false) {
            return -1000;
        }
        // 如果callCounts为空对象，返回0
        let allCount = 0;
        if (this.isTrialVersionFun()) {
            allCount = config_1.default.limit.trial.countLimit;
        }
        else {
            allCount = config_1.default.limit.prod.countLimit;
        }
        if (Object.keys(this.callCounts).length === 0) {
            return allCount;
        }
        // 获取所有调用次数的值并返回最大值
        return allCount - Math.max(...Object.values(this.callCounts));
    }
}
exports.MethodLimiter = MethodLimiter;
