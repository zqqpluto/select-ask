/**
 * 网页内容提取器
 * 智能提取网页正文内容，用于生成摘要
 */

/**
 * 提取结果
 */
export interface ExtractedContent {
  title: string;
  content: string;
  wordCount: number;
  extractionMethod: string; // 提取方法描述
}

/**
 * 计算元素的文本密度
 * 文本密度 = 文本长度 / 标签数量
 */
function calculateTextDensity(element: Element): number {
  const text = element.textContent?.trim() || '';
  const textLength = text.length;

  if (textLength === 0) return 0;

  // 计算子元素数量
  const childElements = element.querySelectorAll('*').length || 1;

  return textLength / childElements;
}

/**
 * 清理文本
 * 移除多余的空白、换行等
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // 多个空白替换为单个空格
    .replace(/\n\s*\n/g, '\n\n') // 多个换行替换为两个换行
    .trim();
}

/**
 * 提取网页正文
 * 按优先级尝试多种提取策略
 */
export function extractMainContent(): ExtractedContent {
  const title = document.title || '未命名页面';

  // 策略1: <article>标签(语义化文章标签)
  const article = document.querySelector('article');
  if (article) {
    const content = cleanText(article.textContent || '');
    return {
      title,
      content,
      wordCount: content.length,
      extractionMethod: 'article标签',
    };
  }

  // 策略2: <main>标签(语义化主内容标签)
  const main = document.querySelector('main');
  if (main) {
    const content = cleanText(main.textContent || '');
    return {
      title,
      content,
      wordCount: content.length,
      extractionMethod: 'main标签',
    };
  }

  // 策略3: 最大文本密度div
  const divs = Array.from(document.querySelectorAll('div'));
  if (divs.length > 0) {
    let maxDensity = 0;
    let bestDiv: Element | null = null;

    // 过滤掉明显不是正文的div(导航、侧边栏等)
    const candidates = divs.filter(div => {
      const className = div.className.toLowerCase();
      const id = (div.id || '').toLowerCase();

      // 排除导航、侧边栏、头部、底部等
      const isExcluded =
        className.includes('nav') ||
        className.includes('sidebar') ||
        className.includes('header') ||
        className.includes('footer') ||
        className.includes('menu') ||
        className.includes('comment') ||
        className.includes('ad') ||
        id.includes('nav') ||
        id.includes('sidebar') ||
        id.includes('header') ||
        id.includes('footer');

      return !isExcluded;
    });

    // 找到文本密度最高的div
    for (const div of candidates) {
      const density = calculateTextDensity(div);
      if (density > maxDensity) {
        maxDensity = density;
        bestDiv = div;
      }
    }

    if (bestDiv) {
      const content = cleanText(bestDiv.textContent || '');
      if (content.length > 100) { // 确保有足够的内容
        return {
          title,
          content,
          wordCount: content.length,
          extractionMethod: '最大文本密度div',
        };
      }
    }
  }

  // 策略4: 降级方案 - body全文(过滤导航等)
  const body = document.body.cloneNode(true) as HTMLElement;

  // 移除不需要的元素
  const removeSelectors = [
    'nav', 'header', 'footer', 'aside',
    '.sidebar', '.navigation', '.menu', '.ads',
    '.comment', '.social-share', '.related'
  ];

  removeSelectors.forEach(selector => {
    body.querySelectorAll(selector).forEach(el => el.remove());
  });

  const content = cleanText(body.textContent || '');

  return {
    title,
    content,
    wordCount: content.length,
    extractionMethod: 'body全文(过滤)',
  };
}

/**
 * 截断内容到指定长度
 * 根据token估算进行截断(大约4个字符 = 1个token)
 */
export function truncateContent(content: string, maxTokens: number = 6000): string {
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
  return `请总结以下网页内容，提炼关键信息。

网页标题: ${content.title}

内容:
${content.content}

要求:
1. 用3-5个要点概括主要内容
2. 提取关键数据和结论
3. 语言简洁，重点突出
4. 如果是技术文章，请保留关键代码或配置示例
5. 如果是新闻资讯，请说明时间、地点、人物等关键信息

请用中文回答。`;
}