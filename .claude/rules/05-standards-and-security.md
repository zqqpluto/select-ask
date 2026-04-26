# 技术细节与安全规则

## Vite 构建配置

- 使用 `@crxjs/vite-plugin` 处理 Chrome 扩展
- 开发服务器：端口 5173，HMR：端口 5174
- 类型：module（全面 ESM）

## API 密钥安全（最高优先级）

- **永远不要以明文形式记录或暴露 API 密钥**
- 存储前始终使用 `src/services/llm/crypto.ts` 中的 `encryptApiKey()`
- 仅在发起 API 调用时解密

## 国际化

- manifest.json 中使用 `__MSG_*__` 格式
- `_locales/` 支持：`en`、`zh_CN`
- 自动跟随浏览器语言设置

## LLM 响应处理

- 所有提供商通过异步生成器支持流式传输
- 响应使用 `marked` 库渲染 markdown
- 错误处理：优雅降级，用户友好的错误消息

## Chrome 扩展权限

- `storage`, `scripting`, `sidePanel`, `tabs`
- LLM API 域名白名单 + `<all_urls>`

## 代码规范

- TypeScript 严格模式，interface 定义对象，避免 `any`
- React hooks 函数式组件，PascalCase 命名
- TailwindCSS + 自定义 `.css`
- 文件命名：组件 `PascalCase.tsx`，TS `camelCase.ts`，CSS `kebab-case.css`，测试 `*.spec.ts`

## 提交规范

Conventional Commits: `<type>(<scope>): <subject>`

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `docs` | 文档更新 |
| `style` | 代码格式 |
| `refactor` | 代码重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建流程 |

## 项目规则

- **内容脚本无法访问 `chrome.*` API** — 必须通过消息传递到后台脚本
- **永远不要对未消毒的内容使用 `eval()` 或 `innerHTML`** — XSS 是关键安全问题
- **Service Worker 生命周期** — 不要依赖事件之间的全局状态持久性
- **测试前先构建** — 测试需要 `dist/` 目录存在

## 数据流

```
用户选中文本 → 悬浮图标出现 → 用户点击 → 二级菜单 → 选择操作
→ 收集上下文 → LLM_STREAM_START → LLM 流式响应 → 渲染 markdown
→ 多轮对话 → 保存到 chrome.storage.local
```

## 性能考虑

- 上下文收集限制文本长度
- 流式响应即时反馈
- 历史记录保留 7 天
- API 调用支持 abort controller
