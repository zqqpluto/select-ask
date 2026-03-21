# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Complete open source preparation
- Docker deployment support
- Comprehensive documentation

## [1.0.0] - 2026-03-21

### Added - Core Features
- 🖱️ Smart text selection detection with auto-popup menu
- 🤖 AI-powered features:
  - Text explanation
  - Translation
  - Custom Q&A
  - Page summarization
  - Smart question recommendations
- 🔍 Context-aware responses
- 💬 Multi-turn conversation support
- 📝 Intelligent content extraction (4-tier strategy)

### Added - User Experience
- 📐 Resizable sidebar (300-800px range)
- ⌨️ Flexible send options (Enter or Ctrl+Enter)
- 🕐 Enhanced history management with search
- 🎯 Simplified UI design (DeepSeek-inspired)
- 📊 Dual display modes (floating box and sidebar)

### Added - Security
- 🔑 AES-256-GCM encrypted API key storage
- 🔒 Device fingerprint verification:
  - Canvas fingerprint
  - WebGL fingerprint
  - Audio fingerprint
  - SHA-256 hash generation
- 🛡️ Rate limiting protection:
  - Per-IP device creation limits (10 devices/hour)
  - Per-user daily quota (30 requests/day)
  - Suspicious activity detection (>10 IPs)

### Added - Multi-Model Support
- OpenAI (GPT-4o, GPT-4 Turbo)
- Anthropic (Claude Sonnet 4)
- DeepSeek (Chat, Reasoner)
- Qwen (Turbo, Plus)
- GLM-4
- Custom OpenAI-compatible APIs

### Added - Backend Service (Optional)
- Device fingerprint validation middleware
- Unified API key management
- MongoDB-based user management
- JWT authentication
- Comprehensive test suite (13 test cases, 100% pass rate)

### Technical Details
- Frontend: React 18 + TypeScript + Vite 5
- Backend: Express.js 5 + MongoDB 6
- Extension: Chrome Manifest V3
- Testing: Jest with 100% coverage
- Security: Multi-dimensional protection

### Security Test Results
- ✅ Fingerprint format validation
- ✅ Device registration and reuse
- ✅ IP tracking
- ✅ Rate limiting
- ✅ Blocked device detection
- ✅ Suspicious activity detection
- ✅ All 13 test cases passed

## [0.9.0] - 2026-03-15

### Added
- Initial beta release
- Basic AI text interaction
- Multiple model support
- Local encrypted storage

## [0.1.0] - 2026-02-01

### Added
- Project initialization
- Basic Chrome extension structure
- Simple text selection feature

---

## Version History

- **1.0.0** - First stable release with complete features
- **0.9.0** - Beta release for testing
- **0.1.0** - Initial development version

## Upgrade Guide

### Upgrading to 1.0.0

This is the first stable release. If you're upgrading from a beta version:

1. **Clear local storage** - Due to security improvements, you may need to reconfigure your models
2. **Update configuration** - New preferences added (sidebar width, send key settings)
3. **Review security** - Device fingerprint validation is now enabled by default

### Migration from 0.9.0

1. Export your model configurations (if needed)
2. Update to version 1.0.0
3. Re-import your configurations
4. Verify all features work as expected

---

For more details on each release, see the [GitHub Releases](../../releases) page.
