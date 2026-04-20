# Select Ask

> 选中文本，AI 秒回 — 开源浏览器插件

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/zqqpluto/select-ask.svg?style=social)](https://github.com/zqqpluto/select-ask/stargazers)

一个功能强大的智能浏览器插件，让用户选中文本后即可通过 AI 进行解释、翻译、提问和搜索。完全开源，支持本地模型配置。

## 核心功能

### AI 文本交互
- **智能文本识别** — 选中文本后弹出操作菜单
- **多维度 AI 功能**
  - **AI 搜索** — 搜索选中内容的相关信息
  - **翻译** — 智能翻译选中文字，自动识别源语言
  - **解释** — AI 通俗解释选中的概念或内容
  - **提问** — 自定义问题，自由对话
- **上下文感知** — 自动获取选中文本前后的上下文，提高 AI 回答准确性
- **连续对话** — 支持基于上下文的多轮追问

### 页面级操作
- **翻译全文** — 一键翻译整个网页内容，保留原文排版
- **总结页面** — 智能提取网页正文，AI 生成精炼总结（侧边栏展示）

### 用户体验
- **悬浮图标菜单** — 页面右下角常驻入口，hover 展开操作菜单
- **可调节侧边栏** — 拖拽调整宽度，AI 对话沉浸式体验
- **侧边栏聊天** — Chrome Side Panel API，完整流式对话体验
- **Markdown 渲染** — AI 回答实时流式输出，支持 Markdown 格式
- **历史记录管理** — 会话式历史，支持搜索和回顾

## 多模型支持

| 提供商 | 模型示例 | 特点 |
|--------|---------|------|
| OpenAI | GPT-4o, GPT-4 Turbo | 标准 OpenAI API |
| Anthropic | Claude Sonnet, Claude Opus | 原生 API，推理能力强 |
| DeepSeek | DeepSeek Chat, Reasoner | 支持原生思考过程输出 |
| 通义千问 | Qwen-Turbo, Qwen-Plus | 阿里云 DashScope API |
| 智谱AI | GLM-4 | 智谱 OpenAI 兼容 API |
| OpenAI 兼容 | 自定义 | 支持任何 OpenAI 兼容 API |
| 本地模型 | Ollama, LM Studio | 本地部署，隐私安全 |

## 安装方式

### 手动安装

1. 克隆或下载本仓库
2. 安装依赖并构建：
   ```bash
   npm install
   npm run build
   ```
3. 打开 Chrome，进入 `chrome://extensions/`
4. 开启右上角的「开发者模式」
5. 点击「加载已解压的扩展程序」，选择项目根目录
6. 完成

## 快速开始

### 1. 配置模型

1. 点击浏览器工具栏中的插件图标
2. 点击「打开详细设置」
3. 点击「添加模型」
4. 选择预设模型或自定义模型
5. 输入 API Key（使用 AES-256-GCM 加密存储在本地）
6. 点击「测试连接」确认配置正确
7. 保存后选择该模型为默认模型

### 2. 使用基础功能

1. 在任意网页上选中一段文字
2. 在弹出的菜单中选择功能：翻译 / 解释 / 提问 / 搜索
3. 在侧边栏中查看 AI 回答（支持 Markdown 渲染）
4. 可以继续追问，进行多轮对话

### 3. 页面级操作

通过页面右下角的悬浮图标菜单：
- **翻译全文** — 逐段翻译页面内容，保留原始排版
- **总结页面** — 自动提取网页正文并生成总结

## 开发指南

### 环境要求

- Node.js 18+
- npm 9+

### 本地开发

```bash
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
5. 选择 项目根目录 目录

## 获取 API Key

| 提供商 | 获取地址 |
|--------|---------|
| OpenAI | https://platform.openai.com/api-keys |
| Anthropic | https://console.anthropic.com/ |
| DeepSeek | https://platform.deepseek.com/ |
| 通义千问 | https://dashscope.aliyun.com/ |
| 智谱AI | https://open.bigmodel.cn/ |

## 安全说明

- 所有 API Key 使用 AES-256-GCM 加密存储在浏览器本地
- 聊天内容仅发送到您配置的 AI 服务提供商
- 开源代码，可自行审计

## 技术栈

- React 18 + TypeScript
- Vite 5 + @crxjs/vite-plugin
- TailwindCSS 3
- Chrome Extension Manifest V3
- Web Crypto API（AES-256-GCM 加密）
- Zustand（状态管理）
- marked（Markdown 渲染）
- Playwright（端到端测试）

## Chrome 扩展权限

| 权限 | 用途 |
|------|------|
| `storage` | 存储设置、API 密钥和聊天历史 |
| `scripting` | 注入内容脚本到网页 |
| `sidePanel` | Chrome 侧边栏 API |
| `tabs` | 标签页管理 |
| `microphone` | 语音输入支持 |

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献者

<a href="https://github.com/zqqpluto/select-ask/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=zqqpluto/select-ask" />
</a>

## 更多信息

- [隐私政策](./PRIVACY_POLICY.md)

## 社区

- [GitHub Discussions](../../discussions) — 问题讨论、功能建议
- [Issue Tracker](../../issues) — Bug 报告、功能请求

## 致谢

感谢所有 AI 提供商提供的优秀模型服务：

- [OpenAI](https://openai.com/)
- [Anthropic](https://www.anthropic.com/)
- [DeepSeek](https://www.deepseek.com/)
- [通义千问](https://tongyi.aliyun.com/)
- [智谱AI](https://www.zhipuai.cn/)

---

如果这个项目对您有帮助，欢迎 Star 支持！

**Made with ❤️ by [zqqpluto](https://github.com/zqqpluto)**
