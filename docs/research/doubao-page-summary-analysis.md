# 豆包 Chrome 扩展 "总结此页面"功能深度分析

## 一、功能概述

豆包 Chrome 扩展（v1.37.0）的"总结此页面"功能允许用户对当前浏览的网页进行 AI 智能摘要。核心流程为：用户触发摘要 → 提取页面内容 → 发送到豆包后端 AI → 侧边栏流式展示摘要结果。

---

## 二、触发机制（三种方式）

### 1. 悬浮按钮（主要入口）

页面上渲染一个浮动工具栏（floating panel），包含"总结此页面"按钮。

**点击处理流程**：
1. 检查登录状态 → 未登录则弹窗
2. 埋点上报（`button_name: summarizePage`）
3. 调用内容提取函数（Readability 算法）
4. 构建消息对象
5. 隐藏悬浮卡片，打开侧边栏
6. 发送消息到聊天

### 2. 键盘快捷键

- **Mac**: `Option + 2`
- **Windows**: `Alt + 2`

### 3. 右键菜单（Context Menu）

扩展声明了 `contextMenus` 权限，右键菜单也是触发方式之一。

---

## 三、页面内容提取策略

### 核心：Mozilla Readability 库

豆包扩展内置了 Mozilla 的 Readability 库（与 Firefox Reader View 相同的文章正文提取算法）。

**内容提取配置**：
- `charThreshold: 500` — 最少500字符才认为是有效文章
- `keepClasses: false` — 不保留CSS类
- 针对知乎有特殊排除规则（排除广告、推荐卡片等）

**提取流程**：
1. `document.cloneNode(true)` — 克隆整个DOM
2. `new Readability(clone, config).parse()` — 提取正文
3. 返回 `{content, title, byline, excerpt, siteName, ...}`

**Markdown 格式提取**：
对于视频/音频网站，生成结构化 Markdown：
```markdown
# 元信息
- 网页类型: 视频网站 / 音频网站 / 普通网站
- 标题: {document.title}
# 字幕
```subtitles
{字幕内容}
```
# 内容
{Readability提取的HTML转Markdown内容}
```

**回退策略**：如果 Readability 提取失败，使用 `document.body.innerText` 作为纯文本回退。

---

## 四、提示词模板

### 划选文本摘要 prompt

用户选中文本后点击"总结"时使用的 prompt：
```
总结以下内容:
"""
$[text]
"""
```

其他操作 prompt：
| 操作 | Prompt 模板 |
|------|------------|
| 解释 | `解释这段文本: \n"""\n$[text]\n"""` |
| 翻译 | `把下面这段文本翻译成目标语言: $[lang]。需要翻译的内容是: \n"""\n$[text]\n"""` |
| 语法校对 | `校对并纠正这段文字: \n"""\n$[text]\n"""` |
| 改写 | `重新表述这段文字, 使这段文字表述的更加合理: \n"""\n$[text]\n"""` |

### "总结此页面"的特殊处理

**重要发现**："总结此页面"功能**不使用本地 prompt 模板**。而是将页面 URL 作为用户消息文本，页面提取内容通过 `extraExt.browser_explain` 字段以 JSON 形式传递：

```javascript
{
  text: window.location.href,  // 用户可见消息 = 当前URL
  extraExt: {
    origin: location.origin,
    browser_explain: JSON.stringify({
      title: "页面标题",
      url: "https://example.com",
      content: "Readability提取的页面正文内容..."
    }),
    llm_without_mem: "1",           // 不使用记忆
    browser_language: "zh",         // 浏览器UI语言
    flag_browser_plugin: "1",       // 标记来自浏览器插件
    answer_with_suggest: "0",       // 0=悬浮按钮, 1=快捷键
    need_create_thread: "1"         // 是否创建新对话线程
  },
  reportParams: {
    scene: "chat_action_bar",       // 或 "web_tool_box"（快捷键触发）
    web_tool: "AI_SUMMARY"
  }
}
```

后端的豆包 AI 服务根据 `browser_explain` 中的页面内容生成摘要，具体的 system prompt 在服务端控制。

---

## 五、UI 展示方式

- **展示位置**：Chrome Side Panel（侧边栏）
- **渲染方式**：完整的豆包聊天界面
- **用户消息**：显示为页面 URL
- **AI 响应**：流式输出，Markdown 实时渲染

---

## 六、流式输出

### SSE (Server-Sent Events) 实现

1. Background service worker 通过 `fetch` + `ReadableStream.getReader()` 处理 SSE
2. 逐块读取流式响应
3. 通过 Chrome runtime Port 转发给 content script
4. 侧边栏中实时渲染 Markdown 内容

---

## 七、完整数据流图

```
用户操作
  │
  ├─ [方式1] 点击悬浮按钮 "总结此页面"
  │     └─► 检查登录 → 埋点 → 提取内容 → 构建消息 → 打开侧边栏 → 发送
  │
  ├─ [方式2] 快捷键 Option+2 / Alt+2
  │     └─► 检查登录 → 提取内容 → 构建消息(answer_with_suggest:"1") → 打开侧边栏
  │
  └─ [方式3] 右键菜单

消息传递: Content Script → Background Service Worker
  │
  ├─ 解析 extraExt.browser_explain
  ├─ 调用豆包后端 API (SSE)
  └─ SSE chunk → Content Script → 侧边栏渲染
```

---

## 八、对 select-ask 项目的参考意义

1. **内容提取**：应引入 Mozilla Readability 库，而非简单的 `innerText` 或手动 DOM 提取
2. **Prompt 设计**：页面总结功能可将内容通过结构化 JSON 传递，而非拼接 prompt
3. **展示方式**：侧边栏比悬浮窗更适合长内容摘要
4. **流式输出**：SSE 是标准方案，兼容性好
5. **用户体验**：用户消息显示 URL（简洁），实际内容隐藏在扩展字段中
