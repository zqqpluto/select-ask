import type { HistoryMessage } from '../../types/history';
import { ensureBoxInViewport } from './layout';

// ==================== Session State ====================

export let currentSessionId: string | null = null;
export let currentSessionType: 'explain' | 'translate' | 'question' | 'search' | 'summarize' | 'custom' = 'explain';
export let currentSelectedText: string = '';
export let currentSessionMessages: HistoryMessage[] = [];
export let currentSessionSaved = false; // 标记会话是否已保存到历史记录

export function setSessionState(state: {
  sessionId: string | null;
  sessionType: 'explain' | 'translate' | 'question' | 'search' | 'summarize' | 'custom';
  selectedText: string;
  messages: HistoryMessage[];
  sessionSaved: boolean;
}): void {
  currentSessionId = state.sessionId;
  currentSessionType = state.sessionType;
  currentSelectedText = state.selectedText;
  currentSessionMessages = state.messages;
  currentSessionSaved = state.sessionSaved;
}

// ==================== Nested List Processing ====================

/**
 * 处理嵌套列表 - 将带 data-level 的 li 元素转换为嵌套结构
 */
export function processNestedLists(html: string): string {
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
        // 当前项的层级大于父级，这是子项，应该被上面的逻辑处理
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

// ==================== Follow-up Chat ====================

export interface FollowUpDependencies {
  createFollowUpMessage: (question: string) => HTMLElement;
  createAIMessage: () => HTMLElement;
  callFollowUpBackendAPI: (
    question: string,
    originalText: string,
    context: any,
    aiResponse: HTMLElement,
    inputArea: HTMLElement,
  ) => Promise<void>;
}

let followUpDeps: FollowUpDependencies | null = null;

export function setFollowUpDeps(deps: FollowUpDependencies): void {
  followUpDeps = deps;
}

/**
 * 启用追问功能
 */
export function enableFollowUp(
  messageElement: HTMLElement,
  originalText: string,
  context: any,
  floatingBox: HTMLElement,
  inputArea: HTMLElement,
): void {
  const textarea = inputArea.querySelector('.select-ask-textarea') as HTMLTextAreaElement;
  const sendBtn = inputArea.querySelector('.select-ask-send-icon') as HTMLButtonElement;
  const chatContainer = floatingBox.querySelector('.select-ask-chat-container') as HTMLElement;

  if (!textarea || !sendBtn || !chatContainer || !followUpDeps) return;

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

    const newMessage = followUpDeps.createFollowUpMessage(question);
    chatContainer.insertBefore(newMessage, inputArea);

    const aiResponse = followUpDeps.createAIMessage();
    chatContainer.insertBefore(aiResponse, inputArea);

    chatContainer.scrollTop = chatContainer.scrollHeight;

    // 确保对话框在视口内
    ensureBoxInViewport(floatingBox);

    await followUpDeps.callFollowUpBackendAPI(question, originalText, context, aiResponse, inputArea);
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

// ==================== Menu Action Delegate ====================

export interface MenuActionDelegateDependencies {
  iconMenuState: {
    currentDropdown: HTMLElement | null;
    currentIconMenu: HTMLElement | null;
    currentSelectionData: any;
  };
  handleMenuAction: (action: string, options: any) => Promise<void>;
  showResponseInSidebar: (options: any) => Promise<void>;
  showFloatingTranslation: (options: any) => Promise<void>;
  showInPlaceTranslation: (options: any) => Promise<void>;
  handleMindMapFromSelection: () => Promise<void>;
}

let menuDelegateDeps: MenuActionDelegateDependencies | null = null;

export function setMenuActionDelegateDeps(deps: MenuActionDelegateDependencies): void {
  menuDelegateDeps = deps;
}

/**
 * 处理菜单动作 — 委托给 handlers/menu-handler
 */
export async function handleMenuActionDelegate(action: string): Promise<void> {
  if (!menuDelegateDeps) return;

  const { iconMenuState, handleMenuAction, showResponseInSidebar, showFloatingTranslation, showInPlaceTranslation, handleMindMapFromSelection } = menuDelegateDeps;

  // 清理 UI
  if (iconMenuState.currentDropdown) {
    iconMenuState.currentDropdown.remove();
    iconMenuState.currentDropdown = null;
  }
  if (iconMenuState.currentIconMenu) {
    iconMenuState.currentIconMenu.remove();
    iconMenuState.currentIconMenu = null;
  }

  await handleMenuAction(action, {
    showResponseInSidebar,
    showFloatingTranslation,
    showInPlaceTranslation,
    handleMindMapFromSelection,
    selectionData: iconMenuState.currentSelectionData,
  });
}
