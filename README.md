# Select Ask

> 🤖 选中文本，AI秒回 - 开源浏览器插件

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/extension-id.svg)](https://chrome.google.com/webstore/detail/select-ask)
[![GitHub stars](https://img.shields.io/github/stars/zqqpluto/select-ask.svg?style=social)](https://github.com/zqqpluto/select-ask/stargazers)

一个功能强大的智能浏览器插件，让用户选中文本后即可通过AI进行解释、翻译、提问、总结和生成常见问题。**前端完全开源**，支持本地模型配置。

## ✨ 核心功能

### 🎯 AI文本交互
- 🖱️ **智能文本识别** - 选中文本后自动弹出操作菜单
- 🤖 **多维度AI功能**
  - **AI搜索** - 搜索选中内容的相关信息
  - **翻译** - 智能翻译选中文字，自动识别源语言
  - **解释** - AI 通俗解释选中的概念或内容
  - **提问** - 自定义问题，自由对话
- 🔍 **上下文感知** - 自动获取选中文本前后的上下文，提高AI回答准确性
- 💬 **连续对话** - 支持基于上下文的多轮追问
- ❓ **智能问题推荐** - AI 自动生成相关问题，点击即可追问

### 📄 页面级操作
- 📝 **翻译全文** - 一键翻译整个网页内容，支持批量并行翻译，保留原文排版
- 📋 **总结页面** - 智能提取网页正文，AI 生成精炼总结（侧边栏展示）
- 🔄 **翻译状态切换** - 再次点击可停止翻译、恢复原文

### 🎨 用户体验优化
- 🎯 **悬浮图标菜单** - 页面右下角常驻入口，hover 展开操作菜单
- 📐 **可调节侧边栏** - 拖拽调整宽度，AI 对话沉浸式体验
- ⌨️ **灵活发送方式** - 支持 Enter 或 Ctrl+Enter 发送消息
- 🕐 **历史记录管理** - 会话式历史，支持搜索和快速回顾
- 🎨 **简洁UI设计** - 现代卡片式设计，清爽舒适
- 🌙 **Markdown 渲染** - AI 回答实时流式输出，支持 Markdown 格式

### 🔐 安全架构
- 🔑 **本地加密存储** - API Key 使用 AES-256-GCM 加密
- 🔒 **设备指纹验证** - 多维度硬件特征防止身份伪造
  - Canvas + WebGL + Audio 指纹
  - SHA-256 哈希生成
  - 可疑活动检测
- 🛡️ **速率限制保护** - 防止滥用和恶意请求

### 🌐 多模型支持

| 提供商 | 模型示例 | 特点 |
|--------|---------|------|
| OpenAI | GPT-4o, GPT-4 Turbo | 标准 OpenAI API |
| Anthropic | Claude Sonnet 4 | 支持 Claude 独有 API 格式，推理能力强 |
| DeepSeek | DeepSeek Chat, Reasoner | 支持原生思考过程输出 |
| 通义千问 | Qwen-Turbo, Qwen-Plus | 阿里云 DashScope API |
| 智谱AI | GLM-4 | 智谱 OpenAI 兼容 API |
| OpenAI 兼容 | 自定义 | 支持任何 OpenAI 兼容 API |
| 本地模型 | Ollama, LM Studio | 本地部署，隐私安全 |

## 📦 项目架构

本项目采用**前后端分离架构**：

- **前端插件**（本仓库，开源）：浏览器扩展，用户界面
- **后端服务**（私有仓库）：可选的云端服务，提供免费模型配额、统一API管理等

```
select-ask/
├── browser-extension/          # 浏览器插件（前端）
│   ├── src/
│   │   ├── background/         # 后台脚本 (Service Worker)
│   │   ├── content/            # 内容脚本 (注入网页)
│   │   ├── popup/              # 弹窗页面
│   │   ├── options/            # 设置页面
│   │   ├── services/           # 服务层
│   │   │   └── llm/            # LLM 提供商实现
│   │   └── utils/              # 工具函数
│   └── manifest.json
└── docs/                       # 文档
```

**💡 架构说明**：
- 前端可以**完全独立运行**，用户自行配置API密钥
- 后端服务为可选增强功能，提供免费试用配额
- 详细技术文档请参考：[select-ask-server 仓库](https://github.com/zqqpluto/select-ask-server)

## 🚀 安装方式

### 方式一：Chrome Web Store（推荐）

*即将上架*

### 方式二：手动安装

1. 下载最新版本的插件包（从 [Releases](../../releases) 页面）
2. 解压到任意目录
3. 打开 Chrome，进入 `chrome://extensions/`
4. 开启右上角的「开发者模式」
5. 点击「加载已解压的扩展程序」，选择解压后的目录
6. 完成！现在可以在任意网页上使用了

## 🎯 快速开始

### 1. 配置模型

首次使用需要配置 AI 模型：

1. 点击浏览器工具栏中的插件图标
2. 点击「打开详细设置」
3. 点击「添加模型」
4. 选择预设模型或自定义模型
5. 输入 API Key（将使用 AES-256-GCM 加密存储在本地）
6. 点击「测试连接」确认配置正确
7. 保存后选择该模型为默认模型

### 2. 开始使用

#### 基础功能
1. 在任意网页上选中一段文字
2. 在弹出的菜单中选择功能：
   - **AI搜索** - 搜索选中内容的相关信息
   - **翻译** - 将选中内容翻译成目标语言
   - **解释** - AI 通俗解释选中的内容
   - **提问** - 输入自定义问题
3. 在侧边栏中查看 AI 回答（支持 Markdown 渲染）
4. 可以继续追问，进行多轮对话

#### 页面级操作
通过页面右下角的悬浮图标菜单操作：

1. **翻译全文**
   - 点击悬浮图标，选择「翻译全文」
   - AI 逐段翻译页面内容，保留原始排版
   - 再次点击可停止翻译、恢复原文

2. **总结页面**
   - 点击悬浮图标，选择「总结页面」
   - AI 自动提取网页正文并生成总结
   - 总结结果在侧边栏中展示

#### 快捷操作
通过浏览器工具栏的插件图标（Popup）：

- **翻译全文** - 快速触发整页翻译
- **总结页面** - 快速触发页面总结
- **历史记录** - 查看历史对话
- **悬浮图标开关** - 控制页面右下角悬浮图标的显示/隐藏

## 👨‍💻 开发指南

### 环境要求

- Node.js 18+
- npm 9+

### 本地开发

#### 浏览器插件

```bash
cd browser-extension
npm install

# 开发模式 (热重载)
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm test
```

### 加载开发版本

1. 运行 `npm run dev` 或 `npm run build`
2. 打开 Chrome，进入 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `browser-extension` 目录

## 🔑 获取 API Key

| 提供商 | 获取地址 |
|--------|---------|
| OpenAI | https://platform.openai.com/api-keys |
| Anthropic | https://console.anthropic.com/ |
| DeepSeek | https://platform.deepseek.com/ |
| 通义千问 | https://dashscope.aliyun.com/ |
| 智谱AI | https://open.bigmodel.cn/ |

## 🔒 安全说明

### 前端安全
- ✅ 所有 API Key 使用 AES-256-GCM 加密存储在浏览器本地
- ✅ 加密密钥存储在 `chrome.storage.local`
- ✅ 聊天内容仅发送到您配置的 AI 服务提供商
- ✅ 开源代码，可自行审计

### 后端安全（可选服务）
- ✅ 设备指纹验证（Canvas + WebGL + Audio 多维度）
- ✅ 可疑活动检测（超过10个不同IP自动标记）
- ✅ 设备创建速率限制（每小时每IP最多10个设备）
- ✅ 原子操作并发保护
- ✅ 阻止设备黑名单机制

详细技术文档请参考后端仓库。

## 📊 技术栈

### 前端（浏览器插件）
- React 18 + TypeScript
- Vite 5 + @crxjs/vite-plugin
- TailwindCSS 3
- Chrome Extension Manifest V3
- Web Crypto API（AES-256-GCM 加密）
- Zustand（状态管理）
- marked（Markdown 渲染）
- Playwright（端到端测试）

## 🌐 后端服务（私有）

本仓库仅包含前端插件代码。如果你需要：

- 免费模型配额服务
- 统一API密钥管理
- 多用户管理
- 高级统计分析

可以自行开发后端服务，或联系作者获取商业授权。

**技术栈参考**：
- Express.js + MongoDB
- 设备指纹验证
- JWT认证
- 速率限制

## 📝 许可证

本项目采用 [Apache 2.0 许可证](LICENSE)。

**开源范围**：
- ✅ 浏览器插件前端代码
- ✅ 文档和示例

**不包含**：
- ❌ 后端服务代码（私有）
- ❌ 设备指纹验证算法细节（仅前端基础实现）
- ❌ 速率限制策略细节

详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

请查看 [贡献指南](CONTRIBUTING.md) 了解详情。

### 贡献者

感谢所有贡献者！

<a href="https://github.com/zqqpluto/select-ask/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=zqqpluto/select-ask" />
</a>

## 📖 更多信息

- [隐私政策](./PRIVACY_POLICY.md)
- [服务条款](./TERMS_OF_SERVICE.md)
- [免责声明](./DISCLAIMER.md)
- [更新日志](CHANGELOG.md)

详细技术文档、架构设计、安全报告等请参考：[后端仓库文档](https://github.com/zqqpluto/select-ask-server)

## 🗺️ Roadmap

- [ ] 多语言界面支持（日语、韩语、欧洲语言）
- [x] 本地模型支持（Ollama, LM Studio）
- [ ] 快捷键自定义
- [ ] 团队协作功能
- [ ] 知识库管理
- [ ] 更多AI模型支持
- [ ] 翻译语言自定义设置
- [ ] 全文翻译进度可视化

详见 [Roadmap](../../discussions/categories/roadmap)

## 💬 社区

- [GitHub Discussions](../../discussions) - 问题讨论、功能建议
- [Issue Tracker](../../issues) - Bug报告、功能请求
- [Twitter](https://twitter.com/selectask) - 最新动态

## 🙏 致谢

感谢所有 AI 提供商提供的优秀模型服务：

- [OpenAI](https://openai.com/)
- [Anthropic](https://www.anthropic.com/)
- [DeepSeek](https://www.deepseek.com/)
- [通义千问](https://tongyi.aliyun.com/)
- [智谱AI](https://www.zhipuai.cn/)

特别感谢开源社区的支持和贡献。

---

如果这个项目对您有帮助，欢迎 ⭐ Star 支持！

**Made with ❤️ by [zqqpluto](https://github.com/zqqpluto)**