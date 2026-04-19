/**
 * Shared markdown rendering utility.
 * Uses marked with project-specific CSS class assignments.
 */

import { marked } from 'marked';

/**
 * Render markdown text to HTML with Select Ask CSS classes.
 */
export function renderMarkdown(text: string): string {
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
