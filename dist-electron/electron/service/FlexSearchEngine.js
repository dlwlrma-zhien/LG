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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlexSearchEngine = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const { Document, Charset } = require("flexsearch");
const SERIALIZED_INDEX_PATH = path.join(__dirname, '../assets/flexsearch/flexsearch_index.idx.json');
const DOCUMENTS_MAP_PATH = path.join(__dirname, '../assets/flexsearch/documents.map.json');
class FlexSearchEngine {
    /** 提供外部可 await 的 ready Promise */
    get ready() {
        return this.initializationPromise;
    }
    constructor() {
        this.idx = null;
        this.documents = {};
        this.isReady = false;
        // 构造时立即启动初始化流程
        this.initializationPromise = this.initialize();
    }
    static async getInstance() {
        if (FlexSearchEngine.instance) {
            return FlexSearchEngine.instance;
        }
        if (FlexSearchEngine.instancePromise) {
            return FlexSearchEngine.instancePromise;
        }
        FlexSearchEngine.instancePromise = (async () => {
            const instance = new FlexSearchEngine();
            await instance.ready; // 保证初始化完成后返回实例
            FlexSearchEngine.instance = instance;
            return instance;
        })();
        return FlexSearchEngine.instancePromise;
    }
    /** 初始化流程，建议始终异步 */
    async initialize() {
        if (this.isReady)
            return;
        console.log('[FlexSearchEngine] 初始化中...');
        if (await this.tryLoadIndexFromFile()) {
            console.log('[FlexSearchEngine] 从预构建索引文件成功初始化。');
            this.isReady = true;
            this.debugIndexStatus();
        }
        else {
            this.isReady = false;
            console.warn('[FlexSearchEngine] 初始化失败（未找到索引文件或加载失败）');
        }
    }
    async tryLoadIndexFromFile() {
        console.log(`[FlexSearchEngine] 尝试从文件加载索引: ${SERIALIZED_INDEX_PATH}`);
        console.log(`[FlexSearchEngine] 尝试从文件加载文档: ${DOCUMENTS_MAP_PATH}`);
        if (fs.existsSync(SERIALIZED_INDEX_PATH) && fs.existsSync(DOCUMENTS_MAP_PATH)) {
            try {
                const indexData = await fs.promises.readFile(SERIALIZED_INDEX_PATH, 'utf-8');
                const documentsData = await fs.promises.readFile(DOCUMENTS_MAP_PATH, 'utf-8');
                this.documents = JSON.parse(documentsData);
                this.buildEmptyIndex();
                if (indexData && indexData !== '{}') {
                    const importedIndexObject = JSON.parse(indexData);
                    for (const key in importedIndexObject) {
                        if (Object.prototype.hasOwnProperty.call(importedIndexObject, key)) {
                            this.idx.import(key, importedIndexObject[key]);
                        }
                    }
                    console.log(`加载索引数据，大小: ${indexData.length} 字节`);
                    // 检验索引是否有效
                    let testExport = "";
                    this.idx.export((key, data) => {
                        if (data !== null) {
                            testExport += data;
                        }
                    });
                    console.log(`导入后重新导出的索引大小: ${testExport.length} 字节`);
                    if (testExport.length === 0 && indexData.length > 10) { // Heuristic: if original data was substantial but export is empty
                        console.warn('[FlexSearchEngine] 警告: 索引导入后似乎仍为空，请检查导出/导入逻辑和索引文件内容。');
                    }
                    console.log('[FlexSearchEngine] 索引数据导入成功');
                }
                else {
                    this.rebuildIndexFromDocuments();
                }
                return true;
            }
            catch (error) {
                console.error('[FlexSearchEngine] 从文件加载或解析索引/文档失败:', error);
                this.idx = null;
                this.documents = {};
                return false;
            }
        }
        else {
            return false;
        }
    }
    buildEmptyIndex() {
        this.idx = new Document({
            tokenize: "full",
            cache: true,
            // resolution: 2, // 分词的粒度
            document: {
                id: "id",
                index: [{ field: "题目描述", weight: 10 }],
                store: ["id"],
            },
            encoder: Charset.CJK,
        });
    }
    rebuildIndexFromDocuments() {
        this.buildEmptyIndex();
        const documents = Object.values(this.documents);
        for (const doc of documents) {
            this.idx.add({
                id: String(doc.id),
                题目描述: typeof doc.题目描述 === 'string' ? doc.题目描述 : String(doc.题目描述 || '')
            });
        }
        console.log('[FlexSearchEngine] 索引重建完成');
    }
    async search(query) {
        if (!this.isReady) {
            // 避免重复等待
            console.warn('[FlexSearchEngine] 搜索调用前初始化未完成，等待中...');
            await this.initializationPromise;
            if (!this.isReady) {
                console.error('[FlexSearchEngine] 初始化未成功完成，无法执行搜索。');
                return [];
            }
        }
        try {
            const searchKeywords = query.join(' ');
            const results = this.idx.search(searchKeywords, {
                limit: 3,
                enrich: false, // 启用结果详情
                suggest: true, // 启用模糊匹配
                score: true
            });
            console.log(`[FlexSearchEngine] 搜索查询 "${searchKeywords}" 的结果:`, results);
            const matchedDocuments = [];
            if (results && Array.isArray(results)) {
                for (const resultSet of results) {
                    if (resultSet.result && Array.isArray(resultSet.result)) {
                        for (const item of resultSet.result) {
                            const docId = item;
                            if (docId && this.documents[docId]) {
                                matchedDocuments.push(this.documents[docId]);
                            }
                        }
                    }
                }
            }
            return matchedDocuments;
        }
        catch (error) {
            console.error(`[FlexSearchEngine] 搜索查询 "${query}" 失败:`, error);
            return [];
        }
    }
    get isIndexReady() {
        return this.isReady;
    }
    async debugIndexStatus() {
        console.log('=== FlexSearch 索引状态检查 ===');
        console.log(`1. 初始化状态: ${this.isReady ? '已完成' : '未完成'}`);
        console.log(`2. 文档数量: ${Object.keys(this.documents).length}`);
        // 检查文档内容
        const firstDoc = Object.values(this.documents)[0];
        console.log('3. 首个文档示例:', firstDoc ? JSON.stringify(firstDoc, null, 2) : '无文档');
        // 检查索引对象
        console.log(`4. 索引对象状态: ${this.idx ? '已创建' : '未创建'}`);
        // if (this.idx) {
        //     // 尝试执行一个简单搜索来验证索引功能
        //     const testSearch = await this.search(['数组']);
        //     console.log('5. 测试搜索结果数量:', testSearch.length);
        // }
        // 检查索引内部状态
        if (this.idx) {
            try {
                const exportData = {};
                this.idx.export((key, data) => {
                    exportData[key] = data;
                });
                console.log('6. 索引内部数据大小:', Object.keys(exportData).length);
                console.log('7. 索引包含的字段:', Object.keys(exportData));
            }
            catch (error) {
                console.error('导出索引数据失败:', error);
            }
        }
        console.log('=== 状态检查完成 ===');
    }
}
exports.FlexSearchEngine = FlexSearchEngine;
FlexSearchEngine.instance = null;
FlexSearchEngine.instancePromise = null;
