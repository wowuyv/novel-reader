# Novel Reader

一个基于 Vue.js 的小说阅读器应用，支持电子书架管理、小说阅读、章节分割和语音朗读功能。

## 功能特性

- **电子书架**：管理您的电子书收藏
- **小说阅读器**：流畅的小说阅读体验，支持设置自定义
- **章节分割**：智能分割小说章节
- **语音朗读**：集成 Edge TTS 语音合成，支持异步队列处理
- **文件处理**：支持 ZIP 文件解压、编码检测和文件保存
- **响应式设计**：基于 Element UI 的现代化界面

## 技术栈

- **前端框架**：Vue.js 2.6.14
- **路由管理**：Vue Router 3.5.1
- **状态管理**：Vuex 3.6.2
- **UI 组件库**：Element UI 2.15.14
- **语音合成**：Edge TTS Universal 1.4.0
- **文件处理**：
  - JSZip 3.10.1 (ZIP 压缩/解压)
  - File Saver 2.0.5 (文件保存)
  - Iconv-lite 0.7.2 (编码转换)
  - JSChardet 3.1.4 (编码检测)
- **构建工具**：Vue CLI 5.0.0
- **样式预处理**：Sass

## 安装

确保您已安装 Node.js 和 Yarn。

```bash
# 克隆项目
git clone <repository-url>
cd novel-reader

# 安装依赖
yarn install
```

## 运行

```bash
# 开发模式运行
yarn serve
```

应用将在 `http://localhost:8080` 启动。

### 环境要求

- **可信环境**：应用需要在可信的环境中运行，包括 `file://`、`https://` 或 `localhost`。
- **浏览器兼容性**：推荐使用 Microsoft Edge 浏览器。如果使用其他浏览器，请修改 User-Agent 为 Edge 浏览器，以确保语音朗读功能正常工作。

## 构建

```bash
# 生产环境构建
yarn build
```

构建后的文件将在 `dist/` 目录中。

## 代码检查

```bash
# 运行 ESLint 检查并自动修复
yarn lint
```

## 项目结构

```
src/
├── assets/          # 静态资源
├── components/      # 公共组件
├── router/          # 路由配置
├── store/           # Vuex 状态管理
│   ├── modules/     # 模块化状态
│   └── getters.js   # getters
├── utils/           # 工具函数
│   ├── book.js      # 书籍处理
│   ├── db.js        # 数据库操作
│   ├── readAloud.js # 语音朗读
│   └── edge-tts-queue/  # TTS 队列处理
├── views/           # 页面组件
│   ├── ebookShelf/  # 电子书架
│   ├── novelReader/ # 小说阅读器
│   └── chapterSegmentation/  # 章节分割
└── App.vue          # 根组件
```

## 自定义配置

查看 [Vue CLI 配置参考](https://cli.vuejs.org/config/)。

## 许可证

本项目采用 MIT 许可证。
