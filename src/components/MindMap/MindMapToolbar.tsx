/**
 * 脑图工具栏组件
 * 对标豆包 v1.37.0 实现：
 * - 内联模式：药丸形容器（border-radius: 999px），32px 高度
 * - 全屏模式：header 内左侧文字按钮+右侧图标按钮
 */

import { useState, useRef, useEffect, useCallback } from 'react';
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
  variant?: 'inline' | 'fullscreen';
}

/* ===== 图标 ===== */
function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function RichTextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="17" y1="10" x2="3" y2="10"/>
      <line x1="21" y1="6" x2="3" y2="6"/>
      <line x1="21" y1="14" x2="3" y2="14"/>
      <line x1="17" y1="18" x2="3" y2="18"/>
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  );
}

function FitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15 3 21 3 21 9"/>
      <polyline points="9 21 3 21 3 15"/>
      <line x1="21" y1="3" x2="14" y2="10"/>
      <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

/* ===== 内联导出下拉 ===== */
function InlineExportDropdown({
  visible,
  onClose,
  downloadPng,
  copyPngToClipboard,
  copyRichText,
}: {
  visible: boolean;
  onClose: () => void;
  downloadPng: () => void;
  copyPngToClipboard: () => void;
  copyRichText: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div ref={ref} className="select-ask-mindmap-export-dropdown">
      <button className="select-ask-mindmap-export-item" onClick={() => { downloadPng(); onClose(); }}>
        <DownloadIcon />
        下载图片
      </button>
      <button className="select-ask-mindmap-export-item" onClick={() => { copyPngToClipboard(); onClose(); }}>
        <CopyIcon />
        复制图片
      </button>
      <button className="select-ask-mindmap-export-item" onClick={() => { copyRichText(); onClose(); }}>
        <RichTextIcon />
        复制富文本
      </button>
    </div>
  );
}

/* ===== 主组件 ===== */
export default function MindMapToolbar({
  markmapRef,
  svgRef: _svgRef,
  downloadPng,
  copyPngToClipboard,
  copyRichText,
  exporting,
  onFullscreen,
  onClose,
  variant = 'inline',
}: MindMapToolbarProps) {
  const [showExport, setShowExport] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

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

  const handleZoomIn = useCallback(() => markmapRef.current?.rescale(1.25), [markmapRef]);
  const handleZoomOut = useCallback(() => markmapRef.current?.rescale(0.8), [markmapRef]);
  const handleFit = useCallback(() => markmapRef.current?.fit(), [markmapRef]);

  const handleExpandAll = useCallback(() => {
    const mm = markmapRef.current;
    if (!mm || !mm.state.data) return;
    const data = mm.state.data;
    function setFold(node: any, fold: number) {
      if (node.children) {
        node.payload = { ...node.payload, fold };
        node.children.forEach((child: any) => setFold(child, fold));
      }
    }
    data.children?.forEach((child: any) => setFold(child, 0));
    void mm.setData(data as any).then(() => mm.fit());
  }, [markmapRef]);

  const handleCollapseAll = useCallback(() => {
    const mm = markmapRef.current;
    if (!mm || !mm.state.data) return;
    const data = mm.state.data;
    function setFold(node: any) {
      if (node.children && node.children.length > 0) {
        node.payload = { ...node.payload, fold: 1 };
        node.children.forEach((child: any) => setFold(child));
      }
    }
    data.children?.forEach((child: any) => setFold(child));
    void mm.setData(data as any).then(() => mm.fit());
  }, [markmapRef]);

  function ExpandIcon() {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
      </svg>
    );
  }

  function CollapseIcon() {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 14h6m0 0v6m0-6H4m0 0V8m16 6h-6m0 0v6m0-6h6m0 0V8M8 10V4h6"/>
      </svg>
    );
  }

  /* ---- 内联模式（药丸形） ---- */
  if (variant === 'inline') {
    return (
      <div className="select-ask-mindmap-toolbar">
        <div style={{ position: 'relative' }}>
          <button
            className="select-ask-mindmap-toolbar-btn"
            title="导出"
            onClick={() => setShowExport(!showExport)}
            disabled={exporting}
          >
            <DownloadIcon />
            <ChevronDown />
          </button>
          <InlineExportDropdown
            visible={showExport}
            onClose={() => setShowExport(false)}
            downloadPng={downloadPng}
            copyPngToClipboard={copyPngToClipboard}
            copyRichText={copyRichText}
          />
        </div>

        <div className="select-ask-mindmap-toolbar-divider" />

        <button className="select-ask-mindmap-toolbar-btn" title="缩小" onClick={handleZoomOut}>
          <ZoomOutIcon />
        </button>

        <button className="select-ask-mindmap-toolbar-btn" title="放大" onClick={handleZoomIn}>
          <ZoomInIcon />
        </button>

        <button className="select-ask-mindmap-toolbar-btn" title="适配" onClick={handleFit}>
          <FitIcon />
        </button>

        <button className="select-ask-mindmap-toolbar-btn" title="展开全部" onClick={handleExpandAll}>
          <ExpandIcon />
        </button>

        <button className="select-ask-mindmap-toolbar-btn" title="折叠全部" onClick={handleCollapseAll}>
          <CollapseIcon />
        </button>

        {onFullscreen && (
          <>
            <div className="select-ask-mindmap-toolbar-divider" />
            <button className="select-ask-mindmap-toolbar-btn" title="全屏" onClick={onFullscreen}>
              <FullscreenIcon />
            </button>
          </>
        )}

        <span className="select-ask-mindmap-toolbar-zoom">{zoomLevel}%</span>
      </div>
    );
  }

  /* ---- 全屏模式（豆包风格） ---- */
  return (
    <div className="select-ask-mindmap-toolbar select-ask-mindmap-toolbar--fullscreen">
      <div className="select-ask-mindmap-toolbar__action-menu">
        <button className="select-ask-mindmap-toolbar__text-btn" onClick={downloadPng} disabled={exporting}>
          <DownloadIcon />
          <span>下载图片</span>
        </button>
        <button className="select-ask-mindmap-toolbar__text-btn" onClick={copyPngToClipboard}>
          <CopyIcon />
          <span>复制图片</span>
        </button>
        <button className="select-ask-mindmap-toolbar__text-btn" onClick={copyRichText}>
          <RichTextIcon />
          <span>复制富文本</span>
        </button>
      </div>

      <div className="select-ask-mindmap-toolbar__other-btns">
        <button className="select-ask-mindmap-toolbar__icon-btn" title="缩小" onClick={handleZoomOut}>
          <ZoomOutIcon />
        </button>
        <button className="select-ask-mindmap-toolbar__icon-btn" title="放大" onClick={handleZoomIn}>
          <ZoomInIcon />
        </button>
        <button className="select-ask-mindmap-toolbar__icon-btn" title="适配" onClick={handleFit}>
          <FitIcon />
        </button>

        <div className="select-ask-mindmap-toolbar-divider select-ask-mindmap-toolbar-divider--vertical" />

        {onFullscreen && (
          <button className="select-ask-mindmap-toolbar__icon-btn" title="全屏" onClick={onFullscreen}>
            <FullscreenIcon />
          </button>
        )}
        {onClose && (
          <button className="select-ask-mindmap-toolbar__icon-btn" title="关闭" onClick={onClose}>
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}
