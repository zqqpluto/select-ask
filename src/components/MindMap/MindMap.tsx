/**
 * 脑图主组件
 * 接收 Markdown 字符串，使用 markmap 渲染为交互式 SVG 脑图
 */

import { useEffect, useRef, useState } from 'react';
import type { IPureNode } from 'markmap-common';
import type { Markmap } from 'markmap-view';
import {
  createTransformer,
  transformMarkdown,
  getMarkmapAssets,
  loadCSS,
  loadJS,
  CHINESE_FONT_CSS,
} from './mindmap-utils';

interface MindMapProps {
  markdown: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

const MARKMAP_OPTIONS = {
  duration: 500,
  maxWidth: 400,
  autoFit: false,
  fitRatio: 0.95,
  nodeMinHeight: 30,
  spacingHorizontal: 100,
  spacingVertical: 10,
  paddingX: 10,
  scrollForPan: true,
  initialExpandLevel: -1,
  zoom: true,
  pan: true,
  toggleRecursively: false,
};

export default function MindMap({ markdown, onReady, onError }: MindMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    let cancelled = false;

    async function init() {
      try {
        console.log('[MindMap] Starting init, markdown length:', markdown.length);
        const transformer = await createTransformer();
        if (cancelled) return;
        console.log('[MindMap] Transformer created');

        const { root, features } = await transformMarkdown(transformer as any, markdown);
        if (cancelled) return;
        console.log('[MindMap] Markdown transformed, root children:', root.children?.length);

        // 加载外部资源
        const assets = getMarkmapAssets(transformer as any, features);
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
            })
          );
        }
        if (assets.scripts?.length) {
          await Promise.allSettled(
            assets.scripts.map((s: any) => s.url && loadJS(s.url))
          );
        }
        if (cancelled) return;
        console.log('[MindMap] Assets loaded, importing markmap-view');

        // 注入中文字体
        const fontStyle = document.createElement('style');
        fontStyle.textContent = CHINESE_FONT_CSS;
        document.head.appendChild(fontStyle);

        // 渲染脑图
        const svg = svgRef.current!;
        const markmapModule = await import('markmap-view');
        console.log('[MindMap] markmap-view imported, creating Markmap...');
        const mm = markmapModule.Markmap.create(
          svg,
          MARKMAP_OPTIONS,
          root as IPureNode
        );
        console.log('[MindMap] Markmap created successfully');

        markmapRef.current = mm;
        setLoading(false);
        onReady?.();
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          onError?.(err instanceof Error ? err : new Error(msg));
        }
      }
    }

    init();
    // Timeout to detect hangs - 30s for large markmap content
    const timeout = setTimeout(() => {
      if (!cancelled && loading) {
        console.warn('[MindMap] Init taking longer than expected (30s)');
      }
    }, 30000);

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [markdown, loading]);

  if (error) {
    return (
      <div className="select-ask-mindmap-error">
        <span>脑图生成失败</span>
        <span style={{ fontSize: 12, color: '#86909c' }}>{error}</span>
      </div>
    );
  }

  return (
    <div className="select-ask-mindmap-container" style={{ position: 'relative' }}>
      {loading && (
        <div className="select-ask-mindmap-loading" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafbfc', zIndex: 10 }}>
          <div className="select-ask-mindmap-loading-spinner" />
          <span>正在生成脑图...</span>
        </div>
      )}
      <svg
        ref={svgRef}
        className="select-ask-mindmap-svg"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export type { MindMapProps };
