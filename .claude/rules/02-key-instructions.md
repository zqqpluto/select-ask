# 关键指令

## UI/CSS 修改
- 做 CSS/UI 修改时，做**最小的针对性修改**。避免连续修改多个无关 CSS 选择器（如 #root、.side-panel-container、.side-panel-content、.side-panel-input）。修改前与用户确认范围。
- 不要为了解答"图标多大"这类问题而跨文件修改代码——直接回答即可。

## Bug 修复验证
- 修复 bug 后，**始终验证修复是否生效**再标记完成。对 CSS 修复，检查视觉结果是否与用户描述匹配（不只是改大小，还要确认图标不再显示为黑色色块等）。
- 脑图/内联渲染修复：确认 AI 回复后实际渲染出脑图，而非仅显示文字。

## 代码提交
- 每次完整的修改完成后，**及时提交代码**。不要积累多个不相关的改动。
- 提交信息遵循 Conventional Commits 格式，描述清晰反映变更内容。

## 关键文件速查
- `src/side-panel/App.tsx`（侧边栏 UI）
- `src/options/App.tsx`（选项页）
- `src/popup/App.tsx`（弹出页）
- `src/content/floating-icon.ts`（悬浮图标）
- `src/content/mindmap.ts`（脑图）
- `src/content/floating-window.ts`（悬浮翻译窗）
- `manifest.json`（扩展权限/配置）
- 遇到权限/插件冲突时优先检查 `manifest.json`
