/**
 * 脑图共享渲染器
 * 纯工具函数（非 React hook），供 MindMap、MindMapFullscreen、content/mindmap.ts 共用
 *
 * 职责：
 * - Transformer 创建 + Markdown 树转换
 * - 外部资源加载（KaTeX、highlight.js 等）
 * - 中文字体注入
 * - Markmap.create() 或 Markmap.setData() 复用
 * - ResizeObserver 自动适配
 */

import type { IPureNode } from 'markmap-common';
import type { Markmap } from 'markmap-view';
import { MARKMAP_OPTIONS } from '../components/MindMap/mindmap-options';
import {
  createTransformer,
  transformMarkdown,
  getMarkmapAssets,
  loadCSS,
  loadJS,
  injectChineseFontCSS,
} from '../components/MindMap/mindmap-utils';

export interface MindmapRendererResult {
  markmap: Markmap;
  dispose: () => void;
}

export interface MindmapRendererOptions {
  /** 已有的 markmap 实例，存在时复用而非重建 */
  existingMarkmap?: Markmap | null;
  /** ResizeObserver 触发时的回调 */
  onResize?: () => void;
}

/**
 * 将 Markdown 渲染为交互式脑图
 *
 * @param svgElement - 用于渲染脑图的 SVG 元素
 * @param markdown - Markdown 内容
 * @param containerElement - 容器元素，用于 ResizeObserver 观察
 * @param options - 可选配置
 * @returns 包含 markmap 实例和 dispose 函数的结果对象
 */
export async function renderMindmap(
  svgElement: SVGSVGElement,
  markdown: string,
  containerElement: HTMLElement,
  options?: MindmapRendererOptions,
): Promise<MindmapRendererResult> {
  const transformer = await createTransformer();
  const { root, features } = await transformMarkdown(transformer, markdown);

  // 加载外部资源（KaTeX、highlight.js 等）
  const assets = getMarkmapAssets(transformer, features);
  if (assets.styles?.length) {
    await Promise.allSettled(
      assets.styles.map((s: { type: string; url?: string; text?: string }) => {
        if (s.type === 'stylesheet' && s.url) return loadCSS(s.url);
        if (s.type === 'style' && s.text) {
          const style = document.createElement('style');
          style.textContent = s.text;
          document.head.appendChild(style);
          return Promise.resolve();
        }
        return Promise.resolve();
      }),
    );
  }
  if (assets.scripts?.length) {
    await Promise.allSettled(
      assets.scripts.map((s: { url?: string }) => s.url && loadJS(s.url)),
    );
  }

  // 注入中文字体
  injectChineseFontCSS();

  // 复用已有实例或创建新实例
  let mm: Markmap;
  if (options?.existingMarkmap) {
    mm = options.existingMarkmap;
    mm.setData(root as IPureNode);
    mm.fit();
  } else {
    const markmapModule = await import('markmap-view');
    mm = markmapModule.Markmap.create(
      svgElement,
      MARKMAP_OPTIONS,
      root as IPureNode,
    );
  }

  // ResizeObserver 自动适配（带 debounce）
  let timer: ReturnType<typeof setTimeout>;
  const observer = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // Only fit if container has a measurable size
      const rect = containerElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        mm.fit();
      }
    }, 100);
    options?.onResize?.();
  });
  observer.observe(containerElement);

  // 初始适配：等待容器有尺寸后再 fit，避免 NaN
  const initialFit = () => {
    const rect = containerElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      mm.fit();
    } else {
      setTimeout(initialFit, 50);
    }
  };
  setTimeout(initialFit, 50);

  return {
    markmap: mm,
    dispose: () => {
      observer.disconnect();
      clearTimeout(timer);
    },
  };
}
