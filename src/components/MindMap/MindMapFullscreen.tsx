/**
 * 脑图全屏模式组件
 * 使用 React Portal 渲染到 document.body
 * 按 Escape 键退出全屏
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { renderMindmap } from '../../utils/mindmap-renderer';
import type { Markmap } from 'markmap-view';
import { useMindMapExport } from './useMindMapExport';
import MindMapToolbar from './MindMapToolbar';

interface MindMapFullscreenProps {
  markdown: string;
  onClose: () => void;
}
export default function MindMapFullscreen({ markdown, onClose }: MindMapFullscreenProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [entering, setEntering] = useState(true);
  const { downloadPng, copyPngToClipboard, copyRichText, copySvg, downloadSvg, exporting } = useMindMapExport(svgRef);

  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 300);
    return () => clearTimeout(t);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  const [retryKey, setRetryKey] = useState(0);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose(), 200);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  useEffect(() => {
    if (!svgRef.current) return;
    let cancelled = false;
    let dispose: (() => void) | null = null;

    async function init() {
      try {
        const container = svgRef.current!.parentElement || svgRef.current;
        const result = await renderMindmap(svgRef.current!, markdown, container as HTMLElement);
        if (cancelled) {
          result.dispose();
          return;
        }

        markmapRef.current = result.markmap;
        dispose = result.dispose;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [markdown, retryKey]);

  const content = (
    <div className={`select-ask-mindmap-fullscreen-overlay${closing ? ' exit' : ''}${entering ? ' enter' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="select-ask-mindmap-fullscreen-header">
        <span className="select-ask-mindmap-fullscreen-title">脑图</span>
        <button className="select-ask-mindmap-toolbar-btn" title="关闭 (Esc)" onClick={handleClose}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="select-ask-mindmap-fullscreen-content">
        <div className="select-ask-mindmap-container">
          {loading && (
            <div className="select-ask-mindmap-loading">
              <div className="select-ask-mindmap-loading-spinner" />
              <span>正在生成脑图...</span>
            </div>
          )}
          {error && (
            <div className="select-ask-mindmap-error">
              <span>脑图生成失败</span>
              <span style={{ fontSize: 12, color: '#86909c' }}>{error}</span>
              <button className="select-ask-mindmap-retry-btn" onClick={handleRetry}>重试</button>
            </div>
          )}
          <svg
            ref={svgRef}
            className="select-ask-mindmap-svg"
            style={{ width: '100%', height: '100%', display: loading || error ? 'none' : 'block' }}
          />
        </div>
      </div>

      {!loading && !error && (
        <MindMapToolbar
          markmapRef={markmapRef}
          svgRef={svgRef}
          downloadPng={downloadPng}
          downloadSvg={downloadSvg}
          copyPngToClipboard={copyPngToClipboard}
          copyRichText={copyRichText}
          copySvg={copySvg}
          exporting={exporting}
          onClose={handleClose}
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
}
