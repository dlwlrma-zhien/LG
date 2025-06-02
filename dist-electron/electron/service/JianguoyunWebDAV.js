"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JianguoyunWebDAV = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../config/config"));
const path_1 = __importDefault(require("path"));
/**
 * 坚果云WebDAV客户端
 */
class JianguoyunWebDAV {
    /**
     * 获取JianguoyunWebDAV的单例实例
     */
    static getInstance() {
        if (!JianguoyunWebDAV.instance) {
            JianguoyunWebDAV.instance = new JianguoyunWebDAV();
        }
        return JianguoyunWebDAV.instance;
    }
    constructor() {
        console.debug('初始化坚果云WebDAV客户端');
        this.baseUrl = config_1.default.jianguoyun.baseUrl;
        this.username = config_1.default.jianguoyun.username;
        this.password = config_1.default.jianguoyun.password;
        if (!this.username || !this.password || !this.baseUrl) {
            console.debug('错误：配置文件中缺少必要的凭据');
            throw new Error('配置文件中必须提供坚果云用户名和密码');
        }
        console.debug('坚果云WebDAV客户端初始化成功');
    }
    //  /**
    //  * 更新配置选项
    //  */
    //  public configure(options: Partial<WebDAVOptions>): void {
    //   this.options = { ...this.options, ...options };
    //   console.log('debug', `WebDAV配置已更新: ${JSON.stringify(this.options)}`);
    // }
    /**
     * 从坚果云获取最新的JSON数据
     *
     * @param remotePath - 云端JSON文件的路径
     * @returns 返回包含JSON字符串的操作结果Promise
     */
    async getJsonString(remotePath, defaultData = '{}') {
        const startTime = Date.now();
        console.debug(`开始获取Json数据: ${remotePath}`);
        try {
            // 文件一定存在
            const downloadResult = await this.downloadFile(remotePath);
            if (!downloadResult.success || !downloadResult.data) {
                return {
                    success: false,
                    message: `下载JSON文件失败: ${downloadResult.message}`,
                    statusCode: downloadResult.statusCode
                };
            }
            try {
                const jsonString = downloadResult.data.toString('utf-8');
                const duration = Date.now() - startTime;
                console.debug(`JSON数据获取成功: ${remotePath}, 耗时: ${duration}ms`);
                return {
                    success: true,
                    message: 'JSON数据获取成功',
                    statusCode: downloadResult.statusCode,
                    jsonString: jsonString
                };
            }
            catch (parseError) {
                return {
                    success: false,
                    message: `JSON数据解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                    statusCode: downloadResult.statusCode,
                    data: downloadResult.data
                };
            }
        }
        catch (error) {
            return this.handleError('JSON数据获取失败', error);
        }
    }
    /**
     * 更新坚果云中的JSON文件
     *
     * @param jsonString - 序列化后的数据
     * @param remotePath - 保存JSON文件的路径
     * @param pretty - 是否格式化JSON（添加缩进）
     * @returns 返回文件操作结果Promise
     */
    /**
    * 更新坚果云中的JSON文件
    * 自动创建不存在的目录
    */
    async updateJsonData(jsonString, remotePath, pretty = true) {
        // 记录开始时间用于性能优化
        const startTime = Date.now();
        console.debug(`开始更新JSON数据: ${remotePath}`);
        try {
            // 处理JSON格式
            let content = jsonString;
            if (pretty && typeof jsonString === 'string') {
                try {
                    const parsedJson = JSON.parse(jsonString);
                    content = JSON.stringify(parsedJson, null, 2);
                }
                catch (error) {
                    // 保持原始内容
                }
            }
            // 直接上传文件，不存在会自动新建文件 但是目录一定要存在
            const result = await this.uploadFile(content, remotePath, 'application/json');
            // 记录完成时间
            const duration = Date.now() - startTime;
            console.debug(`JSON数据更新完成: ${remotePath}, 耗时: ${duration}ms, 状态: ${result.success ? '成功' : '失败'}`);
            return result;
        }
        catch (error) {
            return this.handleError('JSON数据更新失败', error);
        }
    }
    /**
     * 验证密钥目录是否存在 (专用于密钥验证)
     * @param keyDirectory - 要验证的密钥目录路径
     * @returns 密钥是否有效
     */
    async validateKeyDirectory(keyDirectory) {
        console.debug(`验证密钥目录: ${keyDirectory}`);
        // 确保路径以/结尾
        const dirPath = keyDirectory.endsWith('/') ? keyDirectory : keyDirectory + '/';
        try {
            // 1. 首先尝试使用PROPFIND方法检查目录
            try {
                const config = {
                    method: 'PROPFIND',
                    url: this.buildPath(dirPath),
                    auth: {
                        username: this.username,
                        password: this.password
                    },
                    headers: {
                        'Depth': '0',
                        'Content-Type': 'application/xml'
                    },
                    validateStatus: (status) => true, // 接受任何状态码
                    data: '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>'
                };
                const response = await (0, axios_1.default)(config);
                // 207是PROPFIND的成功状态码
                if (response.status === 207) {
                    console.debug(`密钥目录 ${dirPath} 存在 (PROPFIND 成功)`);
                    return {
                        isValid: true,
                        message: `密钥有效`
                    };
                }
                // 即使是403，我们也尝试其他方法继续验证
            }
            catch (propfindError) {
                // 修复: 明确指定 propfindError 类型为 unknown
                const errorMessage = propfindError instanceof Error
                    ? propfindError.message
                    : '未知错误';
                console.debug(`PROPFIND方法失败，尝试备用方法: ${errorMessage}`);
            }
            // 2. 如果PROPFIND失败，尝试检查目录中的标记文件
            try {
                const markerFilePath = `${dirPath}.valid_key`;
                const getConfig = {
                    method: 'GET',
                    url: this.buildPath(markerFilePath),
                    auth: {
                        username: this.username,
                        password: this.password
                    },
                    validateStatus: (status) => status === 200 || status === 404 || status === 403
                };
                const getResponse = await (0, axios_1.default)(getConfig);
                if (getResponse.status === 200) {
                    console.debug(`找到密钥标记文件，密钥有效`);
                    return {
                        isValid: true,
                        message: `密钥有效 (通过标记文件验证)`
                    };
                }
            }
            catch (getError) {
                // 修复: 明确指定 getError 类型为 unknown
                const errorMessage = getError instanceof Error
                    ? getError.message
                    : '未知错误';
                console.debug(`获取标记文件失败: ${errorMessage}`);
            }
            // 3. 最后尝试创建一个临时文件来检查目录是否可写
            const timestamp = Date.now();
            const testFileName = `.key_verify_${timestamp}.tmp`;
            const testPath = `${dirPath}${testFileName}`;
            const testContent = "Key verification";
            try {
                const uploadConfig = {
                    method: 'PUT',
                    url: this.buildPath(testPath),
                    auth: {
                        username: this.username,
                        password: this.password
                    },
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    data: testContent,
                    validateStatus: (status) => true
                };
                const uploadResponse = await (0, axios_1.default)(uploadConfig);
                // 尝试清理测试文件（无论成功与否）
                this.cleanupProbeFile(testPath).catch(() => { });
                if (uploadResponse.status >= 200 && uploadResponse.status < 300) {
                    console.debug(`成功在密钥目录创建测试文件，密钥有效`);
                    return {
                        isValid: true,
                        message: `密钥有效 (通过写入测试验证)`
                    };
                }
                else if (uploadResponse.status === 403) {
                    // 403可能意味着目录存在但无写权限，在某些情况下也认为密钥有效
                    console.debug(`无法在密钥目录写入，但目录可能存在 (403)`);
                    return {
                        isValid: true,
                        message: `密钥可能有效 (目录存在但无写权限)`
                    };
                }
                else if (uploadResponse.status === 409) {
                    // 409表示父目录不存在
                    console.debug(`密钥目录不存在 (409 Conflict)`);
                    return {
                        isValid: false,
                        message: `密钥无效 (目录不存在)`
                    };
                }
            }
            catch (uploadError) {
                // 修复: 明确指定 uploadError 类型为 unknown 并安全地访问 message 属性
                const errorMessage = uploadError instanceof Error
                    ? uploadError.message
                    : '未知错误';
                console.debug(`验证测试文件创建失败: ${errorMessage}`);
            }
            // 如果所有方法都失败，默认密钥无效
            return {
                isValid: false,
                message: `密钥验证失败 (所有检查方法均失败)`
            };
        }
        catch (error) {
            // 修复: 明确指定 error 类型为 unknown
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            console.error(`密钥验证过程中出错: ${dirPath}`, error);
            return {
                isValid: false,
                message: `密钥验证出错: ${errorMessage}`
            };
        }
    }
    /**
     * 检查指定目录下是否存在特定文件
     * 此函数假设目录已存在
     *
     * @param directoryPath - 目录路径
     * @param fileName - 文件名
     * @returns 文件检查结果
     */
    async checkFileInDirectory(directoryPath, fileName) {
        console.debug(`检查目录 ${directoryPath} 下的文件 ${fileName}`);
        try {
            // 1. 规范化目录路径，确保以/结尾
            let normalizedDirPath = directoryPath;
            if (normalizedDirPath.startsWith('/')) {
                normalizedDirPath = normalizedDirPath.substring(1);
            }
            if (!normalizedDirPath.endsWith('/') && normalizedDirPath.length > 0) {
                normalizedDirPath += '/';
            }
            // 2. 规范化文件名，确保不包含路径分隔符
            const normalizedFileName = fileName.replace(/^\/+/, '');
            // 3. 构建完整文件路径
            const filePath = normalizedDirPath + normalizedFileName;
            // 4. 检查文件是否存在
            const exists = await this.fileExists(filePath);
            return {
                success: true,
                exists: exists,
                message: exists
                    ? `文件 ${fileName} 在目录 ${directoryPath} 中存在`
                    : `文件 ${fileName} 在目录 ${directoryPath} 中不存在`,
                filePath: `${normalizedDirPath}${normalizedFileName}`
            };
        }
        catch (error) {
            console.error(`检查文件时出错: ${directoryPath}/${fileName}`, error);
            return {
                success: false,
                exists: false,
                message: `检查文件出错: ${error.message || '未知错误'}`,
                filePath: `${directoryPath}/${fileName}`
            };
        }
    }
    /**
     * 从坚果云下载文件
     *
     * @param remotePath - 云端文件路径
     * @returns 返回包含文件数据的操作结果Promise
     */
    async downloadFile(remotePath) {
        console.debug(`开始下载文件: ${remotePath}`);
        try {
            const config = {
                method: 'GET',
                url: this.buildPath(remotePath),
                auth: {
                    username: this.username,
                    password: this.password
                },
                responseType: 'arraybuffer'
            };
            console.debug('发送下载请求');
            const response = await (0, axios_1.default)(config);
            console.debug(`文件下载成功，状态码: ${response.status}`);
            return {
                success: true,
                message: '文件下载成功',
                statusCode: response.status,
                data: response.data
            };
        }
        catch (error) {
            return this.handleError('文件下载失败', error);
        }
    }
    /**
     * 上传文件到坚果云，如果文件已存在则更新
     *
     * @param fileContent - 要上传的文件内容
     * @param remotePath - 服务器上的目标路径
     * @param contentType - 可选的内容类型（默认为application/octet-stream）
     * @returns 返回操作结果Promise
     */
    /**
     * 上传文件到坚果云，自动创建所需目录
     */
    async uploadFile(fileContent, remotePath, contentType = 'application/octet-stream') {
        console.debug(`开始上传文件: ${remotePath}, 内容类型: ${contentType}`);
        try {
            // 检查文件是否已经存在
            const directory = path_1.default.dirname(remotePath);
            const filename = path_1.default.basename(remotePath);
            const exists = await this.checkFileInDirectory(directory, filename);
            if (exists.success) {
                if (exists.exists === true) {
                    console.debug(`文件已存在，将更新: ${remotePath}`);
                }
                else {
                    console.debug(`文件不存在，将创建: ${remotePath}`);
                }
            }
            else {
                console.error(`检查文件时出错: ${remotePath}`, exists.message);
            }
            // 开始上传
            const config = {
                method: 'PUT',
                url: this.buildPath(remotePath),
                auth: {
                    username: this.username,
                    password: this.password
                },
                headers: {
                    'Content-Type': contentType
                },
                data: fileContent,
                validateStatus: (status) => {
                    // 接受200-299之间的成功状态码
                    return status >= 200 && status < 300;
                }
            };
            // 发送上传请求
            console.debug(`发送上传请求: ${this.buildPath(remotePath)}`);
            const response = await (0, axios_1.default)(config);
            console.debug(`文件上传响应，状态码: ${response.status}`);
            return {
                success: response.status >= 200 && response.status < 300,
                message: '文件上传成功',
                statusCode: response.status
            };
        }
        catch (error) {
            // 如果是409冲突，提供更具体的错误信息
            if (error.response && error.response.status === 409) {
                console.error(`上传409冲突: ${remotePath}`, error);
                // 尝试判断是目录冲突还是其他冲突
                return {
                    success: false,
                    message: `上传冲突(409): 路径'${remotePath}'可能已存在为目录或存在其他冲突`,
                    statusCode: 409
                };
            }
            return this.handleError('文件上传失败', error);
        }
    }
    /**
     * 检查服务器上是否存在文件
     *
     * @param remotePath - 要检查的路径
     * @returns 返回布尔值Promise
     */
    /**
     * 检查服务器上是否存在文件或目录
     */
    async fileExists(remotePath) {
        console.debug(`检查路径是否存在: ${remotePath}`);
        // 标准化路径
        const normalizedPath = remotePath.startsWith('/') ? remotePath.substring(1) : remotePath;
        if (!normalizedPath) {
            // 根目录总是存在
            return true;
        }
        try {
            const config = {
                method: 'HEAD',
                url: this.buildPath(normalizedPath),
                auth: {
                    username: this.username,
                    password: this.password
                },
                // 允许404状态码通过
                validateStatus: (status) => status < 400 || status === 404
            };
            const response = await (0, axios_1.default)(config);
            const exists = response.status >= 200 && response.status < 300;
            console.debug(`路径 ${normalizedPath} ${exists ? '存在' : '不存在'} (状态码: ${response.status})`);
            return exists;
        }
        catch (error) {
            console.error(`检查路径出错: ${normalizedPath}`, error);
            return false;
        }
    }
    /**
     * 创建单个目录
     */
    async makeSingleDirectory(dirPath) {
        console.debug(`创建单个目录: ${dirPath}`);
        try {
            const config = {
                method: 'MKCOL',
                url: this.buildPath(dirPath),
                auth: {
                    username: this.username,
                    password: this.password
                }
            };
            const response = await (0, axios_1.default)(config);
            console.debug(`目录创建成功，状态码: ${response.status}`);
            return {
                success: response.status >= 200 && response.status < 300,
                message: '目录创建成功',
                statusCode: response.status
            };
        }
        catch (error) {
            return this.handleError('目录创建失败', error);
        }
    }
    /**
     * 构建完整的URL路径
     */
    buildPath(path) {
        // 确保path不为空
        if (!path)
            return this.baseUrl;
        // 移除开头的斜杠
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        // 构建完整路径
        const fullPath = cleanPath ? `${this.baseUrl}/${cleanPath}` : this.baseUrl;
        console.debug(`构建WebDAV路径: ${fullPath}`);
        return fullPath;
    }
    /**
     * 处理并格式化错误
     */
    handleError(message, error) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.message || error.message || '未知错误';
        console.debug(`错误: ${message} - ${errorMessage}`, error);
        return {
            success: false,
            message: `${message}: ${errorMessage}`,
            statusCode: statusCode
        };
    }
    /**
   * 确保路径存在，如果不存在则创建
   * 返回完整的成功/失败信息
   */
    async ensurePath(remotePath) {
        console.debug(`确保路径存在: ${remotePath}`);
        try {
            // 如果路径为空或根目录，直接返回成功
            if (!remotePath || remotePath === '/' || remotePath === '') {
                return { success: true, message: '根目录已存在' };
            }
            // 标准化路径 (移除开头斜杠)
            const normalizedPath = remotePath.startsWith('/') ? remotePath.substring(1) : remotePath;
            // 分解路径并检查是否为文件路径 (包含扩展名)
            const parts = normalizedPath.split('/');
            const isFile = parts.length > 0 && parts[parts.length - 1].includes('.');
            // 如果是文件路径，移除文件名以获取目录路径
            const dirParts = isFile ? parts.slice(0, -1) : parts;
            // 如果没有目录部分，直接返回成功
            if (dirParts.length === 0) {
                return { success: true, message: '根目录已存在' };
            }
            // 逐级创建目录
            let currentPath = '';
            for (const part of dirParts) {
                if (!part)
                    continue; // 跳过空部分
                currentPath += (currentPath ? '/' : '') + part;
                console.debug(`检查目录: ${currentPath}`);
                // 检查是否存在
                const exists = await this.fileExists(currentPath);
                if (!exists) {
                    console.debug(`创建目录: ${currentPath}`);
                    const result = await this.makeSingleDirectory(currentPath);
                    if (!result.success) {
                        console.error(`创建目录失败 ${currentPath}: ${result.message}`);
                        return {
                            success: false,
                            message: `创建目录 ${currentPath} 失败: ${result.message}`,
                            statusCode: result.statusCode
                        };
                    }
                }
                else {
                    console.debug(`目录已存在: ${currentPath}`);
                }
            }
            return {
                success: true,
                message: '目录路径已创建或已存在',
                data: { path: normalizedPath, isFile }
            };
        }
        catch (error) {
            return this.handleError('确保路径存在失败', error);
        }
    }
    /**
     * 清理测试用的探测文件
     * @private
     */
    async cleanupProbeFile(filePath) {
        try {
            const config = {
                method: 'DELETE',
                url: this.buildPath(filePath),
                auth: {
                    username: this.username,
                    password: this.password
                },
                validateStatus: (status) => true // 允许任何状态码，不抛出异常
            };
            const response = await (0, axios_1.default)(config);
            if (response.status === 204 || response.status === 200) {
                console.debug(`探测文件已清理: ${filePath}`);
            }
            else {
                console.debug(`清理探测文件返回状态码 ${response.status}: ${filePath}`);
            }
        }
        catch (error) {
            // 修复: 明确指定错误类型
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.debug(`清理探测文件时出错: ${filePath}`, errorMessage);
        }
    }
    /**
    * 获取TXT文本文件内容
    *
    * @param remotePath - 云端TXT文件的路径
    * @param encoding - 文件编码，默认为utf-8
    * @returns 返回包含文本内容的操作结果Promise
    */
    async getTxtFile(remotePath, encoding = 'utf-8') {
        const startTime = Date.now();
        console.debug(`开始获取TXT文件内容: ${remotePath}`);
        try {
            // 下载文件
            const downloadResult = await this.downloadFile(remotePath);
            if (!downloadResult.success || !downloadResult.data) {
                return {
                    success: false,
                    message: `下载TXT文件失败: ${downloadResult.message}`,
                    statusCode: downloadResult.statusCode
                };
            }
            try {
                // 将二进制数据转换为字符串
                const textContent = downloadResult.data.toString(encoding);
                const duration = Date.now() - startTime;
                console.debug(`TXT文件获取成功: ${remotePath}, 长度: ${textContent.length}字符, 耗时: ${duration}ms`);
                return {
                    success: true,
                    message: 'TXT文件获取成功',
                    statusCode: downloadResult.statusCode,
                    data: textContent // 使用data字段保持接口一致性
                };
            }
            catch (parseError) {
                return {
                    success: false,
                    message: `TXT文件解码失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                    statusCode: downloadResult.statusCode
                };
            }
        }
        catch (error) {
            return this.handleError('TXT文件获取失败', error);
        }
    }
}
exports.JianguoyunWebDAV = JianguoyunWebDAV;
// 单例实例
JianguoyunWebDAV.instance = null;
