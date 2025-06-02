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
exports.extract = extract;
exports.generate = generate;
exports.debug = debug;
const MethodLimiter_1 = require("./MethodLimiter");
const config_1 = __importStar(require("../config/config"));
const openai_1 = __importDefault(require("openai"));
const storeManager_1 = require("../store/storeManager");
const FlexSearchEngine_1 = require("./FlexSearchEngine");
const CommonUtil_1 = require("../utils/CommonUtil");
// 初始化OpenAI客户端
const openai = new openai_1.default({
    apiKey: config_1.default.api.apiKey,
    baseURL: config_1.default.api.baseUrl,
    maxRetries: 2, // 重试次数
});
// 初始化OpenAI客户端
const openai_byte = new openai_1.default({
    apiKey: config_1.default.api.apiKey_byte,
    baseURL: config_1.default.api.baseUrl_byte,
    maxRetries: 2, // 重试次数
});
const limter = MethodLimiter_1.MethodLimiter.getInstance();
const searchEngine = FlexSearchEngine_1.FlexSearchEngine.getInstance();
/**
 * 将base64图像数据转换为适合API调用的格式
 */
function formatImageForAPI(base64Data) {
    // 确保base64数据有正确的前缀
    if (!base64Data.startsWith('data:image')) {
        return `data:image/png;base64,${base64Data}`;
    }
    return base64Data;
}
function isTrialVersion() {
    return limter.isTrialVersionFun();
}
function hasReachedLimit(methodName) {
    // 根据版本给不同的限制
    if ((isTrialVersion())) {
        const timeLimiter = limter.hasTimePassedSinceFirstCall(methodName + "-trial", config_1.default.limit.trial.hourLimit); // 限制小时数
        const countLimiter = limter.hasReachedCallLimit(methodName + "-trial", config_1.default.limit.trial.countLimit); // 限制调用次数
        if (timeLimiter || countLimiter) {
            return true;
        }
    }
    else {
        if (limter.hasReachedCallLimit(methodName + "-official", config_1.default.limit.prod.countLimit)) {
            return true;
        }
    }
    return false;
}
function checkLimit(methodName) {
    if (limter.isKeyValid() == false) {
        throw new Error('API Key无效，请检查是否配置了正确的API Key。');
    }
    if (hasReachedLimit(methodName)) {
        if (isTrialVersion()) {
            throw new Error(`试用版本调用次数 ${config_1.default.limit.trial.countLimit} 次/试用时间 ${config_1.default.limit.trial.hourLimit} 小时达到限制，请购买正式版本后继续使用。`);
        }
        else {
            throw new Error(`软件当前key的总调用次数(${config_1.default.limit.prod.countLimit}次)已耗尽，请重新购买key以获取更多次数。`);
        }
    }
}
/**
 * 文字识别和问题提取
 * @param imageDataList base64编码的图像数据数组
 * @param language 编程语言
 * @returns 提取出的问题陈述数据
 */
async function extract(imageDataList, language) {
    // 打包时需要去除这个mock
    // return extractForMock();
    try {
        console.log(`提取算法题目，使用语言: ${language}, 输出语言 ${(0, storeManager_1.getOutputLanguage)()?.outputLanguage}, 图片数量: ${imageDataList.length}`);
        checkLimit('extract');
        // 构建用户消息的内容部分，包含文本和图像
        const userContent = [
            {
                type: "text",
                text: `请从以下电脑屏幕截图中提取出面试/笔试算法题目，你需要过滤掉屏幕上的一些无效字符与文字，并推测补充一些必要的题目信息，同时你需要额外注意屏幕上的代码注释内容，将注释中的关键约束信息(比如"要求迭代法实现"等)补全为题目的约束条件之一，最终返回详细的题目信息。`
                    + `\n **返回内容及格式要求：你必须严格只输出以下格式的合法 JSON，不允许有多余的说明、代码块标记、反引号或其他字符, 且为${(0, storeManager_1.getOutputLanguage)()?.outputLanguage}表达，(其中search_key_words字段不受语言约束，其只能用中文表达)： 
        {
          "problem_statement": "题目描述及约束条件",
          "search_key_words": ["从题目描述中提取(并翻译)出的3~5个核心中文关键特征词，用于快速检索题目, 注意只能从题目描述中提取"],
          "input_format": {
            "description": "输入描述",
            "parameters": [
              {
                "name": "参数名",
                "description": "参数描述",
                "type": "参数类型"
              }
            ]
          },
          "output_format": {
            "description": "输出描述",
            "type": "输出类型",
            "subtype": "输出子类型"
          },
          "test_cases": []
        }`
            },
            ...imageDataList.map(imgData => ({
                type: "image_url",
                image_url: {
                    url: formatImageForAPI(imgData)
                }
            }))
        ];
        // 构建API调用消息
        const messages = [
            {
                role: "system",
                content: `你是一名算法题识别专家，请从用户给的电脑屏幕截图中提取出面试算法题目(输入可能是一张或两张截图，你需要综合提取出里面的一道完整算法题目)，你需要过滤掉屏幕上的一些无效字符与文字，并推测补充一些必要的信息，同时你需要额外注意屏幕上的代码注释，将注释中的关键约束信息补全为题目的约束条件之一，最终的题目要求描述精简、准确、严谨并完整。`
            },
            {
                role: "user",
                content: userContent
            }
        ];
        // 调用API
        const response = await CommonUtil_1.CommonUtil.withRetry(() => openai.chat.completions.create({
            messages,
            model: config_1.apiConfig.models.extra.modelName,
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 3000,
        }));
        // 解析响应
        const responseContent = response.choices[0].message.content;
        if (!responseContent) {
            throw new Error('从API获取的响应内容为空');
        }
        try {
            // 解析JSON响应
            console.debug('extract题解解析响应内容:', responseContent);
            const parsedData = safeParseJSON(responseContent);
            // 确保返回的数据符合ProblemStatementData接口
            const extractedData = {
                problem_statement: parsedData.problem_statement || "无法从图像中提取题目",
                search_key_words: parsedData.search_key_words || [],
                input_format: {
                    description: parsedData.input_format?.description || "未能提取",
                    parameters: parsedData.input_format?.parameters || []
                },
                output_format: {
                    description: parsedData.output_format?.description || "未能提取",
                    type: parsedData.output_format?.type || "unknown",
                    subtype: parsedData.output_format?.subtype || "unknown"
                },
                test_cases: parsedData.test_cases || []
            };
            console.debug('成功提取算法题目数据: ');
            console.debug(extractedData);
            return extractedData;
        }
        catch (parseError) {
            console.error('解析API响应时出错:', parseError);
            throw new Error('无法将API响应解析为有效的JSON');
        }
    }
    catch (error) {
        console.error('调用题目提取API时出错:', error);
        // 提供一个回退方案，以防API调用失败
        const fallbackData = {
            problem_statement: `提取题目出错，错误信息：${error.message}`,
            search_key_words: [],
            input_format: {
                description: "未能提取",
                parameters: []
            },
            output_format: {
                description: "未能提取",
                type: "unknown",
                subtype: "unknown"
            },
            test_cases: []
        };
        console.log('使用回退数据:', fallbackData);
        return fallbackData;
    }
}
function jaccardCharSimilarity(a, b) {
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}
async function searchAndFilter(problemInfo) {
    try {
        const searchInstance = await searchEngine;
        let res = await searchInstance.search(problemInfo.search_key_words);
        if (res != null && res.length > 0) {
            // 计算每个元素的相似度并作为新字段加入
            res = res.map(item => ({
                ...item,
                similarity: jaccardCharSimilarity(problemInfo.problem_statement, item.题目描述)
            }));
            // 按相似度从高到低排序
            res.sort((a, b) => b.similarity - a.similarity);
            console.debug('最终预选的搜索结果:');
            console.debug(JSON.stringify(res[0], null, 2));
            if (res[0].similarity <= 0.35) {
                console.log('搜索结果相似度太低，被过滤了，原题匹配失败！');
                return null;
            }
            console.debug('原题匹配成功！！');
            return res[0];
        }
        // 搜索结果为空
        console.debug('flexsearch搜索结果为空，原题匹配失败！');
        return null;
    }
    catch (err) {
        console.error('搜索过程出错:', err);
        return null;
    }
}
/**
 * 生成解决方案
 * @param problemInfo 问题信息
 * @param language 编程语言
 * @returns 生成的解决方案
 */
async function generate(problemInfo, language) {
    try {
        console.log(`为问题生成${language}解决方案`);
        checkLimit('generate');
        // 将问题信息序列化为字符串
        const problemInfoString = JSON.stringify(problemInfo, null, 2);
        const searchRes = await searchAndFilter(problemInfo);
        let userContent = `请为以下算法问题提供一个${language}的解决方案：\n\n${problemInfoString}`;
        if (searchRes) {
            userContent = userContent + `\n\n参考资料： \n <题目描述>\n${searchRes.题目描述} \n</题目描述>\n <题解>：${searchRes.答案}\n</题解>`
                + "\n\n 重要要求：\n - 参考资料中的<题解>标签的内容是对应于<题目描述>标签中题目的经过验证的正确答案，但需要注意参考资料中的题目不一定是原题，你需要仔细确认参考资料中的答案是否可以解决用户所需解答的题目， \n - 如果发现不是原题，请不要被参考资料影响，需要你自己一步步仔细思考(think)与推理得到最后的答案 \n - 如果发现是原题，则请选择参考答案中的最优解进行解题，并添加上简短注释帮用户理解答案";
        }
        userContent += `\n - **返回内容及格式要求：你必须严格只输出以下格式的合法 JSON，不允许有多余的说明、代码块标记、反引号或其他字符, 且为${(0, storeManager_1.getOutputLanguage)()?.outputLanguage}表达**： 
        {
            initial_thoughts: 核心解题思路要点组成的数组(需要包含题目结题关键技巧信息，比如是用二分/回溯/前缀树/贪心法等等)，注意逻辑性, 要体现关键推导/思考过程/公式，让用户理解如何思考解决这道题，要点数量不超过3个，单个要点字符数量不超过180字。
            code: 问题的代码答案，**要求只允许一共8行以内注释，每行注释不超过40字，仅在核心步骤处加注释帮助用户理解答案，注释使用${(0, storeManager_1.getOutputLanguage)()?.outputLanguage}表达。**。
            time_complexity: 时间复杂度(包含简单解释说明)。
            space_complexity: 空间复杂度(包含简要解释说明)。
        }`;
        // return null;
        // 构建API调用消息
        const messages = [
            {
                role: "system",
                content: `你是一个专业的计算机面试算法解题专家。请为提供的算法问题生成一个高效、正确的${language}解决方案，针对题目未给出的一些必要条件，你可以自行推断与假设。        
        请确保你的解决方案:
        - 代码符合${language}的最佳实践
        - 实现正确且能通过所有测试用例
        - 考虑边界条件和异常情况
        `
            },
            {
                role: "user",
                content: userContent
            }
        ];
        // 调用API
        const response = await CommonUtil_1.CommonUtil.withRetry(() => openai.chat.completions.create({
            messages,
            model: config_1.default.api.models.generate.modelName,
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 3200
        }));
        // 解析响应
        const responseContent = response.choices[0].message.content;
        console.debug('generate题解解析响应内容:', responseContent);
        if (!responseContent) {
            throw new Error('从API获取的响应内容为空');
        }
        try {
            // 解析JSON响应
            const solutionData = safeParseJSON(responseContent);
            // 构建符合Solution接口的对象
            const solution = {
                initial_thoughts: solutionData.initial_thoughts || [],
                code: solutionData.code || "// 未能生成代码",
                time_complexity: solutionData.time_complexity || "NULL",
                space_complexity: solutionData.space_complexity || "NULL"
            };
            console.log('成功生成解决方案');
            return {
                solutions: [solution]
            };
        }
        catch (parseError) {
            console.error('解析API响应时出错:', parseError);
            throw parseError;
        }
    }
    catch (error) {
        console.error('调用解决方案生成API时出错:', error);
        // 提供一个回退方案，以防API调用失败
        return {
            solutions: [
                {
                    initial_thoughts: [`无法生成解决方案，错误信息：${error.message}`],
                    code: `// 生成解决方案失败
                // 可能的原因:
                // - 调用次数已耗尽
                // - 网络连接问题
                // - 服务器错误
                // - 问题描述不完整或不准确`,
                    time_complexity: "NULL",
                    space_complexity: "NULL"
                }
            ]
        };
    }
}
/**
 * 调试和优化解决方案
 * @param imageDataList 新截图的base64图像数据
 * @param problemInfo 原问题信息
 * @param language 编程语言
 * @returns 改进后的解决方案
 */
async function debug(imageDataList, problemInfo, language) {
    try {
        console.log(`调试和优化${language}解决方案，图片数量: ${imageDataList.length}`);
        checkLimit('debug');
        // 将问题信息序列化为字符串
        const problemInfoString = JSON.stringify(problemInfo, null, 2);
        // 构建用户消息的内容部分，包含文本和图像
        const userContent = [
            {
                type: "text",
                text: `识别屏幕截图中的代码实现(一般位于一个代码编辑区域), 这个实现方案整体是正确的，但是细节上存在一些问题，帮我找出无法通过所有Case的原因，并提供改进的${language}解决方案以成功通过题目评审，下面是原始的题目信息：\n\n${problemInfoString}`
                    + `\n **返回内容及格式要求：你必须严格只输出以下格式的合法 JSON，不允许有多余的说明、代码块标记、反引号或其他字符, 且为${(0, storeManager_1.getOutputLanguage)()?.outputLanguage}表达**：
        {
            initial_thoughts: 问题分析及核心改进思路组成的一个数组，让用户容易理解问题如何解决, 但要点数量不超过2个，单个要点字符数量不超过120字
            code: 改进后的完整代码（要精简，仅对改动部分作简单注释，其他地方不要有注释信息）,
            time_complexity: 时间复杂度(包含极简解释说明),
            space_complexity: 空间复杂度(包含极简解释说明)
        }`
            },
            ...imageDataList.map(imgData => ({
                type: "image_url",
                image_url: {
                    url: formatImageForAPI(imgData)
                }
            }))
        ];
        // 构建API调用消息
        const messages = [
            {
                role: "system",
                content: `你是一个专业的代码调试和优化专家。请分析用户提供的算法题目和新截图中的代码和错误信息，找出问题所在并提供改进/优化的解决方案。`
            },
            {
                role: "user",
                content: userContent
            }
        ];
        // 调用API
        const response = await CommonUtil_1.CommonUtil.withRetry(() => openai_byte.chat.completions.create({
            messages,
            model: config_1.default.api.models_byte.debug.modelName,
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 3000
        }));
        // 解析响应
        const responseContent = response.choices[0].message.content;
        if (!responseContent) {
            throw new Error('从API获取的响应内容为空');
        }
        try {
            // 解析JSON响应
            console.debug('debugAPI响应内容:', responseContent);
            const debugData = safeParseJSON(responseContent);
            // 构建符合Solution接口的对象
            const improvedSolution = {
                initial_thoughts: debugData.initial_thoughts || [],
                code: debugData.code || "// 未能生成改进代码",
                time_complexity: debugData.time_complexity || "NULL",
                space_complexity: debugData.space_complexity || "NULL"
            };
            console.log('成功生成改进的解决方案');
            return {
                improvedSolution
            };
        }
        catch (parseError) {
            console.error('解析API响应时出错:', parseError);
            throw new Error('无法将API响应解析为有效的JSON');
        }
    }
    catch (error) {
        console.error('调用代码调试API时出错:', error);
        // 提供一个回退方案，以防API调用失败
        return {
            improvedSolution: {
                initial_thoughts: [`无法生成调试或优化方案，错误信息：${error.message}`],
                code: `// 生成改进解决方案失败，请检查网络连接是否正常，调用次数是否已耗尽。`,
                time_complexity: "NULL",
                space_complexity: "NULL"
            },
        };
    }
}
/**
 * 尝试解析 JSON 字符串，在失败时自动修复常见格式问题
 * @param jsonString 要解析的 JSON 字符串
 * @param maxAttempts 最大修复尝试次数
 * @returns 解析后的 JavaScript 对象
 */
function safeParseJSON(jsonString, maxAttempts = 3) {
    // 先尝试标准解析
    try {
        return JSON.parse(jsonString);
    }
    catch (initialError) {
        // 如果标准解析失败，开始尝试修复
        console.warn("JSON 解析失败，尝试修复格式...");
        let attempts = 0;
        let lastError = initialError;
        let fixedString = jsonString;
        // 尝试各种修复方法
        while (attempts < maxAttempts) {
            attempts++;
            try {
                // 尝试修复 #1: 提取核心 JSON 内容 - 去除首个大括号前和最后一个大括号后的多余字符
                const jsonObjectMatch = fixedString.match(/(\{[\s\S]*\})/);
                if (jsonObjectMatch) {
                    fixedString = jsonObjectMatch[0];
                }
                // 尝试修复 #2: 移除尾随逗号
                fixedString = fixedString.replace(/,\s*([\]}])/g, "$1");
                // 尝试修复 #3: 修复未闭合的括号和大括号
                const opens = (fixedString.match(/\{/g) || []).length;
                const closes = (fixedString.match(/\}/g) || []).length;
                if (opens > closes) {
                    fixedString = fixedString + "}".repeat(opens - closes);
                }
                const opensArray = (fixedString.match(/\[/g) || []).length;
                const closesArray = (fixedString.match(/\]/g) || []).length;
                if (opensArray > closesArray) {
                    fixedString = fixedString + "]".repeat(opensArray - closesArray);
                }
                // 尝试解析修复后的字符串
                const result = JSON.parse(fixedString);
                console.info(`JSON 已修复并成功解析 (尝试 #${attempts})`);
                return result;
            }
            catch (error) {
                lastError = error;
                console.warn(`修复尝试 #${attempts} 失败: ${lastError}`);
            }
        }
        // 所有修复尝试都失败了
        throw new Error('无法将API响应解析为有效的JSON，且尝试修复格式后仍然失败，请重置操作后再次尝试');
    }
}
function extractForMock() {
    // for test
    return {
        "problem_statement": "给定一个整数数组 nums，“数组值”定义为所有满足 0 <= i < nums.length - 1 的 |nums[i] - nums[i+1]| 的和。可以选择给定数组的任意子数组，并将该子数组翻转，且只能执行这个操作一次。需要找到可行的最大数组值。约束条件：2 <= nums.length <= 3 * 10^4。",
        "search_key_words": ["整数数组", "反转子数组", "数组值最大化", "一次操作"],
        "input_format": {
            "description": "输入一个整数数组",
            "parameters": [
                {
                    "name": "nums",
                    "description": "整数数组",
                    "type": "integer array"
                }
            ]
        },
        "output_format": {
            "description": "返回可行的最大数组值",
            "type": "integer",
            "subtype": ""
        },
        "test_cases": [
            {
                "input": {
                    "nums": [2, 3, 1, 5, 4]
                },
                "output": 10
            },
            {
                "input": {
                    "nums": [2, 4, 9, 24, 2, 1, 10]
                },
                "output": 68
            }
        ]
    };
}
