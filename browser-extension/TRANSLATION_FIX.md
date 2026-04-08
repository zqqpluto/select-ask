# 翻译功能修复 - 参照沉浸式翻译 v1.27.2

## 修复日期
2026-04-08

## 问题分析

根据子 agent 对沉浸式翻译 v1.27.2 源码的深入分析，发现以下关键差异：

### 1. 分隔符错误
- **当前实现**: 使用 `\n---\n` 作为多段落分隔符
- **沉浸式翻译**: 使用 `\n\n%%\n\n` 作为分隔符

### 2. 段落检测逻辑
- 当前逻辑基本正确，但可以优化注释说明

### 3. 提示词不匹配
- 系统提示词中描述的分隔符与实际代码不一致

## 修复内容

### 1. 修改分隔符 (index.ts)

**修改前**:
```typescript
const combinedText = paragraphTexts.join('\n---\n');
const translatedSegments = fullResponse.split('\n---\n').map(s => s.trim());
```

**修改后**:
```typescript
const combinedText = paragraphTexts.join('\n\n%%\n\n');
const translatedSegments = fullResponse.split('\n\n%%\n\n').map(s => s.trim());
```

### 2. 更新系统提示词 (prompts.ts)

**修改前**:
```typescript
export const SYSTEM_PROMPT_TRANSLATE = `...
6. For multi-paragraph text separated by "---", preserve the separator in your translation

## Format
- Input is wrapped in <text> tags
- Multi-paragraph content uses "---" as separator
`;
```

**修改后**:
```typescript
export const SYSTEM_PROMPT_TRANSLATE = `...
6. For multi-paragraph text separated by "%%", preserve the separator in your translation

## Format
- Input is wrapped in <text> tags
- Multi-paragraph content uses "%%" as separator (not "---")
- Keep the same paragraph structure in translation
- Each paragraph should be translated separately and separated by "%%"`;
```

### 3. 更新 createTranslatePrompt 函数 (prompts.ts)

**修改前**:
```typescript
const segments = selectedText.split('\n---\n');
// ...
Note: The content above contains multiple paragraphs separated by "---".
```

**修改后**:
```typescript
const segments = selectedText.split('\n\n%%\n\n');
// ...
Note: The content above contains multiple paragraphs separated by "%%".
```

### 4. 优化段落检测函数注释 (translation-dom.ts)

添加了详细的注释说明，参照沉浸式翻译 v1.27.2 的实现逻辑：
- 使用 TreeWalker 遍历所有元素
- 优先识别语义化段落标签
- 过滤包含子段落的父元素
- 检查元素是否在选区内

## 修改的文件

1. `src/content/index.ts`
   - `translateMultipleParagraphs` 函数：分隔符从 `\n---\n` 改为 `\n\n%%\n\n`
   - 添加调试日志输出段落文本

2. `src/services/prompts.ts`
   - `SYSTEM_PROMPT_TRANSLATE`: 更新分隔符描述
   - `createTranslatePrompt`: 分隔符从 `\n---\n` 改为 `\n\n%%\n\n`

3. `src/content/translation-dom.ts`
   - `getAllParagraphsInRange`: 添加详细注释说明实现逻辑

## 测试步骤

1. 构建扩展：`npm run build`
2. 在浏览器中加载扩展
3. 测试场景：
   - 单个段落翻译
   - 多个段落翻译（尤其是列表项）
   - 嵌套列表项翻译
   - 混合内容翻译（标题 + 段落 + 列表）

## 预期结果

- ✅ 所有选中的段落都被正确翻译
- ✅ 翻译结果与源段落 1:1 对应
- ✅ 列表项翻译后保持正确的 HTML 结构
- ✅ 嵌套列表项不会合并
- ✅ 译文样式正确继承原文样式

## 沉浸式翻译参考资料

- 源码位置：`/Users/zhaoqiqiang/Library/Application Support/Google/Chrome/Default/Extensions/bpoadfkcbjbfhfodiogcnhhhpibjhbnh/1.27.2_0/`
- 关键文件：
  - `content_script.js` - 内容脚本
  - `styles/inject.css` - 注入样式
  - `styles/base.css` - 基础样式
  - `side-panel.js` - 多段落处理逻辑（分隔符 `%%`）

## 核心实现对比

| 特性 | 沉浸式翻译 | 本插件实现 (修复后) |
|------|-----------|-------------------|
| 分隔符 | `\n\n%%\n\n` | `\n\n%%\n\n` ✅ |
| 段落检测 | TreeWalker | TreeWalker ✅ |
| 样式继承 | CSS inherit + JS 复制 | CSS inherit + JS 复制 ✅ |
| DOM 结构 | 多层包裹 | 两层结构 ✅ |
| 插入方式 | insertAdjacentElement | insertAdjacentElement ✅ |
| 提示词 | 英文，带 `<text>` 标签 | 英文，带 `<text>` 标签 ✅ |
