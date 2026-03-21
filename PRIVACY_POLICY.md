# Select Ask 隐私政策 / Privacy Policy

**最后更新日期 / Last Updated**: 2026年3月21日

---

## 中文版

### 概述

Select Ask（以下简称"我们"或"本扩展"）致力于保护您的隐私。本隐私政策说明我们如何收集、使用和保护您的数据。

### 1. 数据收集

#### 1.1 我们收集的数据

**API 密钥（可选）**
- **收集目的**: 用于调用您选择的 LLM 服务提供商 API
- **存储方式**: 使用 AES-256-GCM 加密存储在您的本地浏览器中
- **传输**: 仅在您主动调用 AI 功能时发送给您选择的 LLM 提供商
- **我们无法访问**: 我们从未访问、存储或传输您的明文 API 密钥到我们的服务器

**聊天历史（可选）**
- **收集目的**: 便于您查看历史对话
- **存储方式**: 本地浏览器存储（chrome.storage.local）
- **保留期限**: 您可随时删除，或卸载扩展时自动删除

**匿名使用统计（可选，需您的明确同意）**
- **收集内容**: 功能使用频率、错误类型、响应时间
- **不收集**: 用户文本内容、API 密钥、个人信息、浏览历史
- **目的**: 改进产品功能和用户体验

#### 1.2 我们不收集的数据

我们**明确不收集**：
- ❌ 个人身份信息（姓名、邮箱、电话等）
- ❌ 浏览历史
- ❌ 您输入或选择的文本内容
- ❌ 网站访问记录
- ❌ 设备位置信息
- ❌ 联系人信息

### 2. 数据处理

#### 2.1 本地处理

以下数据完全在您的本地设备处理，**不会发送到任何服务器**：
- API 密钥加密存储
- 聊天历史记录
- 用户偏好设置
- 模型配置

#### 2.2 第三方服务

当您使用 AI 功能时，您选择的文本将被发送到您配置的 LLM 提供商：

| 服务提供商 | 服务器位置 | 隐私政策 |
|-----------|-----------|---------|
| OpenAI | 美国 | https://openai.com/privacy |
| Anthropic (Claude) | 美国 | https://www.anthropic.com/privacy |
| DeepSeek | 中国 | https://platform.deepseek.com/privacy |
| 通义千问 (Qwen) | 中国 | https://dashscope.aliyun.com/privacy |
| 智谱 AI (GLM) | 中国 | https://open.bigmodel.cn/privacy |

**重要提示**：
- 我们无法控制这些第三方如何处理您的数据
- 请阅读您使用的 LLM 提供商的隐私政策
- 您可以自由选择使用哪个提供商

### 3. 数据安全

#### 3.1 技术措施

我们采取以下安全措施保护您的数据：

- **加密存储**: API 密钥使用 AES-256-GCM 加密算法加密
- **本地存储**: 敏感数据仅存储在您的本地设备
- **安全传输**: 所有 API 调用使用 HTTPS 加密
- **开源审计**: 前端代码开源，可供安全审计

#### 3.2 您的责任

为确保数据安全，您应：
- 妥善保管您的 API 密钥
- 不要在公共设备上保存 API 密钥
- 定期检查您的 LLM 提供商账单
- 发现 API 密钥泄露后立即撤销并更换

### 4. 数据共享

我们**不会**：
- 出售您的个人数据
- 与第三方共享您的 API 密钥
- 将您的聊天内容用于广告目的
- 在未经您同意的情况下共享数据

### 5. 您的权利

您对您的数据拥有以下权利：

#### 5.1 访问权
您可以随时查看本地存储的所有数据：
1. 打开扩展设置
2. 点击"数据管理"
3. 查看所有本地存储的数据

#### 5.2 删除权
您可以删除：
- 单条聊天记录
- 所有聊天历史
- API 密钥配置
- 完全卸载扩展以删除所有数据

#### 5.3 导出权
您可以导出您的数据（JSON 格式）：
1. 打开扩展设置
2. 点击"导出数据"
3. 下载 JSON 文件

#### 5.4 拒绝权
您可以：
- 拒绝匿名统计数据收集（在设置中关闭）
- 随时卸载扩展

### 6. 儿童隐私

本扩展不面向 13 岁以下儿童。我们不会故意收集儿童的个人信息。如果您是家长或监护人，发现您的孩子向我们提供了个人信息，请联系我们。

### 7. 国际数据传输

当您使用海外 LLM 提供商（如 OpenAI、Anthropic）时，您的数据将传输到美国。当您使用国内提供商（如 DeepSeek、通义千问）时，数据将留在中国。

请根据您所在地的法律法规选择合适的服务提供商。

### 8. 隐私政策更新

我们可能不时更新本隐私政策。重大变更将：
- 在扩展中弹出通知
- 在官网发布更新说明
- 更新本页面的"最后更新日期"

继续使用本扩展即表示您接受更新后的政策。

### 9. 联系我们

如果您对本隐私政策有任何疑问，请联系：

- **电子邮件**: privacy@selectask.com
- **GitHub**: https://github.com/select-ask/select-ask/issues
- **网站**: https://selectask.com

---

## English Version

### Overview

Select Ask (hereinafter referred to as "we" or "this extension") is committed to protecting your privacy. This privacy policy explains how we collect, use, and protect your data.

### 1. Data Collection

#### 1.1 Data We Collect

**API Keys (Optional)**
- **Purpose**: To call the LLM service provider APIs you choose
- **Storage**: Encrypted using AES-256-GCM in your local browser
- **Transmission**: Only sent to your chosen LLM provider when you actively use AI features
- **We Cannot Access**: We never access, store, or transmit your plaintext API keys to our servers

**Chat History (Optional)**
- **Purpose**: To help you review past conversations
- **Storage**: Local browser storage (chrome.storage.local)
- **Retention**: You can delete it anytime, or it's automatically deleted when you uninstall

**Anonymous Usage Statistics (Optional, requires your explicit consent)**
- **Collected**: Feature usage frequency, error types, response times
- **Not Collected**: User text content, API keys, personal information, browsing history
- **Purpose**: To improve product functionality and user experience

#### 1.2 Data We Do NOT Collect

We **explicitly do NOT collect**:
- ❌ Personal identification information (name, email, phone, etc.)
- ❌ Browsing history
- ❌ Text you input or select
- ❌ Website visit records
- ❌ Device location information
- ❌ Contact information

### 2. Data Processing

#### 2.1 Local Processing

The following data is processed entirely on your local device and **NOT sent to any server**:
- API key encrypted storage
- Chat history
- User preferences
- Model configurations

#### 2.2 Third-Party Services

When you use AI features, your selected text will be sent to your configured LLM provider:

| Service Provider | Server Location | Privacy Policy |
|-----------------|-----------------|----------------|
| OpenAI | USA | https://openai.com/privacy |
| Anthropic (Claude) | USA | https://www.anthropic.com/privacy |
| DeepSeek | China | https://platform.deepseek.com/privacy |
| Qwen | China | https://dashscope.aliyun.com/privacy |
| GLM | China | https://open.bigmodel.cn/privacy |

**Important**:
- We cannot control how these third parties process your data
- Please read the privacy policy of your chosen LLM provider
- You are free to choose which provider to use

### 3. Data Security

#### 3.1 Technical Measures

We implement the following security measures:

- **Encrypted Storage**: API keys encrypted using AES-256-GCM algorithm
- **Local Storage**: Sensitive data stored only on your local device
- **Secure Transmission**: All API calls use HTTPS encryption
- **Open Source Audit**: Frontend code is open source for security auditing

#### 3.2 Your Responsibilities

To ensure data security, you should:
- Keep your API keys secure
- Do not save API keys on public devices
- Regularly check your LLM provider bills
- Immediately revoke and replace compromised API keys

### 4. Data Sharing

We **do NOT**:
- Sell your personal data
- Share your API keys with third parties
- Use your chat content for advertising purposes
- Share data without your consent

### 5. Your Rights

You have the following rights regarding your data:

#### 5.1 Right to Access
You can view all locally stored data anytime:
1. Open extension settings
2. Click "Data Management"
3. View all locally stored data

#### 5.2 Right to Deletion
You can delete:
- Individual chat records
- All chat history
- API key configurations
- Uninstall the extension to delete all data

#### 5.3 Right to Export
You can export your data (JSON format):
1. Open extension settings
2. Click "Export Data"
3. Download JSON file

#### 5.4 Right to Object
You can:
- Opt out of anonymous statistics collection (disable in settings)
- Uninstall the extension anytime

### 6. Children's Privacy

This extension is not intended for children under 13. We do not knowingly collect personal information from children. If you are a parent or guardian and discover that your child has provided us with personal information, please contact us.

### 7. International Data Transfers

When you use overseas LLM providers (e.g., OpenAI, Anthropic), your data will be transferred to the USA. When you use domestic providers (e.g., DeepSeek, Qwen), data will remain in China.

Please choose the appropriate service provider according to your local laws and regulations.

### 8. Privacy Policy Updates

We may update this privacy policy from time to time. Significant changes will be:
- Notified via popup in the extension
- Published on our website
- Update the "Last Updated" date on this page

Continued use of this extension constitutes acceptance of the updated policy.

### 9. Contact Us

If you have any questions about this privacy policy, please contact:

- **Email**: privacy@selectask.com
- **GitHub**: https://github.com/select-ask/select-ask/issues
- **Website**: https://selectask.com

---

**版本**: 1.0
**生效日期**: 2026年3月21日