# Select Ask

> Select text, AI helps you explain, translate, and ask questions

A smart browser extension that allows you to select text and get AI-powered explanations, translations, answers, and FAQ generation. All AI calls are made directly in the browser without requiring a backend service.

## Features

- 🖱️ **Smart Text Recognition** - Auto-popup menu after selecting text
- 🤖 **AI Functions** - Explain, Translate, Ask, FAQ Generation
- 🔍 **Context-Aware** - Automatically captures context around selected text
- 💬 **Follow-up Questions** - Supports multi-turn conversations
- 🧠 **Multi-Model Support** - OpenAI, Claude, DeepSeek, Qwen, GLM, and more
- 🔐 **Local Secure Storage** - API Keys encrypted with AES-256-GCM
- 📊 **Display Modes** - Popup and Sidebar modes
- 🕐 **History** - Auto-saves conversation history
- 🌍 **i18n Support** - English & Chinese (Auto language detection)

## Supported AI Models

| Provider | Models | Features |
|----------|--------|----------|
| OpenAI | GPT-4o, GPT-4 | Standard OpenAI API |
| Anthropic | Claude Sonnet, Opus | Claude-specific API format |
| DeepSeek | DeepSeek Chat, Reasoner | Native thinking process output |
| Qwen | Qwen-Turbo, Qwen-Plus | Alibaba Cloud DashScope API |
| GLM | GLM-4 | Zhipu AI OpenAI-compatible API |
| Custom | Any OpenAI-compatible API | Self-hosted or alternative APIs |

## Installation

### Option 1: Chrome Web Store (Recommended)

*Coming soon*

### Option 2: Manual Installation

1. Download the latest release from [GitHub Releases](../../releases)
2. Unzip to any directory
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the unzipped directory
6. Done! You can now use it on any webpage

## Quick Start

### 1. Configure AI Model

First-time setup requires configuring an AI model:

1. Click the extension icon in browser toolbar
2. Click "Open Settings"
3. Click "Add Model"
4. Choose a preset or custom model
5. Enter your API Key (encrypted and stored locally)
6. Click "Test Connection" to verify
7. Save and select the model as default

### 2. Start Using

1. Select any text on a webpage
2. Click the popup icon
3. Choose a function:
   - **Explain** - AI explains the selected content
   - **Translate** - Translates to your language
   - **Ask** - Enter custom questions
   - **FAQs** - AI generates relevant questions
4. View the answer in the popup dialog
5. Continue with follow-up questions

## Directory Structure

```
select-ask/
├── browser-extension/          # Browser extension
│   ├── public/
│   │   ├── icons/             # Extension icons
│   │   ├── logos/             # AI provider logos
│   │   └── _locales/          # i18n translations
│   ├── src/
│   │   ├── background/        # Service Worker
│   │   ├── content/           # Content scripts
│   │   ├── popup/             # Popup page
│   │   ├── options/           # Settings page
│   │   ├── services/          # Service layer
│   │   │   └── llm/          # LLM providers
│   │   ├── hooks/            # React hooks
│   │   ├── utils/            # Utilities
│   │   └── types/            # TypeScript types
│   └── manifest.json
├── analytics-service/          # Optional: Analytics service
│   └── src/                   # Cloudflare Worker code
└── README.md
```

## Development

### Requirements

- Node.js 18+
- npm 9+

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/select-ask.git
cd select-ask

# Install dependencies
cd browser-extension
npm install

# Development mode
npm run dev

# Build for production
npm run build
```

### Load Development Build

1. Run `npm run dev` or `npm run build`
2. Open Chrome and go to `chrome://extensions/`
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

- ✅ All API Keys encrypted with AES-256-GCM and stored locally
- ✅ Encryption keys stored in `chrome.storage.local`
- ✅ Chat content only sent to your configured AI providers
- ✅ No backend dependency (optional analytics service)
- ✅ Open source code for auditing

## Privacy

- Extension does not collect any personal information
- API Keys stored locally, never uploaded to any server
- Chat content only sent to your chosen AI provider
- Optional analytics service only collects anonymous usage data

## Internationalization

The extension supports multiple languages with automatic browser language detection.

**Supported Languages:**
- English (en)
- Chinese (zh_CN)

**Add a New Language:**
1. Create `public/_locales/{language-code}/messages.json`
2. Copy the structure from `en/messages.json`
3. Translate all messages
4. Submit a pull request

See [I18N.md](./browser-extension/I18N.md) for details.

## Tech Stack

- React 18 + TypeScript
- Vite 5
- TailwindCSS 3
- Chrome Extension Manifest V3
- Web Crypto API
- Zustand (State management)

## Analytics (Optional)

The optional analytics service helps you understand usage patterns:

- Extension startup tracking
- Feature usage statistics
- Error monitoring
- Anonymous user identification

See [analytics-service/README.md](./analytics-service/README.md) for deployment instructions.

## Roadmap

- [ ] Firefox support
- [ ] Custom prompt templates
- [ ] Batch processing
- [ ] Keyboard shortcuts
- [ ] More AI models
- [ ] Pro version with premium features

## Contributing

Issues and Pull Requests are welcome!

**Development Process:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT License](LICENSE)

## Acknowledgments

Thanks to all AI providers for their excellent model services.

## Support

If you find this helpful, please give it a ⭐ Star!

**Questions or Issues?**
- [GitHub Issues](../../issues)
- Email: your-email@example.com

---

Made with ❤️ by [Your Name]