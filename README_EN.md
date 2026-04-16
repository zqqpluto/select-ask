# Select Ask

> Select text, AI replies instantly — Open-source browser extension

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/zqqpluto/select-ask.svg?style=social)](https://github.com/zqqpluto/select-ask/stargazers)

A smart browser extension that enables AI-powered explain, translate, ask, and search on selected text. Fully open source, supports local model configuration.

## Core Features

### AI Text Interaction
- **Smart Text Recognition** — Popup menu appears after selecting text
- **Multi-dimensional AI Features**
  - **AI Search** — Search for information related to selected text
  - **Translate** — Smart translation with automatic source language detection
  - **Explain** — AI explains selected concepts in plain language
  - **Ask** — Free-form questions, open-ended dialogue
- **Context-Aware** — Automatically captures context around selected text for better AI responses
- **Follow-up Conversations** — Supports multi-turn dialogue

### Page-level Operations
- **Translate Full Page** — One-click translate entire webpage, preserving original layout
- **Summarize Page** — Extract page content, AI generates concise summary (shown in side panel)

### User Experience
- **Floating Icon Menu** — Persistent entry in bottom-right corner, hover to expand actions
- **Adjustable Side Panel** — Drag to resize width, immersive AI conversation experience
- **Side Panel Chat** — Chrome Side Panel API, full streaming dialogue experience
- **Markdown Rendering** — Real-time streaming AI output with Markdown support
- **History Management** — Session-based history with search and review

## Multi-Model Support

| Provider | Models | Features |
|----------|--------|----------|
| OpenAI | GPT-4o, GPT-4 Turbo | Standard OpenAI API |
| Anthropic | Claude Sonnet, Claude Opus | Native API, strong reasoning |
| DeepSeek | DeepSeek Chat, Reasoner | Native thinking process output |
| Qwen | Qwen-Turbo, Qwen-Plus | Alibaba Cloud DashScope API |
| GLM | GLM-4 | Zhipu AI OpenAI-compatible API |
| OpenAI Compatible | Custom | Any OpenAI-compatible API |
| Local Models | Ollama, LM Studio | Local deployment, privacy-safe |

## Project Architecture

```
select-ask/
├── browser-extension/          # Browser extension (frontend)
│   ├── src/
│   │   ├── background/         # Background script (Service Worker)
│   │   │   ├── index.ts        # Main entry, message routing + state persistence
│   │   │   └── llm-service.ts  # LLM streaming service
│   │   ├── content/            # Content scripts (injected into pages)
│   │   │   ├── index.ts        # Main entry
│   │   │   ├── floating-icon.ts    # Floating icon menu
│   │   │   ├── floating-window.ts  # Floating translation window
│   │   │   └── style.css       # Injected styles
│   │   ├── popup/              # Popup window (quick actions)
│   │   ├── options/            # Settings page (model management, history)
│   │   ├── side-panel/         # Side panel chat interface
│   │   ├── services/           # Service layer
│   │   │   └── llm/            # LLM provider implementations
│   │   │       ├── base.ts     # Abstract base class
│   │   │       ├── factory.ts  # Factory pattern
│   │   │       ├── openai.ts
│   │   │       ├── anthropic.ts
│   │   │       ├── deepseek.ts
│   │   │       ├── qwen.ts
│   │   │       ├── glm.ts
│   │   │       └── openai-compat.ts
│   │   ├── utils/              # Utilities
│   │   │   ├── context.ts      # Context collection
│   │   │   ├── crypto.ts       # AES-256-GCM encryption
│   │   │   ├── history-manager.ts  # History management
│   │   │   └── content-extractor.ts # Page content extraction
│   │   ├── store/              # Zustand state management
│   │   └── types/              # TypeScript type definitions
│   ├── tests/                  # Playwright end-to-end tests
│   ├── manifest.json           # Chrome extension manifest
│   └── package.json
└── docs/                       # Documentation
```

**Architecture Notes**:
- The extension runs independently, no backend service required
- LLM calls go directly from the browser to your configured provider APIs, no intermediate servers
- Users configure their own API keys, data stays fully local

## Installation

### Manual Installation

1. Clone or download this repository
2. Enter the `browser-extension` directory and install dependencies:
   ```bash
   cd browser-extension
   npm install
   npm run build
   ```
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top-right corner
5. Click "Load unpacked" and select the `browser-extension` directory
6. Done!

## Quick Start

### 1. Configure Model

1. Click the extension icon in the browser toolbar
2. Click "Open Settings"
3. Click "Add Model"
4. Choose a preset or custom model
5. Enter your API Key (encrypted with AES-256-GCM and stored locally)
6. Click "Test Connection" to verify
7. Save and select the model as default

### 2. Use Basic Features

1. Select any text on a webpage
2. Choose a function from the popup menu: Translate / Explain / Ask / Search
3. View the AI response in the side panel (with Markdown rendering)
4. Continue with follow-up questions for multi-turn conversations

### 3. Page-level Operations

Via the floating icon menu in the bottom-right corner:
- **Translate Full Page** — Translate page content paragraph by paragraph, preserving layout
- **Summarize Page** — Automatically extract page content and generate summary

## Development Guide

### Requirements

- Node.js 18+
- npm 9+

### Local Development

```bash
cd browser-extension
npm install

# Development mode (HMR)
npm run dev

# Production build
npm run build

# Run tests
npm test
```

### Load Development Build

1. Run `npm run dev` or `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `browser-extension` directory

## Get API Keys

| Provider | Get API Key |
|----------|-------------|
| OpenAI | https://platform.openai.com/api-keys |
| Anthropic | https://console.anthropic.com/ |
| DeepSeek | https://platform.deepseek.com/ |
| Qwen | https://dashscope.aliyun.com/ |
| GLM | https://open.bigmodel.cn/ |

## Security

- All API Keys encrypted with AES-256-GCM, stored locally in the browser
- Chat content only sent to your configured AI providers
- Open source code, auditable by anyone

## Tech Stack

- React 18 + TypeScript
- Vite 5 + @crxjs/vite-plugin
- TailwindCSS 3
- Chrome Extension Manifest V3
- Web Crypto API (AES-256-GCM encryption)
- Zustand (State management)
- marked (Markdown rendering)
- Playwright (End-to-end testing)

## Chrome Extension Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Store settings, API keys, and chat history |
| `scripting` | Inject content scripts into web pages |
| `sidePanel` | Chrome Side Panel API |
| `tabs` | Tab management |
| `microphone` | Voice input support |

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

Issues and Pull Requests are welcome!

### Contributors

<a href="https://github.com/zqqpluto/select-ask/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=zqqpluto/select-ask" />
</a>

## More Information

- [Privacy Policy](./PRIVACY_POLICY.md)

## Community

- [GitHub Discussions](../../discussions) — Questions, feature requests
- [Issue Tracker](../../issues) — Bug reports, feature requests

## Acknowledgments

Thanks to all AI providers for their excellent model services:

- [OpenAI](https://openai.com/)
- [Anthropic](https://www.anthropic.com/)
- [DeepSeek](https://www.deepseek.com/)
- [Qwen](https://tongyi.aliyun.com/)
- [GLM](https://www.zhipuai.cn/)

---

If this project helps you, please give it a Star!

**Made with ❤️ by [zqqpluto](https://github.com/zqqpluto)**
