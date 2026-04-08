# 翻译功能改进总结

## 改进概述

本次改进参照沉浸式翻译 v1.27.2 的实现方式，对插件的翻译功能进行了全面优化。

**改进日期**: 2026-04-07 (初次改进), 2026-04-08 (简化 DOM 结构)

---

## 详细改进内容

### 1. 简化 DOM 结构 (2026-04-08)

**核心改变**: 从三层结构简化为两层结构，参照沉浸式翻译 v1.27.2 的实现

**改进前 (三层结构)**:
```typescript
// wrapper 层（布局控制）
const wrapper = document.createElement('div');
wrapper.className = `select-ask-translation-wrapper ${isInline ? 'inline' : 'block'}`;

// translation 层（译文容器）
const translationEl = document.createElement('div');
translationEl.id = id;
translationEl.className = `select-ask-translation ${isInline ? 'inline' : 'block'}`;

// content 层（内容容器）
const contentWrapper = document.createElement('div');
contentWrapper.className = 'select-ask-translation-content-wrapper';
```

**改进后 (两层结构)**:
```typescript
// translation 层（同时作为 wrapper）
const translationEl = document.createElement('div');
translationEl.id = id;
translationEl.className = `select-ask-translation ${isInline ? 'inline' : 'block'} notranslate`;

// content 层（内容容器）
const contentWrapper = document.createElement('div');
contentWrapper.className = 'select-ask-translation-content-wrapper';
```

**改进点**:
- ✅ 移除不必要的 wrapper 层，简化 DOM 结构
- ✅ 添加 `notranslate` 类防止浏览器自动翻译
- ✅ 使用 `insertAdjacentElement('afterend')` 插入译文（参照沉浸式翻译）
- ✅ 样式继承通过 JS 显式复制（因为兄弟元素无法 CSS inherit）

---

### 2. 优化翻译插入方式 (2026-04-08)

**改进前**:
```typescript
// 使用 insertBefore 或 appendChild 插入
if (paragraph.nextSibling) {
  paragraph.parentNode?.insertBefore(wrapper, paragraph.nextSibling);
} else {
  paragraph.parentNode?.appendChild(wrapper);
}
```

**改进后**:
```typescript
// 使用 insertAdjacentElement + "afterend" 插入（参照沉浸式翻译）
if (parentTag === 'UL' || parentTag === 'OL') {
  // 特殊处理：li 元素内插入
  paragraph.appendChild(translationEl);
} else {
  // 普通元素：使用 afterend 位置
  paragraph.insertAdjacentElement('afterend', translationEl);
}
```

**改进点**:
- ✅ 统一使用 `insertAdjacentElement('afterend')` 插入译文
- ✅ 保持 HTML 结构合法性（ul/ol 内只能直接包含 li）
- ✅ 简化插入逻辑，减少边界情况

---

### 3. 优化 CSS 样式 (2026-04-08)

**改进前**:
```css
/* 三层结构的样式 */
.select-ask-translation-wrapper.block { ... }
.select-ask-translation-wrapper.inline { ... }
.select-ask-translation.block { ... }
.select-ask-translation.inline { ... }
```

**改进后**:
```css
/* 两层结构的样式 */
.select-ask-translation.block {
  display: inline-block;
  margin: 8px 0 0 0;
  padding: 0;
  background: transparent;
  border: none;
  /* 字体样式通过 JS 显式复制 */
}

.select-ask-translation.inline {
  display: inline-block;
  margin: 0 0 0 6px;
  padding: 0;
  background: transparent;
  border: none;
  /* 字体样式通过 JS 显式复制 */
}
```

**改进点**:
- ✅ 移除 wrapper 层样式
- ✅ 保持透明背景和无边框（由主题层控制）
- ✅ 保留淡入动画效果
- ✅ 简化样式层级

---### 2. 改进 DOM 结构 (translation-dom.ts)

**改进前**: 双层结构（wrapper + translation）

**改进后**: 三层结构（wrapper + theme 容器 + 内容容器）

```typescript
// 第一层：wrapper 容器（用于布局和状态管理）
const wrapper = document.createElement('div');
wrapper.className = `select-ask-translation-wrapper ${isInline ? 'inline' : 'block'}`;

// 第二层：译文内容容器
const translationEl = document.createElement('div');
translationEl.id = id;
translationEl.className = `select-ask-translation ${isInline ? 'inline' : 'block'}`;

// 第三层：内容包装器（用于样式继承）
const contentWrapper = document.createElement('div');
contentWrapper.className = 'select-ask-translation-content-wrapper';

// 译文内容容器
const contentEl = document.createElement('span');
contentEl.className = 'select-ask-translation-content';
```

**改进点**:
- ✅ 采用沉浸式翻译的三层嵌套结构
- ✅ 支持主题样式系统（dividing-line, solid-border, dashed-border 等）
- ✅ 更灵活的样式控制
- ✅ 内容层通过 CSS `inherit` 自动继承原文字体样式

### 3. 优化样式系统 (translation-style.css)

**改进点**:
- ✅ 使用 CSS `inherit` 让译文自动继承原文字体大小
- ✅ 不显式设置字体大小，避免样式冲突
- ✅ 添加主题样式系统支持
- ✅ 添加多种主题样式：
  - `dividing-line` - 虚线分隔（默认）
  - `solid-border` - 实线边框
  - `dashed-border` - 虚线边框
  - `underline` - 下划线
  - `blockquote` - 引用块

**关键样式**:
```css
/* 块级模式译文内容继承样式 */
.select-ask-translation.block .select-ask-translation-content {
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  white-space: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  text-align: inherit;
}

/* 使用 box-decoration-break 确保多行文本样式连续性 */
.select-ask-translation-content {
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
```

### 4. 优化语言映射

**改进点**:
- ✅ 使用英文语言名（与英文 system prompt 一致）
- ✅ 支持更多语言
- ✅ 使用正则全局替换 `{{to}}`、`{{from}}` 变量

### 5. 多段落翻译优化

**改进点**:
- ✅ 多段落合并为一个翻译请求
- ✅ 使用 `---` 分隔符分隔段落
- ✅ 翻译完成后按分隔符拆分结果
- ✅ 每段译文独立管理，支持单独关闭

---

## 修改的文件

1. `src/services/prompts.ts` - 翻译提示词优化
2. `src/content/translation-dom.ts` - DOM 结构调整为三层
3. `src/content/translation-style.css` - 样式系统优化
4. `src/content/index.ts` - 适配新的 API

---

## 构建状态

✅ 已验证（2026-04-07）

**构建命令**: `npm run build`
**构建结果**: 成功
**CSS 注入方式**: 内联样式，通过 `translation-style.css?inline` 导入，在 `injectStyles()` 函数中动态插入到页面

**验证步骤**:
1. 在浏览器中加载扩展（`chrome://extensions/` → "加载已解压的扩展程序" → 选择 `browser-extension/` 目录）
2. 打开任意英文网页（如 Wikipedia、MDN 等）
3. 选中一段文本，点击翻译按钮
4. 验证译文：
   - ✅ 无额外背景框（透明背景）
   - ✅ 无边框（除非应用主题样式）
   - ✅ 字体样式与原文一致（大小、粗细、颜色等）
   - ✅ 块级译文显示在原文下方
   - ✅ 行内译文显示在原文后面

---

## 后续优化建议

1. **主题切换功能**: 在设置页面添加主题样式选择器
2. **翻译位置配置**: 支持配置译文显示在原文前/后
3. **术语保护**: 添加术语表功能，保护专有名词不被翻译
4. **上下文摘要**: 添加页面摘要功能，提升翻译准确性
5. **翻译历史**: 记录翻译历史，支持快速复用

---

## 沉浸式翻译参考资料

- 源码位置：`/Users/zhaoqiqiang/Library/Application Support/Google/Chrome/Default/Extensions/bpoadfkcbjbfhfodiogcnhhhpibjhbnh/1.27.2_0/`
- 关键文件：
  - `content_script.js` - 内容脚本（翻译逻辑）
  - `styles/inject.css` - 注入样式
  - `default_config.content.json` - 默认配置

## 核心实现对比

| 特性 | 沉浸式翻译 | 本插件实现 |
|------|-----------|-----------|
| DOM 结构 | 三层 (wrapper → theme → content) | 三层 (已对齐) |
| 样式继承 | CSS `inherit` | CSS `inherit` (已对齐) |
| 主题系统 | 支持 5+ 种主题 | 支持 5 种主题 (已对齐) |
| 提示词 | 英文，带 `<text>` 标签 | 英文，带 `<text>` 标签 (已对齐) |
| 多段翻译 | 分隔符 `---` | 分隔符 `---` (已对齐) |
| 行内/块级判断 | 动态计算 | 动态计算 (已对齐) |
