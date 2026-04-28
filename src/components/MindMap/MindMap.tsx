/**
 * 脑图主组件
 * 接收 Markdown 字符串，使用 markmap 渲染为交互式 SVG 脑图
 */

import { useEffect, useRef, useState } from 'react';
import type { Markmap } from 'markmap-view';
import { renderMindmap } from '../../utils/mindmap-renderer';
import { createTransformer, transformMarkdown } from './mindmap-utils';

interface MindMapProps {
  markdown: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
}
export default function MindMap({ markdown, onReady, onError }: MindMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  };

  useEffect(() => {
    if (!svgRef.current) return;
    let cancelled = false;
    let cleanupDispose: (() => void) | null = null;

    async function init() {
      if (!markdown.trim()) {
        // Empty markdown: stay in loading state for streaming
        return;
      }
      try {
        // Reuse existing instance if available - just update data instead of recreating
        if (markmapRef.current) {
          try {
            const { root } = await transformMarkdown(await createTransformer(), markdown);
            if (cancelled) return;
            markmapRef.current.setData(root);
            markmapRef.current.fit();
            setLoading(false);
            onReady?.();
            return;
          } catch (reuseErr) {
            // If reuse fails, fall through to create new
            markmapRef.current = null;
          }
        }

        const container = svgRef.current!.parentElement || svgRef.current;
        const result = await renderMindmap(svgRef.current!, markdown, container as HTMLElement, {
          existingMarkmap: markmapRef.current,
        });
        if (cancelled) {
          result.dispose();
          return;
        }

        markmapRef.current = result.markmap;
        cleanupDispose = result.dispose;
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

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      cleanupDispose?.();
    };
  }, [markdown, retryKey]);

  if (error) {
    return (
      <div className="select-ask-mindmap-error">
        <span>脑图生成失败</span>
        <span style={{ fontSize: 12, color: '#86909c' }}>{error}</span>
        <button className="select-ask-mindmap-retry-btn" onClick={handleRetry}>重试</button>
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
