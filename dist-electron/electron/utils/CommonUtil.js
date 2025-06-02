"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonUtil = void 0;
/**
 * 通用的 OpenAI API 调用重试工具类
 */
class CommonUtil {
    /**
     * 带自动重试的 API 调用
     * @param requestFn 请求函数（返回 Promise）
     * @param maxRetries 最大重试次数，默认 2
     * @param delayMs 初始重试间隔（ms），默认 400
     */
    static async withRetry(requestFn, maxRetries = 3, delayMs = 400) {
        let attempt = 0;
        let lastError;
        while (attempt <= maxRetries) {
            try {
                return await requestFn();
            }
            catch (err) {
                lastError = err;
                attempt++;
                if (attempt > maxRetries)
                    break;
                // 打印重试日志
                console.warn(`[withRetry] 第${attempt}次重试，延迟${delayMs}ms，错误信息：`, err instanceof Error ? err.message : err);
                // 指数退避
                await new Promise(res => setTimeout(res, delayMs));
            }
        }
        throw lastError;
    }
}
exports.CommonUtil = CommonUtil;
