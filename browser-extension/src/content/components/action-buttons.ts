import { showToast } from '../utils/helpers';

/**
 * 创建复制按钮（支持下拉选择格式）
 */
export function createCopyButton(content: string, markdownContent?: string): HTMLElement {
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
export function createRegenerateButton(
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
    const regenerateType = messageElement.dataset.regenerateType;
    const regenerateText = messageElement.dataset.regenerateText || '';
    const regenerateContext = messageElement.dataset.regenerateContext
      ? JSON.parse(messageElement.dataset.regenerateContext)
      : null;
    const regenerateQuestion = messageElement.dataset.regenerateQuestion;

    if (!regenerateType) return;

    btn.classList.add('loading');

    const currentModel = await getSelectedChatModel();
    const modelName = currentModel?.name || 'AI';
    const modelNameEl = messageElement.querySelector('.select-ask-ai-model-name');
    if (modelNameEl) {
      modelNameEl.textContent = modelName;
    }

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

    const actionsArea = messageElement.querySelector('.select-ask-ai-actions');
    if (actionsArea) actionsArea.remove();

    inputArea.dataset.isLoading = 'true';

    try {
      if (regenerateType === 'question' && regenerateQuestion) {
        await callQuestionBackendAPI(regenerateQuestion, regenerateText, regenerateContext, messageElement, floatingBox, inputArea);
      } else if (regenerateType === 'followup' && regenerateQuestion) {
        await callFollowUpBackendAPI(regenerateQuestion, regenerateText, regenerateContext, messageElement, inputArea);
      } else {
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
export function addActionButtonsToAnswer(
  aiContent: HTMLElement,
  answerText: string,
  messageElement: HTMLElement,
  floatingBox: HTMLElement,
  inputArea: HTMLElement,
  generationTime?: number,
  markdownContent?: string
): void {
  const headerTime = messageElement.querySelector('.select-ask-ai-time') as HTMLElement;
  if (headerTime && generationTime !== undefined) {
    headerTime.textContent = `耗时${Math.round(generationTime)}s`;
  }

  let actionsArea = aiContent.querySelector('.select-ask-ai-actions') as HTMLElement;
  if (!actionsArea) {
    actionsArea = document.createElement('div');
    actionsArea.className = 'select-ask-ai-actions';
    aiContent.appendChild(actionsArea);
  }

  if (!actionsArea.querySelector('.select-ask-copy-wrapper')) {
    const copyBtn = createCopyButton(answerText, markdownContent || answerText);
    actionsArea.appendChild(copyBtn);
  }

  if (!actionsArea.querySelector('.select-ask-regenerate-btn')) {
    const regenerateBtn = createRegenerateButton(messageElement, floatingBox, inputArea);
    actionsArea.appendChild(regenerateBtn);
  }

  if (!actionsArea.querySelector('.select-ask-ai-disclaimer')) {
    const disclaimer = document.createElement('span');
    disclaimer.className = 'select-ask-ai-disclaimer';
    disclaimer.textContent = '内容由AI生成，仅供参考';
    actionsArea.appendChild(disclaimer);
  }

  addMindMapButton(actionsArea, markdownContent || answerText, messageElement);
}

// Forward references to functions defined in index.ts
declare function getSelectedChatModel(): Promise<any>;
declare function callQuestionBackendAPI(question: string, text: string, context: any, messageElement: HTMLElement, floatingBox: HTMLElement, inputArea: HTMLElement): Promise<void>;
declare function callFollowUpBackendAPI(question: string, text: string, context: any, messageElement: HTMLElement, inputArea: HTMLElement): Promise<void>;
declare function callBackendAPI(action: string, text: string, context: any, messageElement: HTMLElement, floatingBox: HTMLElement, inputArea: HTMLElement): Promise<void>;
declare function addMindMapButton(container: HTMLElement, content: string, messageElement: HTMLElement): void;
