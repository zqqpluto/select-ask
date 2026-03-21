# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Select Ask is a browser extension that enables users to select text and interact with AI for explanations, translations, and Q&A. The project is a Chrome Extension (Manifest V3) built with React + TypeScript + Vite.

## Development Commands

### Browser Extension

```bash
cd browser-extension
npm install           # Install dependencies
npm run dev          # Development mode with HMR on port 5173
npm run build        # Production build (outputs to dist/)
npm test             # Run all Playwright tests
npm run test:ui      # Run tests with UI
npm run test:debug   # Debug tests
```

## Architecture

### Chrome Extension Architecture

The extension follows Chrome Extension Manifest V3 architecture:

**Background Script** (`src/background/index.ts`)
- Service worker that handles LLM streaming requests via Chrome runtime ports
- Manages state persistence with Zustand
- Coordinates message passing between content scripts and popup/options pages
- Handles API key encryption/decryption

**Content Script** (`src/content/index.ts`)
- Injected into all web pages
- Handles text selection detection and UI rendering
- Manages floating box and sidebar display modes
- Collects context around selected text for better AI responses
- Streams LLM responses and renders markdown

**Popup** (`src/popup/`)
- Quick access to settings and model selection
- Displays current configuration status

**Options Page** (`src/options/`)
- Detailed model configuration interface
- API key management with AES-256-GCM encryption
- Model testing and validation

### LLM Provider System

The project uses a provider pattern for multiple LLM services:

- **Base Class**: `src/services/llm/base.ts` - Abstract base defining the interface
- **Factory**: `src/services/llm/factory.ts` - Creates provider instances based on type
- **Providers**: `src/services/llm/providers/` - Implementations for:
  - OpenAI (`openai.ts`)
  - Anthropic/Claude (`anthropic.ts`)
  - DeepSeek (`deepseek.ts`) - supports reasoning output
  - Qwen/通义千问 (`qwen.ts`)
  - GLM/智谱AI (`glm.ts`)
  - OpenAI-compatible APIs (`openai-compat.ts`)

Each provider implements `streamChat()` for streaming responses and can optionally override `generateQuestions()`.

### State Management

- **Zustand Store** (`src/store/index.ts`): Global state with selectors
- **Persistence**:
  - `chrome.storage.sync`: User settings (selected model, API keys)
  - `chrome.storage.local`: Chat history and session data
- **State Sync**: Background script listens to store changes and persists automatically

### Message Passing

Extension components communicate via Chrome runtime messages:

- **Port-based streaming**: LLM responses use `chrome.runtime.Port` for real-time streaming
- **Simple messages**: Configuration and state queries use `chrome.runtime.sendMessage`
- **Message types**: Defined in `src/types/messages.ts`

### Key Design Patterns

**Context Collection** (`src/utils/context.ts`)
- Extracts text before and after selection
- Limits context to avoid token limits
- Improves AI response relevance

**Encrypted Storage** (`src/services/llm/crypto.ts`)
- AES-256-GCM encryption for API keys
- Keys stored in `chrome.storage.local`
- Never transmitted to external servers (except chosen LLM provider)

**History Management** (`src/utils/history-manager.ts`)
- Sessions with 7-day expiration
- Auto-generated titles from first message
- Cleanup on extension startup

**Page Summarization** (`src/utils/content-extractor.ts`)
- Intelligent content extraction from web pages
- 4-layer extraction strategy (article tag, semantic HTML, main/content divs, paragraph fallback)
- Used for page-level summarization feature

## Testing

Tests use Playwright with the Chromium browser:

- **Test files**: Located in `browser-extension/tests/`
- **Test page**: Tests use real web pages for realistic scenarios
- **Extension loading**: Tests load the unpacked extension automatically
- **Test categories**:
  - `extension.spec.ts`: Basic functionality tests
  - `extension-features.spec.ts`: Feature-specific tests
  - `extension-real.spec.ts`: Tests with real API calls (requires API keys)
  - `extension-local.spec.ts`: Local-only tests
  - `extension-full.spec.ts`: Comprehensive end-to-end tests

**Test Requirements**:
- Build the extension first: `npm run build`
- Tests require the dist/ directory to exist
- For real API tests, configure API keys in the extension

## Important Technical Details

### Vite Build Configuration

The extension uses `@crxjs/vite-plugin` to handle Chrome Extension specifics:
- Automatic manifest handling
- Content script CSS injection
- HMR for development
- Type: module (ESM throughout)
- Dev server runs on port 5173, HMR on port 5174

### API Key Security

- Never log or expose API keys in plaintext
- Always use `encryptApiKey()` from `src/services/llm/crypto.ts` before storage
- Decrypt only when making API calls
- Keys are stored locally in Chrome storage, never sent to any backend (except the chosen LLM provider)

### Internationalization

- Extension name and description use `__MSG_*__` format in manifest.json
- Supported locales in `_locales/` directory:
  - `en` (English)
  - `zh_CN` (Simplified Chinese)
- Auto-follows browser language setting
- See `browser-extension/I18N.md` for details

### LLM Response Handling

- All providers support streaming via async generators
- DeepSeek supports reasoning output (configure with `addReasoning: true` in model config)
- Responses rendered as markdown using `marked` library
- Error handling: Graceful degradation with user-friendly messages
- Streaming uses Chrome runtime ports for real-time updates

### Chrome Extension Permissions

**Required permissions**:
- `storage`: For storing settings and API keys
- `scripting`: For injecting content scripts

**Host permissions**:
- Specific LLM API domains (OpenAI, Anthropic, DeepSeek, Qwen, GLM)
- `<all_urls>`: For content script injection on all pages

## Code Conventions

### TypeScript
- Strict mode enabled
- All types defined in `src/types/`
- Use interfaces for object structures
- Avoid `any` type

### React
- Functional components with hooks
- Component names use PascalCase
- Props use interfaces
- Keep components focused and small

### Styling
- TailwindCSS for styling
- Custom styles in `.css` files when needed
- Responsive design principles

### File Naming
- React components: `PascalCase.tsx`
- TypeScript files: `camelCase.ts`
- Style files: `kebab-case.css`
- Test files: `*.spec.ts` (Playwright)

### Async Operations
- Use async/await, not raw Promises
- Handle errors gracefully with try-catch
- Provide user-friendly error messages

### Error Handling
- Never expose stack traces to users
- Validate API responses
- Handle network failures gracefully
- Show actionable error messages

## Commit Conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation updates
- `style`: Code formatting (no functional change)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Test-related changes
- `chore`: Build process or tooling changes

**Examples**:
```
feat(content): add page summarization feature
fix(llm): handle DeepSeek reasoning output correctly
docs(readme): update installation instructions
```

## Loading the Extension for Development

1. Run `npm run dev` or `npm run build` in `browser-extension/`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `browser-extension/` directory
6. The extension should now appear in your toolbar

For development with HMR, use `npm run dev` and the extension will hot-reload as you make changes.

## Architecture Diagrams

### Data Flow

```
User selects text
  → Content script detects selection
  → Context collected (before/after text)
  → User chooses action (explain/translate/question/summarize)
  → Content script sends message to background
  → Background script creates streaming port to LLM provider
  → LLM provider streams response
  → Content script renders markdown in real-time
  → User can continue conversation (multi-turn)
```

### Message Types

See `src/types/messages.ts` for all message type definitions:
- `LLM_REQUEST`: Request to start LLM streaming
- `LLM_RESPONSE`: Streaming response chunk
- `LLM_ERROR`: Error during LLM call
- `LLM_COMPLETE`: Streaming completed
- `STORE_UPDATE`: State update notification
- `GET_STORE`: Request current state

## Performance Considerations

- Context collection limits text to avoid token limits
- Streaming responses provide immediate feedback
- History cleanup runs on extension startup (7-day retention)
- Content extraction uses multiple fallback strategies for reliability
- API calls use abort controllers for cancellation support