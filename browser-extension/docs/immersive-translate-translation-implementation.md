# 沉浸式翻译插件翻译实现详解

本文档详细分析了沉浸式翻译插件 (Immersive Translate) v1.27.2 的翻译实现机制，包括翻译请求、响应处理、结果插入和样式保持等核心功能。

---

## 一、核心架构概述

### 1.1 插件架构

```
┌─────────────────────────────────────────────────────────────┐
│                     用户界面层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │  Popup   │  │ Options  │  │     Side Panel           │  │
│  └──────────┘  └──────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ (chrome.runtime.sendMessage)
┌─────────────────────────────────────────────────────────────┐
│                   Background Service Worker                 │
│  • 翻译服务配置管理                                          │
│  • API Key 管理                                             │
│  • 翻译请求转发                                              │
│  • 请求头修改 (Declarative Net Request)                    │
└─────────────────────────────────────────────────────────────┘
                            ↕ (fetch / XMLHttpRequest)
┌─────────────────────────────────────────────────────────────┐
│                   翻译服务 API                               │
│  • OpenAI / Claude / Gemini / DeepSeek 等 104+ 服务            │
│  • Google / Bing / DeepL 等传统翻译引擎                       │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Content Script                           │
│  • DOM 检测与文本提取                                         │
│  • 翻译结果渲染                                              │
│  • 样式注入与保持                                            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心文件

| 文件 | 大小 | 功能 |
|------|------|------|
| `background.js` | 801KB | 后台服务，处理翻译请求转发 |
| `content_script.js` | 2.6MB | 内容脚本，DOM 处理和结果渲染 |
| `default_config.json` | 476KB | 默认配置（含 104+ 翻译服务定义） |
| `default_config.content.json` | 151KB | 内容配置（含 AI Assistant 提示词） |
| `styles/inject.css` | 16KB | 页面翻译样式注入 |

---

## 二、翻译请求实现

### 2.1 多段文本翻译策略

**核心发现：选择多段文本后，是分开请求还是合并请求？**

答案：**取决于文本长度和配置，默认采用合并请求策略**

```javascript
// 配置参数 (default_config.content.json)
{
  "immediateTranslationTextCount": 4999,  // 即时翻译文本数量限制
  "maxTextGroupLengthPerRequestForSubtitle": 5,  // 字幕每请求最大文本组数
}
```

#### 2.1.1 文本分组逻辑

```
用户选择 N 段文本
       ↓
检查总文本长度是否超过阈值
       ↓
┌──────┴──────┐
│  未超过阈值   │  超过阈值
│     ↓       │     ↓
│  合并为 1 个请求  │  分批次请求
│              │  (每批最多 5 组)
└──────────────┘
```

#### 2.1.2 请求格式示例

当用户选择多段文本时，合并为一个请求的格式：

```json
{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "system",
      "content": "You are a professional {{to}} native translator..."
    },
    {
      "role": "user",
      "content": "Translate the following text to {{to}}:\n\n<text>\n{段落 1}\n---\n{段落 2}\n---\n{段落 3}\n</text>"
    }
  ],
  "temperature": 0
}
```

**关键实现细节：**
- 多段文本使用分隔符（如 `---` 或 `<hr>`）分隔
- 翻译响应中也用相同分隔符分隔，便于拆分还原

---

### 2.2 翻译服务配置

#### 2.2.1 支持的翻译服务类别

| 类别 | 服务示例 |
|------|---------|
| **传统翻译引擎** | google, bing, baidu, yandex, deepl, papago, caiyun, youdao |
| **OpenAI 系列** | openai, openai-pro, openai-max, chatgpt |
| **Claude 系列** | claude, claude-pro, claude-max |
| **Gemini 系列** | gemini, gemini-pro, gemini-max |
| **DeepSeek** | deepseek, deepseek-pro |
| **Grok 系列** | grok, grok-pro |
| **阿里系** | qwen, qwen-pro, qwen-max, aliyun, qwen-mt |
| **字节系** | doubao, volc, volcAlpha |
| **百度系** | qianfan, qianfan2, baidu |
| **腾讯系** | hunyuan, transmart |
| **智谱 AI** | zhipu, zhipu-pro, zhipu-free |
| **其他** | kimi, siliconcloud, groq, ollama |

#### 2.2.2 服务配置结构

```json
{
  "deepseek": {
    "visible": true,
    "name": "Deepseek",
    "model": "deepseek-chat",
    "models": "deepseek-chat|deepseek-reasoner",
    "limit": 10,
    "apiUrl": "https://api.deepseek.com/chat/completions",
    "provider": "custom",
    "enableRichTranslate": false,
    "dualEnableRichTranslate": false,
    "translationEnableRichTranslate": true,
    "proModel": "DeepSeek-V3.2-Fast",
    "enableFallback": true,
    "proLimit": 10,
    "requestTimeout": 200000,
    "supportFeatures": ["aiWriting", "selectionTranslation"]
  }
}
```

---

### 2.3 请求体格式详解

#### 2.3.1 标准 OpenAI 兼容格式

大多数 AI 翻译服务使用以下格式：

```json
POST https://api.deepseek.com/chat/completions
Content-Type: application/json
Authorization: Bearer {API_KEY}

{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "system",
      "content": "系统提示词（见下文）"
    },
    {
      "role": "user", 
      "content": "用户输入（待翻译文本）"
    }
  ],
  "temperature": 0,
  "stream": false
}
```

#### 2.3.2 系统提示词 (System Prompt)

**通用英文翻译模板：**

```
You are a professional {{to}} native translator who needs to fluently translate text into {{to}}.

## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here is the translation:", "Translation:", etc.)
2. If the text contains HTML tags, ensure the tags remain in the correct positions after translation and the translation flows naturally
3. For content that doesn't need translation (such as proper nouns, code, etc.), keep the original text{{title_prompt}}{{summary_prompt}}{{terms_prompt}}
```

**简体中文翻译模板：**

```
你是一个专业的简体中文母语译者，需将文本流畅地翻译为简体中文。

## 翻译规则
1. 仅输出译文内容，禁止解释或添加任何额外内容（如"以下是翻译："、"译文如下："等）
2. 如果文本包含 HTML 标签，请在翻译后保持标签位置正确，并确保译文流畅
3. 对于无需翻译的内容（如专有名词、代码等），请保留原文{{title_prompt}}{{summary_prompt}}{{terms_prompt}}
```

**日文翻译模板：**

```
あなたは日本語のネイティブ翻訳者であり、テキストを流暢な日本語に翻訳します。以下のルールに従ってください：
1. 翻訳内容のみを出力し、説明や追加コンテンツ（「以下は翻訳です：」「翻訳文は次の通りです：」など）を加えないでください
2. テキストに HTML タグが含まれている場合は、翻訳後もタグの位置を正確に保ち、翻訳が自然に流れるようにしてください
3. 翻訳する必要のないコンテンツ（固有名詞、コードなど）については、原文のまま保持してください{{title_prompt}}{{summary_prompt}}{{terms_prompt}}
```

#### 2.3.3 提示词变量说明

| 变量 | 说明 | 替换内容 |
|------|------|---------|
| `{{to}}` | 目标语言 | 如 "English", "简体中文", "日本語" |
| `{{from}}` | 源语言 | 如 "Chinese", "English" |
| `{{title_prompt}}` | 标题提示词 | 如果有标题上下文，追加额外提示 |
| `{{summary_prompt}}` | 摘要提示词 | 如果有上下文摘要，追加额外提示 |
| `{{terms_prompt}}` | 术语提示词 | 如果有术语表，追加术语翻译要求 |

#### 2.3.4 特殊 Assistant 提示词

插件支持 AI Assistant（专家模式），不同场景使用不同提示词：

| Assistant ID | 场景 | 提示词特点 |
|-------------|------|-----------|
| `paraphrase` | 改写 | 保持原意的重新表述 |
| `plain-english` | 简化英语 | 用更简单的英语表达 |
| `paragraph-summarizer-expert` | 段落总结 | 提取核心信息 |
| `twitter` | 推特内容 | 适应推特风格 |
| `tech` | 技术文档 | 保留技术术语 |
| `reddit` | Reddit 内容 | 适应论坛风格 |
| `paper` | 学术论文 | 学术严谨翻译 |
| `news` | 新闻内容 | 新闻风格 |
| `medical` | 医学内容 | 医学术语准确 |
| `legal` | 法律内容 | 法律用语准确 |
| `ao3` | AO3 小说 | 文学翻译风格 |
| `common` | 通用 | 标准翻译 |

**AO3 专家配置示例：**

```json
{
  "accurateConfigs": {
    "AO3": {
      "enable": false,
      "matches": ["https://archiveofourown.org/*"],
      "translationService": "deepseek-pro",
      "serviceConfig": {
        "assistantId": "ao3",
        "enableAIContext": true
      }
    }
  }
}
```

---

### 2.4 响应格式

#### 2.4.1 标准响应格式

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepseek-chat",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "翻译后的文本内容\n---\n第二段翻译内容"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

#### 2.4.2 流式响应 (SSE)

当 `stream: true` 时：

```
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"翻"},"index":0}]}

data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"译"},"index":0}]}

data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"内"},"index":0}]}

data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"容"},"index":0}]}

data: [DONE]
```

---

## 三、翻译结果插入逻辑

### 3.1 插入位置控制

翻译结果插入位置由配置 `translationPosition` 控制：

```json
{
  "translationPosition": "after",  // 或 "before"
  "translationMode": "dual",       // "dual"=双语对照，"translation"=仅翻译
  "inputTranslationMode": "translation"
}
```

#### 3.1.1 位置属性映射

| 配置值 | CSS 属性 | 效果 |
|--------|---------|------|
| `"after"` | `[imt-trans-position="after"]` | 译文在原文后 |
| `"before"` | `[imt-trans-position="before"]` | 译文在原文前 |

#### 3.1.2 翻译模式

| 模式 | CSS 属性 | 效果 |
|------|---------|------|
| `dual` | `[imt-state="dual"]` | 双语对照显示 |
| `translation` | `[imt-state="translation"]` | 仅显示译文 |

---

### 3.2 DOM 结构设计

#### 3.2.1 基础结构

当翻译完成后，原文段落会被包裹在以下结构中：

```html
<div class="immersive-translate-target-wrapper" imt-state="dual" imt-trans-position="after">
  <!-- 原文内容 -->
  <p>Original text paragraph</p>
  
  <!-- 翻译结果容器 -->
  <div class="immersive-translate-target-translation-block-wrapper">
    <div class="immersive-translate-target-translation-block-wrapper-theme-dividingLine">
      <div class="immersive-translate-target-translation-pdf-block-wrapper">
        <p>翻译后的文本段落</p>
      </div>
    </div>
  </div>
</div>
```

#### 3.2.2 内联翻译结构

对于内联元素（如 `<span>`），使用内联包装器：

```html
<span class="immersive-translate-target-wrapper">
  <span>Original inline text</span>
  <span class="immersive-translate-target-translation-inline-wrapper">
    <span class="immersive-translate-target-translation-theme-dashed-inner">
      内联翻译文本
    </span>
  </span>
</span>
```

---

### 3.3 插入流程

```
1. 检测可翻译文本节点
         ↓
2. 创建包装器元素 (immersive-translate-target-wrapper)
         ↓
3. 将原文本节点包裹进包装器
         ↓
4. 发送翻译请求到 Background
         ↓
5. 接收翻译响应
         ↓
6. 创建翻译结果容器 (immersive-translate-target-translation-block-wrapper)
         ↓
7. 根据 translationPosition 决定插入位置：
   - "after": insertAdjacentElement('afterend', ...)
   - "before": insertAdjacentElement('beforebegin', ...)
         ↓
8. 应用主题样式
```

#### 3.3.1 插入代码逻辑（伪代码）

```javascript
function insertTranslation(originalElement, translatedText, options) {
  const { position = 'after', theme = 'dividingLine' } = options;
  
  // 创建翻译结果容器
  const translationWrapper = document.createElement('div');
  translationWrapper.className = 'immersive-translate-target-translation-block-wrapper';
  
  // 创建主题容器
  const themeContainer = document.createElement('div');
  themeContainer.className = `immersive-translate-target-translation-block-wrapper-theme-${theme}`;
  
  // 创建实际内容容器
  const contentContainer = document.createElement('div');
  contentContainer.className = 'immersive-translate-target-translation-pdf-block-wrapper';
  contentContainer.textContent = translatedText;
  
  // 组装 DOM
  themeContainer.appendChild(contentContainer);
  translationWrapper.appendChild(themeContainer);
  
  // 根据位置插入
  if (position === 'before') {
    originalElement.parentNode.insertBefore(translationWrapper, originalElement);
  } else {
    originalElement.parentNode.insertBefore(translationWrapper, originalElement.nextSibling);
  }
}
```

---

### 3.4 样式保持机制

#### 3.4.1 字体大小继承

翻译结果的字体大小与正文保持一致的实现方式：

```css
/* inject.css */
.immersive-translate-target-wrapper {
  font-feature-settings: normal;
  /* 字体大小继承自父元素，不显式设置 */
}

[imt-state="dual"] .immersive-translate-target-translation-block-wrapper {
  margin: 8px 0 !important;
  display: inline-block;
}

/* PDF 特殊处理 */
[imt-state="dual"] .immersive-translate-pdf-target-container {
  font-size: 16px;  /* PDF 固定字体大小 */
  line-height: 1.3;
}
```

**关键发现：**
- 翻译容器**不显式设置 `font-size`**，通过 CSS 继承机制自动继承原文字体大小
- 对于 PDF 等特殊场景，使用固定字体大小确保可读性

#### 3.4.2 主题样式系统

插件支持多种翻译主题样式：

| 主题名称 | CSS 类名 | 效果 |
|---------|---------|------|
| `dividingLine` | `theme-dividingLine` | 虚线分隔 |
| `dashedBorder` | `theme-dashedBorder` | 虚线边框 |
| `solidBorder` | `theme-solidBorder` | 实线边框 |
| `underline` | `theme-underline` | 下划线 |
| `highlight` | `theme-highlight` | 高亮背景 |
| `marker` | `theme-marker` | 马克笔效果 |
| `blockquote` | `theme-blockquote` | 引用块样式 |
| `paper` | `theme-paper` | 纸张阴影效果 |
| `italic` | `theme-italic` | 斜体 |
| `bold` | `theme-bold` | 粗体 |

#### 3.4.3 CSS 变量系统

```css
:root {
  --immersive-translate-theme-underline-borderColor: #72ece9;
  --immersive-translate-theme-highlight-backgroundColor: #ffff00;
  --immersive-translate-theme-dashed-borderColor: #59c1bd;
  --immersive-translate-theme-blockquote-borderColor: #cc3355;
  --immersive-translate-theme-grey-textColor: #2f4f4f;
  --immersive-translate-theme-marker-backgroundColor: #fbda41;
}
```

#### 3.4.4 样式示例

**虚线边框主题：**

```css
[imt-state="dual"]
  .immersive-translate-target-translation-block-wrapper-theme-dashedBorder {
  border: 1px dashed var(--immersive-translate-theme-dashedBorder-borderColor) !important;
  border-radius: var(--immersive-translate-theme-dashedBorder-borderRadius) !important;
  padding: 6px;
  margin-top: 2px;
  display: inline-block;
}
```

**引用块主题：**

```css
[imt-state="dual"]
  .immersive-translate-target-translation-block-wrapper-theme-blockquote {
  border-left: 4px solid var(--immersive-translate-theme-blockquote-borderColor) !important;
  padding-left: 12px !important;
  margin-top: 4px;
  margin-bottom: 4px;
  padding-top: 4px;
  padding-bottom: 4px;
  display: inline-block;
}
```

**马克笔效果主题：**

```css
[imt-state="dual"] 
  .immersive-translate-target-translation-theme-marker-inner {
  background: linear-gradient(
    to right,
    rgba(251, 218, 65, 0.1),
    rgba(251, 218, 65, 0.9) 3%,
    rgba(251, 218, 65, 0.9) 35%,
    rgba(251, 218, 65, 0.9) 70%,
    rgba(251, 218, 65, 0.8) 95%,
    rgba(251, 218, 65, 0.3)
  );
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
```

---

### 3.5 特殊情况处理

#### 3.5.1 HTML 标签保持

当原文包含 HTML 标签时，翻译提示词会要求保持标签位置：

```
If the text contains HTML tags, ensure the tags remain in the correct positions after translation
```

**实现逻辑：**
1. 提取 HTML 标签，用占位符替换
2. 发送纯文本进行翻译
3. 翻译完成后，将 HTML 标签还原到对应位置

#### 3.5.2 专有名词保护

通过 `{{terms_prompt}}` 变量注入术语表：

```
For content that doesn't need translation (such as proper nouns, code, etc.), keep the original text
```

#### 3.5.3 RTL 语言支持

对于从右到左的语言（阿拉伯语、希伯来语等）：

```css
[imt-state="dual"] .immersive-translate-target-wrapper[dir="rtl"] {
  text-align: right;
}
```

---

## 四、完整调用流程示例

### 4.1 用户选择文本翻译

```
用户选择文本
       ↓
Content Script 检测选区
       ↓
提取选区中的文本节点（可能多段）
       ↓
检查是否需要分组（超过长度限制）
       ↓
构造翻译请求：
{
  "method": "translateText",
  "data": {
    "text": "段落 1\n---\n段落 2",
    "service": "deepseek",
    "from": "en",
    "to": "zh-CN"
  }
}
       ↓
发送消息到 Background (chrome.runtime.sendMessage)
       ↓
Background 读取服务配置
       ↓
构造 API 请求：
POST https://api.deepseek.com/chat/completions
Body: {
  "model": "deepseek-chat",
  "messages": [
    {"role": "system", "content": "系统提示词"},
    {"role": "user", "content": "Translate..."}
  ]
}
       ↓
接收 API 响应
       ↓
返回结果到 Content Script
       ↓
解析响应内容（按分隔符拆分多段翻译）
       ↓
为每段原文创建翻译容器
       ↓
插入翻译结果到 DOM
       ↓
应用主题样式
```

### 4.2 页面自动翻译

```
页面加载完成
       ↓
Content Script 扫描 DOM
       ↓
识别可翻译段落（排除 textarea, input 等）
       ↓
检测段落语言（使用 AI 框架的语言检测）
       ↓
判断是否需要翻译（与目标语言比较）
       ↓
批量发送翻译请求（最多 5 段/请求）
       ↓
渐进式渲染翻译结果
```

---

## 五、关键配置参数汇总

### 5.1 翻译控制参数

| 参数名 | 默认值 | 说明 |
|--------|--------|------|
| `translationService` | `"bing"` | 默认翻译服务 |
| `translationPosition` | `"after"` | 翻译结果位置 (after/before) |
| `translationMode` | `"dual"` | 翻译模式 (dual/translation) |
| `immediateTranslationTextCount` | `4999` | 即时翻译文本数量限制 |
| `immediateTranslationScrollLimitScreens` | `1` | 滚动翻译限制屏幕数 |
| `translationStartMode` | `"dynamic"` | 翻译启动模式 |
| `sameLangCheck` | `true` | 同语言检测 |
| `aiTranslatedCheck` | `true` | AI 翻译检测（避免重复翻译） |

### 5.2 输入框翻译参数

| 参数名 | 默认值 | 说明 |
|--------|--------|------|
| `enableInputTranslation` | `true` | 启用输入框翻译 |
| `inputTranslationMode` | `"translation"` | 输入框翻译模式 |
| `inputStartingTriggerKey` | `"/"` | 输入框触发键 |
| `inputTrailingTriggerKey` | `"space"` | 尾部触发键 |
| `inputTrailingTriggerKeyRepeatTimes` | `3` | 触发键重复次数 |
| `inputTrailingTriggerKeyTimeout` | `300` | 触发键超时 (ms) |

### 5.3 请求限制参数

| 参数名 | 说明 |
|--------|------|
| `limit` | 每秒请求数限制（默认 10） |
| `proLimit` | Pro 服务每秒请求数限制 |
| `requestTimeout` | 请求超时时间（默认 200000ms） |

---

## 六、实现建议

### 6.1 复用现有代码

如果要实现类似的翻译功能，建议：

1. **使用 Content Script** 注入页面
2. **通过 Background Service** 转发 API 请求（避免 CORS 问题）
3. **使用 CSS 变量** 管理主题样式
4. **采用包装器模式** 保持原文和译文的关联

### 6.2 翻译请求优化

1. **文本合并**：多段短文本合并为一个请求，减少 API 调用次数
2. **流式响应**：使用 `stream: true` 提升用户体验
3. **缓存机制**：对相同文本的翻译结果进行缓存

### 6.3 样式保持技巧

1. **不显式设置字体大小**，让翻译容器继承原文样式
2. **使用 `!important`** 确保翻译样式优先级
3. **CSS 变量主题系统** 支持用户自定义

---

## 七、总结

沉浸式翻译插件的核心实现要点：

1. **多段文本处理**：默认合并为一个请求，用分隔符区分段落
2. **请求格式**：使用标准 OpenAI 兼容格式，System Prompt 定义翻译规则
3. **响应解析**：按分隔符拆分多段翻译结果
4. **DOM 插入**：使用包装器模式，支持 before/after 两种位置
5. **样式保持**：通过 CSS 继承机制，翻译结果自动继承原文字体大小
6. **主题系统**：支持 10+ 种预设主题样式

本文档提供了足够的细节，可供其他 AI 根据此文档实现类似的翻译效果。
