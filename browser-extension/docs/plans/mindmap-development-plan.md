# 脑图功能开发方案

> 基于豆包脑图研究文档 (`docs/doubao-mindmap-analysis.md`) 与本项目代码结构制定

---

## 一、技术选型

| 依赖 | 用途 |
|------|------|
| `markmap-lib` | Markdown → Tree 转换 |
| `markmap-view` | Tree → SVG 渲染 |
| `html-to-image` | SVG → PNG 导出 |

安装命令：
```bash
cd browser-extension
npm install markmap-lib markmap-view html-to-image
```

**注意**：markmap-lib 和 markmap-view 必须使用相同主版本。

---

## 二、新建文件清单

```
src/components/mind-map/
├── index.ts                 # 统一导出 + 懒加载包装
├── MindMap.tsx              # 主组件：接收 markdown → 渲染 SVG 脑图
├── MindMapToolbar.tsx       # 操作栏：导出下拉/缩放/全屏
├── MindMapFullscreen.tsx    # 全屏模式（React Portal + fixed overlay）
├── useMindMapExport.ts      # 导出 hooks（下载图片/复制图片/复制富文本）
├── mindmap-utils.ts         # 工具函数：Markdown 转换、脑图结构检测
└── mind-map.css             # 脑图样式

src/content/
├── mindmap.ts               # 纯 TS 脑图模块（content script 用）
└── mindmap-style.css        # content script 注入样式（与 mind-map.css 内容一致）
```

## 三、修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `package.json` | 新增 3 个依赖 |
| `vite.config.ts` | 添加 manualChunks 将 markmap 分离为独立 chunk |
| `src/side-panel/App.tsx` | AI 回复区域添加"生成脑图"按钮 + 渲染 LazyMindMap |
| `src/content/index.ts` | AI 回复完成后添加脑图按钮入口 |
| `src/content/index.ts` | injectStyles() 追加 mindmap-style.css |

---

## 四、实施步骤

### Phase 1: 安装依赖 + Vite 配置

**1.1 安装包**

**1.2 修改 vite.config.ts**

在 rollupOptions.output 中添加：
```typescript
manualChunks: {
  markmap: ['markmap-lib', 'markmap-view'],
}
```
这确保 markmap + d3 依赖（约 200KB）被分割为独立 chunk，不影响首次加载。

### Phase 2: 核心工具函数

**创建 `src/components/mind-map/mindmap-utils.ts`**

核心内容：
- `shouldShowMindMapButton(markdown: string): boolean` — 检测 markdown 是否包含层级结构（`^#{2,}\s` 或 `^[\s]*[-*]\s` 或 `^[\s]*\d+\.\s`），且长度 > 20 字符
- `transformMarkdown(markdown: string)` — 调用 `new Transformer().transform(markdown)` 输出 tree
- `defaultMarkmapOptions` — 布局参数对象：
  ```typescript
  {
    autoFit: false, duration: 500, embedGlobalCSS: true,
    fitRatio: 0.95, maxWidth: 400, nodeMinHeight: 16,
    paddingX: 8, scrollForPan: true,
    spacingHorizontal: 80, spacingVertical: 5,
    initialExpandLevel: -1, zoom: true, pan: true,
    toggleRecursively: false,
  }
  ```

### Phase 3: 核心组件 MindMap.tsx

**职责**：
- 接收 `markdown` prop
- 调用 `transformMarkdown` 转为 tree
- 使用 `Markmap.create(svgEl, options, treeData)` 渲染
- `useRef` 管理 SVG 容器 + markmap 实例
- `ResizeObserver` 监听容器尺寸变化，自动 `markmap.fit()`
- Loading 状态 + Error 状态

**关键代码流程**：
```
mount/markdown change → transformMarkdown(markdown)
  → 检查 root.children 是否有效
  → 清理旧 SVG 内容
  → Markmap.create(svgRef, options, root)
  → requestAnimationFrame(() => mm.fit())
  → 设置 isLoading = false
```

### Phase 4: 导出功能（useMindMapExport.ts）

三个导出函数：

**下载图片** — `domToPng(svgEl, { pixelRatio: 2 })` → 创建 `<a download>` → 触发点击

**复制图片** — `domToPng` → PNG Blob → `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])`

**复制富文本** — 遍历 SVG 中所有 `.markmap-foreign` 元素 → 按 `data-depth` 和 `data-path` 排序 → 递归构建 `<ul>/<li>` 嵌套 HTML → 创建隐藏 contentEditable div → 同时设置 `text/html` 和 `text/plain` 两种 MIME 类型写入剪贴板

### Phase 5: 工具栏 + 全屏

**MindMapToolbar.tsx**：
- 导出下拉菜单（下载图片/复制图片/复制富文本）
- 缩小/放大按钮（`markmap.rescale(0.8)` / `markmap.rescale(1.25)`）
- 适配按钮（`markmap.fit()`）
- 全屏按钮（触发 `onEnterFullscreen` 回调）

**MindMapFullscreen.tsx**：
- `createPortal` 渲染到 `document.body`
- `position: fixed; inset: 0; z-index: 99999`
- 灰色背景 `#f9fafb`
- Header：标题 + 下载/复制图片/复制文本/缩放/适配/关闭
- 克隆 SVG 节点到全屏容器
- `Escape` 键退出 + `document.body.style.overflow` 管理

### Phase 6: 懒加载包装

**创建 `src/components/mind-map/index.ts`**：
```typescript
const MindMapLazy = lazy(() => import('./MindMap'));

export function LazyMindMap(props) {
  return <Suspense fallback={<Loading />}><MindMapLazy {...props} /></Suspense>;
}
```

Vite 自动将 markmap 相关依赖分割为独立 chunk，React.lazy 触发异步加载。

### Phase 7: 集成到侧边栏（React）

**修改 `src/side-panel/App.tsx`**：

1. 添加导入：`import { LazyMindMap, shouldShowMindMapButton } from '../components/mind-map'`
2. 添加状态：`const [expandedMindMaps, setExpandedMindMaps] = useState<Set<number>>(new Set())`
3. 在 AI assistant 消息渲染区域（messages.map 循环内），在操作按钮下方添加：
```tsx
{(msg.duration || msg.isStopped) && shouldShowMindMapButton(msg.content) && (
  <>
    <button onClick={() => toggleMindMap(index)}>
      {expandedMindMaps.has(index) ? '收起脑图' : '生成脑图'}
    </button>
    {expandedMindMaps.has(index) && <LazyMindMap markdown={msg.content} />}
  </>
)}
```
4. 在 `src/side-panel/index.css` 追加脑图触发按钮样式

### Phase 8: 集成到 Content Script（纯 TS）

**创建 `src/content/mindmap.ts`**：
- 使用 Vite `import('markmap-view')` 动态导入（自动分 chunk）
- 提供 `addMindMapButton(messageElement, markdownContent)` 函数
- 在 AI 回复完成后，在操作按钮区域追加"生成脑图"按钮
- 点击按钮后动态创建 SVG 容器 + 渲染脑图 + 工具栏

**修改 `src/content/index.ts`**：
- 导入 `addMindMapButton`
- 在 `addActionButtonsToAnswer` 函数末尾调用
- `injectStyles()` 追加 mindmap-style.css 内容

### Phase 9: 样式

`mind-map.css` 包含：
- 脑图容器（圆角、边框、背景色、最大高度 400px）
- 工具栏（右下角绝对定位、毛玻璃效果）
- 导出下拉菜单
- Loading/Error 状态
- 全屏覆盖层（Header + Content 布局）
- Markmap 字体覆盖（中文字体支持）

---

## 五、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 触发方式 | 手动按钮 | 不是所有 AI 回复都适合脑图 |
| 数据来源 | AI 回复原始 markdown | 不需要额外请求 |
| 加载策略 | 懒加载（dynamic import） | markmap 库体积 ~200KB，避免影响主包 |
| 节点编辑 | 只读 | 豆包也是只读 |
| 折叠状态 | 默认全部展开 | 用户可自行折叠 |
| 按钮位置 | 每条 AI 回复下方 | 贴近内容，直观 |

---

## 六、验证清单

- [ ] `npm run build` 成功，markmap 独立 chunk
- [ ] 侧边栏：AI 返回列表/层级结构消息 → 显示"生成脑图"按钮
- [ ] 点击按钮 → 脑图 SVG 正确渲染
- [ ] 折叠/展开节点
- [ ] 滚轮平移、Ctrl+滚轮缩放
- [ ] 下载图片 → PNG 文件
- [ ] 复制图片 → 粘贴到微信/文档正确
- [ ] 复制富文本 → 粘贴到 Word/Notion 为嵌套列表
- [ ] 全屏模式 → Escape 退出
- [ ] 首次点击 → Network 面板看到 markmap chunk 异步加载
- [ ] 悬浮窗口（content script）同样可用
- [ ] 历史记录页面同样可用

---

## 七、风险提示

- **库体积**：markmap-lib + markmap-view + d3 约 200-300KB（gzip 后 80-100KB），通过懒加载不影响首次加载
- **SVG 性能**：>500 节点可能卡顿，但一般 AI 回复不会超过此量级
- **剪贴板权限**：按钮点击即满足用户手势要求
- **字体渲染**：导出 PNG 时需确保中文字体嵌入
