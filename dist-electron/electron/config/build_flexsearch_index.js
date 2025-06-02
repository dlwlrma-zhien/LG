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
const xlsx = __importStar(require("xlsx"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const { Document, Charset } = require("flexsearch");
const excelPath = "/Users/peakiz/Projects/myScripts/python/Data/leetcode/all_leetcode.xlsx";
const indexPath = "/Users/peakiz/Projects/OpenHands/assets/flexsearch/";
const SERIALIZED_INDEX_PATH = path.join(indexPath, 'flexsearch_index.idx.json');
const DOCUMENTS_MAP_PATH = path.join(indexPath, 'documents.map.json');
function ensureDirExist(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.debug(`[build_flexsearch_index] 创建目录: ${dir}`);
    }
}
function loadDataFromExcel(excelFilePath) {
    console.log(`[build_flexsearch_index] 读取Excel文件: ${excelFilePath}`);
    if (!fs.existsSync(excelFilePath)) {
        throw new Error(`[build_flexsearch_index] Excel文件未找到: ${excelFilePath}`);
    }
    const buf = fs.readFileSync(excelFilePath);
    const workbook = xlsx.read(buf, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    const documents = {};
    const documentsForIndex = [];
    if (jsonData.length > 1) {
        const headers = jsonData[0];
        const idIndex = headers.indexOf("题号");
        const descIndex = headers.indexOf("题目描述");
        const answerIndex = headers.indexOf("答案");
        if (idIndex === -1 || descIndex === -1 || answerIndex === -1) {
            throw new Error("Excel表格缺少必需的列: '题号', '题目描述', '答案'");
        }
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const id = row[idIndex];
            if (id === undefined || id === null || documents[id]) {
                console.warn(`[build_flexsearch_index] 跳过Excel行 ${i + 1}，因为ID缺失或重复: ${id}`);
                continue;
            }
            const doc = {
                id: id,
                题目描述: row[descIndex] || "",
                答案: row[answerIndex] || "",
            };
            documentsForIndex.push(doc);
            documents[doc.id] = doc;
        }
    }
    else {
        console.warn("[build_flexsearch_index] Excel表格为空或只包含表头行。");
    }
    console.log(`[build_flexsearch_index] 从Excel加载了 ${documentsForIndex.length} 个文档。`);
    return documentsForIndex;
}
function buildEmptyIndex() {
    return new Document({
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
function buildFlexSearchIndex(docs) {
    const idx = buildEmptyIndex();
    docs.forEach(doc => {
        const processedDoc = {
            id: String(doc.id),
            题目描述: typeof doc.题目描述 === "string"
                ? doc.题目描述
                : String(doc.题目描述 || ""),
        };
        idx.add(processedDoc);
    });
    return idx;
}
function saveIndexAndDocuments(idx, docs) {
    return new Promise(async (resolve, reject) => {
        ensureDirExist(path.dirname(SERIALIZED_INDEX_PATH));
        ensureDirExist(path.dirname(DOCUMENTS_MAP_PATH));
        // 构建文档对象
        const documentsObj = {};
        docs.forEach(doc => {
            documentsObj[doc.id] = doc;
        });
        // 保存索引
        if (idx) {
            const exportData = {};
            idx.export((key, data) => {
                // FlexSearch's export callback might provide null for some keys if data is empty.
                if (data !== null) {
                    exportData[key] = data;
                }
            });
            const serializedIndex = JSON.stringify(exportData);
            await fs.promises.writeFile(SERIALIZED_INDEX_PATH, serializedIndex, "utf-8");
            console.log(`[build_flexsearch_index] 索引序列化完成: ${SERIALIZED_INDEX_PATH}`);
        }
        else {
            await fs.promises.writeFile(SERIALIZED_INDEX_PATH, '{}', "utf-8");
            console.log(`[build_flexsearch_index] 索引为空，写入空对象: ${SERIALIZED_INDEX_PATH}`);
        }
        // 保存文档
        const documentsJson = JSON.stringify(documentsObj);
        await fs.promises.writeFile(DOCUMENTS_MAP_PATH, documentsJson, "utf-8");
        console.log(`[build_flexsearch_index] 文档保存成功: ${DOCUMENTS_MAP_PATH}`);
        resolve();
    });
}
async function main() {
    try {
        ensureDirExist(path.dirname(excelPath));
        if (!fs.existsSync(excelPath)) {
            console.error(`[build_flexsearch_index] 错误: 未找到Excel文件，路径: ${excelPath}`);
            return;
        }
        // 尝试从Excel构建
        const docs = loadDataFromExcel(excelPath);
        if (docs.length === 0) {
            console.warn("[build_flexsearch_index] Excel中未找到有效文档用于构建索引。");
            await saveIndexAndDocuments(null, docs);
            return;
        }
        console.log("[build_flexsearch_index] 正在从Excel数据构建FlexSearch索引...");
        const idx = buildFlexSearchIndex(docs);
        console.log("[build_flexsearch_index] 从Excel成功构建FlexSearch索引。");
        await saveIndexAndDocuments(idx, docs);
        console.log("[build_flexsearch_index] 初始化完成（从Excel构建并保存）。");
    }
    catch (err) {
        console.error("[build_flexsearch_index] 构建失败:", err);
    }
}
main();
// 执行命令即可构建： npx ts-node electron/config/build_flexsearch_index.ts
