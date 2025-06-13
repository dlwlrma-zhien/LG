# LG项目文档

## 一、项目概述

本项目是一个基于 Electron 的应用程序，主要功能包括为算法问题生成解决方案、管理截图、检查应用更新等。项目包含多个模块，如 FlexSearch 搜索引擎、自动更新模块、模型调用模块等。

## 二、项目结构

### package.json
```plaintext
package.json
dist-electron/
  electron/
    fileFromPath-DrTUs41R.js
    main-DSRivCYi.js
    main.js
    preload.js
    src/
    assets/
      documents.map.json
      flexsearch_index.idx.json
    dist/
      asstes/
        index.html
node_modules/
  ...
```


## 三、各模展示
#### dist-electron/electron/store/storeManager.js：
>提供单例模式的存储管理器。
#### dist-electron/electron/service/FlexSearchEngine.js：
?初始化 FlexSearch 搜索引擎，尝试从预构建的索引文件加载索引。
#### dist-electron/electron/autoUpdater.js：
>检查应用程序的更新，比较当前版本和最新版本，提供更新日志。
#### dist-electron/fileFromPath-DrTUs41R.js：
>提供从文件路径创建文件对象的功能。
#### dist-electron/electron/service/modelCall.js：
>根据问题信息和编程语言生成算法问题的解决方案。
#### dist-electron/electron/preload.js：
>预加载脚本，暴露一些 Electron API 给渲染进程。
#### dist-electron/electron/service/JianguoyunWebDAV.js：
>初始化坚果云 WebDAV 客户端。
#### dist-electron/electron/main.js：
>主进程文件，负责创建窗口、管理窗口状态、初始化辅助工具等。
#### dist-electron/electron/config/build_flexsearch_index.js：
>从 Excel 文件构建 FlexSearch 索引并保存到文件。
#### dist-electron/electron/service/MethodLimiter.js：
>方法调用限制器，管理方法的调用次数和时间。

## 四、使用方法
### 1.安装依赖
> npm install
### 2.构建索引
> npx ts-node electron/config/build_flexsearch_index.ts
### 3.启动引用程序
> npm start
