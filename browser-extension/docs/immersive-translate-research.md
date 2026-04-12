# 沉浸式翻译插件 - 全文翻译交互样式分析

> 基于 Immersive Translate v1.27.2 源码分析

## 1. DOM 结构

### 翻译段落的 DOM 层级

```
.immersive-translate-target-wrapper          ← 每个翻译段的包裹层
  .immersive-translate-target-translation-block-wrapper  ← 块级翻译容器
    .immersive-translate-target-translation-theme-${theme}-inner  ← 主题样式（下划线/高亮/模糊等）
      译文内容
```

### 内联翻译的 DOM 层级

```
.immersive-translate-target-translation-inline-wrapper-theme-${theme}  ← 内联翻译包裹
```

## 2. 状态控制 - CSS 属性选择器

| 属性 | 值 | 效果 |
|------|----|------|
| `imt-state` | `dual` | 双语模式：原文 + 译文同时显示 |
| `imt-state` | `translation` | 仅译文模式：原文被隐藏 |
| `imt-trans-position` | `before` | 译文在原文前面（块级布局） |

### 根节点控制

- `[data-immersive-translate-root-translation-theme="mask"]`: 模糊原文
- `[data-immersive-translate-root-translation-theme="opacity"]`: 半透明原文
- `[data-immersive-translate-root-translation-theme="none"]`: 禁用遮罩

## 3. 翻译主题（视觉样式）

通过 `-theme-${name}` 类名切换不同视觉主题：

| 主题 | 效果 |
|------|------|
| `grey` | 灰色文字 |
| `underline` | 实线下划线 |
| `nativeUnderline` | 原生下划线 |
| `nativeDashed` | 原生虚线下划线 |
| `nativeDotted` | 原生点线下划线 |
| `thinDashed` | 自定义虚线下划线 |
| `dotted` | 渐变点线 |
| `wavy` | 波浪线 |
| `dashed` | 渐变虚线 |
| `highlight` | 黄色高亮背景 |
| `marker` | 渐变标记效果 |
| `weakening` | 降低不透明度 |
| `italic` | 斜体 |
| `bold` | 粗体 |
| `mask` | 模糊效果（hover 显示原文） |
| `opacity` | 透明度降低（hover 显示原文） |
| `blockquote` | 左侧色条引用样式 |
| `paper` | 纸张阴影卡片样式 |
| `dividingLine` | 分割线样式 |
| `dashedBorder` | 虚线边框卡片 |
| `solidBorder` | 实线边框卡片 |

## 4. 加载状态设计

### 4.1 段落加载 - 旋转 Spinner

```css
.immersive-translate-loading-spinner {
  width: 10px;
  height: 10px;
  border: 2px rgba(221, 244, 255, 0.6) solid;
  border-top: 2px rgba(0, 0, 0, 0.375) solid;
  border-radius: 50%;
  animation: immersive-translate-loading-animation 0.6s infinite linear;
  vertical-align: middle;
  margin: 0 4px;
}

@keyframes immersive-translate-loading-animation {
  from { transform: rotate(0deg); }
  to { transform: rotate(359deg); }
}
```

暗色模式下：
```css
@media (prefers-color-scheme: dark) {
  .immersive-translate-loading-spinner {
    border: 2px rgba(255, 255, 255, 0.25) solid;
    border-top: 2px rgba(255, 255, 255, 1) solid;
  }
}
```

### 4.2 骨架屏加载（侧边栏）

```css
.skeleton-text-line {
  background-color: #e0e0e0;
  border-radius: 4px;
  height: 1em;
  margin-bottom: 0.75em;
  animation: pulse 1.5s infinite ease-in-out;
}

@keyframes pulse {
  0%, 100% { background-color: #e0e0e0; }
  50% { background-color: #d0d0d0; }
}
```

### 4.3 滚动小圆点加载

```css
.immersive-translate-input-loading {
  --loading-color: #f78fb6;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  animation: immersiveTranslateShadowRolling 1.5s linear infinite;
}
```

## 5. 批量翻译机制

### 分块策略

```javascript
if (text.length > maxChunkSize) {
    // 按 maxChunkSize 分割成多个 chunks
    let chunks = WO(text, maxChunkSize);
    // 每个 chunk 携带上下文
    push({
        text: chunkText,
        prefix: contextBefore,    // 前文上下文
        suffix: contextAfter,     // 后文上下文
        sentenceTotalParts: totalParts,
        partIndex: i,             // 当前是第几块
        xpath: elementXPath,      // DOM 元素 xpath
        url: pageUrl
    });
}
```

关键点：
- **长文本分割**：避免 API 负载限制
- **上下文携带**：每个 chunk 带 prefix/suffix 保持句子连贯性
- **并行翻译 + 顺序重组**：通过 `sentenceTotalParts` + `partIndex` 重组
- **xpath 定位**：精确将译文放回 DOM

## 6. 错误处理

### 错误 Toast

```css
.immersive-translate-error-toast {
  position: fixed;
  top: 5%;
  left: 0; right: 0;
  margin: auto;
  max-width: 300px;
  padding: 16px;
  border-radius: 12px;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 99999999;
}
```

### Toastify 通知

使用 [Toastify JS 1.12.0](https://github.com/apvarun/toastify-js)：
```css
.toastify {
  padding: 12px 20px;
  box-shadow: 0 3px 6px -1px rgba(0, 0, 0, 0.12), 0 10px 36px -4px rgba(77, 96, 232, 0.3);
  background: linear-gradient(135deg, #73a5ff, #5477f5);
  max-width: calc(50% - 20px);
  z-index: 2147483647;
}
```

### 行内错误提示

```css
.immersive-translate-error-wrapper {
  display: inline-flex;
  padding: 6px;
  margin: 0 12px;
  font-size: 0.9em;
}
```

## 7. 悬浮球控制

```css
.imt-fb-container {
  position: fixed;
  top: 335px;
  direction: ltr;
}
.imt-fb-container.left { left: 0; }
.imt-fb-container.right { right: 0; }

.imt-fb-btn {
  cursor: pointer;
  height: 36px;
  box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.08);
}
/* 左侧：右侧圆角 */
.imt-fb-btn.left {
  border-top-right-radius: 36px;
  border-bottom-right-radius: 36px;
}
/* 右侧：左侧圆角 */
.imt-fb-btn.right {
  border-top-left-radius: 36px;
  border-bottom-left-radius: 36px;
}
```

## 8. 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt+W` | 切换全文翻译 |
| `Alt+A` | 切换页面翻译（官方） |
| `Alt+S` | 切换侧边栏 |
| `Alt+I` | 翻译输入框 |

## 9. CSS 架构特点

- **`!important` 广泛使用**：确保翻译样式不被页面样式覆盖
- **CSS Custom Properties**：大量使用 CSS 变量实现运行时主题切换
- **Shadow DOM 隔离**：部分注入组件使用 Shadow DOM 防止 CSS 冲突
- **`translate3d` GPU 加速**：悬浮球动画使用 3D 变换
- **Z-Index 分层**：tooltip(1000亿) > modal/toast(2147483647) > error(99999999)

## 10. 对我们项目的改进建议

### 全文翻译 UI 改进方向

1. **采用沉浸式翻译的 DOM 结构**：每个翻译段落用 `wrapper > block-wrapper > theme-inner` 三层结构
2. **使用 CSS 属性选择器控制模式**：通过 `data-imt-state` 切换双语/仅译文模式
3. **实现翻译主题系统**：支持多种视觉主题（下划线、高亮、模糊等）
4. **改进加载状态**：段落加载中显示旋转 spinner，整体显示进度条
5. **批量分块翻译**：长文本分割，每段携带上下文，并行翻译后重组
6. **错误处理改进**：单个段落失败不影响其他，显示行内重试按钮
7. **性能优化**：使用 `!important` 确保翻译样式不被覆盖，使用 CSS 变量实现主题

### 具体实现计划

- 新增 `translation-themes.css`：定义所有翻译主题的 CSS
- 修改 `translation-fullpage.ts`：采用分块并行翻译 + 顺序重组
- 修改 `translation-style.css`：改进加载状态显示（旋转 spinner）
- 新增主题选择 UI：在悬浮菜单中增加主题切换
