# 代码地图

> 快速定位文件，按功能分组。所有路径相对 `src/`。

## 入口文件
| 文件 | 用途 |
|---|---|
| `content/index.ts` | 内容脚本主入口 |
| `background/index.ts` | Service Worker |
| `side-panel/main.tsx` | 侧边栏入口 |
| `options/main.tsx` | 选项页入口 |
| `popup/main.tsx` | 弹出页入口 |

## 页面应用
| 文件 | 改动场景 |
|---|---|
| `side-panel/App.tsx` | 侧边栏聊天 UI、模型选择器、脑图 |
| `options/App.tsx` | 模型管理/历史记录/翻译设置/显示模式 |
| `popup/App.tsx` | 快速模型选择、站点开关 |

## 内容脚本 UI 组件
| 文件 | 改动场景 |
|---|---|
| `content/floating-icon.ts` | 悬浮图标入口、事件绑定 |
| `content/floating-window.ts` | 悬浮翻译窗口、双面板 |
| `content/mindmap.ts` | 页面内脑图渲染 |
| `content/components/action-buttons.ts` | 操作按钮 |
| `content/components/chat-box.ts` | 聊天窗口、拖拽、模式切换 |
| `content/components/fullscreen-mode.ts` | 全屏模式、历史面板 |
| `content/components/icon-menu.ts` | 图标菜单 DOM |
| `content/components/model-selector.ts` | 模型选择下拉框 |
| `content/components/sidebar.ts` | 侧边栏 DOM |
| `content/components/translation-ui.ts` | 翻译窗口 UI |

## 内容脚本 Handlers
| 文件 | 改动场景 |
|---|---|
| `content/handlers/menu-handler.ts` | 菜单点击处理 |
| `content/handlers/mindmap-handler.ts` | 脑图生成 |
| `content/handlers/summary-handler.ts` | 页面摘要 |

## 内容脚本工具
| 文件 | 改动场景 |
|---|---|
| `content/utils/dom-utils.ts` | 选择/定位/图标移除 |
| `content/utils/helpers.ts` | 通用 DOM 工具 |
| `content/utils/layout.ts` | UI 定位计算 |
| `content/utils/response-cache.ts` | 响应缓存 |
| `content/utils/selection.ts` | 文本选中检测 |
| `content/utils/session-manager.ts` | 会话管理、菜单分发 |
| `content/utils/floating-position.ts` | 悬浮窗口位置 |
| `content/utils/svg-helpers.ts` | SVG 创建 |

## 翻译系统
| 文件 | 改动场景 |
|---|---|
| `content/translation/dom.ts` | 翻译 DOM |
| `content/translation/fullpage.ts` | 整页翻译 |
| `content/translation/interaction.ts` | 翻译交互 |
| `content/translation/manager.ts` | 翻译管理 |

## LLM 服务
| 文件 | 改动场景 |
|---|---|
| `services/llm/base.ts` | 抽象基类 |
| `services/llm/factory.ts` | 提供商工厂 |
| `services/llm/crypto.ts` | 密钥加密 |
| `services/llm/providers/` | OpenAI, Claude, DeepSeek, Qwen, GLM, OpenAI 兼容 |
| `services/content-llm.ts` | 内容脚本 LLM 调用 |
| `services/prompts.ts` | AI 提示词模板 |

## 状态与存储
| 文件 | 改动场景 |
|---|---|
| `store/index.ts` | Zustand |
| `utils/storage.ts` | Chrome storage |
| `utils/config-manager.ts` | 配置管理 |
| `utils/history-manager.ts` | 历史记录 |

## 共享组件
| 文件 | 改动场景 |
|---|---|
| `components/ChatMessage/ChatMessage.tsx` | 聊天消息 |
| `components/IconMenu/IconMenu.tsx` | 图标菜单 |
| `components/MindMap/` | 脑图组件族 |

## Hooks
| 文件 | 用途 |
|---|---|
| `hooks/useClickOutside.ts` | 点击外部关闭 |
| `hooks/useI18n.tsx` | 国际化 |

## 工具函数
| 文件 | 改动场景 |
|---|---|
| `utils/context.ts` | 上下文提取 |
| `utils/content-extractor.ts` | 页面内容提取 |
| `utils/markdown.ts` | Markdown 渲染 |
| `utils/shared.ts` | 共享工具 |
| `utils/i18n.ts` | 国际化文本 |

## 类型定义
| 文件 | 内容 |
|---|---|
| `types/messages.ts` | Chrome 消息 |
| `types/store.ts` | Zustand Store |
| `types/llm.ts` | LLM |
| `types/message.ts` | 消息/对话 |
| `types/history.ts` | 历史 |
| `types/config.ts` | 配置 |
| `types/api.ts` | API |
| `types/selection.ts` | 选中文字 |

## 配置文件
| 文件 | 改动场景 |
|---|---|
| `manifest.json` | 扩展权限 |
| `vite.config.ts` | Vite |
| `tailwind.config.js` | TailwindCSS |
