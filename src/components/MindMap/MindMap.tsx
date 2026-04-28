/**
 * 脑图主组件
 * 接收 Markdown 字符串，使用 markmap 渲染为交互式 SVG 脑图
 *
 * 关键设计：流式更新时使用 debounce，只在 markdown 稳定后渲染。
 * 豆包模式：AI 回复完成后一次性渲染。本项目需支持流式，
 * 因此必须避免频繁重渲染导致的竞态。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Markmap } from 'markmap-view';
import { renderMindmap } from '../../utils/mindmap-renderer';
import { createTransformer, transformMarkdown } from './mindmap-utils';

interface MindMapProps {
  markdown: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

// 流式更新 debounce 时间（ms）
// 豆包不存在此问题（一次性渲染），本项目需 300ms 防抖
const STREAMING_DEBOUNCE_MS = 300;

export default function MindMap({ markdown, onReady, onError }: MindMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // 当前正在渲染的 markdown 版本（用于跳过过时的流式更新）
  const renderingVersionRef = useRef(0);
  const latestVersionRef = useRef(0);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  };

  // 稳定版渲染函数：只在 markdown 稳定后执行
  const renderStable = useCallback(async (md: string, version: number) => {
    if (!svgRef.current) return;

    // 空内容：停止 loading，等待流式内容到达
    if (!md.trim()) {
      setLoading(false);
      return;
    }

    // 跳过过时版本
    if (version < latestVersionRef.current) return;
    renderingVersionRef.current = version;

    try {
      // 复用已有实例：只更新数据
      if (markmapRef.current) {
        try {
          const { root } = await transformMarkdown(await createTransformer(), md);
          if (version < latestVersionRef.current) return; // 检查是否有更新版本
          markmapRef.current.setData(root);
          markmapRef.current.fit();
          setLoading(false);
          onReady?.();
          return;
        } catch {
          markmapRef.current = null;
        }
      }

      const container = svgRef.current!.parentElement || svgRef.current;
      const result = await renderMindmap(svgRef.current!, md, container as HTMLElement, {
        existingMarkmap: markmapRef.current,
      });
      if (version < latestVersionRef.current) {
        result.dispose();
        return;
      }

      markmapRef.current = result.markmap;
      setLoading(false);
      onReady?.();
    } catch (err) {
      if (version >= latestVersionRef.current) {
        setLoading(false);
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        onError?.(err instanceof Error ? err : new Error(msg));
      }
    }
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    latestVersionRef.current++;
    const version = latestVersionRef.current;

    // debounce: 等待 markdown 稳定后再渲染
    const timer = setTimeout(() => {
      renderStable(markdown, version);
    }, STREAMING_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [markdown, retryKey, renderStable]);

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
        viewBox="0 0 800 600"
        width="100%"
        height="100%"
      />
    </div>
  );
}

export type { MindMapProps };
