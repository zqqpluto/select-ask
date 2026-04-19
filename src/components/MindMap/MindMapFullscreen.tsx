/**
 * 脑图全屏模式组件
 * 使用 React Portal 渲染到 document.body
 * 按 Escape 键退出全屏
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { useMindMapExport } from './useMindMapExport';
import MindMapToolbar from './MindMapToolbar';

interface MindMapFullscreenProps {
  markdown: string;
  onClose: () => void;
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

export default function MindMapFullscreen({ markdown, onClose }: MindMapFullscreenProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { downloadPng, copyPngToClipboard, copyRichText, exporting } = useMindMapExport(svgRef);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!svgRef.current) return;
    let cancelled = false;

    async function init() {
      try {
        const transformer = await createTransformer();
        if (cancelled) return;

        const { root, features } = await transformMarkdown(transformer as any, markdown);
        if (cancelled) return;

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

        const fontStyle = document.createElement('style');
        fontStyle.textContent = CHINESE_FONT_CSS;
        document.head.appendChild(fontStyle);

        const svg = svgRef.current!;
        const mm = (await import('markmap-view')).Markmap.create(
          svg,
          MARKMAP_OPTIONS,
          root as IPureNode
        );

        markmapRef.current = mm;
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [markdown]);

  const content = (
    <div className="select-ask-mindmap-fullscreen-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="select-ask-mindmap-fullscreen-header">
        <span className="select-ask-mindmap-fullscreen-title">脑图</span>
        <button className="select-ask-mindmap-toolbar-btn" title="关闭 (Esc)" onClick={onClose}>
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
          copyPngToClipboard={copyPngToClipboard}
          copyRichText={copyRichText}
          exporting={exporting}
          onClose={onClose}
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
}
