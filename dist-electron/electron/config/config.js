"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = exports.jianguoyunConfig = exports.limitConfig = exports.apiConfig = void 0;
// OpenAI API 配置
exports.apiConfig = {
    baseUrl_byte: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey_byte: '1a47282d-2d01-441a-bf4f-82357e57bbf6',
    models_byte: {
        extra: {
            modelName: 'doubao-1-5-vision-pro-32k-250115',
        },
        generate: {
            modelName: 'deepseek-v3-250324'
        },
        debug: {
            modelName: 'doubao-1-5-vision-pro-32k-250115',
        },
    },
    // openRouter
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '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',
    models: {
        extra: {
            modelName: 'google/gemini-2.5-flash-preview-05-20',
        },
        generate: {
            modelName: 'google/gemini-2.5-flash-preview-05-20'
        },
        debug: {
            modelName: 'google/gemini-2.5-flash-preview-05-20',
        },
    }
};
// 应用功能限制配置
exports.limitConfig = {
    // 试用版限制
    trial: {
        hourLimit: 0.5,
        countLimit: 5
    },
    // 正式版限制
    prod: {
        countLimit: 650
    }
};
// 坚果云WebDAV配置
exports.jianguoyunConfig = {
    username: '1957939650@qq.com',
    password: 'acvy9g9zbw2uif7c',
    baseUrl: 'https://dav.jianguoyun.com/dav'
};
/**
 * 完整配置对象，导出所有配置
 */
exports.appConfig = {
    api: exports.apiConfig,
    limit: exports.limitConfig,
    jianguoyun: exports.jianguoyunConfig
};
// 默认导出完整配置
exports.default = exports.appConfig;
