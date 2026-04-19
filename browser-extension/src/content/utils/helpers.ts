import type { ProviderType } from '../../types/llm';
import type { ModelConfig } from '../../types/config';
import { renderMarkdown } from '../../utils/markdown';

/**
 * 显示 Toast 提示
 */
export function showToast(message: string, type: 'success' | 'info' = 'success'): void {
  const existingToast = document.querySelector('.select-ask-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `select-ask-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

/**
 * 获取模型显示名称
 */
export function getProviderDisplayName(provider: ProviderType): string {
  const names: Record<ProviderType, string> = {
    'openai': 'OpenAI',
    'anthropic': 'Claude',
    'deepseek': 'DeepSeek',
    'qwen': '通义千问',
    'glm': '智谱GLM',
    'openai-compat': 'LLM',
    'local-ollama': 'Ollama',
    'local-lm-studio': 'LM Studio',
  };
  return names[provider] || 'LLM';
}

/**
 * 检查模型是否支持深度思考
 */
export function modelSupportsReasoning(model: ModelConfig | null): boolean {
  if (!model) return false;

  // DeepSeek Reasoner
  if (model.provider === 'deepseek' && model.modelId === 'deepseek-reasoner') {
    return true;
  }

  // Anthropic Claude
  if (model.provider === 'anthropic') {
    return true;
  }

  // OpenAI o1/o3 系列
  if (model.provider === 'openai' && /^o[13]-/.test(model.modelId)) {
    return true;
  }

  // 通义千问深度思考模型
  if (model.provider === 'qwen' && /qwen\d+(-max|-\d+)?/i.test(model.modelId)) {
    return true;
  }

  // 其他模型
  if (/reasoner|deepthink|thinking|o1-|o3-/i.test(model.modelId)) {
    return true;
  }

  return false;
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 格式化绝对时间
 */
export function formatAbsoluteTime(timestamp: number): string {
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
 * 格式化历史记录时间
 */
export function formatHistoryTime(timestamp: number): string {
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
 * 规范化思考过程文本 - 保留列表缩进
 */
export function normalizeReasoningText(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s/);
      if (listMatch) {
        const indent = line.match(/^(\s*)/)?.[1] || '';
        const preservedIndent = indent.slice(0, 4);
        return preservedIndent + line.trim();
      }
      return line.trim();
    })
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();
}

/**
 * 渲染思考过程文本
 */
export function renderReasoningText(text: string): string {
  return renderMarkdown(text);
}

/**
 * 设置点击外部关闭对话框
 */
export function setupClickOutsideClose(box: HTMLElement, delay: number = 100): () => void {
  let cleanup: (() => void) | null = null;

  const handleMouseDown = (e: MouseEvent) => {
    const path = e.composedPath();
    const isInsideBox = path.includes(box);
    if (!isInsideBox) {
      box.remove();
      if (cleanup) cleanup();
    }
  };

  const timeoutId = setTimeout(() => {
    document.addEventListener('mousedown', handleMouseDown, false);
  }, delay);

  cleanup = () => {
    clearTimeout(timeoutId);
    document.removeEventListener('mousedown', handleMouseDown, false);
  };

  return cleanup;
}
