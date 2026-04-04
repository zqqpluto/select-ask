import { getContextData } from '../utils/context';
import { isValidSelection, getSelectionPosition, removeIconMenus } from './utils';
import { streamExplain, streamTranslate, streamQuestion, generateQuestions as llmGenerateQuestions } from '../services/content-llm';
import {
  addSession,
  updateSession,
  generateSessionId,
  generateTitle,
  getHistory,
} from '../utils/history-manager';
import { getSelectedChatModel, getAppConfig, saveAppConfig, setSelectedChatModel, getSelectedChatModels, getDisplayMode, setDisplayMode } from '../utils/config-manager';
import { extractMainContent, truncateContent, generateSummaryPrompt } from '../utils/content-extractor';
import type { HistorySession, HistoryMessage } from '../types/history';
import type { ProviderType } from '../types/llm';
import type { ModelConfig, DisplayMode } from '../types/config';
import { marked } from 'marked';

// 样式
import styleContent from './style.css?inline';
import chatStyleContent from './chat-style.css?inline';

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
  style.textContent = styleContent + '\n' + chatStyleContent;

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
let currentSessionType: 'explain' | 'translate' | 'question' | 'custom' = 'explain';
let currentSelectedText: string = '';
let currentSessionMessages: HistoryMessage[] = [];

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
        console.log('Model switched to:', modelId);
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
      currentFloatingBox = null;
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
  const currentMode = await getDisplayMode();
  const newMode: DisplayMode = currentMode === 'sidebar' ? 'floating' : 'sidebar';

  // 保存当前聊天内容和输入区域的引用
  const chatContainer = box.querySelector('.select-ask-chat-container') as HTMLElement;
  const inputArea = box.querySelector('.select-ask-input-area') as HTMLElement;

  // 保存当前的滚动位置
  const scrollTop = chatContainer?.scrollTop || 0;

  // 保存新的显示模式
  await setDisplayMode(newMode);

  // 先将旧容器设置为透明，避免闪烁
  box.style.opacity = '0';
  box.style.transition = 'opacity 0.15s ease-out';

  // 等待过渡完成
  await new Promise(resolve => setTimeout(resolve, 150));

  // 根据新模式创建新容器
  let newBox: HTMLElement;

  if (newMode === 'sidebar') {
    // 创建侧边栏容器
    newBox = document.createElement('div');
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
    currentFloatingBox = null;

    // 淡入新容器
    requestAnimationFrame(() => {
      newBox.style.transition = 'opacity 0.2s ease-out';
      newBox.style.opacity = '1';
      if (chatContainer) {
        chatContainer.scrollTop = scrollTop;
      }
    });

  } else {
    // 创建浮动窗口容器
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // 计算浮动窗口位置
    const boxWidth = Math.min(viewportWidth * 0.5, 700);
    const boxHeight = Math.min(viewportHeight * 0.77, 770);
    const x = scrollX + (viewportWidth - boxWidth) / 2;
    const y = scrollY + (viewportHeight - boxHeight) / 2;

    newBox = document.createElement('div');
    newBox.className = 'select-ask-chat-box';
    newBox.style.left = `${x}px`;
    newBox.style.top = `${y}px`;
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
    currentFloatingBox = newBox;

    // 移除旧的 box
    box.remove();
    // 如果从侧边栏切换到浮动框，恢复页面布局
    if (currentSidebar) {
      closeSidebarLayout();
    }
    currentSidebar = null;

    // 淡入新容器
    requestAnimationFrame(() => {
      newBox.style.transition = 'opacity 0.2s ease-out';
      newBox.style.opacity = '1';
      if (chatContainer) {
        chatContainer.scrollTop = scrollTop;
      }
    });
  }

  showToast(newMode === 'sidebar' ? '已切换到侧边栏模式' : '已切换到浮动窗口模式', 'info');
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
    currentFloatingBox = null;
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
let currentFloatingBox: HTMLElement | null = null; // 当前浮动框
let currentDropdown: HTMLElement | null = null; // 当前下拉菜单
let savedRange: Range | null = null; // 保存的选中文本范围
let currentQuestionText: string = ''; // 当前问题的文本内容
let currentQuestionContext: any = null; // 当前问题的上下文

// 缓存接口
interface CachedResponse {
  questions: string[];
  customQuestions: string[]; // 用户自定义的问题
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
    console.log('Cache cleared (new session)');
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
    questions: [],
    customQuestions: [],
    explain: '',
    translate: '',
    timestamp: Date.now(),
  };

  if (data.questions) existing.questions = data.questions;
  if (data.customQuestions) existing.customQuestions = data.customQuestions;
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
 * 添加用户自定义问题到缓存
 */
function addCustomQuestion(text: string, question: string): void {
  const hash = getTextHash(text);
  const existing = responseCache.get(hash);

  if (existing) {
    // 避免重复添加
    if (!existing.customQuestions.includes(question)) {
      existing.customQuestions.push(question);
      saveCache();
    }
  }
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
    selection.removeAllRanges();
    selection.addRange(savedRange);
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
 * 显示二级菜单（解释、翻译、提问）- 包含加载进度
 */
function showDropdownMenu(x: number, y: number, showLoading: boolean = false): HTMLElement {
  const dropdown = document.createElement('div');
  dropdown.className = 'select-ask-dropdown-menu';
  dropdown.style.left = `${x}px`;
  dropdown.style.top = `${y}px`;

  const menuItems = [
    { key: 'explain', label: '解释', icon: '💡' },
    { key: 'translate', label: '翻译', icon: '🌐' },
    { key: 'question', label: '提问', icon: '❓' },
    { key: 'summarize', label: '总结页面', icon: '📄' },
  ];

  menuItems.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'select-ask-dropdown-item';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'select-ask-dropdown-icon';
    iconSpan.textContent = item.icon;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'select-ask-dropdown-label';
    labelSpan.textContent = item.label;

    button.appendChild(iconSpan);
    button.appendChild(labelSpan);

    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault(); // 阻止默认行为，保持选区
      console.log('=== Menu item button clicked ===');
      console.log('Item key:', item.key);
      console.log('currentSelectionData:', currentSelectionData);
      await handleMenuAction(item.key);
    });
    dropdown.appendChild(button);
  });

  // 如果显示加载状态，添加分隔线和加载指示器
  if (showLoading) {
    const divider = document.createElement('div');
    divider.className = 'select-ask-dropdown-divider';
    dropdown.appendChild(divider);

    const loadingSection = document.createElement('div');
    loadingSection.className = 'select-ask-dropdown-loading';

    const spinner = document.createElement('div');
    spinner.className = 'select-ask-dropdown-spinner';
    loadingSection.appendChild(spinner);

    const loadingText = document.createElement('div');
    loadingText.className = 'select-ask-dropdown-loading-text';
    loadingText.textContent = 'AI 正在生成问题...';
    loadingSection.appendChild(loadingText);

    dropdown.appendChild(loadingSection);
  }

  document.body.appendChild(dropdown);
  return dropdown;
}

/**
 * 更新下拉菜单 - 移除加载状态，显示问题列表（包含AI生成的问题和用户自定义问题）
 */
function updateDropdownMenuWithQuestions(aiQuestions: string[]): void {
  if (!currentDropdown) return;

  // 获取缓存的自定义问题
  let customQuestions: string[] = [];
  if (currentSelectionData) {
    const cached = getCachedResponse(currentSelectionData.text);
    if (cached && cached.customQuestions.length > 0) {
      customQuestions = cached.customQuestions;
    }
  }

  // 移除现有的加载部分
  const loadingSection = currentDropdown.querySelector('.select-ask-dropdown-loading');
  if (loadingSection) {
    loadingSection.remove();
  }

  // 移除分隔线
  const divider = currentDropdown.querySelector('.select-ask-dropdown-divider');
  if (divider) {
    divider.remove();
  }

  // 合并所有问题
  const allQuestions = [...aiQuestions, ...customQuestions];

  if (allQuestions.length === 0) {
    // 没有问题时不显示任何内容
    return;
  }

  // 添加新的分隔线
  const newDivider = document.createElement('div');
  newDivider.className = 'select-ask-dropdown-divider';
  currentDropdown.appendChild(newDivider);

  // 添加问题列表
  const questionsSection = document.createElement('div');
  questionsSection.className = 'select-ask-dropdown-questions';

  const questionsHeader = document.createElement('div');
  questionsHeader.className = 'select-ask-dropdown-questions-header';
  questionsHeader.innerHTML = `
    <span>常见问题</span>
    <button class="select-ask-regenerate-mini-button" title="重新生成问题">↻</button>
  `;
  questionsSection.appendChild(questionsHeader);

  // 重新生成按钮事件
  const regenerateBtn = questionsHeader.querySelector('.select-ask-regenerate-mini-button');
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      regenerateDropdownQuestions(questionsList, questionsHeader, aiQuestions);
    });
  }

  const questionsList = document.createElement('div');
  questionsList.className = 'select-ask-dropdown-questions-list';

  allQuestions.forEach((question, index) => {
    const questionItem = document.createElement('button');
    questionItem.className = 'select-ask-dropdown-question-item';

    // 如果是自定义问题，添加标记
    const isCustom = index >= aiQuestions.length;
    if (isCustom) {
      questionItem.innerHTML = `<span class="select-ask-question-badge">🔖</span> ${question}`;
      questionItem.classList.add('select-ask-custom-question');
    } else {
      questionItem.textContent = question;
    }

    questionItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault(); // 阻止默认行为，保持选区
      await handleQuestionClick(question);
    });
    questionsList.appendChild(questionItem);
  });

  questionsSection.appendChild(questionsList);
  currentDropdown.appendChild(questionsSection);
}

/**
 * 在下拉菜单中重新生成问题
 */
async function regenerateDropdownQuestions(
  questionsListElement: HTMLElement,
  questionsHeader: HTMLElement,
  originalAIQuestions: string[]
): Promise<void> {
  if (!currentSelectionData) return;

  const { text, context } = currentSelectionData;

  // 显示加载状态
  questionsListElement.innerHTML = `
    <div style="padding: 14px 18px; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <span class="select-ask-dropdown-spinner"></span>
      <span class="select-ask-dropdown-loading-text">重新生成中...</span>
    </div>
  `;

  // 禁用重新生成按钮
  const regenerateBtn = questionsHeader.querySelector('.select-ask-regenerate-mini-button');
  if (regenerateBtn) {
    regenerateBtn.disabled = true;
    regenerateBtn.style.opacity = '0.5';
  }

  try {
    const newQuestions = await generateQuestions(text, context);

    // 清空加载状态
    questionsListElement.innerHTML = '';

    if (newQuestions.length > 0) {
      // 获取缓存的自定义问题
      const cached = getCachedResponse(text);
      const customQuestions = (cached && cached.customQuestions) || [];

      // 合并所有问题
      const allQuestions = [...newQuestions, ...customQuestions];

      // 清除该文本的缓存并保存新问题
      clearTextCache(text);
      saveToCache(text, { questions: newQuestions, customQuestions: customQuestions });

      // 显示新问题
      allQuestions.forEach((question, index) => {
        const questionItem = document.createElement('button');
        questionItem.className = 'select-ask-dropdown-question-item';

        const isCustom = index >= newQuestions.length;
        if (isCustom) {
          questionItem.innerHTML = `<span class="select-ask-question-badge">🔖</span> ${question}`;
          questionItem.classList.add('select-ask-custom-question');
        } else {
          questionItem.textContent = question;
        }

        questionItem.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          await handleQuestionClick(question);
        });
        questionsListElement.appendChild(questionItem);
      });
    } else {
      questionsListElement.innerHTML = `
        <div style="padding: 14px 18px; text-align: center; color: #999; font-size: 13px;">
          未能生成问题，请稍后重试
        </div>
      `;
    }
  } catch (error) {
    questionsListElement.innerHTML = `
      <div style="padding: 14px 18px; display: flex; align-items: center; justify-content: center; gap: 8px; color: #ff4d4f; font-size: 13px; background: #fff1f0; border-radius: 8px; margin: 6px;">
        <span>⚠️</span>
        <span>${error.message || '生成问题失败，请稍后重试'}</span>
      </div>
    `;
  } finally {
    // 恢复重新生成按钮
    if (regenerateBtn) {
      regenerateBtn.disabled = false;
      regenerateBtn.style.opacity = '1';
    }
  }
}

/**
 * 处理图标点击 - 显示下拉菜单并开始生成常见问题
 */
function handleMenuClick(e: MouseEvent, iconMenu: HTMLElement): void {
  console.log('Icon clicked!', e.target);
  isIconClicking = false;

  // 获取图标位置
  const rect = iconMenu.getBoundingClientRect();
  const dropdownX = rect.left + window.scrollX;
  const dropdownY = rect.bottom + window.scrollY + 4;

  // 渐变隐藏图标（不删除，保持选中文本状态）
  iconMenu.classList.add('fade-out');

  // 立即恢复选区高亮
  restoreSelectionRange();

  // 显示二级菜单（带加载状态）
  const dropdown = showDropdownMenu(dropdownX, dropdownY, true);
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

  // 后台自动生成常见问题
  generateQuestionsInBackground();
}

/**
 * 后台生成常见问题 - 在下拉菜单中显示进度
 */
function generateQuestionsInBackground(): void {
  if (!currentSelectionData) return;

  const { text, context } = currentSelectionData;

  // 检查缓存
  const cached = getCachedResponse(text);
  if (cached && cached.questions.length > 0) {
    console.log('Using cached questions:', cached.questions);
    // 更新下拉菜单，显示问题列表
    updateDropdownMenuWithQuestions(cached.questions);
    return;
  }

  // 后台生成问题
  generateQuestions(text, context).then((questions) => {
    if (questions.length > 0) {
      // 保存到缓存
      saveToCache(text, { questions });
      // 更新下拉菜单，显示问题列表
      updateDropdownMenuWithQuestions(questions);
    }
  }).catch((error) => {
    console.error('Questions generation failed:', error);
    // 显示错误状态
    if (currentDropdown) {
      const loadingSection = currentDropdown.querySelector('.select-ask-dropdown-loading');
      if (loadingSection) {
        loadingSection.innerHTML = `
          <div class="select-ask-dropdown-error">
            <span class="select-ask-error-icon">⚠️</span>
            <span class="select-ask-error-text">${error.message || '生成问题失败，请稍后重试'}</span>
          </div>
        `;
      }
    }
  });
}

/**
 * 重新生成问题
 */
async function regenerateQuestions(questionsListElement: HTMLElement): Promise<void> {
  if (!currentSelectionData) return;

  const { text, context } = currentSelectionData;

  // 清空当前问题列表，显示加载状态
  questionsListElement.innerHTML = `
    <div class="select-ask-questions-loading-inline">
      <div class="select-ask-spinner-inline"></div>
      <span>重新生成中...</span>
    </div>
  `;

  try {
    const questions = await generateQuestions(text, context);

    // 清空加载状态
    questionsListElement.innerHTML = '';

    if (questions.length > 0) {
      // 清除该文本的缓存并保存新问题
      clearTextCache(text);
      saveToCache(text, { questions });

      // 显示新问题
      questions.forEach((question) => {
        const questionItem = document.createElement('button');
        questionItem.className = 'select-ask-question-item-inline';
        questionItem.textContent = question;
        questionItem.addEventListener('click', async () => {
          await handleQuestionClick(question);
        });
        questionsListElement.appendChild(questionItem);
      });
    } else {
      questionsListElement.innerHTML = `
        <div class="select-ask-questions-empty-inline">
          <span>未能生成问题，请稍后重试</span>
        </div>
      `;
    }
  } catch (error) {
    questionsListElement.innerHTML = `
      <div class="select-ask-questions-error-inline">
        ${error instanceof Error ? error.message : '生成问题失败，请稍后重试'}
      </div>
    `;
  }
}

/**
 * 显示问题生成加载框
 */
function showLoadingQuestionsBox(position: { x: number; y: number }): void {
  // 如果已有浮动框，先关闭
  if (currentFloatingBox) {
    currentFloatingBox.remove();
  }

  const box = document.createElement('div');
  box.className = 'select-ask-floating-box select-ask-questions-box';
  box.style.left = `${position.x}px`;
  box.style.top = `${position.y + 50}px`;
  box.style.width = '400px';

  const header = document.createElement('div');
  header.className = 'select-ask-floating-box-header';
  header.innerHTML = `
    <span class="select-ask-floating-box-title">常见问题</span>
    <button class="select-ask-floating-box-close">×</button>
  `;
  box.appendChild(header);

  const content = document.createElement('div');
  content.className = 'select-ask-floating-box-content';
  content.innerHTML = `
    <div class="select-ask-loading">
      <div class="select-ask-loading-spinner"></div>
      <div class="select-ask-loading-text">AI 正在分析并生成问题...</div>
      <div class="select-ask-loading-subtext">这通常需要几秒钟</div>
    </div>
  `;
  box.appendChild(content);

  // 关闭按钮事件
  const closeBtn = header.querySelector('.select-ask-floating-box-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      box.remove();
      currentFloatingBox = null;
    });
  }

  document.body.appendChild(box);
  currentFloatingBox = box;

  // 设置点击外部关闭对话框
  setupClickOutsideClose(box);

  // 调整位置确保不超出视口
  setTimeout(() => {
    adjustBoxPosition(box, parseInt(box.style.left), parseInt(box.style.top));
  }, 0);
}

/**
 * 创建问题列表浮动框
 */
async function showQuestionsFloatingBox(questions: string[], position: { x: number; y: number }): Promise<void> {
  // 如果已有浮动框，先关闭
  if (currentFloatingBox) {
    currentFloatingBox.remove();
  }

  // 计算位置
  let x = 100, y = 100;
  if (currentSelectionData && currentSelectionData.position) {
    x = currentSelectionData.position.x + 150;
    y = currentSelectionData.position.y;
  }

  const box = document.createElement('div');
  box.className = 'select-ask-chat-box';
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;

  // 添加可拖拽标题栏
  const header = await createChatHeader(box);
  box.appendChild(header);
  setupDraggable(box, header);
  setupHistoryButton(header, box);
  setupFullscreenButton(header, box);
  setupCloseButton(header, box);

  // 聊天容器
  const chatContainer = document.createElement('div');
  chatContainer.className = 'select-ask-chat-container';

  // AI 消息 - 问题列表
  const aiMessage = document.createElement('div');
  aiMessage.className = 'select-ask-message select-ask-message-ai';

  const aiContent = document.createElement('div');
  aiContent.className = 'select-ask-message-content';
  aiContent.innerHTML = `
    <div class="select-ask-ai-content">
      <div class="select-ask-questions-header-inline">
        <span class="select-ask-questions-title">相关问题</span>
        <button class="select-ask-regenerate-mini-btn" title="重新生成">↻</button>
      </div>
      <div class="select-ask-questions-list-inline"></div>
    </div>
  `;
  aiMessage.appendChild(aiContent);

  const questionsList = aiMessage.querySelector('.select-ask-questions-list-inline') as HTMLElement;

  // 显示加载状态或问题
  if (questions.length === 0) {
    questionsList.innerHTML = `
      <div class="select-ask-questions-loading-inline">
        <div class="select-ask-spinner-inline"></div>
        <span>正在生成问题...</span>
      </div>
    `;
  } else {
    questions.forEach((question) => {
      const questionItem = document.createElement('button');
      questionItem.className = 'select-ask-question-item-inline';
      questionItem.textContent = question;
      questionItem.addEventListener('click', async () => {
        await handleQuestionClick(question);
      });
      questionsList.appendChild(questionItem);
    });
  }

  chatContainer.appendChild(aiMessage);
  box.appendChild(chatContainer);

  // 输入区域
  const inputArea = document.createElement('div');
  inputArea.className = 'select-ask-input-area';

  // 输入框容器（圆角卡片）
  const inputBox = document.createElement('div');
  inputBox.className = 'select-ask-input-box';

  // 输入行：文本框
  const inputRow = document.createElement('div');
  inputRow.className = 'select-ask-input-row';

  const textarea = document.createElement('textarea');
  textarea.className = 'select-ask-textarea';
  textarea.placeholder = '输入自定义问题...';
  textarea.rows = 1;
  inputRow.appendChild(textarea);

  inputBox.appendChild(inputRow);

  // 控制行：模型选择 + 发送按钮（放在底部）
  const controlsRow = document.createElement('div');
  controlsRow.className = 'select-ask-controls-row';

  // 创建模型选择器
  const modelSelector = await createModelSelector();
  controlsRow.appendChild(modelSelector);

  const sendBtn = document.createElement('button');
  sendBtn.className = 'select-ask-send-icon';
  sendBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  `;
  controlsRow.appendChild(sendBtn);

  inputBox.appendChild(controlsRow);
  inputArea.appendChild(inputBox);

  box.appendChild(inputArea);

  document.body.appendChild(box);
  currentFloatingBox = box;

  // 重新生成按钮事件
  const regenerateBtn = aiMessage.querySelector('.select-ask-regenerate-mini-btn');
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      regenerateQuestions(questionsList);
    });
  }

  // 自定义问题输入事件
  textarea.addEventListener('input', () => {
    sendBtn.disabled = !textarea.value.trim();
  });

  const sendCustomQuestion = async () => {
    const question = textarea.value.trim();
    if (!question) return;
    textarea.value = '';
    sendBtn.disabled = true;
    await handleQuestionClick(question);
  };

  sendBtn.addEventListener('click', sendCustomQuestion);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCustomQuestion();
    }
  });

  // 初始禁用发送按钮
  sendBtn.disabled = true;

  // 调整位置确保不超出视口
  setTimeout(() => {
    adjustBoxPosition(box, parseInt(box.style.left), parseInt(box.style.top));
  }, 0);

  // 设置点击外部关闭对话框
  setupClickOutsideClose(box);
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
 * 显示响应浮动框（解释/翻译） - 聊天样式
 */
async function showResponseFloatingBox(title: string, text: string, context: any, dropdownRect: { left: number; top: number; right: number; bottom: number } | null = null): Promise<void> {
  console.log('=== showResponseFloatingBox called ===');
  console.log('Title:', title);
  console.log('Text:', text);
  console.log('Context:', context);
  console.log('DropdownRect:', dropdownRect);

  // 检查显示模式
  const displayMode = await getDisplayMode();
  if (displayMode === 'sidebar') {
    // 侧边栏模式
    await showResponseInSidebar(title, text, context);
    return;
  }

  // 如果已有浮动框，先关闭
  if (currentFloatingBox) {
    currentFloatingBox.remove();
  }

  // 初始化历史会话
  currentSessionId = generateSessionId();
  currentSelectedText = text;
  currentSessionType = title === '解释' ? 'explain' : title === '翻译' ? 'translate' : 'custom';
  currentSessionMessages = [];

  // 保存用户消息
  let userMessageText = '';
  const targetLang = getTargetLanguage();
  if (title === '解释') {
    userMessageText = `解释${text}是什么`;
  } else if (title === '翻译') {
    userMessageText = `将"${text}"翻译成${targetLang}`;
  } else {
    userMessageText = text;
  }
  currentSessionMessages.push({
    role: 'user',
    content: userMessageText,
    timestamp: Date.now(),
  });

  // 获取视口信息
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // 对话框的预估尺寸
  const estimatedBoxWidth = Math.min(viewportWidth * 0.5, 700);
  const estimatedBoxHeight = Math.min(viewportHeight * 0.77, 770);

  // 计算位置
  let x = 100, y = 100;
  const margin = 20; // 与边缘的最小距离
  const gap = 10; // 与下拉菜单的间距

  if (dropdownRect) {
    // 尝试将对话框放在下拉菜单右侧
    const rightSideX = dropdownRect.right + gap;
    const leftSideX = dropdownRect.left - estimatedBoxWidth - gap;

    // 计算垂直位置：与下拉菜单顶部对齐
    const topY = dropdownRect.top;
    const bottomY = dropdownRect.bottom - estimatedBoxHeight;

    // 优先放在右侧，如果空间不够则放左侧
    if (rightSideX + estimatedBoxWidth < viewportWidth + scrollX - margin) {
      x = rightSideX;
    } else if (leftSideX > scrollX + margin) {
      x = leftSideX;
    } else {
      // 如果左右都不够，放在视口中间偏左
      x = scrollX + margin;
    }

    // 垂直位置：优先顶部对齐，确保不超出视口
    if (topY + estimatedBoxHeight < viewportHeight + scrollY - margin) {
      y = topY;
    } else if (bottomY > scrollY + margin) {
      y = bottomY;
    } else {
      y = scrollY + margin;
    }
  } else if (currentSelectionData && currentSelectionData.position) {
    const selX = currentSelectionData.position.x;
    const selY = currentSelectionData.position.y;

    // 放在选区右侧
    if (selX + 150 + estimatedBoxWidth < viewportWidth + scrollX - margin) {
      x = selX + 150;
    } else {
      x = scrollX + margin;
    }

    if (selY + estimatedBoxHeight < viewportHeight + scrollY - margin) {
      y = selY;
    } else {
      y = scrollY + margin;
    }
  }

  const box = document.createElement('div');
  box.className = 'select-ask-chat-box';
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;

  // 添加可拖拽标题栏
  const header = await createChatHeader(box);
  box.appendChild(header);
  setupDraggable(box, header);
  setupHistoryButton(header, box);
  setupFullscreenButton(header, box);
  setupCloseButton(header, box);

  // 聊天容器
  const chatContainer = document.createElement('div');
  chatContainer.className = 'select-ask-chat-container';

  // 用户消息
  const userMessage = document.createElement('div');
  userMessage.className = 'select-ask-message select-ask-message-user';
  userMessage.innerHTML = `
    <div class="select-ask-message-content">
      <div class="select-ask-message-time">${formatTime()}</div>
      <div class="select-ask-message-body">
        <div class="select-ask-message-text">${escapeHtml(userMessageText)}</div>
      </div>
    </div>
  `;
  chatContainer.appendChild(userMessage);

  // AI 消息
  const aiMessage = document.createElement('div');
  aiMessage.className = 'select-ask-message select-ask-message-ai';

  const aiContent = document.createElement('div');
  aiContent.className = 'select-ask-message-content';

  // 获取当前模型配置并设置内容
  const currentModel = await getSelectedChatModel();
  const modelName = currentModel?.name || 'AI';
  const modelNameDisplay = modelName;

  // 始终创建思考过程区域，但初始隐藏
  // 当收到推理内容时动态显示
  aiContent.innerHTML = `
    <div class="select-ask-ai-header">
      <span class="select-ask-message-time">${formatTime()}</span>
      <span class="select-ask-ai-divider">·</span>
      <span class="select-ask-ai-model-name">${modelNameDisplay}</span>
      <span class="select-ask-ai-divider">·</span>
      <span class="select-ask-ai-time"></span>
    </div>
    <div class="select-ask-ai-content">
      <div class="select-ask-reasoning-section" style="display: none;">
        <button class="select-ask-reasoning-toggle" aria-expanded="true">
          <span class="select-ask-reasoning-icon">💭</span>
          <span class="select-ask-reasoning-title">思考中...</span>
          <span class="select-ask-reasoning-chevron">▼</span>
        </button>
        <div class="select-ask-reasoning-content">
          <div class="select-ask-reasoning-text"></div>
        </div>
      </div>
      <div class="select-ask-answer-text select-ask-loading-placeholder">请求中...</div>
    </div>
  `;

  aiMessage.appendChild(aiContent);

  // 思考过程折叠/展开 - 在元素添加到 DOM 后绑定事件
  const reasoningToggle = aiMessage.querySelector('.select-ask-reasoning-toggle');
  const reasoningSection = aiMessage.querySelector('.select-ask-reasoning-section');

  reasoningToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isExpanded = reasoningSection?.classList.toggle('expanded');
    reasoningToggle?.setAttribute('aria-expanded', String(!!isExpanded));
  });

  chatContainer.appendChild(aiMessage);

  box.appendChild(chatContainer);

  // 输入区域 - 添加到 box 而不是 chatContainer，使其固定在底部
  const inputArea = document.createElement('div');
  inputArea.className = 'select-ask-input-area';
  inputArea.dataset.isLoading = 'true'; // 标记正在加载

  // 输入框容器（圆角卡片）
  const inputBox = document.createElement('div');
  inputBox.className = 'select-ask-input-box';

  // 输入行：文本框
  const inputRow = document.createElement('div');
  inputRow.className = 'select-ask-input-row';

  const textarea = document.createElement('textarea');
  textarea.className = 'select-ask-textarea';
  textarea.placeholder = '追问或提出新问题...';
  textarea.rows = 1;
  inputRow.appendChild(textarea);

  inputBox.appendChild(inputRow);

  // 控制行：模型选择 + 发送按钮（放在底部）
  const controlsRow = document.createElement('div');
  controlsRow.className = 'select-ask-controls-row';

  // 创建模型选择器
  const modelSelector = await createModelSelector();
  controlsRow.appendChild(modelSelector);

  const sendBtn = document.createElement('button');
  sendBtn.className = 'select-ask-send-icon';
  sendBtn.disabled = true;
  sendBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  `;
  controlsRow.appendChild(sendBtn);

  inputBox.appendChild(controlsRow);
  inputArea.appendChild(inputBox);

  box.appendChild(inputArea);

  document.body.appendChild(box);
  currentFloatingBox = box;

  // 为用户消息添加操作按钮
  addUserMessageActions(userMessage, userMessageText, inputArea);

  // 调整位置确保不超出视口
  setTimeout(() => {
    adjustBoxPosition(box, parseInt(box.style.left), parseInt(box.style.top));
  }, 0);

  // 设置点击外部关闭对话框
  setupClickOutsideClose(box);

  // 自动调整文本框高度
  const adjustTextareaHeight = () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = Math.max(newHeight, 24) + 'px';
  };

  textarea.addEventListener('focus', adjustTextareaHeight);
  textarea.addEventListener('input', () => {
    adjustTextareaHeight();
    // 只有不在加载状态时才启用发送按钮
    if (inputArea.dataset.isLoading !== 'true') {
      sendBtn.disabled = !textarea.value.trim();
    }
  });

  // 支持 Enter 发送，Shift+Enter 换行
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (textarea.value.trim() && !sendBtn.disabled) {
        sendBtn.click();
      }
    }
  });

  // 发送按钮点击事件
  sendBtn.addEventListener('click', async () => {
    const question = textarea.value.trim();
    if (!question) return;

    // 添加新消息到聊天容器
    const newMessage = createFollowUpMessage(question);
    chatContainer.appendChild(newMessage);

    // 清空输入框并重置状态
    textarea.value = '';
    textarea.style.height = '48px';
    sendBtn.disabled = true;

    // 调用后端 API
    const aiResponseMessage = await createAIMessage();
    chatContainer.appendChild(aiResponseMessage);

    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 确保对话框在视口内
    ensureBoxInViewport(box);

    // 调用 API 获取回答
    callFollowUpBackendAPI(question, text, context, aiResponseMessage, inputArea);
  });

  // 调用后端 API
  callBackendAPI(title, text, context, aiMessage, box, inputArea);
}

/**
 * 创建追问用户消息
 */
function createFollowUpMessage(question: string): HTMLElement {
  const message = document.createElement('div');
  message.className = 'select-ask-message select-ask-message-user';
  message.innerHTML = `
    <div class="select-ask-message-content">
      <div class="select-ask-message-time">${formatTime()}</div>
      <div class="select-ask-message-body">
        <div class="select-ask-message-text">${escapeHtml(question)}</div>
      </div>
    </div>
  `;
  return message;
}

/**
 * 为用户消息添加操作按钮（复制、编辑）
 */
function addUserMessageActions(
  messageElement: HTMLElement,
  messageText: string,
  inputArea?: HTMLElement
): void {
  const messageBody = messageElement.querySelector('.select-ask-message-body');
  if (!messageBody) return;

  // 检查是否已有操作区
  if (messageBody.querySelector('.select-ask-user-actions')) return;

  const actionsArea = document.createElement('div');
  actionsArea.className = 'select-ask-user-actions';
  actionsArea.style.cssText = 'display: flex; gap: 6px; margin-top: 6px; justify-content: flex-end;';

  // 复制按钮
  const copyBtn = document.createElement('button');
  copyBtn.className = 'select-ask-user-action-btn';
  copyBtn.title = '复制';
  copyBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;
  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(messageText);
    copyBtn.classList.add('copied');
    showToast('✅复制成功', 'success');
    setTimeout(() => copyBtn.classList.remove('copied'), 1500);
  });

  // 编辑按钮
  const editBtn = document.createElement('button');
  editBtn.className = 'select-ask-user-action-btn';
  editBtn.title = '编辑并重新提问';
  editBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  `;
  editBtn.addEventListener('click', () => {
    if (inputArea) {
      const textarea = inputArea.querySelector('.select-ask-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = messageText;
        textarea.focus();
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      }
    }
  });

  actionsArea.appendChild(copyBtn);
  actionsArea.appendChild(editBtn);
  messageBody.appendChild(actionsArea);
}

/**
 * 创建 AI 消息（用于追问回复）
 */
async function createAIMessage(): Promise<HTMLElement> {
  const message = document.createElement('div');
  message.className = 'select-ask-message select-ask-message-ai';

  // 获取当前模型配置
  const currentModel = await getSelectedChatModel();
  const modelName = currentModel?.name || 'AI';

  const aiContent = document.createElement('div');
  aiContent.className = 'select-ask-message-content';

  // 始终创建思考过程区域，但初始隐藏
  // 当收到推理内容时动态显示
  aiContent.innerHTML = `
    <div class="select-ask-ai-header">
      <span class="select-ask-message-time">${formatTime()}</span>
      <span class="select-ask-ai-divider">·</span>
      <span class="select-ask-ai-model-name">${modelName}</span>
      <span class="select-ask-ai-divider">·</span>
      <span class="select-ask-ai-time"></span>
    </div>
    <div class="select-ask-ai-content">
      <div class="select-ask-reasoning-section" style="display: none;">
        <button class="select-ask-reasoning-toggle" aria-expanded="true">
          <span class="select-ask-reasoning-icon">💭</span>
          <span class="select-ask-reasoning-title">思考中...</span>
          <span class="select-ask-reasoning-chevron">▼</span>
        </button>
        <div class="select-ask-reasoning-content">
          <div class="select-ask-reasoning-text"></div>
        </div>
      </div>
      <div class="select-ask-answer-text select-ask-loading-placeholder">请求中...</div>
    </div>
  `;
  message.appendChild(aiContent);

  // 思考过程折叠/展开
  const reasoningToggle = message.querySelector('.select-ask-reasoning-toggle');
  const reasoningSection = message.querySelector('.select-ask-reasoning-section');

  reasoningToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isExpanded = reasoningSection?.classList.toggle('expanded');
    reasoningToggle?.setAttribute('aria-expanded', String(!!isExpanded));
  });

  return message;
}

/**
 * 显示问题响应浮动框
 */
async function showQuestionResponseFloatingBox(question: string, text: string, context: any, dropdownRect?: { left: number; top: number; right: number; bottom: number } | null): Promise<void> {
  // 如果已有浮动框，先关闭
  if (currentFloatingBox) {
    currentFloatingBox.remove();
  }

  // 初始化历史会话
  currentSessionId = generateSessionId();
  currentSelectedText = text;
  currentSessionType = 'question';
  currentSessionMessages = [];

  // 保存用户问题消息
  currentSessionMessages.push({
    role: 'user',
    content: question,
    timestamp: Date.now(),
  });

  // 获取视口信息
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // 对话框的预估尺寸
  const estimatedBoxWidth = Math.min(viewportWidth * 0.5, 700);
  const estimatedBoxHeight = Math.min(viewportHeight * 0.77, 770);

  // 计算位置：优先使用传入的下拉菜单位置，其次使用选区位置
  let x = 100, y = 100;
  const margin = 20; // 与边缘的最小距离
  const gap = 10; // 与下拉菜单的间距

  if (dropdownRect) {
    // 尝试将对话框放在下拉菜单右侧
    const rightSideX = dropdownRect.right + gap;
    const leftSideX = dropdownRect.left - estimatedBoxWidth - gap;

    // 计算垂直位置：与下拉菜单顶部对齐
    const topY = dropdownRect.top;
    const bottomY = dropdownRect.bottom - estimatedBoxHeight;

    // 优先放在右侧，如果空间不够则放左侧
    if (rightSideX + estimatedBoxWidth < viewportWidth + scrollX - margin) {
      x = rightSideX;
    } else if (leftSideX > scrollX + margin) {
      x = leftSideX;
    } else {
      // 如果左右都不够，放在视口中间偏左
      x = scrollX + margin;
    }

    // 垂直位置：优先顶部对齐，确保不超出视口
    if (topY + estimatedBoxHeight < viewportHeight + scrollY - margin) {
      y = topY;
    } else if (bottomY > scrollY + margin) {
      y = bottomY;
    } else {
      y = scrollY + margin;
    }
  } else if (currentSelectionData && currentSelectionData.position) {
    // 使用选区位置
    const selX = currentSelectionData.position.x;
    const selY = currentSelectionData.position.y;

    // 放在选区右侧
    if (selX + 150 + estimatedBoxWidth < viewportWidth + scrollX - margin) {
      x = selX + 150;
    } else {
      x = scrollX + margin;
    }

    if (selY + estimatedBoxHeight < viewportHeight + scrollY - margin) {
      y = selY;
    } else {
      y = scrollY + margin;
    }
  }

  const box = document.createElement('div');
  box.className = 'select-ask-chat-box';
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;

  // 添加可拖拽标题栏
  const header = await createChatHeader(box);
  box.appendChild(header);
  setupDraggable(box, header);
  setupHistoryButton(header, box);
  setupFullscreenButton(header, box);
  setupCloseButton(header, box);

  // 聊天容器
  const chatContainer = document.createElement('div');
  chatContainer.className = 'select-ask-chat-container';

  // 用户消息
  const userMessage = document.createElement('div');
  userMessage.className = 'select-ask-message select-ask-message-user';
  userMessage.innerHTML = `
    <div class="select-ask-message-content">
      <div class="select-ask-message-time">${formatTime()}</div>
      <div class="select-ask-message-body">
        <div class="select-ask-message-text">${escapeHtml(question)}</div>
      </div>
    </div>
  `;
  chatContainer.appendChild(userMessage);

  // AI 消息
  const aiMessage = document.createElement('div');
  aiMessage.className = 'select-ask-message select-ask-message-ai';
  aiMessage.innerHTML = `
    <div class="select-ask-message-content">
      <div class="select-ask-ai-header">
        <span class="select-ask-message-time">${formatTime()}</span>
        <span class="select-ask-ai-divider">·</span>
        <span class="select-ask-ai-model-name"></span>
        <span class="select-ask-ai-divider">·</span>
        <span class="select-ask-ai-time"></span>
      </div>
      <div class="select-ask-ai-content">
        <div class="select-ask-model-badge"></div>
        <div class="select-ask-reasoning-section" style="display: none;">
          <button class="select-ask-reasoning-toggle" aria-expanded="true">
            <span class="select-ask-reasoning-icon">💭</span>
            <span class="select-ask-reasoning-title">思考中...</span>
            <span class="select-ask-reasoning-chevron">▼</span>
          </button>
          <div class="select-ask-reasoning-content">
            <div class="select-ask-reasoning-text"></div>
          </div>
        </div>
        <div class="select-ask-answer-text"></div>
      </div>
    </div>
  `;

  // 异步设置模型名称
  getSelectedChatModel().then(currentModel => {
    const modelName = currentModel?.name || 'AI';

    const modelNameEl = aiMessage.querySelector('.select-ask-ai-model-name');
    if (modelNameEl) {
      modelNameEl.textContent = modelName;
    }
  });

  chatContainer.appendChild(aiMessage);

  box.appendChild(chatContainer);

  // 输入区域 - 添加到 box 而不是 chatContainer，使其固定在底部
  const inputArea = document.createElement('div');
  inputArea.className = 'select-ask-input-area';
  inputArea.dataset.isLoading = 'true'; // 标记正在加载

  // 输入框容器（圆角卡片）
  const inputBox = document.createElement('div');
  inputBox.className = 'select-ask-input-box';

  // 输入行：文本框
  const inputRow = document.createElement('div');
  inputRow.className = 'select-ask-input-row';

  const textarea = document.createElement('textarea');
  textarea.className = 'select-ask-textarea';
  textarea.placeholder = '追问或提出新问题...';
  textarea.rows = 1;
  inputRow.appendChild(textarea);

  inputBox.appendChild(inputRow);

  // 控制行：模型选择 + 发送按钮（放在底部）
  const controlsRow = document.createElement('div');
  controlsRow.className = 'select-ask-controls-row';

  // 创建模型选择器
  const modelSelector = await createModelSelector();
  controlsRow.appendChild(modelSelector);

  const sendBtn = document.createElement('button');
  sendBtn.className = 'select-ask-send-icon';
  sendBtn.disabled = true;
  sendBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  `;
  controlsRow.appendChild(sendBtn);

  inputBox.appendChild(controlsRow);
  inputArea.appendChild(inputBox);

  box.appendChild(inputArea);

  document.body.appendChild(box);
  currentFloatingBox = box;

  // 为用户消息添加操作按钮
  addUserMessageActions(userMessage, question, inputArea);

  // 调整位置确保不超出视口
  setTimeout(() => {
    adjustBoxPosition(box, parseInt(box.style.left), parseInt(box.style.top));
  }, 0);

  // 设置点击外部关闭对话框
  setupClickOutsideClose(box);

  // 思考过程折叠/展开
  const reasoningToggle = aiMessage.querySelector('.select-ask-reasoning-toggle');
  const reasoningSection = aiMessage.querySelector('.select-ask-reasoning-section');

  reasoningToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isExpanded = reasoningSection?.classList.toggle('expanded');
    reasoningToggle?.setAttribute('aria-expanded', String(!!isExpanded));
  });

  // 自动调整文本框高度
  const adjustTextareaHeight = () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = Math.max(newHeight, 24) + 'px';
  };

  textarea.addEventListener('focus', adjustTextareaHeight);
  textarea.addEventListener('input', () => {
    adjustTextareaHeight();
    // 只有不在加载状态时才启用发送按钮
    if (inputArea.dataset.isLoading !== 'true') {
      sendBtn.disabled = !textarea.value.trim();
    }
  });

  // 支持 Enter 发送，Shift+Enter 换行
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (textarea.value.trim() && !sendBtn.disabled) {
        sendBtn.click();
      }
    }
  });

  // 发送按钮点击事件
  sendBtn.addEventListener('click', async () => {
    const followUpQuestion = textarea.value.trim();
    if (!followUpQuestion) return;

    // 添加新消息到聊天容器
    const newMessage = createFollowUpMessage(followUpQuestion);
    chatContainer.appendChild(newMessage);

    // 清空输入框并重置状态
    textarea.value = '';
    textarea.style.height = '48px';
    sendBtn.disabled = true;

    // 调用后端 API
    const aiResponseMessage = await createAIMessage();
    chatContainer.appendChild(aiResponseMessage);

    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 确保对话框在视口内
    ensureBoxInViewport(box);

    // 调用 API 获取回答
    callFollowUpBackendAPI(followUpQuestion, text, context, aiResponseMessage, inputArea);
  });

  // 调用后端 API
  callQuestionBackendAPI(question, text, context, aiMessage, box, inputArea);
}

/**
 * 调用本地 LLM 获取问题回答（流式）
 */
async function callQuestionBackendAPI(question: string, text: string, context: any, messageElement: HTMLElement, floatingBox: HTMLElement, inputArea: HTMLElement): Promise<void> {
  const startTime = Date.now();
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
    // 转换上下文格式
    const llmContext = context ? {
      selected: text,
      before: context.before || '',
      after: context.after || '',
    } : undefined;

    // 流式读取响应
    for await (const chunk of streamQuestion(question, text, llmContext)) {
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
      messageElement.dataset.regenerateType = 'question';
      messageElement.dataset.regenerateText = text;
      messageElement.dataset.regenerateContext = context ? JSON.stringify(context) : '';
      messageElement.dataset.regenerateQuestion = question;

      addActionButtonsToAnswer(aiContent, answerContent, messageElement, floatingBox, inputArea, elapsed, answerContent);
    }

    // 保存问题回答到当前会话
    if (currentSessionId) {
      // 添加 AI 回答（用户消息已在 showQuestionResponseFloatingBox 中添加）
      currentSessionMessages.push({
        role: 'assistant',
        content: answerContent,
        reasoning: reasoningContent || undefined,
        timestamp: Date.now(),
      });

      // 首次保存会话到历史记录
      const currentModel = await getSelectedChatModel();
      const session: HistorySession = {
        id: currentSessionId,
        title: question,
        type: currentSessionType,
        selectedText: currentSelectedText,
        messages: currentSessionMessages,
        modelId: currentModel?.id || 'unknown',
        modelName: currentModel?.name || 'AI',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await addSession(session);
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
  console.log('=== callBackendAPI called ===');
  console.log('Action:', action);
  console.log('Text:', text);
  console.log('Context:', context);

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
    console.log('=== Starting LLM stream ===');

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
      console.log('Received chunk:', chunk);

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
    currentSessionMessages.push({
      role: 'assistant',
      content: answerContent,
      reasoning: reasoningContent || undefined,
      timestamp: Date.now(),
    });

    // 保存会话到历史记录
    if (currentSessionId && currentSessionMessages.length > 0) {
      const currentModel = await getSelectedChatModel();
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
      };
      await addSession(session);
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
 * 处理问题点击
 */
async function handleQuestionClick(question: string): Promise<void> {
  if (!currentSelectionData) return;

  const { text, context } = currentSelectionData;

  // 获取当前选中的模型用于统计
  const selectedModel = await getSelectedChatModel();

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

  // 移除问题框和下拉菜单
  if (currentFloatingBox) {
    currentFloatingBox.remove();
    currentFloatingBox = null;
  }
  if (currentDropdown) {
    currentDropdown.remove();
    currentDropdown = null;
  }

  // 显示问题响应浮动框
  await showQuestionResponseFloatingBox(question, text, context, dropdownRect);

  // 移除所有菜单
  removeIconMenus();
  currentIconMenu = null;
}

/**
 * 调用本地 LLM 生成问题
 */
async function generateQuestions(text: string, context: any): Promise<string[]> {
  try {
    // 转换上下文格式
    const llmContext = context ? {
      selected: text,
      before: context.before || '',
      after: context.after || '',
    } : undefined;

    return await llmGenerateQuestions(text, llmContext);
  } catch (error) {
    console.error('Failed to generate questions:', error);
    throw error;
  }
}

/**
 * 处理菜单动作
 */
async function handleMenuAction(action: string): Promise<void> {
  console.log('=== handleMenuAction called ===');
  console.log('Action:', action);
  console.log('currentSelectionData:', currentSelectionData);
  if (!currentSelectionData) {
    console.error('ERROR: currentSelectionData is null!');
    return;
  }

  const { text, context } = currentSelectionData;
  console.log('Selected text:', text);
  console.log('Context:', context);

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

  console.log('Menu action:', action, 'Text:', text);

  // 获取动作标题
  const titles: Record<string, string> = {
    'explain': '解释',
    'translate': '翻译',
    'question': '提问',
    'summarize': '总结页面',
  };

  const title = titles[action] || action;

  console.log('=== About to check action ===');
  console.log('Action value:', action);

  // 获取当前选中的模型用于统计
  const selectedModel = await getSelectedChatModel();

  if (action === 'question') {
    console.log('=== Handling question action ===');
    // 显示问题输入框，让用户输入问题
    await showCustomQuestionInputBox(text, context, dropdownRect);
  } else if (action === 'summarize') {
    console.log('=== Handling summarize action ===');
    // 统计总结功能使用
    // 显示页面总结
    await showPageSummary(dropdownRect);
  } else if (action === 'explain' || action === 'translate') {
    console.log('=== Handling explain/translate action ===');
    // 显示响应浮动框
    await showResponseFloatingBox(title, text, context, dropdownRect);
  } else {
    console.log('=== Unknown action:', action);
  }
}

/**
 * 显示页面总结
 */
async function showPageSummary(dropdownRect: { left: number; top: number; right: number; bottom: number } | null = null): Promise<void> {
  console.log('=== showPageSummary called ===');

  try {
    // 提取页面内容
    const extractedContent = extractMainContent();
    console.log('Extracted content:', {
      title: extractedContent.title,
      wordCount: extractedContent.wordCount,
      method: extractedContent.extractionMethod,
    });

    // 截断内容（限制在6000 tokens）
    const truncatedContent = truncateContent(extractedContent.content, 6000);

    // 生成总结提示词
    const summaryPrompt = generateSummaryPrompt({
      ...extractedContent,
      content: truncatedContent,
    });

    // 获取当前显示模式
    const displayMode = await getDisplayMode();

    if (displayMode === 'sidebar') {
      // 在侧边栏中显示
      await showSummaryInSidebar(extractedContent.title, summaryPrompt);
    } else {
      // 在浮动框中显示
      await showSummaryInFloatingBox(extractedContent.title, summaryPrompt, dropdownRect);
    }
  } catch (error) {
    console.error('Failed to generate page summary:', error);
    // 显示错误提示
    alert('生成页面总结失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * 在侧边栏中显示页面总结
 */
async function showSummaryInSidebar(title: string, prompt: string): Promise<void> {
  console.log('=== showSummaryInSidebar called ===');

  // 显示侧边栏
  await showSidebar();

  // 等待侧边栏创建完成
  await new Promise(resolve => setTimeout(resolve, 100));

  if (!currentHistorySidebar) {
    console.error('Sidebar not created');
    return;
  }

  // 初始化历史会话
  currentSessionId = generateSessionId();
  currentSelectedText = title;
  currentSessionType = 'custom';
  currentSessionMessages = [];

  // 创建消息容器
  const messagesContainer = currentHistorySidebar.querySelector('.select-ask-sidebar-messages');
  if (!messagesContainer) {
    console.error('Messages container not found');
    return;
  }

  // 清空现有消息
  messagesContainer.innerHTML = '';

  // 添加用户消息（页面标题）
  const userMessage: HistoryMessage = {
    role: 'user',
    content: `总结页面: ${title}`,
    timestamp: Date.now(),
  };
  currentSessionMessages.push(userMessage);

  const userMessageElement = document.createElement('div');
  userMessageElement.className = 'select-ask-sidebar-message user';
  userMessageElement.innerHTML = `
    <div class="select-ask-sidebar-message-content">
      <div class="select-ask-sidebar-message-text">总结页面: ${title}</div>
    </div>
  `;
  messagesContainer.appendChild(userMessageElement);

  // 创建AI消息元素
  const aiMessageElement = document.createElement('div');
  aiMessageElement.className = 'select-ask-sidebar-message ai';
  aiMessageElement.innerHTML = `
    <div class="select-ask-sidebar-message-avatar">
      <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="AI">
    </div>
    <div class="select-ask-sidebar-message-content">
      <div class="select-ask-sidebar-message-text"></div>
    </div>
  `;
  messagesContainer.appendChild(aiMessageElement);

  const textElement = aiMessageElement.querySelector('.select-ask-sidebar-message-text');
  if (!textElement) {
    console.error('Text element not found');
    return;
  }

  // 显示加载状态
  textElement.innerHTML = '<div class="select-ask-loading">正在生成总结...</div>';

  // 调用LLM API
  try {
    const selectedModel = await getSelectedChatModel();
    if (!selectedModel) {
      throw new Error('未配置模型，请先在设置中配置模型');
    }

    // 使用问答接口获取总结
    const messages = [{ role: 'user' as const, content: prompt }];
    let fullResponse = '';

    // 流式调用
    for await (const chunk of streamQuestion(messages, selectedModel)) {
      fullResponse += chunk;
      // 渲染Markdown
      textElement.innerHTML = await marked(fullResponse) as string;
      // 滚动到底部
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 保存AI消息到历史
    const aiMessage: HistoryMessage = {
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
    };
    currentSessionMessages.push(aiMessage);

    // 保存会话
    const sessionTitle = await generateTitle(`总结: ${title}`);
    await addSession({
      id: currentSessionId,
      title: sessionTitle,
      type: currentSessionType,
      messages: currentSessionMessages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

  } catch (error) {
    console.error('Failed to get summary:', error);
    textElement.innerHTML = `<div class="select-ask-error">生成总结失败: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
}

/**
 * 在浮动框中显示页面总结
 */
async function showSummaryInFloatingBox(title: string, prompt: string, dropdownRect: { left: number; top: number; right: number; bottom: number } | null = null): Promise<void> {
  console.log('=== showSummaryInFloatingBox called ===');

  // 创建浮动框
  const floatingBox = document.createElement('div');
  floatingBox.className = 'select-ask-floating-box';
  floatingBox.style.cssText = `
    position: absolute;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 16px;
    max-width: 600px;
    max-height: 500px;
    overflow-y: auto;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  `;

  // 设置位置
  if (dropdownRect) {
    floatingBox.style.left = `${dropdownRect.left}px`;
    floatingBox.style.top = `${dropdownRect.bottom + 8}px`;
  } else {
    floatingBox.style.left = '50%';
    floatingBox.style.top = '50%';
    floatingBox.style.transform = 'translate(-50%, -50%)';
  }

  // 创建标题
  const titleElement = document.createElement('div');
  titleElement.style.cssText = `
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #1f2937;
  `;
  titleElement.textContent = `总结页面: ${title}`;
  floatingBox.appendChild(titleElement);

  // 创建内容区域
  const contentElement = document.createElement('div');
  contentElement.style.cssText = `
    font-size: 14px;
    line-height: 1.6;
    color: #374151;
  `;

  // 显示加载状态
  contentElement.innerHTML = '<div style="color: #6b7280;">正在生成总结...</div>';
  floatingBox.appendChild(contentElement);

  // 创建关闭按钮
  const closeButton = document.createElement('button');
  closeButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: transparent;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #9ca3af;
    padding: 4px;
  `;
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => {
    floatingBox.remove();
  });
  floatingBox.appendChild(closeButton);

  document.body.appendChild(floatingBox);
  currentFloatingBox = floatingBox;

  // 调用LLM API
  try {
    const selectedModel = await getSelectedChatModel();
    if (!selectedModel) {
      throw new Error('未配置模型，请先在设置中配置模型');
    }

    // 使用问答接口获取总结
    const messages = [{ role: 'user' as const, content: prompt }];
    let fullResponse = '';

    // 流式调用
    for await (const chunk of streamQuestion(messages, selectedModel)) {
      fullResponse += chunk;
      // 渲染Markdown
      contentElement.innerHTML = await marked(fullResponse) as string;
    }

  } catch (error) {
    console.error('Failed to get summary:', error);
    contentElement.innerHTML = `<div style="color: #ef4444;">生成总结失败: ${error instanceof Error ? error.message : String(error)}</div>`;
  }
}

/**
 * 显示自定义问题输入框
 */
/**
 * 截断文本，中间省略
 */
function truncateText(text: string, maxLength: number = 100): { text: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }
  const startLength = Math.floor(maxLength / 2);
  const endLength = Math.floor(maxLength / 2);
  return {
    text: text.slice(0, startLength) + '...' + text.slice(-endLength),
    truncated: true
  };
}

async function showCustomQuestionInputBox(text: string, context: any, dropdownRect: { left: number; top: number; right: number; bottom: number } | null = null): Promise<void> {
  // 如果已有浮动框，先关闭
  if (currentFloatingBox) {
    currentFloatingBox.remove();
  }

  // 计算位置
  let x = 100, y = 100;
  if (dropdownRect) {
    x = dropdownRect.right + 8;
    y = dropdownRect.top;
  } else if (currentSelectionData && currentSelectionData.position) {
    x = currentSelectionData.position.x + 150;
    y = currentSelectionData.position.y;
  }

  const box = document.createElement('div');
  box.className = 'select-ask-chat-box';
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;

  // 添加可拖拽标题栏
  const header = await createChatHeader(box);
  box.appendChild(header);
  setupDraggable(box, header);
  setupHistoryButton(header, box);
  setupFullscreenButton(header, box);
  setupCloseButton(header, box);

  // 聊天容器
  const chatContainer = document.createElement('div');
  chatContainer.className = 'select-ask-chat-container';

  // 引用卡片 - 显示选中的文本
  const quoteCard = document.createElement('div');
  quoteCard.className = 'select-ask-quote-card';
  const { text: displayText, truncated } = truncateText(text, 120);
  quoteCard.innerHTML = `
    <div class="select-ask-quote-label">📝 选中文本${truncated ? '（已截断）' : ''}</div>
    <div class="select-ask-quote-text">${escapeHtml(displayText)}</div>
  `;
  chatContainer.appendChild(quoteCard);

  box.appendChild(chatContainer);

  // 输入区域
  const inputArea = document.createElement('div');
  inputArea.className = 'select-ask-input-area';
  inputArea.dataset.isLoading = 'false';

  // 输入框容器（圆角卡片）
  const inputBox = document.createElement('div');
  inputBox.className = 'select-ask-input-box';

  // 输入行：文本框
  const inputRow = document.createElement('div');
  inputRow.className = 'select-ask-input-row';

  const textarea = document.createElement('textarea');
  textarea.className = 'select-ask-textarea';
  textarea.placeholder = '输入您的问题...';
  textarea.rows = 1;
  inputRow.appendChild(textarea);

  inputBox.appendChild(inputRow);

  // 控制行：模型选择 + 发送按钮（放在底部）
  const controlsRow = document.createElement('div');
  controlsRow.className = 'select-ask-controls-row';

  // 创建模型选择器
  const modelSelector = await createModelSelector();
  controlsRow.appendChild(modelSelector);

  const sendBtn = document.createElement('button');
  sendBtn.className = 'select-ask-send-icon';
  sendBtn.disabled = true;
  sendBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  `;
  controlsRow.appendChild(sendBtn);

  inputBox.appendChild(controlsRow);
  inputArea.appendChild(inputBox);

  box.appendChild(inputArea);

  document.body.appendChild(box);
  currentFloatingBox = box;

  // 初始禁用发送按钮
  sendBtn.disabled = true;

  // 自动调整文本框高度
  const adjustTextareaHeight = () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = Math.max(newHeight, 24) + 'px';
  };

  textarea.addEventListener('focus', adjustTextareaHeight);
  textarea.addEventListener('input', () => {
    adjustTextareaHeight();
    // 只有不在加载状态时才启用发送按钮
    if (inputArea.dataset.isLoading !== 'true') {
      sendBtn.disabled = !textarea.value.trim();
    }
  });

  // 支持 Enter 发送，Shift+Enter 换行
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (textarea.value.trim() && !sendBtn.disabled) {
        sendBtn.click();
      }
    }
  });

  // 发送按钮点击事件
  const submitQuestion = () => {
    const question = textarea.value.trim();
    if (!question) return;

    // 用户消息 - 显示用户的问题
    const userMessage = document.createElement('div');
    userMessage.className = 'select-ask-message select-ask-message-user';
    userMessage.innerHTML = `
      <div class="select-ask-message-content">
        <div class="select-ask-message-time">${formatTime()}</div>
        <div class="select-ask-message-body">
          <div class="select-ask-message-action">提问</div>
          <div class="select-ask-message-text">${escapeHtml(question)}</div>
        </div>
      </div>
    `;
    chatContainer.appendChild(userMessage);

    // 为用户消息添加操作按钮
    addUserMessageActions(userMessage, question, inputArea);

    // 清空输入框并标记加载状态
    inputArea.dataset.isLoading = 'true';
    textarea.value = '';
    textarea.style.height = '44px';
    sendBtn.disabled = true;

    // 添加 AI 消息容器
    const aiMessage = document.createElement('div');
    aiMessage.className = 'select-ask-message select-ask-message-ai';
    aiMessage.innerHTML = `
      <div class="select-ask-message-content">
        <div class="select-ask-ai-header">
          <span class="select-ask-message-time">${formatTime()}</span>
          <span class="select-ask-ai-divider">·</span>
          <span class="select-ask-ai-model-name"></span>
          <span class="select-ask-ai-divider">·</span>
          <span class="select-ask-ai-time"></span>
        </div>
        <div class="select-ask-ai-content">
          <div class="select-ask-reasoning-section expanded">
            <button class="select-ask-reasoning-toggle" aria-expanded="true">
              <span class="select-ask-reasoning-icon">💭</span>
              <span class="select-ask-reasoning-title">思考中...</span>
              <span class="select-ask-reasoning-chevron">▼</span>
            </button>
            <div class="select-ask-reasoning-content">
              <div class="select-ask-reasoning-text"></div>
            </div>
          </div>
          <div class="select-ask-answer-text"></div>
        </div>
      </div>
    `;

    // 异步设置模型名称
    getSelectedChatModel().then(model => {
      const modelNameEl = aiMessage.querySelector('.select-ask-ai-model-name');
      if (modelNameEl && model) {
        modelNameEl.textContent = model.name;

        if (!supportsReasoning) {
          const reasoningSection = aiMessage.querySelector('.select-ask-reasoning-section') as HTMLElement;
          if (reasoningSection) {
            reasoningSection.style.display = 'none';
          }
        }
      }
    });

    chatContainer.appendChild(aiMessage);

    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 调用 API 获取回答
    callQuestionBackendAPI(question, text, context, aiMessage, box, inputArea);
  };

  sendBtn?.addEventListener('click', submitQuestion);

  // 调整位置确保不超出视口
  setTimeout(() => {
    adjustBoxPosition(box, parseInt(box.style.left), parseInt(box.style.top));
    textarea?.focus({ preventScroll: true });
  }, 0);

  // 设置点击外部关闭对话框
  setupClickOutsideClose(box);
}

/**
 * 显示图标菜单
 */
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
    console.log('Icon menu created at:', x, y);

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
      (e.target as HTMLElement).closest('.select-ask-floating-box') ||
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
  console.log('Select Ask content script initializing...');

  // 加载缓存
  loadCache();

  // 鼠标按下时隐藏已有菜单（除非是点击图标、浮动框或下拉菜单）
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    const isClickingMenu = target.closest('.select-ask-icon-menu') ||
                           target.closest('.select-ask-dropdown-menu') ||
                           target.closest('.select-ask-floating-box') ||
                           target.closest('.select-ask-chat-box');

    if (!isIconClicking && !isClickingMenu) {
      mouseUpPosition = null;
      currentSelectionData = null;
      removeIconMenus();
      if (currentFloatingBox) {
        currentFloatingBox.remove();
        currentFloatingBox = null;
      }
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

  console.log('Select Ask content script initialized');
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
async function showResponseInSidebar(title: string, text: string, context: any): Promise<void> {
  // 初始化历史会话
  currentSessionId = generateSessionId();
  currentSelectedText = text;
  currentSessionType = title === '解释' ? 'explain' : title === '翻译' ? 'translate' : 'custom';
  currentSessionMessages = [];

  // 只发送"解释"或"翻译"给 AI，不包含选中文本
  const userMessageText = title; // 直接发送"解释"或"翻译"

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
  console.log('=== callBackendAPIForSidebar called ===');

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
    const streamGenerator = apiAction === 'translate'
      ? streamTranslate(text)
      : streamExplain(text, llmContext);

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
    currentSessionMessages.push({
      role: 'assistant',
      content: answerContent,
      reasoning: reasoningContent || undefined,
      timestamp: Date.now(),
    });

    // 保存会话到历史记录
    if (currentSessionId && currentSessionMessages.length > 0) {
      const currentModel = await getSelectedChatModel();
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
      };
      await addSession(session);
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

/**
 * 从历史记录创建聊天框
 */
async function createChatBoxFromHistory(session: HistorySession): Promise<void> {
  // 关闭已有的聊天框
  if (currentFloatingBox) {
    currentFloatingBox.remove();
    currentFloatingBox = null;
  }

  // 创建新的聊天框
  const box = document.createElement('div');
  box.className = 'select-ask-chat-box';

  // 设置位置
  box.style.left = '50%';
  box.style.top = '50%';
  box.style.transform = 'translate(-50%, -50%)';

  // 创建头部
  const header = await createChatHeader(box);
  box.appendChild(header);

  // 创建聊天容器并恢复消息
  const chatContainer = document.createElement('div');
  chatContainer.className = 'select-ask-chat-container';

  for (const msg of session.messages) {
    if (msg.role === 'user') {
      const userMsg = document.createElement('div');
      userMsg.className = 'select-ask-message select-ask-message-user';
      userMsg.innerHTML = `<div class="select-ask-message-content">${escapeHtml(msg.content)}</div>`;
      chatContainer.appendChild(userMsg);
    } else {
      const aiMsg = document.createElement('div');
      aiMsg.className = 'select-ask-message select-ask-message-ai';

      const aiContent = document.createElement('div');
      aiContent.className = 'select-ask-ai-content';

      // 添加思考过程（如果有）
      if (msg.reasoning) {
        aiContent.innerHTML = `
          <div class="select-ask-reasoning-section expanded">
            <button class="select-ask-reasoning-toggle" aria-expanded="true">
              <span class="select-ask-reasoning-icon">💭</span>
              <span class="select-ask-reasoning-title">思考过程</span>
              <span class="select-ask-reasoning-chevron">▼</span>
            </button>
            <div class="select-ask-reasoning-content">
              <div class="select-ask-reasoning-text">${renderMarkdown(msg.reasoning)}</div>
            </div>
          </div>
          <div class="select-ask-answer-text">${renderMarkdown(msg.content)}</div>
        `;

        // 添加折叠功能
        const toggle = aiContent.querySelector('.select-ask-reasoning-toggle');
        const section = aiContent.querySelector('.select-ask-reasoning-section');
        toggle?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const isExpanded = section?.classList.toggle('expanded');
          toggle?.setAttribute('aria-expanded', String(!!isExpanded));
        });
      } else {
        aiContent.innerHTML = `<div class="select-ask-answer-text">${renderMarkdown(msg.content)}</div>`;
      }

      aiMsg.appendChild(aiContent);
      chatContainer.appendChild(aiMsg);
    }
  }

  box.appendChild(chatContainer);

  // 创建输入区域
  const inputArea = document.createElement('div');
  inputArea.className = 'select-ask-input-area';

  const inputBox = document.createElement('div');
  inputBox.className = 'select-ask-input-box';

  const inputRow = document.createElement('div');
  inputRow.className = 'select-ask-input-row';

  const textarea = document.createElement('textarea');
  textarea.className = 'select-ask-textarea';
  textarea.placeholder = '追问或提出新问题...';
  textarea.rows = 1;
  inputRow.appendChild(textarea);

  inputBox.appendChild(inputRow);

  const controlsRow = document.createElement('div');
  controlsRow.className = 'select-ask-controls-row';

  const modelSelector = await createModelSelector();
  controlsRow.appendChild(modelSelector);

  const sendBtn = document.createElement('button');
  sendBtn.className = 'select-ask-send-icon';
  sendBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
  sendBtn.disabled = true;
  controlsRow.appendChild(sendBtn);

  inputBox.appendChild(controlsRow);
  inputArea.appendChild(inputBox);
  box.appendChild(inputArea);

  document.body.appendChild(box);
  currentFloatingBox = box;

  // 设置拖拽
  setupDraggable(header, box);

  // 设置历史记录按钮
  setupHistoryButton(header, box);

  // 设置全屏按钮
  setupFullscreenButton(header, box);

  // 设置关闭按钮
  setupCloseButton(header, box);

  // 设置当前会话 ID
  currentSessionId = session.id;
  currentSessionType = session.type;
  currentSelectedText = session.selectedText;
  currentSessionMessages = [...session.messages];

  // 滚动到底部
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // 输入事件
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    sendBtn.disabled = !textarea.value.trim();
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (textarea.value.trim() && !sendBtn.disabled) {
        sendBtn.click();
      }
    }
  });

  // 发送事件
  sendBtn.addEventListener('click', async () => {
    const question = textarea.value.trim();
    if (!question) return;

    // 添加用户消息
    const userMsg = document.createElement('div');
    userMsg.className = 'select-ask-message select-ask-message-user';
    userMsg.innerHTML = `<div class="select-ask-message-content">${escapeHtml(question)}</div>`;
    chatContainer.appendChild(userMsg);

    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;

    // 添加 AI 消息占位
    const aiMsg = document.createElement('div');
    aiMsg.className = 'select-ask-message select-ask-message-ai';

    const aiContent = document.createElement('div');
    aiContent.className = 'select-ask-ai-content';
    aiContent.innerHTML = `
      <div class="select-ask-reasoning-section" style="display: none;">
        <button class="select-ask-reasoning-toggle" aria-expanded="true">
          <span class="select-ask-reasoning-icon">💭</span>
          <span class="select-ask-reasoning-title">思考中...</span>
          <span class="select-ask-reasoning-chevron">▼</span>
        </button>
        <div class="select-ask-reasoning-content">
          <div class="select-ask-reasoning-text"></div>
        </div>
      </div>
      <div class="select-ask-answer-text select-ask-loading-placeholder">请求中...</div>
    `;
    aiMsg.appendChild(aiContent);
    chatContainer.appendChild(aiMsg);

    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 调用 API
    const context = await getContextData(session.selectedText);
    await callFollowUpBackendAPI(question, session.selectedText, context, aiMsg, inputArea);

    chatContainer.scrollTop = chatContainer.scrollHeight;
  });
}