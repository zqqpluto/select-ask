/**
 * 脑图全屏集成组件
 * 对标 MindMapFullscreen：自渲染 markmap + 工具栏 + 导出
 * 区别：在 side-panel 内直接渲染（不用 createPortal）
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { renderMindmap } from '../../utils/mindmap-renderer';
import type { Markmap } from 'markmap-view';
import { useMindMapExport } from '../../components/MindMap/useMindMapExport';
import MindMapToolbar from '../../components/MindMap/MindMapToolbar';

interface Props {
  mindMapMarkdown: string | null;
  onClose: () => void;
}

export default function MindMapIntegration({ mindMapMarkdown, onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [entering, setEntering] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const { downloadPng, copyPngToClipboard, copyRichText, copySvg, downloadSvg, exporting } = useMindMapExport(svgRef);

  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mindMapMarkdown) return;
    setClosing(false);
    setEntering(true);
    const t = setTimeout(() => setEntering(false), 300);
    return () => clearTimeout(t);
  }, [mindMapMarkdown]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose(), 200);
  }, [onClose]);

  useEffect(() => {
    if (!mindMapMarkdown) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mindMapMarkdown, handleClose]);

  useEffect(() => {
    if (!svgRef.current || !mindMapMarkdown) return;
    let cancelled = false;
    let dispose: (() => void) | null = null;

    async function init() {
      try {
        const container = svgRef.current!.parentElement || svgRef.current;
        const result = await renderMindmap(svgRef.current!, mindMapMarkdown, container as HTMLElement);
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

    setLoading(true);
    setError(null);
    init();
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [mindMapMarkdown, retryKey]);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  if (!mindMapMarkdown) return null;

  return (
    <div className="side-panel-mindmap-fullscreen-placeholder">
      <div className={`doubao-fullscreen-overlay${closing ? ' exit' : ''}${entering ? ' enter' : ''}`}>
        <div className="doubao-fullscreen-header">
          <div className="doubao-header-left">
            <span className="doubao-title">脑图</span>
          </div>
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
            variant="fullscreen"
          />
        </div>

        <div className="doubao-fullscreen-content">
          <div className="doubao-diagram-content">
            {loading && (
              <div className="doubao-mindmap-loading">
                <div className="doubao-mindmap-loading-spinner" />
                <span>正在生成脑图...</span>
              </div>
            )}
            {error && (
              <div className="doubao-mindmap-error">
                <span>脑图生成失败</span>
                <span style={{ fontSize: 12, color: '#86909c' }}>{error}</span>
                <button className="doubao-retry-btn" onClick={handleRetry}>重试</button>
              </div>
            )}
            <svg
              ref={svgRef}
              className="doubao-mindmap-svg"
              style={{ width: '100%', height: '100%', display: loading || error ? 'none' : 'block' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
