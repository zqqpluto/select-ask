import { LLM_STREAM_PORT_NAME } from '../../types/messages';

/**
 * Generate recommended follow-up questions based on selected text, user question, and AI answer.
 */
export async function generateRecommendedQuestions(
  selectedText: string,
  userQuestion: string,
  aiAnswer: string
): Promise<string[]> {
  try {
    const port = chrome.runtime.connect({ name: LLM_STREAM_PORT_NAME });

    return new Promise((resolve, reject) => {
      let fullContent = '';

      port.onMessage.addListener((message) => {
        if (message.type === 'LLM_STREAM_CHUNK') {
          fullContent += message.chunk || '';
        } else if (message.type === 'LLM_STREAM_ERROR') {
          reject(new Error(message.error));
          port.disconnect();
        } else if (message.type === 'LLM_STREAM_END') {
          port.disconnect();

          // 解析问题列表
          const questions = fullContent
            .split('\n')
            .map(q => q.trim())
            .filter(q => q && !q.match(/^[\d\-\•\*]+\.?\s*/)) // 移除序号
            .slice(0, 3); // 只展示 3 个

          resolve(questions);
        }
      });

      port.onDisconnect.addListener(() => {
        if (!fullContent) {
          reject(new Error('Connection closed'));
        }
      });

      port.postMessage({
        type: 'LLM_STREAM_START',
        payload: {
          action: 'generateQuestions',
          text: selectedText,
          context: userQuestion,
          answer: aiAnswer,
        },
      });
    });
  } catch (error) {
    console.error('Failed to generate questions:', error);
    return [];
  }
}
