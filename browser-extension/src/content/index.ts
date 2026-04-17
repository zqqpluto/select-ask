import { getContextData } from '../utils/context';
import { isValidSelection, getSelectionPosition, removeIconMenus } from './utils';
import { streamExplain, streamTranslate, streamQuestion, streamSearch } from '../services/content-llm';
import {
  addSession,
  updateSession,
  updateSession,
  generateSessionId,
  generateTitle,
  getHistory,
} from '../utils/history-manager';
import { getSelectedChatModel, getAppConfig, saveAppConfig, setSelectedChatModel, getSelectedChatModels, getDisplayMode, setDisplayMode, getTranslationMode } from '../utils/config-manager';
import { extractMainContent, truncateContent, generateSummaryPrompt } from '../utils/content-extractor';
import type { HistorySession, HistoryMessage } from '../types/history';
import type { ProviderType } from '../types/llm';
import type { ModelConfig, DisplayMode } from '../types/config';
import { marked } from 'marked';

// 样式
import styleContent from './style.css?inline';
import chatStyleContent from './chat-style.css?inline';
import translationStyleContent from './translation-style.css?inline';
import mindmapStyleContent from './mindmap-style.css?inline';
import { addMindMapButton } from './mindmap';

/**
 * 注入样式到页面（作为 manifest.json CSS 注入的备用方案）
 * 这确保在 Playwright 测试等环境中样式也能正确加载
 */
function injectStyles(): void {
  // 检查是否已经注入过样式
  if (document.querySelector('#select-ask-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'select-ask-styles';
  style.textContent = styleContent + '\n' + chatStyleContent + '\n' + translationStyleContent + '\n' + mindmapStyleContent;

  // 尝试插入到 head 中，如果 head 不存在则插入到 body
  const target = document.head || document.body || document.documentElement;
  target.appendChild(style);
}

// 立即注入样式
if (typeof document !== 'undefined') {
  // 对于静态页面，立即注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => injectStyles());
  } else {
    injectStyles();
  }
}

// 当前会话 ID（用于保存历史记录）
let currentSessionId: string | null = null;
let currentSessionType: 'explain' | 'translate' | 'question' | 'search' | 'summarize' | 'custom' = 'explain';
let currentSelectedText: string = '';
let currentSessionMessages: HistoryMessage[] = [];
let currentSessionSaved = false; // 标记会话是否已保存到历史记录

// 全屏状态
let isFullscreen: boolean = false;

// 当前功能开关状态获取器

// 工具函数
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 显示 Toast 提示
 */
function showToast(message: string, type: 'success' | 'info' = 'success'): void {
  // 移除已有的 toast
  const existingToast = document.querySelector('.select-ask-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `select-ask-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // 2秒后自动消失
  setTimeout(() => {
    toast.remove();
  }, 2000);
}

/**
 * 获取模型名称显示
 */
function getProviderDisplayName(provider: ProviderType): string {
  const names: Record<ProviderType, string> = {
    'openai': 'OpenAI',
    'anthropic': 'Claude',
    'deepseek': 'DeepSeek',
    'qwen': '通义千问',
    'glm': '智谱GLM',
    'openai-compat': 'LLM',
  };
  return names[provider] || 'LLM';
}

/**
 * 打开侧边栏时调整页面布局
 */
function openSidebarLayout(): void {
  const sidebarWidth = 420;
  document.body.style.marginRight = `${sidebarWidth}px`;
  document.body.style.transition = 'margin-right 0.25s ease-out';
  document.body.style.width = `calc(100% - ${sidebarWidth}px)`;
}

/**
 * 关闭侧边栏时恢复页面布局
 */
function closeSidebarLayout(): void {
  document.body.style.marginRight = '0';
  document.body.style.width = '100%';
}

/**
 * 创建 AI 头像元素 - 使用项目logo
 */
function createAIAvatar(): HTMLElement {
  const avatar = document.createElement('div');
  avatar.className = 'select-ask-message-avatar select-ask-avatar-ai';
  const iconUrl = chrome.runtime.getURL('public/icons/icon48.png');
  avatar.innerHTML = `<img src="${iconUrl}" alt="AI" />`;
  return avatar;
}

/**
 * 获取当前模型名称
 */
async function getCurrentModelName(): Promise<string> {
  try {
    const model = await getSelectedChatModel();
    if (model) {
      return getProviderDisplayName(model.provider);
    }
  } catch (e) {
    // 忽略错误
  }
  return 'AI';
}

/**
 * 格式化时间 - 包含年月日时分秒
 */
function formatTime(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 创建用户头像元素
 */
function createUserAvatar(): HTMLElement {
  const avatar = document.createElement('div');
  avatar.className = 'select-ask-message-avatar select-ask-avatar-user';
  // 用户头像使用简单的人物图标
  avatar.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>`;
  return avatar;
}

/**
 * 检查模型是否支持深度思考（系统自动判断）
 * 注意：现在不再依赖此函数来决定是否显示思考区域，而是动态显示
 */
function modelSupportsReasoning(model: ModelConfig | null): boolean {
  if (!model) return false;

  // DeepSeek Reasoner
  if (model.provider === 'deepseek' && model.modelId === 'deepseek-reasoner') {
    return true;
  }

  // Anthropic Claude (所有模型支持 extended thinking)
  if (model.provider === 'anthropic') {
    return true;
  }

  // OpenAI o1/o3 系列推理模型
  if (model.provider === 'openai' && /^o[13]-/.test(model.modelId)) {
    return true;
  }

  // 通义千问 qwen3-max, qwen3.5-max 等深度思考模型
  // qwen3 和 qwen3.5 系列都支持深度思考
  if (model.provider === 'qwen' && /qwen\d+(-max|-\d+)?/i.test(model.modelId)) {
    return true;
  }

  // 其他模型，根据 modelId 判断
  if (/reasoner|deepthink|thinking|o1-|o3-/i.test(model.modelId)) {
    return true;
  }

  return false;
}

/**
 * 创建模型选择器
 */
async function createModelSelector(): Promise<HTMLElement> {
  const wrapper = document.createElement('div');
  wrapper.className = 'select-ask-model-selector-wrapper';

  const selector = document.createElement('select');
  selector.className = 'select-ask-model-selector';

  const arrow = document.createElement('span');
  arrow.className = 'select-ask-model-selector-arrow';
  arrow.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;

  try {
    const config = await getAppConfig();
    const enabledModels = config.models.filter(m => m.enabled);
    const selectedModelIds = config.selectedChatModelIds || [];

    // 如果没有选中任何问答模型，默认使用所有启用的模型
    const selectedModels = selectedModelIds.length > 0
      ? enabledModels.filter(m => selectedModelIds.includes(m.id))
      : enabledModels;

    const currentModel = await getSelectedChatModel();

    if (selectedModels.length === 0) {
      selector.innerHTML = '<option value="">无模型</option>';
      selector.disabled = true;
      wrapper.appendChild(selector);
      wrapper.appendChild(arrow);
      return wrapper;
    }

    selector.innerHTML = selectedModels.map(model => {
      const isSelected = currentModel?.id === model.id;
      return `<option value="${model.id}" ${isSelected ? 'selected' : ''}>${model.name}</option>`;
    }).join('');

    selector.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      const modelId = target.value;
      if (modelId) {
        // 更新当前使用的模型（将选中的模型移到数组第一位）
        const currentIds = [...selectedModelIds];
        const index = currentIds.indexOf(modelId);
        if (index > 0) {
          currentIds.splice(index, 1);
          currentIds.unshift(modelId);
          await setSelectedChatModel(modelId);
        }
      }
    });
  } catch (error) {
    console.error('Failed to create model selector:', error);
    selector.innerHTML = '<option value="">加载失败</option>';
    selector.disabled = true;
  }

  wrapper.appendChild(selector);
  wrapper.appendChild(arrow);
  return wrapper;
}

/**
 * 获取目标翻译语言
 */
function getTargetLanguage(): string {
  const browserLang = navigator.language || (navigator as any).userLanguage;
  // 语言代码映射到语言名称
  const languageNames: Record<string, string> = {
    'zh': '中文',
    'zh-CN': '中文',
    'zh-TW': '繁体中文',
    'zh-HK': '繁体中文',
    'en': '英文',
    'en-US': '英文',
    'en-GB': '英文',
    'ja': '日语',
    'ko': '韩语',
    'fr': '法语',
    'de': '德语',
    'es': '西班牙语',
    'ru': '俄语',
    'pt': '葡萄牙语',
    'it': '意大利语',
    'ar': '阿拉伯语',
    'th': '泰语',
    'vi': '越南语',
  };

  if (browserLang) {
    if (languageNames[browserLang]) {
      return languageNames[browserLang];
    }
    const langCode = browserLang.split('-')[0];
    if (languageNames[langCode]) {
      return languageNames[langCode];
    }
  }

  return '中文';
}

/**
 * 创建复制按钮（支持下拉选择格式）
 */
function createCopyButton(content: string, markdownContent?: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'select-ask-copy-wrapper';
  wrapper.style.position = 'relative';

  const btn = document.createElement('button');
  btn.className = 'select-ask-copy-btn';
  btn.title = '复制';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;

  // 下拉箭头
  const dropdownBtn = document.createElement('button');
  dropdownBtn.className = 'select-ask-copy-dropdown-btn';
  dropdownBtn.title = '选择复制格式';
  dropdownBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 9l6 6 6-6"></path>
    </svg>
  `;

  // 下拉菜单
  const dropdown = document.createElement('div');
  dropdown.className = 'select-ask-copy-dropdown';
  dropdown.innerHTML = `
    <div class="select-ask-copy-option" data-format="text">复制为纯文本</div>
    <div class="select-ask-copy-option" data-format="markdown">复制为 Markdown</div>
  `;

  // 主按钮点击 - 快速复制纯文本
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(content);
      btn.classList.add('copied');
      btn.title = '已复制';
      showToast('✅复制成功', 'success');
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.title = '复制';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast('复制失败', 'info');
    }
  });

  // 下拉按钮点击 - 显示/隐藏菜单
  dropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  // 下拉选项点击
  dropdown.querySelectorAll('.select-ask-copy-option').forEach(option => {
    option.addEventListener('click', async (e) => {
      e.stopPropagation();
      const format = (option as HTMLElement).dataset.format;
      const textToCopy = format === 'markdown' && markdownContent ? markdownContent : content;

      try {
        await navigator.clipboard.writeText(textToCopy);
        btn.classList.add('copied');
        btn.title = '已复制';
        showToast('✅复制成功', 'success');
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.title = '复制';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        showToast('复制失败', 'info');
      }

      dropdown.classList.remove('show');
    });
  });

  // 点击外部关闭下拉菜单
  document.addEventListener('click', () => {
    dropdown.classList.remove('show');
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(dropdownBtn);
  wrapper.appendChild(dropdown);

  return wrapper;
}

/**
 * 创建重新生成按钮
 */
function createRegenerateButton(
  messageElement: HTMLElement,
  floatingBox: HTMLElement,
  inputArea: HTMLElement
): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'select-ask-regenerate-btn';
  btn.title = '重新生成';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M23 4v6h-6"></path>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
    </svg>
  `;

  btn.addEventListener('click', async () => {
    // 获取存储的重新生成上下文
    const regenerateType = messageElement.dataset.regenerateType;
    const regenerateText = messageElement.dataset.regenerateText || '';
    const regenerateContext = messageElement.dataset.regenerateContext
      ? JSON.parse(messageElement.dataset.regenerateContext)
      : null;
    const regenerateQuestion = messageElement.dataset.regenerateQuestion;

    if (!regenerateType) return;

    // 标记加载状态
    btn.classList.add('loading');

    // 获取当前选择的模型并更新显示
    const currentModel = await getSelectedChatModel();
    const modelName = currentModel?.name || 'AI';
    const modelNameEl = messageElement.querySelector('.select-ask-ai-model-name');
    if (modelNameEl) {
      modelNameEl.textContent = modelName;
    }

    // 清空当前回答
    const reasoningText = messageElement.querySelector('.select-ask-reasoning-text') as HTMLElement;
    const answerText = messageElement.querySelector('.select-ask-answer-text') as HTMLElement;
    const reasoningToggle = messageElement.querySelector('.select-ask-reasoning-title') as HTMLElement;
    const reasoningSection = messageElement.querySelector('.select-ask-reasoning-section') as HTMLElement;

    if (reasoningText) reasoningText.textContent = '';
    if (answerText) {
      answerText.innerHTML = '请求中...';
      answerText.classList.add('select-ask-loading-placeholder');
    }
    if (reasoningToggle) reasoningToggle.textContent = '思考中...';
    if (reasoningSection) {
      reasoningSection.classList.add('expanded');
    }

    // 移除操作按钮区域
    const actionsArea = messageElement.querySelector('.select-ask-ai-actions');
    if (actionsArea) actionsArea.remove();

    // 标记输入区域为加载中
    inputArea.dataset.isLoading = 'true';

    try {
      if (regenerateType === 'question' && regenerateQuestion) {
        // 重新生成问题回答
        await callQuestionBackendAPI(regenerateQuestion, regenerateText, regenerateContext, messageElement, floatingBox, inputArea);
      } else if (regenerateType === 'followup' && regenerateQuestion) {
        // 重新生成追问回答
        await callFollowUpBackendAPI(regenerateQuestion, regenerateText, regenerateContext, messageElement, inputArea);
      } else {
        // 重新生成解释/翻译
        await callBackendAPI(regenerateType === 'explain' ? '解释' : '翻译', regenerateText, regenerateContext, messageElement, floatingBox, inputArea);
      }
    } catch (error) {
      console.error('Regenerate failed:', error);
      if (answerText) {
        answerText.innerHTML = `<div class="select-ask-error-message">重新生成失败</div>`;
      }
    }

    btn.classList.remove('loading');
  });

  return btn;
}

/**
 * 添加操作按钮到 AI 回答区域
 */
function addActionButtonsToAnswer(
  aiContent: HTMLElement,
  answerText: string,
  messageElement: HTMLElement,
  floatingBox: HTMLElement,
  inputArea: HTMLElement,
  generationTime?: number,
  markdownContent?: string
): void {
  // 更新 header 中的耗时（header 在 messageElement 中，不在 aiContent 中）
  const headerTime = messageElement.querySelector('.select-ask-ai-time') as HTMLElement;
  if (headerTime && generationTime !== undefined) {
    headerTime.textContent = `耗时${Math.round(generationTime)}s`;
  }

  // 检查是否已有操作区
  let actionsArea = aiContent.querySelector('.select-ask-ai-actions') as HTMLElement;
  if (!actionsArea) {
    actionsArea = document.createElement('div');
    actionsArea.className = 'select-ask-ai-actions';
    aiContent.appendChild(actionsArea);
  }

  // 添加复制按钮（放在左边）
  if (!actionsArea.querySelector('.select-ask-copy-wrapper')) {
    const copyBtn = createCopyButton(answerText, markdownContent || answerText);
    actionsArea.appendChild(copyBtn);
  }

  // 添加重新生成按钮（放在左边）
  if (!actionsArea.querySelector('.select-ask-regenerate-btn')) {
    const regenerateBtn = createRegenerateButton(messageElement, floatingBox, inputArea);
    actionsArea.appendChild(regenerateBtn);
  }

  // 添加 AI 免责声明（放在右边）
  if (!actionsArea.querySelector('.select-ask-ai-disclaimer')) {
    const disclaimer = document.createElement('span');
    disclaimer.className = 'select-ask-ai-disclaimer';
    disclaimer.textContent = '内容由AI生成，仅供参考';
    actionsArea.appendChild(disclaimer);
  }

  // 添加脑图按钮（在免责声明之前）
  addMindMapButton(actionsArea, markdownContent || answerText, messageElement);
}

/**
 * 设置点击外部关闭对话框的逻辑
 * 使用捕获阶段确保对话框内点击不会关闭
 */
function setupClickOutsideClose(box: HTMLElement, delay: number = 100): () => void {
  let cleanup: (() => void) | null = null;

  // 使用 mousedown 事件而不是 click，避免与其他点击事件冲突
  const handleMouseDown = (e: MouseEvent) => {
    // 使用 composedPath 来获取事件的完整路径，包括 Shadow DOM 中的元素
    const path = e.composedPath();
    // 检查 box 是否在事件路径中
    const isInsideBox = path.includes(box);

    if (!isInsideBox) {
      // 点击在 box 外部，关闭对话框
      box.remove();
      if (cleanup) cleanup();
    }
  };

  // 延迟添加监听器，避免立即触发
  const timeoutId = setTimeout(() => {
    document.addEventListener('mousedown', handleMouseDown, false);
  }, delay);

  cleanup = () => {
    clearTimeout(timeoutId);
    document.removeEventListener('mousedown', handleMouseDown, false);
  };

  return cleanup;
}

/**
 * 创建可拖拽的标题栏
 */
async function createChatHeader(box: HTMLElement): Promise<HTMLElement> {
  const header = document.createElement('div');
  header.className = 'select-ask-chat-header';

  // 获取当前显示模式
  const currentMode = await getDisplayMode();
  const isSidebar = currentMode === 'sidebar';

  header.innerHTML = `
    <div class="select-ask-chat-header-title">
      <span class="select-ask-chat-header-name">select ask</span>
      <span class="select-ask-chat-header-divider">·</span>
      <span class="select-ask-chat-header-slogan">选中即问，知识自来</span>
    </div>
    <div class="select-ask-chat-header-actions">
      <button class="select-ask-mode-toggle-btn" title="${isSidebar ? '切换为浮动窗口' : '切换为侧边栏'}">
        ${isSidebar ? `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
          </svg>
        ` : `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
            <line x1="17" y1="2" x2="17" y2="22"></line>
          </svg>
        `}
      </button>
      <button class="select-ask-fullscreen-btn" title="全屏">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
      </button>
      <button class="select-ask-history-btn" title="历史记录">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </button>
      ${isSidebar ? `
      <button class="select-ask-close-btn" title="关闭">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
      ` : ''}
    </div>
  `;

  // 添加模式切换事件
  const modeToggleBtn = header.querySelector('.select-ask-mode-toggle-btn');
  modeToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDisplayMode(box);
  });

  return header;
}

/**
 * 切换显示模式（浮动窗口 <-> 侧边栏）
 * 使用移动DOM的方式，保持所有事件绑定和流式响应
 */
async function toggleDisplayMode(box: HTMLElement): Promise<void> {
  // 保存当前聊天内容和输入区域的引用
  const chatContainer = box.querySelector('.select-ask-chat-container') as HTMLElement;
  const inputArea = box.querySelector('.select-ask-input-area') as HTMLElement;

  // 保存当前的滚动位置
  const scrollTop = chatContainer?.scrollTop || 0;

  // 保存新的显示模式
  await setDisplayMode('sidebar');

  // 先将旧容器设置为透明，避免闪烁
  box.style.opacity = '0';
  box.style.transition = 'opacity 0.15s ease-out';

  // 等待过渡完成
  await new Promise(resolve => setTimeout(resolve, 150));

  // 创建侧边栏容器
  const newBox = document.createElement('div');
  newBox.className = 'select-ask-sidebar';
  newBox.style.opacity = '0';

  // 创建新的头部
  const newHeader = await createChatHeader(newBox);
  newBox.appendChild(newHeader);

  // 设置事件
  setupDraggable(newBox, newHeader);
  setupHistoryButton(newHeader, newBox);
  setupFullscreenButton(newHeader, newBox);

  // 移动聊天内容到新容器
  if (chatContainer) {
    newBox.appendChild(chatContainer);
  }

  // 移动输入区域到新容器
  if (inputArea) {
    newBox.appendChild(inputArea);
  }

  // 先添加新容器到 DOM
  document.body.appendChild(newBox);
  currentSidebar = newBox;

  // 调整页面布局，为侧边栏腾出空间
  openSidebarLayout();

  // 移除旧的 box
  box.remove();

  // 淡入新容器
  requestAnimationFrame(() => {
    newBox.style.transition = 'opacity 0.2s ease-out';
    newBox.style.opacity = '1';
    if (chatContainer) {
      chatContainer.scrollTop = scrollTop;
    }
  });

  showToast('已切换到侧边栏模式', 'info');
}

/**
 * 设置拖拽功能（支持整个对话框空白区域拖拽）
 */
function setupDraggable(box: HTMLElement, header: HTMLElement): void {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  const handleMouseDown = (e: MouseEvent) => {
    // 检查是否点击了可交互元素
    const target = e.target as HTMLElement;
    const isInteractive = target.closest(
      'button, input, textarea, a, .select-ask-copy-btn, .select-ask-regenerate-btn'
    );

    if (isInteractive) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = parseInt(box.style.left) || 0;
    initialTop = parseInt(box.style.top) || 0;
    box.classList.add('dragging');
    header.classList.add('dragging');
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    box.style.left = `${initialLeft + deltaX}px`;
    box.style.top = `${initialTop + deltaY}px`;
  };

  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      box.classList.remove('dragging');
      header.classList.remove('dragging');
    }
  };

  // 只在头部绑定 mousedown 事件
  header.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // 清理函数存储在 box 上，以便在 box 移除时清理
  const cleanup = () => {
    header.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  (box as any)._dragCleanup = cleanup;
}

/**
 * 设置历史记录按钮事件
 */
function setupHistoryButton(header: HTMLElement, box: HTMLElement): void {
  const historyBtn = header.querySelector('.select-ask-history-btn');
  if (!historyBtn) return;

  historyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 打开插件的配置页面（历史记录标签）
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
  });
}

/**
 * 切换全屏模式
 */
function toggleFullscreen(box: HTMLElement, header: HTMLElement): void {
  isFullscreen = !isFullscreen;

  if (isFullscreen) {
    // 进入全屏模式
    box.classList.add('fullscreen');
    // 更新全屏按钮图标为退出全屏
    const fullscreenBtn = header.querySelector('.select-ask-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
        </svg>
      `;
      (fullscreenBtn as HTMLElement).title = '退出全屏';
    }

    // 创建主内容区域包装器
    const mainContent = document.createElement('div');
    mainContent.className = 'select-ask-fullscreen-main';

    // 创建历史记录面板（同步创建结构，异步加载数据）
    const historyPanel = document.createElement('div');
    historyPanel.className = 'select-ask-fullscreen-history';
    historyPanel.innerHTML = `
      <div class="select-ask-fullscreen-history-header">
        <h3>历史记录</h3>
        <button class="select-ask-clear-history-btn" title="清空全部记录">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          清空
        </button>
      </div>
      <div class="select-ask-fullscreen-history-list">
        <div class="select-ask-fullscreen-history-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <p>加载中...</p>
        </div>
      </div>
    `;

    // 创建右侧内容区域（聊天容器 + 输入区域）
    const rightContent = document.createElement('div');
    rightContent.className = 'select-ask-fullscreen-content';

    // 移动聊天容器和输入区域到右侧内容区域
    const chatContainer = box.querySelector('.select-ask-chat-container');
    const inputArea = box.querySelector('.select-ask-input-area');
    if (chatContainer) rightContent.appendChild(chatContainer);
    if (inputArea) rightContent.appendChild(inputArea);

    // 同步组装 DOM 结构，确保布局立即生效
    mainContent.appendChild(historyPanel);
    mainContent.appendChild(rightContent);
    box.appendChild(mainContent);

    // 异步加载历史记录数据
    loadFullscreenHistoryData(historyPanel, box);
  } else {
    // 退出全屏模式
    box.classList.remove('fullscreen');
    // 更新全屏按钮图标为全屏
    const fullscreenBtn = header.querySelector('.select-ask-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
      `;
      (fullscreenBtn as HTMLElement).title = '全屏';
    }

    // 恢复原始结构
    const mainContent = box.querySelector('.select-ask-fullscreen-main');
    const rightContent = box.querySelector('.select-ask-fullscreen-content');
    const chatContainer = rightContent?.querySelector('.select-ask-chat-container');
    const inputArea = rightContent?.querySelector('.select-ask-input-area');

    // 移回聊天容器和输入区域到 box
    if (chatContainer) box.appendChild(chatContainer);
    if (inputArea) box.appendChild(inputArea);

    // 移除主内容区域
    if (mainContent) mainContent.remove();
  }
}

/**
 * 异步加载全屏历史记录数据
 */
async function loadFullscreenHistoryData(
  historyPanel: HTMLElement,
  box: HTMLElement
): Promise<void> {
  const sessions = await getHistory();

  const typeNames: Record<string, string> = {
    explain: '解释',
    translate: '翻译',
    question: '问答',
    custom: '自定义',
  };

  // 添加清空按钮事件
  const clearBtn = historyPanel.querySelector('.select-ask-clear-history-btn');
  clearBtn?.addEventListener('click', async () => {
    if (confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
      const { clearHistory } = await import('../utils/history-manager');
      await clearHistory();
      // 刷新历史列表
      const listEl = historyPanel.querySelector('.select-ask-fullscreen-history-list');
      if (listEl) {
        listEl.innerHTML = `
          <div class="select-ask-fullscreen-history-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <p>暂无历史记录</p>
          </div>
        `;
      }
      showToast('历史记录已清空', 'success');
    }
  });

  // 填充历史记录列表
  const listEl = historyPanel.querySelector('.select-ask-fullscreen-history-list');
  if (!listEl) return;

  if (sessions.length === 0) {
    listEl.innerHTML = `
      <div class="select-ask-fullscreen-history-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p>暂无历史记录</p>
      </div>
    `;
    return;
  }

  // 清空加载提示，填充实际数据
  listEl.innerHTML = '';
  sessions.slice(0, 20).forEach(session => {
    // 获取首次提问时间和内容
    const firstMessageTime = session.messages.length > 0 ? session.messages[0].timestamp : session.createdAt;
    const firstMessageContent = session.messages.length > 0 ? session.messages[0].content : session.title;

    // 截断过长的内容
    const maxContentLength = 50;
    const displayContent = firstMessageContent.length > maxContentLength
      ? firstMessageContent.substring(0, maxContentLength) + '...'
      : firstMessageContent;

    const item = document.createElement('div');
    item.className = 'select-ask-fullscreen-history-item';
    item.innerHTML = `
      <div class="select-ask-fullscreen-history-item-header">
        <span class="select-ask-fullscreen-history-item-time">${formatAbsoluteTime(firstMessageTime)}</span>
      </div>
      <div class="select-ask-fullscreen-history-item-content">${escapeHtml(displayContent)}</div>
    `;
    item.addEventListener('click', () => {
      createChatBoxFromHistory(session);
    });
    listEl.appendChild(item);
  });

  if (sessions.length > 20) {
    const moreInfo = document.createElement('div');
    moreInfo.className = 'select-ask-fullscreen-history-more';
    moreInfo.textContent = `还有 ${sessions.length - 20} 条记录`;
    listEl.appendChild(moreInfo);
  }
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return '刚刚';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  } else if (diff < 604800000) {
    return `${Math.floor(diff / 86400000)}天前`;
  } else {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

/**
 * 格式化绝对时间（用于历史记录列表）
 */
function formatAbsoluteTime(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 设置全屏按钮事件
 */
function setupFullscreenButton(header: HTMLElement, box: HTMLElement): void {
  const fullscreenBtn = header.querySelector('.select-ask-fullscreen-btn');
  if (!fullscreenBtn) return;

  fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFullscreen(box, header);
  });
}

/**
 * 设置关闭按钮事件（已废弃，保留兼容）
 */
function setupCloseButton(header: HTMLElement, box: HTMLElement): void {
  // 关闭按钮已移除，此函数保留以兼容旧代码
  const closeBtn = header.querySelector('.select-ask-close-btn');
  if (!closeBtn) return;

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 重置全屏状态
    isFullscreen = false;
    box.remove();
    // 如果关闭的是侧边栏，恢复页面布局
    if (currentSidebar === box) {
      closeSidebarLayout();
    }
    currentSidebar = null;
  });
}

/**
 * 显示历史记录侧边栏
 */
let currentHistorySidebar: HTMLElement | null = null;

async function showHistoryPanel(box: HTMLElement, triggerBtn: HTMLElement): Promise<void> {
  // 如果侧边栏已存在，关闭它
  if (currentHistorySidebar) {
    currentHistorySidebar.remove();
    currentHistorySidebar = null;
    return;
  }

  // 获取历史记录
  const sessions = await getHistory();

  // 创建侧边栏
  const sidebar = document.createElement('div');
  sidebar.className = 'select-ask-history-sidebar';
  currentHistorySidebar = sidebar;

  const typeNames: Record<string, string> = {
    explain: '解释',
    translate: '翻译',
    question: '问答',
    custom: '自定义',
  };

  sidebar.innerHTML = `
    <div class="select-ask-history-sidebar-header">
      <h3>历史记录</h3>
      <button class="select-ask-history-sidebar-close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="select-ask-history-sidebar-list">
      ${sessions.length === 0 ? `
        <div class="select-ask-history-sidebar-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <p>暂无历史记录</p>
        </div>
      ` : ''}
    </div>
  `;

  // 添加关闭按钮事件
  const closeBtn = sidebar.querySelector('.select-ask-history-sidebar-close');
  closeBtn?.addEventListener('click', () => {
    sidebar.remove();
    currentHistorySidebar = null;
  });

  // 渲染历史记录列表
  const listContainer = sidebar.querySelector('.select-ask-history-sidebar-list');
  if (listContainer && sessions.length > 0) {
    sessions.forEach((session) => {
      const item = document.createElement('div');
      item.className = 'select-ask-history-sidebar-item';

      item.innerHTML = `
        <div class="select-ask-history-sidebar-item-header">
          <span class="select-ask-history-sidebar-item-type">${typeNames[session.type] || session.type}</span>
          <span class="select-ask-history-sidebar-item-time">${formatHistoryTime(session.updatedAt)}</span>
        </div>
        <div class="select-ask-history-sidebar-item-title">${escapeHtml(session.title)}</div>
        <div class="select-ask-history-sidebar-item-model">${session.modelName}</div>
      `;

      item.addEventListener('click', () => {
        resumeSession(session, box);
        sidebar.remove();
        currentHistorySidebar = null;
      });

      listContainer.appendChild(item);
    });
  }

  document.body.appendChild(sidebar);

  // 点击侧边栏外部关闭
  sidebar.addEventListener('click', (e) => {
    if (e.target === sidebar) {
      sidebar.remove();
      currentHistorySidebar = null;
    }
  });
}

/**
 * 格式化历史记录时间
 */
function formatHistoryTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 恢复历史会话
 */
async function resumeSession(session: HistorySession, box: HTMLElement): Promise<void> {
  // 设置当前会话信息
  currentSessionId = session.id;
  currentSessionType = session.type;
  currentSelectedText = session.selectedText;
  currentSessionMessages = [...session.messages];
  currentSessionSaved = true; // 恢复的会话已存在于历史记录中

  // 清空当前聊天容器
  const chatContainer = box.querySelector('.select-ask-chat-container') as HTMLElement;
  if (!chatContainer) return;

  chatContainer.innerHTML = '';

  // 渲染历史消息
  for (const msg of session.messages) {
    const messageEl = document.createElement('div');
    messageEl.className = `select-ask-message select-ask-message-${msg.role}`;

    const avatar = msg.role === 'user'
      ? '<div class="select-ask-message-avatar select-ask-avatar-user">我</div>'
      : `<div class="select-ask-message-avatar select-ask-avatar-ai"><img src="${chrome.runtime.getURL('public/icons/icon48.png')}" alt="AI" /></div>`;

    messageEl.innerHTML = `
      ${avatar}
      <div class="select-ask-message-content">
        <div class="select-ask-message-body">
          <div class="select-ask-message-text">${msg.role === 'user' ? escapeHtml(msg.content) : ''}</div>
        </div>
      </div>
    `;

    if (msg.role === 'user') {
      chatContainer.appendChild(messageEl);
    } else {
      // AI 消息需要渲染 markdown
      const contentEl = messageEl.querySelector('.select-ask-message-text');
      if (contentEl) {
        contentEl.innerHTML = renderMarkdown(msg.content);
      }
      chatContainer.appendChild(messageEl);
    }
  }

  // 滚动到底部
  chatContainer.scrollTop = chatContainer.scrollHeight;

  showToast('已恢复历史对话', 'info');
}

// 状态
let selectionTimeout: number | null = null;
let mouseUpPosition: { x: number; y: number } | null = null;
let currentSelectionData: { text: string; position: { x: number; y: number; width: number; height: number }; context: any } | null = null;
let isIconClicking = false; // 标记是否正在点击图标
let currentIconMenu: HTMLElement | null = null; // 当前图标菜单引用
let currentDropdown: HTMLElement | null = null; // 当前下拉菜单
let savedRange: Range | null = null; // 保存的选中文本范围
let currentQuestionText: string = ''; // 当前问题的文本内容
let currentQuestionContext: any = null; // 当前问题的上下文

// 缓存接口
interface CachedResponse {
  explain: string;
  explainReasoning: string;
  translate: string;
  translateReasoning: string;
  timestamp: number;
}

// 缓存存储（在内存中，刷新页面自动清空）
const responseCache = new Map<string, CachedResponse>();

// 缓存过期时间（1小时，但刷新页面会清空）
const CACHE_EXPIRY = 60 * 60 * 1000;

/**
 * 加载缓存（只从内存加载，不持久化）
 */
async function loadCache(): Promise<void> {
  try {
    // 清除旧的本地存储缓存
    await chrome.storage.local.remove('responseCache');

    // 不再从 storage 加载，刷新页面自动清空缓存
  } catch (error) {
    console.error('Failed to load cache:', error);
  }
}

/**
 * 保存缓存（不再持久化，刷新页面自动清空）
 */
async function saveCache(): Promise<void> {
  // 不再保存到 storage，刷新页面自动清空缓存
  // chrome.storage.session 在 content script 中不可用
  // 缓存仅保存在内存中
}

/**
 * 生成文本哈希值
 */
function getTextHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * 从缓存获取结果
 */
function getCachedResponse(text: string): CachedResponse | null {
  const hash = getTextHash(text);
  const cached = responseCache.get(hash);

  if (cached) {
    // 检查是否过期
    if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
      responseCache.delete(hash);
      return null;
    }
    return cached;
  }
  return null;
}

/**
 * 保存结果到缓存
 */
function saveToCache(text: string, data: Partial<CachedResponse>): void {
  const hash = getTextHash(text);
  const existing = responseCache.get(hash) || {
    explain: '',
    translate: '',
    timestamp: Date.now(),
  };

  if (data.explain) existing.explain = data.explain;
  if (data.translate) existing.translate = data.translate;

  existing.timestamp = Date.now();
  responseCache.set(hash, existing);
  saveCache(); // 异步保存到 storage
}

/**
 * 清除指定文本的缓存
 */
function clearTextCache(text: string): void {
  const hash = getTextHash(text);
  responseCache.delete(hash);
}

/**
 * 清空所有缓存
 */
function clearCache(): void {
  responseCache.clear();
}


/**
 * 保存选中文本范围
 */
function saveSelectionRange(): void {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    savedRange = selection.getRangeAt(0).cloneRange();
  }
}

/**
 * 恢复选中文本范围
 */
function restoreSelectionRange(): void {
  if (savedRange) {
    const selection = window.getSelection();
    // 验证 range 是否仍然有效（容器是否在文档中）
    try {
      const rangeNode = savedRange.startContainer;
      if (!rangeNode || !document.contains(rangeNode)) {
        // range 已失效，尝试从 currentSelectionData 重新定位
        console.warn('Saved range is no longer valid');
        return;
      }
      selection.removeAllRanges();
      selection.addRange(savedRange);
    } catch (e) {
      console.warn('Failed to restore selection:', e);
    }
  }
}

/**
 * 清除选中文本范围
 */
function clearSelection(): void {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
}

/**
 * 创建图标菜单（使用 search.png 图标）
 */
function createIconMenu(x: number, y: number): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'select-ask-icon-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  // 用于检测鼠标是"经过"还是"停留"
  let mouseEnterTimer: number | null = null;
  let hasClicked = false;

  // 使用 search.png 图标
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('public/icons/search.png');
  img.alt = 'Ask AI';
  img.className = 'select-ask-icon-img';
  menu.appendChild(img);

  // mousedown 事件 - 在这里保存选区，防止浏览器清除
  menu.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault(); // 阻止默认行为，保持选区
    isIconClicking = true;
    hasClicked = true;

    // 点击时清除所有定时器
    if (mouseEnterTimer) {
      clearTimeout(mouseEnterTimer);
      mouseEnterTimer = null;
    }
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }
  });

  // mouseup 事件 - 继续阻止默认行为
  menu.addEventListener('mouseup', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  // 鼠标移入图标时，开始计时
  menu.addEventListener('mouseenter', (e) => {
    hasClicked = false;
    // 0.8 秒后检查，如果鼠标还在图标上且没有点击，渐变隐藏图标
    mouseEnterTimer = window.setTimeout(() => {
      if (!hasClicked && menu.matches(':hover')) {
        // 鼠标仍在图标上但没有点击，渐变隐藏图标
        fadeOutIcon(menu);
      }
    }, 800) as unknown as number;
  });

  // 鼠标离开图标时，清除定时器
  menu.addEventListener('mouseleave', (e) => {
    if (mouseEnterTimer) {
      clearTimeout(mouseEnterTimer);
      mouseEnterTimer = null;
    }
    // 如果鼠标离开图标且没有点击，渐变隐藏图标
    if (!hasClicked) {
      fadeOutIcon(menu);
    }
  });

  // 点击事件
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    handleMenuClick(e, menu);
  });

  return menu;
}

/**
 * 显示二级菜单（AI 搜索、解释、翻译、总结、提问）
 */
function showDropdownMenu(x: number, y: number): HTMLElement {
  const dropdown = document.createElement('div');
  dropdown.className = 'select-ask-dropdown-menu';
  dropdown.style.left = `${x}px`;
  dropdown.style.top = `${y}px`;

  const menuItems = [
    { key: 'search', label: '搜索', svg: '<svg viewBox="0 0 1293 1024" fill="currentColor"><path d="M646.736842 0l281.222737 1024h-253.305263l-62.356211-227.220211L253.305263 1024H0L281.222737 0z m365.568 0l281.222737 1024H1040.168421L758.945684 0zM463.925895 256l-106.819369 389.389474 182.218106-115.280842-75.452632-274.162527z"/></svg>' },
    { key: 'explain', label: '解释', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>' },
    { key: 'translate', label: '翻译', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>' },
    { key: 'summarize', label: '总结', svg: '<svg viewBox="0 0 1024 1024" fill="currentColor"><path d="M725.76 9.344H185.770667q-61.994667 0-105.813334 43.818667T36.181333 158.976v706.048q0 61.994667 43.818667 105.813333t105.813333 43.818667h234.154667q17.237333 0 29.44-12.202667 12.202667-12.202667 12.202667-29.44 0-17.237333-12.202667-29.44-12.202667-12.202667-29.44-12.202666H185.813333q-66.346667 0-66.346666-66.346667V158.976q0-66.346667 66.346666-66.346667h539.904q66.346667 0 66.346667 66.346667v329.088q0 17.28 12.202667 29.44 12.202667 12.202667 29.44 12.202667 17.237333 0 29.44-12.16 12.202667-12.202667 12.202666-29.44V158.933333q0-61.994667-43.818666-105.813333T725.717333 9.344z m-37.290667 274.944q0 18.986667-13.44 32.426667-13.397333 13.397333-32.341333 13.397333H268.885333q-18.986667 0-32.426666-13.44-13.354667-13.397333-13.354667-32.384 0-18.944 13.397333-32.384 13.397333-13.397333 32.384-13.397333h373.76q18.986667 0 32.426667 13.397333 13.397333 13.44 13.397333 32.426667z m-207.658666 232.789333q0 18.944-13.397334 32.384-13.44 13.397333-32.426666 13.397334H268.928q-18.986667 0-32.384-13.397334-13.397333-13.44-13.397333-32.426666 0-18.944 13.397333-32.341334 13.397333-13.44 32.384-13.44h166.144q18.944 0 32.384 13.44 13.397333 13.397333 13.397333 32.384z"/><path d="M526.677333 1010.346667h85.973334l29.824-108.885334h136.96l29.866666 108.928h89.386667l-135.850667-424.746666h-100.309333l-135.850667 424.746666z m134.101334-174.805334l12.629333-46.421333c12.629333-44.16 24.661333-92.288 36.096-138.709333h2.304c12.629333 45.269333 24.064 94.549333 37.248 138.666666l12.629333 46.506667h-100.906666z m237.909333 174.848h84.821333v-424.746666h-84.821333v424.746666z"/></svg>' },
  ];

  // 脑图按钮（仅当选中文本长度 > 100 时显示）
  if (currentSelectionData && currentSelectionData.text.length > 100) {
    menuItems.push({
      key: 'mindmap',
      label: '脑图',
      svg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/><line x1="9.5" y1="10.5" x2="5.5" y2="7.5"/><line x1="14.5" y1="10.5" x2="18.5" y2="7.5"/><line x1="9.5" y1="13.5" x2="5.5" y2="16.5"/><line x1="14.5" y1="13.5" x2="18.5" y2="16.5"/></svg>',
    });
  }

  menuItems.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'select-ask-dropdown-item';
    // 阻止 mousedown 导致选区丢失
    button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const iconSpan = document.createElement('span');
    iconSpan.className = 'select-ask-dropdown-icon';
    iconSpan.innerHTML = item.svg;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'select-ask-dropdown-label';
    labelSpan.textContent = item.label;

    button.appendChild(iconSpan);
    button.appendChild(labelSpan);

    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault(); // 阻止默认行为，保持选区
      await handleMenuAction(item.key);
    });
    dropdown.appendChild(button);
  });

  // 分割线
  const divider = document.createElement('div');
  divider.className = 'select-ask-dropdown-divider';
  dropdown.appendChild(divider);

  // 提问输入框区域
  const askContainer = document.createElement('div');
  askContainer.className = 'select-ask-dropdown-ask-container';

  const textarea = document.createElement('textarea');
  textarea.className = 'select-ask-dropdown-ask-textarea';
  textarea.placeholder = '针对选中文本提问…';
  textarea.rows = 1;

  const textareaWrapper = document.createElement('div');
  textareaWrapper.className = 'select-ask-dropdown-ask-textarea-wrapper';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'select-ask-dropdown-ask-send';
  sendBtn.title = '发送';
  const sendSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sendSvg.setAttribute('viewBox', '0 0 24 24');
  sendSvg.setAttribute('fill', 'currentColor');
  sendSvg.setAttribute('width', '16');
  sendSvg.setAttribute('height', '16');
  const sendPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  sendPath.setAttribute('d', 'M12 4L4 14h5v6h6v-6h5L12 4z');
  sendSvg.appendChild(sendPath);
  sendBtn.appendChild(sendSvg);

  textareaWrapper.appendChild(textarea);
  textareaWrapper.appendChild(sendBtn);
  askContainer.appendChild(textareaWrapper);
  dropdown.appendChild(askContainer);

  // 输入框自适应高度
  const MAX_HEIGHT = 120;
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(MAX_HEIGHT, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';
    // 多行时发送按钮移到底部
    if (newHeight > 40) {
      sendBtn.classList.add('multi-line');
    } else {
      sendBtn.classList.remove('multi-line');
    }
  });

  // 键盘事件：Enter 发送
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAskSubmit();
    }
  });

  // 发送按钮点击
  sendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    handleAskSubmit();
  });

  function handleAskSubmit() {
    const question = textarea.value.trim();
    if (!question) return;
    dropdown.remove();
    currentDropdown = null;
    removeIconMenus();
    // 获取当前选中文本
    const selectedText = window.getSelection()?.toString().trim() || '';
    // 调用提问功能
    chrome.runtime.sendMessage({
      type: 'TOGGLE_SIDE_PANEL',
      selectedText: selectedText,
      context: null,
      userMessage: question,
      summaryPrompt: null,
      pageUrl: window.location.href,
      pageTitle: document.title,
    });
  }

  document.body.appendChild(dropdown);
  return dropdown;
}


/**
 * 处理图标点击 - 显示下拉菜单
 */
function handleMenuClick(e: MouseEvent, iconMenu: HTMLElement): void {
  isIconClicking = false;

  // 获取图标位置
  const rect = iconMenu.getBoundingClientRect();
  const dropdownX = rect.left + window.scrollX;
  const dropdownY = rect.bottom + window.scrollY + 4;

  // 渐变隐藏图标（不删除，保持选中文本状态）
  iconMenu.classList.add('fade-out');

  // 立即恢复选区高亮
  restoreSelectionRange();

  // 显示下拉菜单
  const dropdown = showDropdownMenu(dropdownX, dropdownY);
  currentDropdown = dropdown;

  // 点击外部关闭
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e: MouseEvent) {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.remove();
        currentDropdown = null;
        // 恢复图标显示
        if (currentIconMenu && currentIconMenu.parentElement) {
          currentIconMenu.classList.remove('fade-out');
          currentIconMenu.style.display = 'flex';
        }
        // 恢复选中文本
        restoreSelectionRange();
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 0);
}

/**
 * 调整浮动框位置
 */
function adjustBoxPosition(box: HTMLElement, initialX: number, initialY: number): void {
  const boxRect = box.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const margin = 10;

  let x = initialX;
  let y = initialY;

  // 检查右边界
  if (x + boxRect.width > scrollX + viewportWidth - margin) {
    x = scrollX + viewportWidth - boxRect.width - margin;
  }

  // 检查左边界
  if (x < scrollX + margin) {
    x = scrollX + margin;
  }

  // 检查下边界
  if (y + boxRect.height > scrollY + viewportHeight - margin) {
    y = scrollY + viewportHeight - boxRect.height - margin;
  }

  // 检查上边界
  if (y < scrollY + margin) {
    y = scrollY + margin;
  }

  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
}

/**
 * 确保对话框在视口内
 */
function ensureBoxInViewport(box: HTMLElement): void {
  const boxRect = box.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const margin = 10;

  let x = parseFloat(box.style.left) || boxRect.left + scrollX;
  let y = parseFloat(box.style.top) || boxRect.top + scrollY;

  // 检查右边界
  if (boxRect.right > viewportWidth - margin) {
    x = scrollX + viewportWidth - boxRect.width - margin;
  }

  // 检查左边界
  if (boxRect.left < margin) {
    x = scrollX + margin;
  }

  // 检查下边界
  if (boxRect.bottom > viewportHeight - margin) {
    y = scrollY + viewportHeight - boxRect.height - margin;
  }

  // 检查上边界
  if (boxRect.top < margin) {
    y = scrollY + margin;
  }

  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
}



/**
 * 调用本地 LLM 获取响应（解释/翻译）- 流式
 */
async function callBackendAPI(
  action: string,
  text: string,
  context: any,
  messageElement: HTMLElement,
  floatingBox: HTMLElement,
  inputArea: HTMLElement
): Promise<void> {
  const startTime = Date.now();

  const actionMap: Record<string, string> = {
    '解释': 'explain',
    '翻译': 'translate',
  };

  const apiAction = actionMap[action] || action;

  // 获取思考过程和回答元素
  const reasoningText = messageElement.querySelector('.select-ask-reasoning-text') as HTMLElement;
  const answerText = messageElement.querySelector('.select-ask-answer-text') as HTMLElement;
  const reasoningToggle = messageElement.querySelector('.select-ask-reasoning-title') as HTMLElement;
  const reasoningSection = messageElement.querySelector('.select-ask-reasoning-section') as HTMLElement;

  // 初始化响应文本
  let reasoningContent = '';
  let answerContent = '';
  let hasReasoning = false;
  let hasAnswer = false;

  try {
    // 如果之前的会话已保存到历史记录，创建新会话（避免覆盖旧会话）
    if (currentSessionSaved) {
      currentSessionId = generateSessionId();
      currentSessionType = apiAction === 'translate' ? 'translate' : 'explain';
      currentSelectedText = text;
      currentSessionMessages = [];
      currentSessionSaved = false;
    }

    // 初始化新会话（添加用户消息）
    if (!currentSessionId) {
      currentSessionId = generateSessionId();
      currentSessionType = apiAction === 'translate' ? 'translate' : 'explain';
      currentSelectedText = text;
      currentSessionMessages = [];
      currentSessionSaved = false;
    }

    // 确保用户消息被添加到会话（每次 LLM 调用都应该有对应的用户消息）
    const hasUserMessage = currentSessionMessages.some(
      m => m.role === 'user' && m.content === text
    );
    if (!hasUserMessage) {
      currentSessionMessages.push({
        role: 'user',
        content: text,
        timestamp: Date.now(),
      });
    }

    // 转换上下文格式
    const llmContext = context ? {
      selected: text,
      before: context.before || '',
      after: context.after || '',
    } : undefined;

    // 根据动作选择流式生成器
    const streamGenerator = apiAction === 'translate'
      ? streamTranslate(text)
      : streamExplain(text, llmContext);

    // 流式读取响应
    for await (const chunk of streamGenerator) {
      if (chunk === '[REASONING]') {
        // 开始思考过程 - 显示并展开推理区域，移除请求中提示
        hasReasoning = true;
        if (reasoningSection) {
          reasoningSection.style.display = 'block';
          reasoningSection.classList.add('expanded');
        }
        // 移除请求中占位提示
        if (answerText) {
          answerText.innerHTML = '';
          answerText.classList.remove('select-ask-loading-placeholder');
        }
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        // 思考过程完成
        if (reasoningToggle) {
          reasoningToggle.textContent = '思考过程';
        }
        continue;
      }
      if (chunk.startsWith('[REASONING]')) {
        // 思考过程内容 - 首次收到时显示推理区域
        if (!hasReasoning) {
          hasReasoning = true;
          if (reasoningSection) {
            reasoningSection.style.display = 'block';
            reasoningSection.classList.add('expanded');
          }
          // 移除请求中占位提示
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        const text = chunk.slice(11);
        reasoningContent += text;
        if (reasoningText) {
          // 移除多余空行，保留列表缩进
          reasoningText.innerHTML = renderReasoningText(normalizeReasoningText(reasoningContent));
        }
      } else if (chunk.startsWith('[ERROR:')) {
        throw new Error(chunk.slice(7, -1));
      } else {
        // 回答内容 - 首次收到时清除加载提示
        if (!hasAnswer) {
          hasAnswer = true;
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        answerContent += chunk;
        if (answerText) {
          answerText.innerHTML = renderMarkdown(answerContent);
        }
      }
    }

    // 移除streaming类
    if (answerText) {
      answerText.classList.remove('streaming');
    }

    // 最终规范化思考过程文本
    if (reasoningText && reasoningContent) {
      reasoningText.innerHTML = renderReasoningText(normalizeReasoningText(reasoningContent));
    }

    // 添加操作按钮
    const aiContent = messageElement.querySelector('.select-ask-ai-content') as HTMLElement;
    if (aiContent && answerContent) {
      const elapsed = (Date.now() - startTime) / 1000;
      // 存储重新生成上下文
      messageElement.dataset.regenerateType = apiAction; // 'explain' or 'translate'
      messageElement.dataset.regenerateText = text;
      messageElement.dataset.regenerateContext = context ? JSON.stringify(context) : '';

      addActionButtonsToAnswer(aiContent, answerContent, messageElement, floatingBox, inputArea, elapsed, answerContent);
    }

    // 保存到缓存
    saveToCache(text, {
      [apiAction]: answerContent,
      [`${apiAction}Reasoning`]: reasoningContent
    });

    // 保存 AI 回答到当前会话消息
    const currentModel = await getSelectedChatModel();
    currentSessionMessages.push({
      role: 'assistant',
      content: answerContent,
      reasoning: reasoningContent || undefined,
      timestamp: Date.now(),
      modelName: currentModel?.name || 'AI',
      duration: Date.now() - startTime,
    });

    // 保存会话到历史记录
    if (currentSessionId && currentSessionMessages.length > 0) {
      const currentModel = await getSelectedChatModel();
      if (!currentSessionSaved) {
        // 首次保存，添加新会话
        const session: HistorySession = {
          id: currentSessionId,
          title: generateTitle(text, currentSessionType),
          type: currentSessionType,
          selectedText: currentSelectedText,
          messages: currentSessionMessages,
          modelId: currentModel?.id || 'unknown',
          modelName: currentModel?.name || 'AI',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pageUrl: window.location.href,
          pageTitle: document.title,
        };
        await addSession(session);
        currentSessionSaved = true;
      } else {
        // 已保存过，更新会话
        await updateSession(currentSessionId, {
          messages: currentSessionMessages,
          modelId: currentModel?.id || 'unknown',
          modelName: currentModel?.name || 'AI',
        });
      }
    }

    // 启用输入功能
    enableFollowUp(messageElement, text, context, floatingBox, inputArea);
  } catch (error) {
    console.error('Failed to call LLM:', error);
    if (answerText) {
      const errorMessage = error instanceof Error ? error.message : '请求失败，请稍后重试';
      answerText.innerHTML = `<div class="select-ask-error-message">${errorMessage}</div>`;
      answerText.classList.remove('streaming');
    }
  }
}

/**
 * 处理嵌套列表 - 将带 data-level 的 li 元素转换为嵌套结构
 */
function processNestedLists(html: string): string {
  // 匹配连续的列表项（包括带 data-level 的）
  const listItemRegex = /<li class="select-ask-li select-ask-li-(ul|ol|task-done|task)(?:\s+[^"]*)?" data-level="(\d+)">(.*?)<\/li>/gs;

  interface ListItem {
    type: string;
    level: number;
    content: string;
  }

  const items: ListItem[] = [];
  let match;

  while ((match = listItemRegex.exec(html)) !== null) {
    const type = match[1];
    const level = parseInt(match[2], 10);
    const content = match[3];
    items.push({ type: type === 'task-done' || type === 'task' ? 'ul' : type, level, content });
  }

  if (items.length === 0) {
    // 没有嵌套列表，使用原来的简单处理
    html = html.replace(/(<li class="select-ask-li select-ask-li-ul"[^>]*>.*?<\/li>)+/gs, (m) => {
      return `<ul class="select-ask-ul">${m.replace(/ data-level="\d+"/g, '')}</ul>`;
    });
    html = html.replace(/(<li class="select-ask-li select-ask-li-ol"[^>]*>.*?<\/li>)+/gs, (m) => {
      return `<ol class="select-ask-ol">${m.replace(/ data-level="\d+"/g, '')}</ol>`;
    });
    html = html.replace(/(<li class="select-ask-li select-ask-task(?:-done)?"[^>]*>.*?<\/li>)+/gs, (m) => {
      return `<ul class="select-ask-ul">${m.replace(/ data-level="\d+"/g, '')}</ul>`;
    });
    return html;
  }

  // 递归构建列表结构
  function buildListFromIndex(startIdx: number, parentLevel: number): { html: string; nextIdx: number } {
    let result = '';
    let i = startIdx;

    while (i < items.length) {
      const item = items[i];

      // 如果当前项的层级小于父级，返回上层
      if (item.level < parentLevel) {
        break;
      }

      // 如果当前项的层级等于父级，这是同级项
      if (item.level === parentLevel) {
        // 检查是否需要开始一个新的列表
        // 如果是第一项，或者前一项类型不同，需要开始新列表
        const prevItem = i > 0 ? items[i - 1] : null;
        const needNewList = i === startIdx || !prevItem || prevItem.level !== parentLevel || prevItem.type !== item.type;

        if (needNewList) {
          // 收集同级同类型的连续项
          let groupEnd = i;
          while (groupEnd < items.length) {
            const nextItem = items[groupEnd];
            if (nextItem.level < parentLevel) break;
            if (nextItem.level === parentLevel && nextItem.type !== item.type) break;
            groupEnd++;
          }

          // 生成列表
          const listTag = item.type === 'ol' ? 'ol' : 'ul';
          let listContent = '';

          for (let j = i; j < groupEnd; j++) {
            const currItem = items[j];
            if (currItem.level !== parentLevel) continue;

            const isTask = currItem.content.includes('<input type="checkbox"');
            listContent += `<li class="select-ask-li ${isTask ? (currItem.content.includes('checked') ? 'select-ask-task-done' : 'select-ask-task') : ''}">`;

            // 检查是否有子项
            if (j + 1 < items.length && items[j + 1].level > parentLevel) {
              const nested = buildListFromIndex(j + 1, items[j + 1].level);
              listContent += currItem.content + nested.html + '</li>';
              // 跳过已处理的子项
              i = nested.nextIdx - 1;
            } else {
              listContent += currItem.content + '</li>';
            }
          }

          result += `<${listTag} class="select-ask-${listTag}">${listContent}</${listTag}>`;
          i = groupEnd;
        }
      } else {
        // 当前项层级大于父级，这是子项，应该被上面的逻辑处理
        // 如果走到这里说明有问题，跳过
        i++;
      }
    }

    return { html: result, nextIdx: i };
  }

  // 找到列表开始的位置
  const firstMatch = html.match(/<li class="select-ask-li[^"]*"\s+data-level="\d+">/);
  if (!firstMatch) return html;

  const startIndex = firstMatch.index!;
  const { html: listHtml, nextIdx } = buildListFromIndex(0, 0);

  // 找到列表结束位置
  let endIndex = startIndex;
  const allMatches = [...html.matchAll(/<li class="select-ask-li[^"]*"\s+data-level="\d+">.*?<\/li>/gs)];
  if (allMatches.length > 0) {
    const lastMatch = allMatches[allMatches.length - 1];
    endIndex = lastMatch.index! + lastMatch[0].length;
  }

  // 替换原来的列表项
  return html.substring(0, startIndex) + listHtml + html.substring(endIndex);
}

/**
 * 规范化思考过程文本 - 保留列表缩进
 */
function normalizeReasoningText(text: string): string {
  return text
    .split('\n')
    .map(line => {
      // 检测是否是列表项（有序或无序），保留其缩进
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s/);
      if (listMatch) {
        // 保留最多4个空格的缩进（Markdown 标准缩进）
        const indent = line.match(/^(\s*)/)?.[1] || '';
        const content = line.trim();
        const preservedIndent = indent.slice(0, 4);
        return preservedIndent + content;
      }
      // 非列表项，直接 trim
      return line.trim();
    })
    .filter((line, i, arr) => !(line === '' && arr[i-1] === ''))
    .join('\n')
    .trim();
}

/**
 * 渲染思考过程文本 - 保持原始格式
 */
function renderReasoningText(text: string): string {
  // 思考内容本身就是 markdown 格式，直接使用 renderMarkdown
  return renderMarkdown(text);
}

/**
 * 使用 marked 渲染 Markdown
 */
function renderMarkdown(text: string): string {
  if (!text) return '';

  try {
    // 先用 marked 默认渲染
    let html = marked.parse(text, {
      breaks: true,
      gfm: true,
    }) as string;

    // 分割代码块和非代码块内容，分别处理
    const parts: string[] = [];
    const codeBlockRegex = /<pre>([\s\S]*?)<\/pre>/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(html)) !== null) {
      // 添加代码块之前的内容
      if (match.index > lastIndex) {
        parts.push(html.slice(lastIndex, match.index));
      }
      // 添加代码块（保留原样，稍后添加类名）
      parts.push(`<pre class="select-ask-code-block">${match[1]}</pre>`);
      lastIndex = match.index + match[0].length;
    }
    // 添加最后一部分
    if (lastIndex < html.length) {
      parts.push(html.slice(lastIndex));
    }

    // 处理非代码块内容中的元素
    html = parts.map(part => {
      // 跳过已处理的代码块
      if (part.startsWith('<pre class="select-ask-code-block">')) {
        return part;
      }

      // 处理非代码块内容
      let processed = part;

      // 标题
      processed = processed.replace(/<h1>/g, '<h1 class="select-ask-h1">');
      processed = processed.replace(/<h2>/g, '<h2 class="select-ask-h2">');
      processed = processed.replace(/<h3>/g, '<h3 class="select-ask-h3">');
      processed = processed.replace(/<h4>/g, '<h4 class="select-ask-h4">');
      processed = processed.replace(/<h5>/g, '<h5 class="select-ask-h5">');
      processed = processed.replace(/<h6>/g, '<h6 class="select-ask-h6">');

      // 段落
      processed = processed.replace(/<p>/g, '<p class="select-ask-p">');

      // 行内代码 - 只处理不在代码块内的
      processed = processed.replace(/<code>([^<]*)<\/code>/g, '<code class="select-ask-inline-code">$1</code>');

      // 引用块
      processed = processed.replace(/<blockquote>/g, '<blockquote class="select-ask-blockquote">');

      // 列表
      processed = processed.replace(/<ul>/g, '<ul class="select-ask-ul">');
      processed = processed.replace(/<ol>/g, '<ol class="select-ask-ol">');
      processed = processed.replace(/<li>/g, '<li class="select-ask-li">');

      // 表格
      processed = processed.replace(/<table>/g, '<table class="select-ask-table">');

      // 分割线
      processed = processed.replace(/<hr\s*\/?>/g, '<hr class="select-ask-hr">');

      // 链接 - 添加安全属性
      processed = processed.replace(/<a href="([^"]*)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');

      return processed;
    }).join('');

    return html;
  } catch (error) {
    console.error('Markdown render error:', error);
    return text;
  }
}

/**
 * 调用本地 LLM 进行追问（流式）
 */
async function callFollowUpBackendAPI(
  question: string,
  originalText: string,
  context: any,
  messageElement: HTMLElement,
  inputArea: HTMLElement
): Promise<void> {
  const startTime = Date.now();
  const reasoningText = messageElement.querySelector('.select-ask-reasoning-text') as HTMLElement;
  const answerText = messageElement.querySelector('.select-ask-answer-text') as HTMLElement;
  const reasoningToggle = messageElement.querySelector('.select-ask-reasoning-title') as HTMLElement;
  const textarea = inputArea.querySelector('.select-ask-textarea') as HTMLTextAreaElement;
  const sendBtn = inputArea.querySelector('.select-ask-send-icon') as HTMLButtonElement;
  const reasoningSection = messageElement.querySelector('.select-ask-reasoning-section') as HTMLElement;

  let reasoningContent = '';
  let answerContent = '';
  let hasReasoning = false;
  let hasAnswer = false;

  try {
    // 转换上下文格式
    const llmContext = context ? {
      selected: originalText,
      before: context.before || '',
      after: context.after || '',
    } : undefined;

    // 流式读取响应
    for await (const chunk of streamQuestion(question, originalText, llmContext)) {
      if (chunk === '[REASONING]') {
        // 开始思考过程 - 显示并展开推理区域，移除请求中提示
        hasReasoning = true;
        if (reasoningSection) {
          reasoningSection.style.display = 'block';
          reasoningSection.classList.add('expanded');
        }
        // 移除请求中占位提示
        if (answerText) {
          answerText.innerHTML = '';
          answerText.classList.remove('select-ask-loading-placeholder');
        }
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        if (reasoningText) reasoningText.classList.remove('streaming');
        if (reasoningToggle) reasoningToggle.textContent = '思考过程';
        continue;
      }
      if (chunk.startsWith('[REASONING]')) {
        // 首次收到推理内容时显示推理区域
        if (!hasReasoning) {
          hasReasoning = true;
          if (reasoningSection) {
            reasoningSection.style.display = 'block';
            reasoningSection.classList.add('expanded');
          }
          // 移除请求中占位提示
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        const text = chunk.slice(11);
        reasoningContent += text;
        if (reasoningText) {
          // 移除多余空行，保留列表缩进
          reasoningText.innerHTML = renderReasoningText(normalizeReasoningText(reasoningContent));
        }
      } else if (chunk.startsWith('[ERROR:')) {
        throw new Error(chunk.slice(7, -1));
      } else {
        // 回答内容 - 首次收到时清除加载提示
        if (!hasAnswer) {
          hasAnswer = true;
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        answerContent += chunk;
        if (answerText) answerText.innerHTML = renderMarkdown(answerContent);
      }
    }

    if (answerText) answerText.classList.remove('streaming');

    // 最终规范化思考过程文本
    if (reasoningText && reasoningContent) {
      reasoningText.innerHTML = renderReasoningText(normalizeReasoningText(reasoningContent));
    }

    // 添加操作按钮
    const aiContent = messageElement.querySelector('.select-ask-ai-content') as HTMLElement;
    if (aiContent && answerContent) {
      const elapsed = (Date.now() - startTime) / 1000;
      // 获取 floatingBox
      const floatingBox = messageElement.closest('.select-ask-chat-box') as HTMLElement;

      // 存储重新生成上下文
      messageElement.dataset.regenerateType = 'followup';
      messageElement.dataset.regenerateText = originalText;
      messageElement.dataset.regenerateContext = context ? JSON.stringify(context) : '';
      messageElement.dataset.regenerateQuestion = question;

      if (floatingBox) {
        addActionButtonsToAnswer(aiContent, answerContent, messageElement, floatingBox, inputArea, elapsed, answerContent);
      }
    }

    // 保存追问消息到当前会话
    if (currentSessionId) {
      // 添加用户追问消息
      currentSessionMessages.push({
        role: 'user',
        content: question,
        timestamp: Date.now(),
      });

      // 添加 AI 回答
      currentSessionMessages.push({
        role: 'assistant',
        content: answerContent,
        reasoning: reasoningContent || undefined,
        timestamp: Date.now(),
      });

      // 更新历史记录中的会话
      const currentModel = await getSelectedChatModel();
      await updateSession(currentSessionId, {
        messages: currentSessionMessages,
        title: generateTitle(currentSelectedText, currentSessionType),
        modelId: currentModel?.id || 'unknown',
        modelName: currentModel?.name || 'AI',
      });
    }

    // 启用输入框
    if (textarea && sendBtn) {
      inputArea.dataset.isLoading = 'false';
      sendBtn.disabled = !textarea.value.trim();
      textarea.focus({ preventScroll: true });

      // 绑定发送事件
      const sendMessage = async () => {
        const followUpQuestion = textarea.value.trim();
        if (!followUpQuestion) return;

        inputArea.dataset.isLoading = 'true';
        textarea.value = '';
        textarea.style.height = '48px';
        sendBtn.disabled = true;

        const chatContainer = messageElement.closest('.select-ask-chat-container') as HTMLElement;
        if (chatContainer) {
          const newMessage = createFollowUpMessage(followUpQuestion);
          chatContainer.insertBefore(newMessage, inputArea);

          const aiResponse = await createAIMessage();
          chatContainer.insertBefore(aiResponse, inputArea);

          chatContainer.scrollTop = chatContainer.scrollHeight;

          // 确保对话框在视口内
          const floatingBox = chatContainer.closest('.select-ask-chat-box') as HTMLElement;
          if (floatingBox) {
            ensureBoxInViewport(floatingBox);
          }

          await callFollowUpBackendAPI(followUpQuestion, originalText, context, aiResponse, inputArea);
        }
      };

      sendBtn.onclick = sendMessage;
      textarea.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      };
    }
  } catch (error) {
    console.error('Follow-up API failed:', error);
    if (answerText) {
      const errorMessage = error instanceof Error ? error.message : '请求失败，请稍后重试';
      answerText.innerHTML = `<div class="select-ask-error-message">${errorMessage}</div>`;
      answerText.classList.remove('streaming');
    }
  }
}

/**
 * 启用追问功能
 */
function enableFollowUp(
  messageElement: HTMLElement,
  originalText: string,
  context: any,
  floatingBox: HTMLElement,
  inputArea: HTMLElement
): void {
  const textarea = inputArea.querySelector('.select-ask-textarea') as HTMLTextAreaElement;
  const sendBtn = inputArea.querySelector('.select-ask-send-icon') as HTMLButtonElement;
  const chatContainer = floatingBox.querySelector('.select-ask-chat-container') as HTMLElement;

  if (!textarea || !sendBtn || !chatContainer) return;

  // 标记加载完成，启用输入
  inputArea.dataset.isLoading = 'false';
  sendBtn.disabled = !textarea.value.trim();
  textarea.focus({ preventScroll: true });

  const sendMessage = async () => {
    const question = textarea.value.trim();
    if (!question) return;

    // 标记正在加载
    inputArea.dataset.isLoading = 'true';
    textarea.value = '';
    textarea.style.height = '48px';
    sendBtn.disabled = true;

    const newMessage = createFollowUpMessage(question);
    chatContainer.insertBefore(newMessage, inputArea);

    const aiResponse = await createAIMessage();
    chatContainer.insertBefore(aiResponse, inputArea);

    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 确保对话框在视口内
    ensureBoxInViewport(floatingBox);

    await callFollowUpBackendAPI(question, originalText, context, aiResponse, inputArea);
  };

  sendBtn.onclick = sendMessage;
  textarea.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  const adjustTextareaHeight = () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = Math.max(newHeight, 24) + 'px';
  };
  textarea.onfocus = adjustTextareaHeight;
  textarea.oninput = () => {
    adjustTextareaHeight();
    sendBtn.disabled = !textarea.value.trim();
  };
}



/**
 * 悬浮窗口翻译 - 在选区附近显示悬浮窗口进行翻译
 * 支持窗口内切换目标语言
 */
async function showFloatingTranslation(text: string, context: any): Promise<void> {
  const { createFloatingTranslationWindow } = await import('./floating-window');
  const { getTargetLanguage } = await import('../utils/config-manager');
  const { streamTranslate } = await import('../services/content-llm');

  // 恢复选区
  restoreSelectionRange();

  // 获取选区
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    console.warn('No selection found');
    return;
  }

  const range = selection.getRangeAt(0);
  const targetLang = await getTargetLanguage(text);

  // 清除选区
  clearSelection();

  // 移除图标和下拉菜单
  removeIconMenus();

  let currentTargetLang = targetLang;
  let floatWindow: ReturnType<typeof createFloatingTranslationWindow> | null = null;
  let abortController = new AbortController();

  async function startTranslation(lang: string) {
    if (!floatWindow) return;

    floatWindow.setContent('');
    floatWindow.setStreaming(true);
    abortController = new AbortController();

    let fullText = '';
    let isReasoning = false;
    try {
      for await (const chunk of streamTranslate(text, lang)) {
        if (abortController.signal.aborted) break;
        // 过滤推理标签
        if (chunk === '[REASONING]') { isReasoning = true; continue; }
        if (chunk === '[REASONING_DONE]') { isReasoning = false; continue; }
        if (isReasoning) continue;
        fullText += chunk;
        floatWindow?.appendContent(chunk);
      }
      floatWindow?.setStreaming(false);
    } catch (error) {
      if (!abortController.signal.aborted) {
        floatWindow?.setError(error instanceof Error ? error.message : '翻译出错');
      }
    }
  }

  // 创建悬浮窗口
  floatWindow = createFloatingTranslationWindow(range, {
    initialTargetLanguage: targetLang,
    originalText: text,
    onLanguageChange: async (newLang) => {
      if (newLang === 'auto') {
        // 智能模式：根据文本语言自动选择目标
        currentTargetLang = await getTargetLanguage(text);
      } else {
        currentTargetLang = newLang;
      }
      // 保存语言偏好
      const { setTargetLanguage } = await import('../utils/config-manager');
      await setTargetLanguage(currentTargetLang);
      // 重新翻译
      startTranslation(currentTargetLang);
    },
    onClose: () => {
      abortController.abort();
      floatWindow = null;
    },
  });

  floatWindow.show();

  // 开始翻译
  startTranslation(currentTargetLang);
}

/**
 * 行内翻译 - 短文本显示在原文右侧，长文本显示在原文下方
 * 支持单段和多段文本选择
 * loading 始终显示在段落尾部（不换行），翻译完成后再根据文本长度决定译文显示位置
 */
async function showInPlaceTranslation(text: string, context: any): Promise<void> {
  // 动态导入翻译模块
  const { findParagraphContainer, getAllParagraphsInRange, generateTranslationId, insertTranslation, insertLoadingAtEnd, detectInlineMode, shouldUseInlineMode, removeTranslation, getTextInElementRange } = await import('./translation-dom');
  const { TranslationManager } = await import('./translation-manager');
  const { setupTranslationInteraction, setupSourceElementInteraction, closeTranslation } = await import('./translation-interaction');

  // 恢复选区
  restoreSelectionRange();

  // 获取选区
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    console.warn('No selection found');
    return;
  }

  const range = selection.getRangeAt(0);

  // 检测是否是多段选择
  const paragraphs = getAllParagraphsInRange(range);

  // 获取到段落后清除选区
  clearSelection();

  if (paragraphs.length > 1) {
    // 多段选择：每段单独翻译，一起发送，分别插入
    await translateMultipleParagraphs(paragraphs, range, {
      generateTranslationId,
      insertTranslation,
      insertLoadingAtEnd,
      TranslationManager,
      setupTranslationInteraction,
      setupSourceElementInteraction,
      detectInlineMode,
      shouldUseInlineMode,
      getTextInElementRange,
    });
    return;
  }

  // 单段选择
  const targetParagraph = findParagraphContainer(range);

  if (!targetParagraph) {
    console.warn('Could not find paragraph container, falling back to floating box');
    // 降级：使用浮动框
    await showResponseFloatingBox('翻译', text, context, null);
    return;
  }

  // 生成唯一 ID
  const translationId = generateTranslationId(text);

  // 翻译开始时：在段落后面插入 loading（作为兄弟元素）
  // 先使用原文长度预估模式（短文本使用行内 loading，长文本使用块级 loading）
  const estimatedInline = shouldUseInlineMode(text);
  const { loadingEl, container: loadingContainer } = insertLoadingAtEnd(targetParagraph, estimatedInline, estimatedInline ? range : undefined);

  // 创建临时条目用于管理 loading 状态
  let translationEl: HTMLElement | null = null;
  let separatorNode: Text | undefined;
  let isInline = true; // 默认使用行内模式，等翻译完成后动态判断

  const tempEntry = {
    id: translationId,
    originalText: text,
    sourceElement: targetParagraph,
    translationElement: loadingEl,
    isVisible: true,
    createdAt: Date.now(),
    streamCompleted: false,
  };

  // 注册到管理器
  TranslationManager.register(tempEntry);

  // 流式翻译
  let fullTranslation = '';
  let isReasoning = false; // 是否在思考过程标签内

  try {
    for await (const chunk of streamTranslate(text)) {
      // 处理思考过程标签
      if (chunk === '[REASONING]') {
        isReasoning = true;
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        isReasoning = false;
        continue;
      }

      // 如果在思考过程中，跳过不显示
      if (isReasoning) {
        continue;
      }

      fullTranslation += chunk;

      // 第一条内容到达时，移除 loading 并创建正式译文容器
      if (tempEntry.isVisible) {
        loadingEl.remove();

        // 使用 shouldUseInlineMode 作为初始判断（基于原文长度）
        isInline = shouldUseInlineMode(text);

        const result = insertTranslation(targetParagraph, translationId, isInline, text, isInline ? range : undefined);
        translationEl = result.translationEl;
        separatorNode = result.separatorNode;

        // 更新条目
        tempEntry.translationElement = translationEl;
        tempEntry.sourceElement = targetParagraph;
        tempEntry.separatorNode = separatorNode;

        // 设置交互
        setupTranslationInteraction(translationEl, translationId);

        // 标记为已切换
        tempEntry.isVisible = false;
      }

      // 渲染 Markdown（注意：marked 输出需要 sanitized，这里假设输入来自可信的 LLM）
      if (translationEl) {
        const contentEl = translationEl.querySelector('.select-ask-translation-content');
        if (contentEl) {
          const htmlContent = await marked(fullTranslation) as string;
          contentEl.innerHTML = htmlContent;
        }
        // 滚动到译文可见
        translationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // 流式完成，动态判断是否需要切换模式
    if (translationEl && fullTranslation.trim()) {
      // 使用 detectInlineMode 动态判断
      const shouldBeInline = detectInlineMode(targetParagraph, text, fullTranslation);

      // 如果当前模式与应该使用的模式不同，切换 translationEl 的类名
      if (shouldBeInline !== isInline) {
        translationEl.classList.remove(isInline ? 'inline' : 'block');
        translationEl.classList.add(shouldBeInline ? 'inline' : 'block');
      }
    }

    TranslationManager.update(translationId, { streamCompleted: true });

    // 打印完整译文
    if (fullTranslation.trim()) {
      console.log('[翻译译文]:', fullTranslation);
    }

  } catch (error) {
    console.error('[翻译失败]:', error instanceof Error ? error.message : error);
    // 翻译失败，移除 loading 并显示错误
    loadingEl.remove();
    if (!tempEntry.isVisible && translationEl) {
      const contentEl = translationEl.querySelector('.select-ask-translation-content');
      if (contentEl) {
        contentEl.textContent = `翻译失败：${error instanceof Error ? error.message : String(error)}`;
      }
    }
  }
}

/**
 * 翻译多个段落
 * 参照沉浸式翻译实现：多段文本合并为一个请求，用分隔符分隔
 * 翻译完成后按分隔符拆分结果
 */
async function translateMultipleParagraphs(
  paragraphs: HTMLElement[],
  range: Range,
  deps: {
    generateTranslationId: (text: string) => string;
    insertTranslation: (paragraph: HTMLElement, translationId: string, isInline: boolean, originalText: string, range?: Range) => { translationEl: HTMLElement; wrapper: HTMLElement; container: HTMLElement; separatorNode?: Text };
    insertLoadingAtEnd: (paragraph: HTMLElement, isInline?: boolean, range?: Range) => { loadingEl: HTMLElement; container: HTMLElement; separatorNode?: Text };
    TranslationManager: typeof import('./translation-manager').TranslationManager;
    setupTranslationInteraction: (translationEl: HTMLElement, entryId: string) => void;
    setupSourceElementInteraction: (paragraph: HTMLElement, translationId: string) => void;
    detectInlineMode: (sourceElement: HTMLElement, sourceText: string, translatedText: string) => boolean;
    shouldUseInlineMode: (text: string) => boolean;
    getTextInElementRange: (range: Range, element: HTMLElement) => string;
  }
): Promise<void> {
  const { generateTranslationId, insertTranslation, insertLoadingAtEnd, TranslationManager, setupTranslationInteraction, setupSourceElementInteraction, detectInlineMode, shouldUseInlineMode, getTextInElementRange } = deps;

  // 限制最大段落数量，防止过多请求
  const MAX_PARAGRAPHS = 100;
  let targetParagraphs = paragraphs;

  if (paragraphs.length > MAX_PARAGRAPHS) {
    console.warn('Too many paragraphs detected, using first', MAX_PARAGRAPHS);
    targetParagraphs = paragraphs.slice(0, MAX_PARAGRAPHS);
  }

  // 提取每段在选区内的文本（只提取被选中的文本，不包括嵌套子元素）
  const paragraphTexts: string[] = [];
  for (let i = 0; i < targetParagraphs.length; i++) {
    const p = targetParagraphs[i];
    let text = getTextInElementRange(range, p);
    // 过滤空段落
    if (text) {
      paragraphTexts.push(text);
    }
  }

  // 为每个段落创建加载状态（inline loading）
  const loadingEntries: Array<{
    paragraph: HTMLElement;
    paragraphIdx: number;
    translationId: string;
    loadingEl: HTMLElement;
    container: HTMLElement;
    originalText: string;
    // 翻译完成后填充
    translationEl?: HTMLElement;
  }> = [];

  for (let i = 0; i < targetParagraphs.length; i++) {
    const paragraph = targetParagraphs[i];
    const originalText = paragraphTexts[i] || '';
    if (!originalText) continue;

    const translationId = generateTranslationId('loading-' + i);

    // 在段落内部插入 inline loading（行内显示）
    // 多段落翻译时，loading 应该显示在每个段落内部，而不是段落后面
    const { loadingEl, container } = insertLoadingAtEnd(paragraph, true);

    loadingEntries.push({
      paragraph,
      paragraphIdx: i,
      translationId,
      loadingEl,
      container,
      originalText,
    });
  }

  // 合并多段文本为一个请求（使用 \n\n 分隔，让大模型知道段落边界）
  const combinedText = paragraphTexts.join('\n\n');

  // 打印翻译请求的原文（合并后的）
  console.log('[翻译原文]:', combinedText.substring(0, 500) + (combinedText.length > 500 ? '...' : ''));

  try {
    let fullResponse = '';
    let isReasoning = false;

    // 发起单次翻译请求
    for await (const chunk of streamTranslate(combinedText)) {
      if (chunk === '[REASONING]') {
        isReasoning = true;
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        isReasoning = false;
        continue;
      }
      if (isReasoning) continue;

      fullResponse += chunk;
    }

    // 打印完整译文
    if (fullResponse.trim()) {
      console.log('[翻译译文]:', fullResponse.substring(0, 500) + (fullResponse.length > 500 ? '...' : ''));
    }

    // 尝试按双换行符拆分翻译结果（因为原文是用 \n\n 分隔的）
    // 先尝试按 \n\n 拆分，如果段数不匹配，再尝试按句子拆分
    let translatedSegments = fullResponse.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 0);

    console.log('[段落数]', `原文:${paragraphTexts.length} 段，译文:${translatedSegments.length} 段`);

    // 详细日志：原文段落
    paragraphTexts.forEach((t, i) => {
      console.log(`[原文段落 ${i}]:`, t.substring(0, 100) + (t.length > 100 ? '...' : ''));
    });

    // 详细日志：译文段落
    translatedSegments.forEach((t, i) => {
      console.log(`[译文段落 ${i}]:`, t.substring(0, 100) + (t.length > 100 ? '...' : ''));
    });

    // 如果译文段数与原文段数不匹配，需要重新分配
    if (translatedSegments.length !== loadingEntries.length) {
      console.warn('[翻译段数不匹配] 原文段落:', loadingEntries.length, '译文段落:', translatedSegments.length);

      // 如果译文段数多于原文段数，合并多余的段
      if (translatedSegments.length > loadingEntries.length) {
        const ratio = translatedSegments.length / loadingEntries.length;
        const newSegments: string[] = [];
        for (let i = 0; i < loadingEntries.length; i++) {
          const start = Math.floor(i * ratio);
          const end = Math.floor((i + 1) * ratio);
          newSegments.push(translatedSegments.slice(start, end).join(' '));
        }
        translatedSegments = newSegments;
      }
      // 如果译文段数少于原文段数，将译文平均分配或重复使用
      else if (translatedSegments.length < loadingEntries.length) {
        if (translatedSegments.length === 1) {
          // 只有一段译文，所有段落都使用这一段
          translatedSegments = Array(loadingEntries.length).fill(translatedSegments[0]);
        } else {
          // 按比例分配
          const newSegments: string[] = [];
          const ratio = loadingEntries.length / translatedSegments.length;
          for (let i = 0; i < loadingEntries.length; i++) {
            const segmentIdx = Math.min(Math.floor(i / ratio), translatedSegments.length - 1);
            newSegments.push(translatedSegments[segmentIdx]);
          }
          translatedSegments = newSegments;
        }
      }
    }

    // 为每段创建译文容器
    for (let i = 0; i < loadingEntries.length; i++) {
      const loadingEntry = loadingEntries[i];
      const translationText = translatedSegments[i] || '';

      console.log(`[插入译文 ${i}/${loadingEntries.length}]`, `段落原文:"${loadingEntry.originalText.substring(0, 50)}..." → 译文:"${translationText.substring(0, 50)}..."`);

      // 移除 loading
      loadingEntry.loadingEl.remove();

      // 动态判断使用行内还是块级模式
      const isInline = translationText
        ? detectInlineMode(loadingEntry.paragraph, loadingEntry.originalText, translationText)
        : shouldUseInlineMode(loadingEntry.originalText);

      // 创建正式的译文容器
      const translationId = loadingEntry.translationId;
      const result = insertTranslation(loadingEntry.paragraph, translationId, isInline, loadingEntry.originalText, undefined);

      loadingEntry.translationEl = result.translationEl;

      // 设置交互
      setupTranslationInteraction(result.translationEl, translationId);

      // 渲染译文
      const contentEl = result.translationEl.querySelector('.select-ask-translation-content');
      if (contentEl) {
        if (translationText && translationText.trim()) {
          contentEl.innerHTML = await marked(translationText) as string;
        } else {
          contentEl.innerHTML = '<span class="select-ask-translation-error">翻译失败</span>';
        }
      }

      // 更新 TranslationManager 中的条目
      const entry = TranslationManager.get(translationId);
      if (entry) {
        entry.streamCompleted = true;
      }
    }
  } catch (error) {
    console.error('[翻译失败]:', error instanceof Error ? error.message : error);
    // 翻译失败，移除所有 loading 并显示错误
    for (const loadingEntry of loadingEntries) {
      loadingEntry.loadingEl.remove();
      const contentEl = loadingEntry.container.querySelector('.select-ask-translation-content');
      if (contentEl) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        contentEl.textContent = `翻译失败：${errorMessage}`;
        contentEl.classList.add('select-ask-translation-error');
      }
    }
  }
}

/**
 * 处理菜单动作
 */
async function handleMenuAction(action: string): Promise<void> {
  if (!currentSelectionData) {
    console.error('ERROR: currentSelectionData is null!');
    return;
  }

  const { text, context } = currentSelectionData;

  // 恢复选区高亮
  restoreSelectionRange();

  // 在移除下拉菜单之前获取菜单位置
  let dropdownRect: { left: number; top: number; right: number; bottom: number } | null = null;
  if (currentDropdown && currentDropdown.parentElement) {
    const rect = currentDropdown.getBoundingClientRect();
    dropdownRect = {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      right: rect.right + window.scrollX,
      bottom: rect.bottom + window.scrollY,
    };
  }

  // 移除下拉菜单
  if (currentDropdown) {
    currentDropdown.remove();
    currentDropdown = null;
  }

  // 移除图标
  if (currentIconMenu) {
    currentIconMenu.remove();
    currentIconMenu = null;
  }

  // 获取动作标题
  const titles: Record<string, string> = {
    'explain': '解释',
    'translate': '翻译',
    'question': '提问',
    'summarize': '总结页面',
    'search': '搜索',
  };

  const title = titles[action] || action;

  // 获取当前选中的模型用于统计
  const selectedModel = await getSelectedChatModel();

  if (action === 'question') {
    // 提问功能已删除
  } else if (action === 'summarize') {
    // 段落总结：对选中的文本进行总结
    // userMessage 仅用于显示，summaryPrompt 用于发送给 AI
    const summaryPrompt = `请对以下选中的内容进行简明总结，提取核心要点和关键信息：\n\n${text}`;
    await showResponseInSidebar('总结', '总结', context, summaryPrompt);
  } else if (action === 'translate') {
    // 检查翻译模式配置
    const translationMode = await getTranslationMode();

    // 打印翻译请求的原文
    console.log('[翻译原文]:', text);

    if (translationMode === 'floating') {
      // 悬浮窗口翻译模式
      await showFloatingTranslation(text, context);
    } else if (translationMode === 'inline') {
      // 行内翻译模式
      await showInPlaceTranslation(text, context);
    } else {
      // 侧边栏模式
      await showResponseInSidebar(title, text, context);
    }
  } else if (action === 'explain') {
    // 解释功能使用侧边栏
    await showResponseInSidebar(title, text, context);
  } else if (action === 'search') {
    // AI 搜索功能使用侧边栏
    await showResponseInSidebar(title, text, context);
  } else if (action === 'mindmap') {
    // 基于选中文本生成脑图
    await handleMindMapFromSelection();
  }
}

/**
 * 基于页面全文生成脑图
 */
async function handleMindMapFromPage(): Promise<void> {
  try {
    const extractedContent = extractMainContent();
    if (!extractedContent.content || extractedContent.content.trim().length < 10) {
      showToast('当前页面内容太少，无法生成脑图');
      return;
    }

    const truncatedContent = truncateContent(extractedContent.content, 6000);
    const prompt = `请将以下内容整理为层级化 Markdown 脑图格式。要求：
1. 使用 ## 作为一级标题，### 作为二级标题，#### 作为三级标题
2. 使用 - 列表项表示子节点
3. 结构清晰，层次分明
4. 提取核心要点，不要遗漏重要信息

内容：
${truncatedContent}`;

    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
      selectedText: '',
      context: null,
      userMessage: '生成脑图',
      summaryPrompt: prompt,
      pageUrl: window.location.href,
      pageTitle: extractedContent.title || document.title,
    });
  } catch (error) {
    console.error('[脑图] 生成失败:', error);
    showToast('生成脑图失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * 基于选中文本生成脑图
 */
async function handleMindMapFromSelection(): Promise<void> {
  if (!currentSelectionData) return;

  const { text } = currentSelectionData;
  const prompt = `请将以下内容整理为层级化 Markdown 脑图格式。要求：
1. 使用 ## 作为一级标题，### 作为二级标题，#### 作为三级标题
2. 使用 - 列表项表示子节点
3. 结构清晰，层次分明
4. 提取核心要点，不要遗漏重要信息

内容：
${text}`;

  chrome.runtime.sendMessage({
    type: 'OPEN_SIDE_PANEL',
    selectedText: '',
    context: null,
    userMessage: '生成脑图',
    summaryPrompt: prompt,
    pageUrl: window.location.href,
    pageTitle: document.title,
  });
}

/**
 * 显示页面总结 — 通过 Side Panel 展示
 */
async function showPageSummary(_dropdownRect: { left: number; top: number; right: number; bottom: number } | null = null): Promise<void> {
  try {
    const { extractMainContent, truncateContent, generateSummaryPrompt } = await import('../utils/content-extractor');
    const extractedContent = extractMainContent();
    if (!extractedContent.content || extractedContent.content.trim().length < 10) {
      console.warn('[页面总结] 页面内容太少');
      showToast('当前页面内容太少，无法总结');
      return;
    }

    const truncatedContent = truncateContent(extractedContent.content, 6000);
    const summaryPrompt = generateSummaryPrompt({
      ...extractedContent,
      content: truncatedContent,
    });

    // 通过 Side Panel 展示总结
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
      selectedText: '',
      context: null,
      userMessage: '总结页面',
      summaryPrompt: summaryPrompt,
      pageUrl: window.location.href,
      pageTitle: extractedContent.title || document.title,
    });
  } catch (error) {
    console.error('Failed to generate page summary:', error);
    alert('生成页面总结失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}


function showIconMenu(): void {
  const selection = window.getSelection();
  // 检查选择有效性：非空、非折叠、非纯空白
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !isValidSelection(selection)) {
    return;
  }

  // 立即保存选区
  saveSelectionRange();

  // 获取选中文本信息
  const text = selection.toString();
  const position = getSelectionPosition(selection);
  const contextData = getContextData(selection);
  currentSelectionData = { text, position, context: contextData };

  // 使用鼠标抬起位置显示图标
  if (mouseUpPosition) {
    const iconSize = 36;
    const padding = 8;

    // 图标显示在鼠标位置的右侧，距离很近
    let x = mouseUpPosition.x + padding;
    let y = mouseUpPosition.y - iconSize / 2;

    // 检查右边界，超出则显示在左侧
    if (x + iconSize > window.innerWidth + window.scrollX) {
      x = mouseUpPosition.x - iconSize - padding;
    }

    // 检查上边界
    if (y < window.scrollY) {
      y = window.scrollY + padding;
    }

    // 如果已有图标，先移除
    if (currentIconMenu) {
      currentIconMenu.remove();
      currentIconMenu = null;
    }

    const menu = createIconMenu(x, y);
    document.body.appendChild(menu);
    currentIconMenu = menu;

    // 2 秒后自动隐藏图标（如果还没有被点击）
    selectionTimeout = window.setTimeout(() => {
      if (currentIconMenu && !currentDropdown) {
        fadeOutIcon(currentIconMenu);
      }
    }, 2000) as unknown as number;
  }

  // 清除鼠标位置记录
  mouseUpPosition = null;
}

/**
 * 图标渐变消失
 */
function fadeOutIcon(menu: HTMLElement): void {
  menu.classList.add('fade-out');
  // 等待过渡动画完成后移除
  setTimeout(() => {
    if (currentIconMenu === menu) {
      currentIconMenu = null;
    }
  }, 300);
}

/**
 * 处理鼠标抬起（选择完成）
 */
function handleMouseUp(e: MouseEvent): void {
  // 检查是否点击了菜单或对话框
  if ((e.target as HTMLElement).closest('.select-ask-icon-menu') ||
      (e.target as HTMLElement).closest('.select-ask-dropdown-menu') ||
      (e.target as HTMLElement).closest('.select-ask-chat-box') ||
      (e.target as HTMLElement).closest('.select-ask-sidebar')) {
    return;
  }

  // 记录鼠标抬起位置（考虑滚动偏移）
  mouseUpPosition = {
    x: e.clientX + window.scrollX,
    y: e.clientY + window.scrollY,
  };

  // 清除之前的定时器
  if (selectionTimeout) {
    clearTimeout(selectionTimeout);
  }

  // 50ms 延迟后显示图标
  selectionTimeout = window.setTimeout(() => {
    showIconMenu();
  }, 50) as unknown as number;
}

/**
 * 初始化 content script
 */
function init(): void {
  // 加载缓存
  loadCache();

  // 鼠标按下时隐藏已有菜单（除非是点击图标、浮动框或下拉菜单）
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    const isClickingMenu = target.closest('.select-ask-icon-menu') ||
                           target.closest('.select-ask-dropdown-menu') ||
                           target.closest('.select-ask-chat-box');

    if (!isIconClicking && !isClickingMenu) {
      mouseUpPosition = null;
      currentSelectionData = null;
      removeIconMenus();
      if (currentDropdown) {
        currentDropdown.remove();
        currentDropdown = null;
      }
      currentIconMenu = null;
    }
    isIconClicking = false;
  });

  // 鼠标抬起时显示图标
  document.addEventListener('mouseup', handleMouseUp);

  // 滚动时隐藏图标，避免影响阅读
  let scrollTimeout: number | null = null;
  document.addEventListener('scroll', () => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    scrollTimeout = window.setTimeout(() => {
      scrollTimeout = null;
    }, 150) as unknown as number;

    // 滚动时立即隐藏图标
    if (currentIconMenu && !currentDropdown) {
      fadeOutIcon(currentIconMenu);
      currentIconMenu = null;
    }
  }, true);
}

// 启动
init();

// ==================== 侧边栏功能 ====================

let currentSidebar: HTMLElement | null = null;

/**
 * 创建侧边栏
 */
async function createSidebar(session?: HistorySession): Promise<HTMLElement> {
  // 移除已有的侧边栏
  if (currentSidebar) {
    currentSidebar.remove();
    closeSidebarLayout();
  }

  // 获取用户偏好宽度
  const config = await getAppConfig();
  const savedWidth = config.preferences?.sidebarWidth || 420;

  const sidebar = document.createElement('div');
  sidebar.className = 'select-ask-sidebar';
  sidebar.style.width = `${savedWidth}px`;

  // 创建拖拽手柄
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'select-ask-sidebar-resize-handle';
  resizeHandle.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: ew-resize;
    background: transparent;
    transition: background 0.2s;
    z-index: 10;
  `;

  // 拖拽悬停效果
  resizeHandle.addEventListener('mouseenter', () => {
    resizeHandle.style.background = 'rgba(59, 130, 246, 0.3)';
  });
  resizeHandle.addEventListener('mouseleave', () => {
    resizeHandle.style.background = 'transparent';
  });

  sidebar.appendChild(resizeHandle);

  sidebar.innerHTML += `
    <div class="select-ask-sidebar-header">
      <div class="select-ask-sidebar-header-title">
        <img src="${chrome.runtime.getURL('public/icons/icon48.png')}" alt="Select Ask" class="select-ask-sidebar-logo" />
        <span>Select Ask</span>
      </div>
      <button class="select-ask-sidebar-close">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="select-ask-sidebar-content">
      <div class="select-ask-sidebar-chat"></div>
    </div>
    <div class="select-ask-sidebar-input">
      <div class="select-ask-sidebar-input-box">
        <textarea placeholder="输入消息..." rows="1"></textarea>
        <button class="select-ask-sidebar-send" disabled>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(sidebar);
  currentSidebar = sidebar;

  // 拖拽调整宽度
  let isResizing = false;
  let startX = 0;
  let startWidth = savedWidth;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const deltaX = startX - e.clientX;
    const newWidth = Math.max(300, Math.min(800, startWidth + deltaX));

    sidebar.style.width = `${newWidth}px`;

    // 同步调整页面布局
    document.body.style.marginRight = `${newWidth}px`;
    document.body.style.width = `calc(100% - ${newWidth}px)`;
  });

  document.addEventListener('mouseup', async () => {
    if (!isResizing) return;

    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // 保存宽度到配置
    const newWidth = sidebar.offsetWidth;
    const config = await getAppConfig();
    config.preferences = {
      ...config.preferences,
      sendWithEnter: config.preferences?.sendWithEnter ?? false,
      sidebarWidth: newWidth,
      autoGenerateQuestions: config.preferences?.autoGenerateQuestions ?? true,
    };
    await saveAppConfig(config);
  });

  // 调整页面布局，为侧边栏腾出空间
  openSidebarLayout();

  // 关闭按钮
  const closeBtn = sidebar.querySelector('.select-ask-sidebar-close');
  closeBtn?.addEventListener('click', () => {
    sidebar.remove();
    currentSidebar = null;
    closeSidebarLayout();
  });

  // 如果有会话，恢复会话内容
  if (session) {
    await restoreSession(sidebar, session);
  }

  // 输入框自动调整高度
  const textarea = sidebar.querySelector('textarea') as HTMLTextAreaElement;
  const sendBtn = sidebar.querySelector('.select-ask-sidebar-send') as HTMLButtonElement;

  textarea?.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    sendBtn.disabled = !textarea.value.trim();
  });

  // 发送消息
  sendBtn?.addEventListener('click', async () => {
    const message = textarea.value.trim();
    if (!message) return;

    // 添加用户消息
    addSidebarMessage(sidebar, 'user', message);
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;

    // 添加 AI 消息占位
    const aiMsgElement = addSidebarMessage(sidebar, 'assistant', '', true);

    // 调用 API 获取回答
    await getSidebarAIResponse(sidebar, message, aiMsgElement, session);
  });

  // Enter 发送
  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (textarea.value.trim() && !sendBtn.disabled) {
        sendBtn.click();
      }
    }
  });

  return sidebar;
}

/**
 * 添加侧边栏消息
 */
function addSidebarMessage(sidebar: HTMLElement, role: 'user' | 'assistant', content: string, isLoading: boolean = false): HTMLElement {
  const chatContainer = sidebar.querySelector('.select-ask-sidebar-chat') as HTMLElement;
  const msgDiv = document.createElement('div');
  msgDiv.className = `select-ask-sidebar-message select-ask-sidebar-message-${role}`;

  if (role === 'user') {
    msgDiv.innerHTML = `
      <div class="select-ask-sidebar-message-content">${escapeHtml(content)}</div>
    `;
  } else {
    msgDiv.innerHTML = `
      <div class="select-ask-sidebar-message-content">
        ${isLoading ? '<span class="select-ask-sidebar-loading">思考中...</span>' : renderMarkdown(content)}
      </div>
    `;
  }

  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  return msgDiv;
}

/**
 * 获取侧边栏 AI 响应
 */
async function getSidebarAIResponse(sidebar: HTMLElement, question: string, msgElement: HTMLElement, session?: HistorySession): Promise<void> {
  const contentEl = msgElement.querySelector('.select-ask-sidebar-message-content') as HTMLElement;

  try {
    const model = await getSelectedChatModel();
    if (!model) {
      contentEl.innerHTML = '<span class="select-ask-sidebar-error">请先配置模型</span>';
      return;
    }

    let fullContent = '';
    let reasoningContent = '';
    let hasReasoning = false;
    let hasAnswer = false;

    // 流式读取响应 - 与浮动框模式保持一致
    for await (const chunk of streamQuestion(question, session?.selectedText || '', undefined)) {
      if (chunk === '[REASONING]') {
        hasReasoning = true;
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        continue;
      }
      if (chunk.startsWith('[REASONING]')) {
        if (!hasReasoning) {
          hasReasoning = true;
        }
        reasoningContent += chunk.slice(11);
      } else if (chunk.startsWith('[ERROR:')) {
        throw new Error(chunk.slice(7, -1));
      } else {
        // 回答内容
        if (!hasAnswer) {
          hasAnswer = true;
          if (contentEl) {
            contentEl.innerHTML = '';
          }
        }
        fullContent += chunk;
        if (contentEl) {
          contentEl.innerHTML = renderMarkdown(fullContent);
        }
        const chatContainer = sidebar.querySelector('.select-ask-sidebar-chat') as HTMLElement;
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    contentEl.innerHTML = `<span class="select-ask-sidebar-error">错误: ${errorMessage}</span>`;
  }
}

/**
 * 恢复会话内容
 */
async function restoreSession(sidebar: HTMLElement, session: HistorySession): Promise<void> {
  const chatContainer = sidebar.querySelector('.select-ask-sidebar-chat') as HTMLElement;
  chatContainer.innerHTML = '';

  // 设置会话已保存标记（恢复的会话已存在于历史记录中）
  currentSessionSaved = true;

  // 添加原始选中的文本
  if (session.selectedText) {
    const contextDiv = document.createElement('div');
    contextDiv.className = 'select-ask-sidebar-context';
    contextDiv.innerHTML = `
      <div class="select-ask-sidebar-context-label">原始文本</div>
      <div class="select-ask-sidebar-context-text">${escapeHtml(session.selectedText.slice(0, 200))}${session.selectedText.length > 200 ? '...' : ''}</div>
    `;
    chatContainer.appendChild(contextDiv);
  }

  // 恢复消息
  for (const msg of session.messages) {
    addSidebarMessage(sidebar, msg.role, msg.content);
  }
}

/**
 * 在 Chrome Side Panel 中显示解释/翻译响应
 */
async function showResponseInSidebar(title: string, text: string, context: any, summaryPrompt?: string): Promise<void> {
  // 初始化历史会话
  currentSessionId = generateSessionId();
  currentSelectedText = text;
  currentSessionType = title === '解释' ? 'explain' : title === '翻译' ? 'translate' : title === '搜索' ? 'search' : 'custom';
  currentSessionMessages = [];
  currentSessionSaved = false; // 新建会话，尚未保存到历史记录

  // 只发送"解释"或"翻译"或"搜索"给 AI，不包含选中文本
  const userMessageText = title; // 直接发送"解释"或"翻译"或"搜索"

  currentSessionMessages.push({
    role: 'user',
    content: userMessageText,
    timestamp: Date.now(),
  });

  // 获取页面 URL
  const pageUrl = window.location.href;
  const pageTitle = document.title;

  // 通过 Background 打开 Side Panel，同时传递选中文本和页面信息
  chrome.runtime.sendMessage({
    type: 'OPEN_SIDE_PANEL',
    selectedText: text,
    context: context,
    userMessage: userMessageText,
    summaryPrompt: summaryPrompt || null,
    pageUrl: pageUrl,
    pageTitle: pageTitle,
  }, (response) => {
    if (!response?.success) {
      console.error('Failed to open Side Panel:', response?.error);
    }
  });
}

/**
 * 侧边栏模式下的后端 API 调用
 */
async function callBackendAPIForSidebar(
  action: string,
  text: string,
  context: any,
  messageElement: HTMLElement,
  sidebar: HTMLElement,
  inputArea: HTMLElement
): Promise<void> {
  const startTime = Date.now();

  const actionMap: Record<string, string> = {
    '解释': 'explain',
    '翻译': 'translate',
    '搜索': 'search',
  };

  const apiAction = actionMap[action] || action;

  // 获取思考过程和回答元素
  const reasoningText = messageElement.querySelector('.select-ask-reasoning-text') as HTMLElement;
  const answerText = messageElement.querySelector('.select-ask-answer-text') as HTMLElement;
  const reasoningToggle = messageElement.querySelector('.select-ask-reasoning-title') as HTMLElement;
  const reasoningSection = messageElement.querySelector('.select-ask-reasoning-section') as HTMLElement;
  const aiTimeEl = messageElement.querySelector('.select-ask-ai-time') as HTMLElement;

  // 初始化响应文本
  let reasoningContent = '';
  let answerContent = '';
  let hasReasoning = false;
  let hasAnswer = false;

  try {
    // 转换上下文格式
    const llmContext = context ? {
      selected: text,
      before: context.before || '',
      after: context.after || '',
    } : undefined;

    // 根据动作选择流式生成器
    let streamGenerator;
    if (apiAction === 'translate') {
      streamGenerator = streamTranslate(text);
    } else if (apiAction === 'search') {
      streamGenerator = streamSearch(text, llmContext);
    } else {
      streamGenerator = streamExplain(text, llmContext);
    }

    // 流式读取响应
    for await (const chunk of streamGenerator) {
      if (chunk === '[REASONING]') {
        hasReasoning = true;
        if (reasoningSection) {
          reasoningSection.style.display = 'block';
          reasoningSection.classList.add('expanded');
        }
        if (answerText) {
          answerText.innerHTML = '';
          answerText.classList.remove('select-ask-loading-placeholder');
        }
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        if (reasoningToggle) {
          reasoningToggle.textContent = '思考过程';
        }
        continue;
      }
      if (chunk.startsWith('[REASONING]')) {
        if (!hasReasoning) {
          hasReasoning = true;
          if (reasoningSection) {
            reasoningSection.style.display = 'block';
            reasoningSection.classList.add('expanded');
          }
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        const text = chunk.slice(11);
        reasoningContent += text;
        if (reasoningText) {
          reasoningText.innerHTML = renderReasoningText(normalizeReasoningText(reasoningContent));
        }
      } else if (chunk.startsWith('[ERROR:')) {
        throw new Error(chunk.slice(7, -1));
      } else {
        if (!hasAnswer) {
          hasAnswer = true;
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        answerContent += chunk;
        if (answerText) {
          answerText.innerHTML = renderMarkdown(answerContent);
        }
      }
    }

    // 更新耗时
    const elapsed = (Date.now() - startTime) / 1000;
    if (aiTimeEl) {
      aiTimeEl.textContent = `${elapsed.toFixed(1)}s`;
    }

    // 添加操作按钮
    const aiContent = messageElement.querySelector('.select-ask-ai-content') as HTMLElement;
    if (aiContent && answerContent) {
      messageElement.dataset.regenerateType = apiAction;
      messageElement.dataset.regenerateText = text;
      messageElement.dataset.regenerateContext = context ? JSON.stringify(context) : '';
      addActionButtonsToAnswer(aiContent, answerContent, messageElement, sidebar, inputArea, elapsed, answerContent);
    }

    // 保存到缓存
    saveToCache(text, {
      [apiAction]: answerContent,
      [`${apiAction}Reasoning`]: reasoningContent
    });

    // 保存 AI 回答到当前会话消息
    const currentModel = await getSelectedChatModel();
    currentSessionMessages.push({
      role: 'assistant',
      content: answerContent,
      reasoning: reasoningContent || undefined,
      timestamp: Date.now(),
      modelName: currentModel?.name || 'AI',
      duration: Date.now() - startTime,
    });

    // 保存会话到历史记录
    if (currentSessionId && currentSessionMessages.length > 0) {
      const currentModel = await getSelectedChatModel();
      if (!currentSessionSaved) {
        // 首次保存，添加新会话
        const session: HistorySession = {
          id: currentSessionId,
          title: generateTitle(text, currentSessionType),
          type: currentSessionType,
          selectedText: currentSelectedText,
          messages: currentSessionMessages,
          modelId: currentModel?.id || 'unknown',
          modelName: currentModel?.name || 'AI',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pageUrl: window.location.href,
          pageTitle: document.title,
        };
        await addSession(session);
        currentSessionSaved = true;
      } else {
        // 已保存过，更新会话
        await updateSession(currentSessionId, {
          messages: currentSessionMessages,
          modelId: currentModel?.id || 'unknown',
          modelName: currentModel?.name || 'AI',
        });
      }
    }

    // 启用输入功能
    enableFollowUp(messageElement, text, context, sidebar, inputArea);
    inputArea.dataset.isLoading = 'false';

  } catch (error) {
    console.error('Failed to call LLM:', error);
    if (answerText) {
      const errorMessage = error instanceof Error ? error.message : '请求失败，请稍后重试';
      answerText.innerHTML = `<div class="select-ask-error-message">${errorMessage}</div>`;
    }
    inputArea.dataset.isLoading = 'false';
  }
}

/**
 * 监听来自 popup 的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_SIDEBAR') {
    // 使用 Chrome Side Panel 打开侧边栏
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
      selectedText: message.selectedText,
      context: message.context,
      userMessage: message.userMessage,
    }, (response) => {
      sendResponse({ success: response?.success });
    });
  } else if (message.type === 'CONTINUE_SESSION') {
    // 继续会话 - 使用 Side Panel
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
      selectedText: message.session?.selectedText,
      context: null,
      userMessage: message.session?.messages[0]?.content,
    }, (response) => {
      sendResponse({ success: response?.success });
    });
  } else if (message.type === 'OPEN_HISTORY_SIDEBAR') {
    // 打开历史记录侧边栏
    showHistorySidebarFromPopup();
    sendResponse({ success: true });
  } else if (message.action === 'toggleFullPageTranslate') {
    // 来自 popup 的翻译全文请求
    startFullPageTranslation();
    sendResponse({ success: true });
  } else if (message.action === 'startPageSummarize') {
    // 来自 popup 的总结页面请求 — 统一使用侧边栏
    showPageSummary();
    sendResponse({ success: true });
  } else if (message.action === 'floatingIconToggle') {
    // 来自 popup 的悬浮图标开关请求
    if (message.enabled === false) {
      import('./floating-icon').then(({ destroyFloatingIcon }) => {
        destroyFloatingIcon();
      });
    } else {
      initFloatingIcon();
    }
    sendResponse({ success: true });
  } else if (message.type === 'EXTRACT_PAGE_FOR_MINDMAP') {
    // 提取页面内容用于脑图生成
    try {
      const extractedContent = extractMainContent();
      const truncatedContent = truncateContent(extractedContent.content, 6000);
      sendResponse({
        title: extractedContent.title || document.title,
        content: truncatedContent,
      });
    } catch (error) {
      console.error('[脑图] 页面内容提取失败:', error);
      sendResponse({ error: error instanceof Error ? error.message : String(error) });
    }
  }
  return true;
});

/**
 * 从 popup 打开历史记录侧边栏
 */
async function showHistorySidebarFromPopup(): Promise<void> {
  // 获取历史记录
  const sessions = await getHistory();

  // 创建侧边栏
  const sidebar = document.createElement('div');
  sidebar.className = 'select-ask-history-sidebar';
  currentHistorySidebar = sidebar;

  const typeNames: Record<string, string> = {
    explain: '解释',
    translate: '翻译',
    question: '问答',
    custom: '自定义',
  };

  sidebar.innerHTML = `
    <div class="select-ask-history-sidebar-header">
      <h3>历史记录</h3>
      <button class="select-ask-history-sidebar-close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="select-ask-history-sidebar-list">
      ${sessions.length === 0 ? `
        <div class="select-ask-history-sidebar-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <p>暂无历史记录</p>
        </div>
      ` : ''}
    </div>
  `;

  // 添加关闭按钮事件
  const closeBtn = sidebar.querySelector('.select-ask-history-sidebar-close');
  closeBtn?.addEventListener('click', () => {
    sidebar.remove();
    currentHistorySidebar = null;
  });

  // 渲染历史记录列表
  const listContainer = sidebar.querySelector('.select-ask-history-sidebar-list');
  if (listContainer && sessions.length > 0) {
    sessions.forEach((session) => {
      const item = document.createElement('div');
      item.className = 'select-ask-history-sidebar-item';

      item.innerHTML = `
        <div class="select-ask-history-sidebar-item-header">
          <span class="select-ask-history-sidebar-item-type">${typeNames[session.type] || session.type}</span>
          <span class="select-ask-history-sidebar-item-time">${formatHistoryTime(session.updatedAt)}</span>
        </div>
        <div class="select-ask-history-sidebar-item-title">${escapeHtml(session.title)}</div>
        <div class="select-ask-history-sidebar-item-model">${session.modelName}</div>
      `;

      item.addEventListener('click', () => {
        // 创建新的聊天框并恢复会话
        sidebar.remove();
        currentHistorySidebar = null;
        createChatBoxFromHistory(session);
      });

      listContainer.appendChild(item);
    });
  }

  document.body.appendChild(sidebar);
}


// ============= 初始化全局翻译交互监听 =============
// 在 DOM 加载完成后初始化全局 ESC 键监听器和悬浮图标
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      const { initGlobalInteractions } = await import('./translation-interaction');
      initGlobalInteractions();
      initFloatingIcon();
    });
  } else {
    (async () => {
      const { initGlobalInteractions } = await import('./translation-interaction');
      initGlobalInteractions();
      initFloatingIcon();
    })();
  }
}

/**
 * 初始化右侧悬浮图标
 */
function initFloatingIcon(): void {
  // 延迟初始化，确保页面完全加载
  setTimeout(async () => {
    try {
      // 检查配置是否允许显示悬浮图标（默认开启，兼容旧配置）
      const { getAppConfig } = await import('../utils/config-manager');
      const config = await getAppConfig();
      if (config.showFloatingIcon === false) return;

      const { createFloatingIcon, destroyFloatingIcon, updateMenuState } = await import('./floating-icon');
      const { restoreAllTranslations } = await import('./translation-fullpage');

      // 检查是否已经存在
      if (document.querySelector('.select-ask-floating-icon')) return;

      let isTranslating = false;

      const icon = createFloatingIcon({
        onFullPageTranslate: () => {
          isTranslating = true;
          updateMenuState();
          startFullPageTranslation();
        },
        onRestore: () => {
          restoreAllTranslations();
          isTranslating = false;
          updateMenuState();
        },
        onToggleFullPageTranslate: () => {
          if (isTranslating) {
            // 停止翻译：恢复原文
            restoreAllTranslations();
            isTranslating = false;
            updateMenuState();
          } else {
            // 开始翻译 - 先更新UI，再启动翻译（fire-and-forget）
            isTranslating = true;
            updateMenuState();
            startFullPageTranslation();
          }
        },
        onSummarizePage: () => {
          // 统一使用侧边栏展示页面总结
          showPageSummary();
        },
        onMindMapPage: () => {
          // 基于页面全文生成脑图
          handleMindMapFromPage();
        },
        onClickIcon: () => {
          // 点击图标：切换侧边栏（未打开则打开，已打开则关闭）
          chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL', selectedText: '', context: null, userMessage: '', pageUrl: window.location.href, pageTitle: document.title });
        },
        isTranslating: false,
      });

      document.body.appendChild(icon);
    } catch (error) {
      console.error('[悬浮图标] 初始化失败:', error);
    }
  }, 500);
}

/**
 * 启动全文翻译
 */
async function startFullPageTranslation(): Promise<void> {
  try {
    const { createFullPageTranslationController, restoreAllTranslations } = await import('./translation-fullpage');
    const { getTargetLanguage } = await import('../utils/config-manager');
    const { streamTranslate } = await import('../services/content-llm');

    const targetLang = await getTargetLanguage();

    // 如果已有翻译在进行，先恢复
    const existingTranslation = document.querySelector('[data-sa-translation]');
    if (existingTranslation) {
      restoreAllTranslations();
      return;
    }

    const controller = createFullPageTranslationController({
      targetLanguage: targetLang,
      streamTranslate,
      onProgress: (status) => {
        console.log(`[全文翻译] 进度: ${status.completed}/${status.total}`);
      },
      onDone: () => {
        console.log('[全文翻译] 完成');
      },
      onError: (error) => {
        console.error('[全文翻译] 错误:', error.message);
      },
    });

    await controller.start();
  } catch (error) {
    console.error('[全文翻译] 启动失败:', error);
  }
}

/**
 * 监听配置变更 - 实时更新悬浮图标显示/隐藏
 */
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'sync' || !changes.appConfig) return;

    const newValue = changes.newValue;
    const oldValue = changes.oldValue;
    const wasVisible = oldValue?.showFloatingIcon !== false;
    const nowVisible = newValue?.showFloatingIcon !== false;

    if (wasVisible && !nowVisible) {
      // 配置关闭：销毁悬浮图标
      import('./floating-icon').then(({ destroyFloatingIcon }) => {
        destroyFloatingIcon();
        console.log('[悬浮图标] 已因配置关闭而销毁');
      });
    } else if (!wasVisible && nowVisible) {
      // 配置开启：重新创建
      initFloatingIcon();
      console.log('[悬浮图标] 已因配置开启而重建');
    }
  });
}