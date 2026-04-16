# 豆包浏览器扩展 - 一键生成脑图功能深度解析

> 基于豆包 Chrome 扩展 v1.37.0 源码逆向分析

## 目录

1. [整体架构](#1-整体架构)
2. [一键生成脑图流程](#2-一键生成脑图流程)
3. [渲染引擎：Markmap](#3-渲染引擎markmap)
4. [数据结构](#4-数据结构)
5. [复制图片功能](#5-复制图片功能)
6. [复制富文本功能](#6-复制富文本功能)
7. [全屏查看功能](#7-全屏查看功能)
8. [节点交互](#8-节点交互)
9. [布局算法](#9-布局算法)
10. [导出功能](#10-导出功能)
11. [文件清单](#11-文件清单)
12. [实现路线图](#12-实现路线图)

---

## 1. 整体架构

豆包扩展的脑图功能建立在以下技术栈之上：

```
Markdown 文本
    ↓ (Transformer 转换)
Tree 数据结构 (nodes + children)
    ↓ (Markmap 渲染)
SVG 矢量图形
    ↓ (d3-flextree 布局 + d3-zoom 交互)
可视化脑图
```

**核心依赖库**：
- **markmap-lib / markmap-view** — SVG 脑图渲染引擎
- **d3-flextree v2.1.2** — 树形布局算法（d3-hierarchy 的变体，支持可变节点尺寸）
- **d3-zoom** — 平移/缩放交互
- **html-to-image** — SVG 转 PNG 转换（用于复制图片）
- **marked** — Markdown 解析

---

## 2. 一键生成脑图流程

### 2.1 触发点

用户触发流程：
1. AI 在聊天中返回 Markdown 格式的回复
2. Markdown 被 `async-markdown-slot-plugin-code-tools.js` 解析
3. 代码块工具栏中出现 **"一键生成脑图"** 按钮
4. 用户点击按钮

### 2.2 懒加载机制

```
用户点击 "一键生成脑图"
    ↓
动态 import('mind-map-lazy.js')    ← 代码分割，按需加载
    ↓
加载 markmap 依赖 (vendors-markmap.js)
    ↓
Markdown → Transformer → Tree → Markmap → SVG
```

- `mind-map-lazy.js` (116KB) 是异步加载的代码块
- `vendors-markmap.js` 包含完整的 markmap + d3 库
- 这种设计确保初次加载时不会增加主包体积

### 2.3 Markdown 转换

```javascript
// Transformer 类 (来自 markmap-lib)
import { Transformer } from 'markmap-lib';

const transformer = new Transformer();
const { root, features } = transformer.transform(markdownString);
```

转换过程：
1. 使用 `marked` 解析 Markdown
2. 自定义插件处理：frontmatter、checkbox、sourceLines、npmUrl
3. 输出嵌套树结构，每个节点包含 `content`（HTML）和 `children`

---

## 3. 渲染引擎：Markmap

### 3.1 技术选型

豆包使用 **markmap** 而非自定义 Canvas 实现：
- 优势：SVG 天然支持文字选择、CSS 样式、DOM 操作
- 劣势：大量节点时性能不如 Canvas

### 3.2 渲染流程

```javascript
import { Markmap } from 'markmap-view';

// 创建实例
const markmap = Markmap.create(svgElement, options, treeData);

// 更新数据
markmap.setData(newTreeData);
markmap.fit(); // 自动适配视口
```

### 3.3 SVG 结构

```xml
<svg class="markmap">
  <g class="markmap-links">
    <path class="markmap-link" d="M..."/>  <!-- 连接线 -->
  </g>
  <g class="markmap-nodes">
    <g class="markmap-node">
      <circle class="markmap-node-circle"/>  <!-- 折叠切换圆点 -->
      <foreignObject class="markmap-foreign">  <!-- HTML 内容容器 -->
        <div>节点文本内容...</div>
      </foreignObject>
    </g>
  </g>
</svg>
```

### 3.4 CSS 类名体系

| 类名 | 作用 |
|------|------|
| `.markmap-node` | 单个节点容器 |
| `.markmap-link` | 父子节点连接线 |
| `.markmap-foreign` | foreignObject 包裹层 |
| `.markmap-node-circle` | 节点圆点（可折叠指示器） |

---

## 4. 数据结构

### 4.1 节点结构

```typescript
interface MindMapNode {
  content: string;              // HTML 内容字符串
  children: MindMapNode[];      // 子节点数组
  state: {
    depth: number;              // 树深度（根=0）
    id: number;                 // 唯一数字 ID
    path: string;               // 点分路径，如 "1.2.3"
    key: string;                // 组合 key：parentId.id + content
    size: [number, number];     // 包围盒尺寸 [width, height]
    x: number;                  // 布局 X 坐标
    y: number;                  // 布局 Y 坐标
    x0: number;                 // 上一帧 X（动画用）
    y0: number;                 // 上一帧 Y（动画用）
    el: DOMElement;             // DOM 引用
  };
  payload: {
    fold: 0 | 1 | 2;           // 0=展开, 1=折叠, 2=不可展开
  };
}
```

### 4.2 连线结构

```typescript
interface MindMapLink {
  source: MindMapNode;  // 父节点
  target: MindMapNode;  // 子节点
}
```

### 4.3 Transformer 输出

```typescript
interface TransformResult {
  root: MindMapNode;           // 树根节点
  content: string;             // 原始 Markdown
  features: Record<string, any>; // 检测到的特性（katex、代码高亮等）
  frontmatter: Record<string, any>; // YAML frontmatter
  contentLineOffset: number;   // 内容行偏移
}
```

---

## 5. 复制图片功能

### 5.1 实现步骤

```
1. 获取 SVG 元素：svgContainerRef.querySelector("svg")
2. 嵌入字体 CSS（确保字体正确渲染）
3. 使用 html-to-image 的 domToPng() 转换 SVG → PNG
4. 以 2x 像素比率输出（高清）
5. 从 PNG base64 创建 Blob
6. 检查剪贴板权限：navigator.permissions.query({name: "clipboard-write"})
7. 写入剪贴板：navigator.clipboard.write([new ClipboardItem({"image/png": blob})])
```

### 5.2 关键代码

```javascript
// 从 html-to-image 库
import { domToPng } from 'html-to-image';

async function copyImage(svgElement) {
  const dataUrl = await domToPng(svgElement, {
    pixelRatio: 2,  // 2x 高清
    style: { /* 嵌入字体等样式 */ }
  });

  // base64 → Blob
  const base64 = dataUrl.replace('data:image/png;base64,', '');
  const blob = new Blob([atob(base64)], { type: 'image/png' });

  // 写入剪贴板
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob })
  ]);
}
```

---

## 6. 复制富文本功能

### 6.1 HTML 格式输出

从 SVG 的 `foreignObject` 中提取节点内容，构建嵌套的 `<ul>/<li>` 结构：

```html
<ul>
  <li data-plain-text="根节点">
    <ul>
      <li data-plain-text="子节点1">
        <ul>
          <li data-plain-text="孙节点1"></li>
        </ul>
      </li>
      <li data-plain-text="子节点2"></li>
    </ul>
  </li>
</ul>
```

### 6.2 纯文本格式

Tab 缩进的层级文本：
```
根节点
	子节点1
		孙节点1
	子节点2
```

### 6.3 实现步骤

```
1. 遍历 SVG 中所有 foreignObject
2. 按 depth 和 data-path 排序
3. 构建 `<ul>/<li>` 嵌套结构
4. 创建隐藏的 contentEditable div
5. 通过 document.execCommand("copy") 复制
6. 同时设置 text/html 和 text/plain 两种 MIME 类型
```

### 6.4 关键代码

```javascript
async function copyRichText(svgElement) {
  // 构建 HTML
  const html = buildNestedList(svgElement);

  // 创建临时元素
  const temp = document.createElement('div');
  temp.contentEditable = 'true';
  temp.innerHTML = html;
  temp.style.position = 'fixed';
  temp.style.left = '-9999px';
  document.body.appendChild(temp);

  // 选中并复制
  const range = document.createRange();
  range.selectNodeContents(temp);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('copy');
  document.body.removeChild(temp);
}
```

---

## 7. 全屏查看功能

### 7.1 实现方式

- 使用 **React Portal** (`ReactDOM.createPortal`) 渲染到 `document.body`
- `position: fixed` 覆盖整个视口（`inset: 0`）
- `z-index: 9999` 确保在最上层

### 7.2 全屏布局结构

```
+-------------------------------------+
|  全屏 Header (48px, 白色, 底部边框)    |
|  [下载图片] [复制图片] [复制HTML]     |
|  [-] [+] [适配] [全屏] [x关闭]       |
+-------------------------------------+
|                                     |
|         脑图内容区                    |
|       (灰色背景 #f9fafb)              |
|         可平移/缩放                   |
|                                     |
+-------------------------------------+
```

### 7.3 关键 CSS 类

```css
.fullscreenRoot-FtITWA { position: fixed; inset: 0; z-index: 9999; }
.container-I2iJh4 { display: flex; flex-direction: column; height: 100%; }
.header-zp16H4 { background: #fff; border-bottom: 1px solid rgba(0,0,0,0.08); height: 48px; }
.diagramContent-GHoVQ4 { background: #f9fafb; flex: 1; min-height: 0; }
```

### 7.4 交互行为

- **Escape 键** 退出全屏
- 进入全屏时设置 `document.body.overflow = 'hidden'`
- 复用相同的 markmap SVG 渲染实例
- Header 提供：下载图片、复制图片、复制 HTML、缩放、适配、关闭

### 7.5 触发方式

在消息流中点击脑图 SVG → 调用 `enterFullscreen()`

---

## 8. 节点交互

### 8.1 支持的操作

| 操作 | 触发方式 | 说明 |
|------|---------|------|
| 折叠/展开 | 点击节点圆点 | 支持 fold: 0/1/2 状态 |
| 递归折叠 | Ctrl/Cmd + 点击 | 展开/折叠所有子节点 |
| 平移 | 鼠标滚轮 / 触摸拖动 | Mac 行为：直接滚轮 = 平移 |
| 缩放 | Ctrl + 滚轮 | 或使用 +/- 按钮 |
| 适配 | 点击适配按钮 | 自动 fit 到视口 |
| 进入全屏 | 点击脑图 SVG | 在消息流中点击触发 |

### 8.2 不支持的操作

- **拖拽节点** — 不支持手动重定位
- **编辑节点文本** — 只读显示
- **删除/添加节点** — 只读显示

### 8.3 折叠状态管理

```javascript
// 折叠
node.payload = { fold: 1 };

// 展开
node.payload = { fold: 0 };  // 或 undefined

// 不可展开（叶子节点或特殊节点）
node.payload = { fold: 2 };
```

---

## 9. 布局算法

### 9.1 引擎：d3-flextree

d3-flextree 是 d3-hierarchy 的变体，支持可变节点尺寸（每个节点的宽高可以不同）。

### 9.2 布局参数

```javascript
const options = {
  autoFit: false,
  color: (node) => colorByDepth(node),   // 按深度动态着色
  duration: 500,         // 动画时长（毫秒）
  embedGlobalCSS: true,
  fitRatio: 0.95,        // 视口适配比例
  maxWidth: 0,           // 节点最大宽度（0=无限制）
  nodeMinHeight: 16,     // 节点最小高度（px）
  paddingX: 8,           // 节点内水平间距
  scrollForPan: true,    // 滚轮 = 平移（Mac 行为）
  spacingHorizontal: 80, // 父子节点水平间距
  spacingVertical: 5,    // 兄弟节点垂直间距
  initialExpandLevel: -1,// -1 = 全部展开
  zoom: true,
  pan: true,
  toggleRecursively: false
};
```

### 9.3 节点尺寸计算

通过隐藏 DOM 渲染并测量：
```javascript
// 将节点 HTML 渲染到不可见元素
// 使用 getBoundingClientRect() 获取实际尺寸
e.state.size = [Math.ceil(width) + 1, Math.max(Math.ceil(height), nodeMinHeight)];
```

### 9.4 自动适配

使用 `ResizeObserver` 监听容器尺寸变化：
```javascript
const observer = new ResizeObserver(
  debounce(() => markmap.fit(), 100)
);
observer.observe(svgContainer);
```

---

## 10. 导出功能

### 10.1 导出方式汇总

| 功能 | 中文标签 | 实现方式 |
|------|---------|---------|
| 下载图片 | 下载图片 | SVG → Canvas → PNG → `<a download>` 点击 |
| 复制图片 | 复制图片 | SVG → Canvas → PNG Blob → `clipboard.write()` |
| 复制富文本 | 复制富文本 | SVG → ul/li HTML → `execCommand("copy")` |

### 10.2 导出 Shadow DOM

豆包使用了一个离屏的隐藏组件用于高质量导出：
- `position: fixed; top: -100vw`（屏幕外渲染）
- 包含脑图 SVG + 品牌 footer
- Footer：134px 高度，豆包 logo + "豆包" 文字
- Logo URL：`https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/flow-ext-doubao/cdn-media-assets/logo-icon-white-bg.24455f48.png`

### 10.3 下载图片实现

```javascript
async function downloadImage(svgElement) {
  const dataUrl = await domToPng(svgElement, { pixelRatio: 2 });

  // 创建下载链接
  const link = document.createElement('a');
  link.download = `mindmap-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}
```

---

## 11. 文件清单

### 11.1 核心文件

| 文件路径 | 作用 | 大小 |
|---------|------|------|
| `static/js/async/mind-map-lazy.js` | **主脑图组件** — React 包装层，包含全屏、复制、下载、缩放 | 116KB |
| `static/js/async/vendors-markmap.js` | **Markmap 库** — SVG 渲染引擎、d3-flextree 布局、Transformer | ~45KB |
| `static/css/async/mind-map-lazy.css` | **脑图样式** — 全屏、操作栏、导出等所有 CSS | 6.3KB |
| `static/js/async/async-markdown-slot-plugin-code-tools.js` | **触发点** — Markdown 代码块工具栏，含"一键生成脑图"按钮 | - |

### 11.2 辅助文件

| 文件路径 | 作用 |
|---------|------|
| `static/js/async/88720.js` | 脑图数据/状态管理 |
| `static/js/async/40620.js` | 脑图集成 hooks |
| `static/js/async/78936.js` | 脑图 UI 组件 |
| `static/js/async/56013.js` | 脑图事件处理 |
| `static/js/async/19241.js` | 脑图渲染辅助 |
| `static/js/async/99933.js` | 脑图视频播放器集成（可能为教程/演示） |

### 11.3 集成入口

| 文件路径 | 作用 |
|---------|------|
| `static/js/content.js` | 内容脚本 — 在网页中注入脑图 UI |
| `static/js/side_panel.js` | 侧边栏 — 侧边栏中的脑图展示 |
| `static/js/background.js` | 后台脚本 — 含脑图相关引用 |
| `configs/content_css_list.json` | CSS 配置 — 列出 mind-map-lazy.css 异步加载 |

---

## 12. 实现路线图

### 12.1 组件层级

```
MindMap (默认导出组件)
  |-- MindMapProvider (React Context)
  |-- mindmapContainer-l0pP8f (包装 div)
  |    |-- [isError] -> ErrorDisplay
  |    |-- [isForbid] -> SafetyNotice
  |    |-- MindMapContent
  |         |-- markmapContent-FD26OW (SVG 容器)
  |         |    |-- svg (markmap 渲染)
  |         |-- MindMapActionBar (操作栏)
  |         |    |-- CopyDropdown (下载/复制图片/复制HTML)
  |         |    |-- Divider
  |         |    |-- 缩小按钮
  |         |    |-- 放大按钮
  |         |    |-- 适配按钮
  |         |    |-- 全屏按钮
  |         |-- MindMapExportShadow (离屏导出容器)
  |         |-- FullscreenMindmap (全屏激活时)
  |              |-- fullscreenRoot-FtITWA (fixed 覆盖层)
  |              |    |-- Header (下载、复制、缩放、关闭)
  |              |    |-- Diagram Content (复用同一 SVG)
```

### 12.2 在我们项目中实现的步骤

如果要在 select-ask 扩展中实现相同功能，需要：

1. **安装依赖**：
   ```bash
   npm install markmap-lib markmap-view html-to-image
   ```

2. **创建脑图组件** (`src/components/mind-map/`)：
   - `MindMap.tsx` — 主组件，接收 markdown 字符串
   - `MindMapActionBar.tsx` — 操作栏（下载/复制/缩放/全屏）
   - `MindMapFullscreen.tsx` — 全屏模式
   - `useMindMapExport.ts` — 导出 hooks（复制图片/富文本）

3. **集成到 AI 回复**：
   - 在 markdown 渲染组件中检测代码块/特定标记
   - 添加"生成脑图"按钮
   - 点击后懒加载脑图组件

4. **异步加载**：
   - 使用 `import()` 动态导入 markmap 相关代码
   - 避免主包体积膨胀

5. **样式**：
   - 创建独立的 `mind-map.css`
   - 使用 markmap 自带 CSS + 自定义主题

### 12.3 关键 API 摘要

| 操作 | 关键 API |
|------|---------|
| Markdown → Tree | `Transformer.transform(markdown)` |
| Tree → SVG | `Markmap.create(svgEl, options, treeData)` |
| SVG → PNG | `domToPng(svgElement, { pixelRatio: 2 })` |
| PNG → 剪贴板 | `navigator.clipboard.write([new ClipboardItem({...})])` |
| HTML → 剪贴板 | `document.execCommand("copy")` |
| 平移/缩放 | `d3-zoom` |
| 布局 | `d3-flextree` |
| 全屏 | `ReactDOM.createPortal()` |
| 自动适配 | `ResizeObserver` + `markmap.fit()` |
