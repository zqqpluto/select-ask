/**
 * 网页内容提取器
 * 使用 Mozilla Readability 提取正文（与 Firefox Reader View / 豆包同款算法）
 */

import { Readability } from '@mozilla/readability';

/**
 * 提取结果
 */
export interface ExtractedContent {
  title: string;
  content: string;
  wordCount: number;
  extractionMethod: string;
}

/**
 * 将 HTML 转为纯文本（保留段落结构）
 */
function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  // 块级元素后加换行
  div.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, tr, blockquote, pre, br, hr').forEach(el => {
    el.appendChild(document.createTextNode('\n'));
  });

  // 移除脚本和样式
  div.querySelectorAll('script, style').forEach(el => el.remove());

  return div.textContent?.replace(/\n{3,}/g, '\n\n').trim() || '';
}

/**
 * 提取网页正文 — 优先使用 Readability（豆包同款算法）
 */
export function extractMainContent(): ExtractedContent {
  // 策略1: Mozilla Readability（Firefox Reader View / 豆包同款）
  try {
    const cloned = document.cloneNode(true) as Document;
    const reader = new Readability(cloned, {
      charThreshold: 500,
      keepClasses: false,
    });
    const result = reader.parse();

    if (result?.content && result.content.length > 100) {
      const content = htmlToPlainText(result.content);
      return {
        title: result.title || document.title || '未命名页面',
        content,
        wordCount: content.length,
        extractionMethod: 'Readability（豆包同款）',
      };
    }
  } catch (e) {
    console.warn('[Readability] 提取失败:', e);
  }

  // 策略2: 降级 — <article> 标签
  const article = document.querySelector('article');
  if (article) {
    const content = article.textContent?.trim().replace(/\s+/g, ' ') || '';
    return {
      title: document.title || '未命名页面',
      content,
      wordCount: content.length,
      extractionMethod: 'article标签（降级）',
    };
  }

  // 策略3: 降级 — <main> 标签
  const main = document.querySelector('main');
  if (main) {
    const content = main.textContent?.trim().replace(/\s+/g, ' ') || '';
    return {
      title: document.title || '未命名页面',
      content,
      wordCount: content.length,
      extractionMethod: 'main标签（降级）',
    };
  }

  // 策略4: 最低降级 — body 过滤
  const body = document.body.cloneNode(true) as HTMLElement;
  ['nav', 'header', 'footer', 'aside', 'script', 'style'].forEach(tag => {
    body.querySelectorAll(tag).forEach(el => el.remove());
  });
  const content = body.textContent?.trim().replace(/\s+/g, ' ') || '';
  return {
    title: document.title || '未命名页面',
    content,
    wordCount: content.length,
    extractionMethod: 'body过滤（最低降级）',
  };
}

/**
 * 截断内容到指定长度
 * 根据token估算进行截断(大约4个字符 = 1个token)
 */
export function truncateContent(content: string, maxTokens: number = 100000): string {
  const estimatedTokens = content.length / 4;

  if (estimatedTokens <= maxTokens) {
    return content;
  }

  // 截断到目标token数对应的字符数
  const maxLength = maxTokens * 4;
  const truncated = content.substring(0, maxLength);

  // 尝试在句子边界截断
  const lastPeriod = truncated.lastIndexOf('。');
  const lastQuestion = truncated.lastIndexOf('？');
  const lastExclamation = truncated.lastIndexOf('！');

  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);

  if (lastSentenceEnd > maxLength * 0.8) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }

  return truncated + '...';
}

/**
 * 生成网页总结的Prompt
 */
export function generateSummaryPrompt(content: ExtractedContent): string {
  return `总结以下内容：\n"""\n${content.content}\n"""`;
}