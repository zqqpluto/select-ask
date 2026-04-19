/**
 * 脑图工具函数
 * - Markdown 结构检测
 * - Transformer 调用
 * - 中文字体支持
 */

import type { IPureNode } from 'markmap-common';

/**
 * 检测 Markdown 是否适合生成脑图
 * 需要包含标题层级（## 标题）或列表层级（- 列表项 / 1. 有序列表）
 * 且内容长度 > 20 字符
 */
export function detectMarkdownStructure(markdown: string): boolean {
  if (!markdown || markdown.trim().length < 20) return false;

  const lines = markdown.split('\n');
  let headingCount = 0;
  let listItemCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // 标题行：## 标题
    if (/^#{2,6}\s/.test(trimmed)) headingCount++;
    // 无序列表：- 项 / * 项 / + 项
    if (/^[-*+]\s/.test(trimmed)) listItemCount++;
    // 有序列表：1. 项
    if (/^\d+\.\s/.test(trimmed)) listItemCount++;
  }

  // 至少需要两层结构（1 个标题 + 1 个列表，或 2 个标题，或 2 个列表）
  return headingCount + listItemCount >= 2;
}

/**
 * 动态创建 markmap Transformer 实例
 * 使用动态 import 实现懒加载
 */
export async function createTransformer() {
  const { Transformer } = await import('markmap-lib');
  return new Transformer();
}

/**
 * 将 Markdown 字符串转换为脑图树结构
 */
export async function transformMarkdown(
  transformer: InstanceType<typeof import('markmap-lib').Transformer>,
  markdown: string,
): Promise<{ root: IPureNode; features: Record<string, any> }> {
  const { root, features } = transformer.transform(markdown);
  return { root, features };
}

/**
 * 获取 Transformer 使用的 CSS/JS 资源
 * 用于动态注入 markmap 所需的外部依赖（如 katex、highlight.js）
 */
export function getMarkmapAssets(
  transformer: InstanceType<typeof import('markmap-lib').Transformer>,
  features: Record<string, any>,
) {
  return transformer.getUsedAssets(features);
}

/**
 * 动态加载外部 CSS
 */
export function loadCSS(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

/**
 * 动态加载外部 JS
 */
export function loadJS(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * 中文字体 CSS，注入到 markmap 渲染的 SVG 中
 */
export const CHINESE_FONT_CSS = `
  .markmap-foreign {
    font-family: "Inter", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif !important;
    font-size: 14px !important;
    line-height: 1.6 !important;
  }
`;
