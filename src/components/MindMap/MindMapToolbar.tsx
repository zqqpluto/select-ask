/**
 * 脑图工具栏组件
 * 提供导出、缩放、适配、全屏等功能
 */

import { useState, useRef, useEffect } from 'react';
import type { Markmap } from 'markmap-view';

interface MindMapToolbarProps {
  markmapRef: React.RefObject<Markmap | null>;
  svgRef: React.RefObject<SVGSVGElement | null>;
  downloadPng: () => void;
  downloadSvg: () => void;
  copyPngToClipboard: () => void;
  copyRichText: () => void;
  copySvg: () => void;
  exporting: boolean;
  onFullscreen?: () => void;
  onClose?: () => void;
}

export default function MindMapToolbar({
  markmapRef,
  svgRef: _svgRef,
  downloadPng,
  downloadSvg,
  copyPngToClipboard,
  copyRichText,
  copySvg,
  exporting,
  onFullscreen,
  onClose,
}: MindMapToolbarProps) {
  const [showExport, setShowExport] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExport) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

  // Track zoom level via MutationObserver on SVG transform
  useEffect(() => {
    const svg = _svgRef.current;
    if (!svg || !markmapRef.current) return;
    const g = svg.querySelector('g');
    if (!g) return;

    const updateZoom = () => {
      const transform = (g as SVGGraphicsElement).transform?.baseVal;
      if (transform && transform.numberOfItems > 0) {
        const matrix = transform.getItem(0).matrix;
        setZoomLevel(Math.round(matrix.a * 100));
      }
    };

    const observer = new MutationObserver(updateZoom);
    observer.observe(g, { attributes: true, attributeFilter: ['transform'] });
    updateZoom();
    return () => observer.disconnect();
  }, [_svgRef, markmapRef]);

  const handleZoomIn = () => markmapRef.current?.rescale(1.25);
  const handleZoomOut = () => markmapRef.current?.rescale(0.8);
  const handleFit = () => markmapRef.current?.fit();

  const handleExpandAll = () => {
    const mm = markmapRef.current;
    if (!mm) return;
    const data = mm.getData();
    function setFold(node: any, fold: number) {
      if (node.children) {
        node.payload = { ...node.payload, fold };
        node.children.forEach((child: any) => setFold(child, fold));
      }
    }
    data.children?.forEach((child: any) => setFold(child, 0));
    mm.setData(data);
    mm.fit();
  };

  const handleCollapseAll = () => {
    const mm = markmapRef.current;
    if (!mm) return;
    const data = mm.getData();
    function setFold(node: any) {
      if (node.children && node.children.length > 0) {
        node.payload = { ...node.payload, fold: 1 };
        node.children.forEach((child: any) => setFold(child));
      }
    }
    data.children?.forEach((child: any) => setFold(child));
    mm.setData(data);
    mm.fit();
  };

  return (
    <>
      <div className="select-ask-mindmap-toolbar">
        <div ref={exportRef} style={{ position: 'relative' }}>
          <button
            className="select-ask-mindmap-toolbar-btn"
            title="导出"
            onClick={() => setShowExport(!showExport)}
            disabled={exporting}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          {showExport && (
            <div className="select-ask-mindmap-export-dropdown">
              <button className="select-ask-mindmap-export-item" onClick={() => { downloadPng(); setShowExport(false); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                下载图片
              </button>
              <button className="select-ask-mindmap-export-item" onClick={() => { downloadSvg(); setShowExport(false); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                下载 SVG
              </button>
              <button className="select-ask-mindmap-export-item" onClick={() => { copyPngToClipboard(); setShowExport(false); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                复制图片
              </button>
              <button className="select-ask-mindmap-export-item" onClick={() => { copyRichText(); setShowExport(false); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="17" y1="10" x2="3" y2="10"/>
                  <line x1="21" y1="6" x2="3" y2="6"/>
                  <line x1="21" y1="14" x2="3" y2="14"/>
                  <line x1="17" y1="18" x2="3" y2="18"/>
                </svg>
                复制文本
              </button>
              <button className="select-ask-mindmap-export-item" onClick={() => { copySvg(); setShowExport(false); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                复制 SVG
              </button>
            </div>
          )}
        </div>

        <div className="select-ask-mindmap-toolbar-divider" />

        <button className="select-ask-mindmap-toolbar-btn" title="缩小" onClick={handleZoomOut}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>

        <button className="select-ask-mindmap-toolbar-btn" title="放大" onClick={handleZoomIn}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>

        <button className="select-ask-mindmap-toolbar-btn" title="适应" onClick={handleFit}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        </button>

        <button className="select-ask-mindmap-toolbar-btn" title="展开全部" onClick={handleExpandAll}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 3 21 3 21 9"/>
            <polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/>
            <line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>

        <button className="select-ask-mindmap-toolbar-btn" title="折叠全部" onClick={handleCollapseAll}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 14h6m0 0v6m0-6H4m0 0V8m16 6h-6m0 0v6m0-6h6m0 0V8M8 10V4h6"/>
          </svg>
        </button>

        <div className="select-ask-mindmap-toolbar-divider" />

        <span className="select-ask-mindmap-toolbar-zoom">{zoomLevel}%</span>

        <div className="select-ask-mindmap-toolbar-divider" />

        {onFullscreen && (
          <button className="select-ask-mindmap-toolbar-btn" title="全屏" onClick={onFullscreen}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        )}

        {onClose && (
          <button className="select-ask-mindmap-toolbar-btn" title="关闭" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
    </>
  );
}
