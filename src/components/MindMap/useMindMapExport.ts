/**
 * 脑图导出功能 Hook
 * 提供下载图片、复制图片、复制富文本等功能
 */

import { useState, useCallback } from 'react';
import { escapeHtml } from '../../utils/shared';

/**
 * 脑图导出 Hook
 * @param svgRef - SVG 元素的引用
 */
export function useMindMapExport(svgRef: React.RefObject<SVGSVGElement | null>) {
  const [exporting, setExporting] = useState(false);

  /**
   * 创建离屏克隆 SVG，避免导出时受视口裁剪影响
   */
  function createOffscreenClone(): SVGSVGElement | null {
    if (!svgRef.current) return null;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    const viewBox = svgRef.current.viewBox.baseVal;
    if (viewBox.width > 0 && viewBox.height > 0) {
      clone.setAttribute('width', String(viewBox.width * 2));
      clone.setAttribute('height', String(viewBox.height * 2));
    }
    clone.style.position = 'fixed';
    clone.style.left = '-10000px';
    clone.style.top = '0';
    document.body.appendChild(clone);
    return clone;
  }

  const downloadPng = useCallback(async (filename = 'mindmap.png') => {
    if (!svgRef.current) return;
    setExporting(true);
    let offscreen: SVGSVGElement | null = null;
    try {
      const { toBlob } = await import('html-to-image');
      offscreen = createOffscreenClone();
      const target = offscreen || svgRef.current;
      const blob = await toBlob(target as unknown as HTMLElement, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
      });
      if (!blob) throw new Error('Failed to generate blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PNG:', err);
    } finally {
      if (offscreen) offscreen.remove();
      setExporting(false);
    }
  }, [svgRef]);

  const copyPngToClipboard = useCallback(async () => {
    if (!svgRef.current) return;
    setExporting(true);
    let offscreen: SVGSVGElement | null = null;
    try {
      const { toBlob } = await import('html-to-image');
      offscreen = createOffscreenClone();
      const target = offscreen || svgRef.current;
      const blob = await toBlob(target as unknown as HTMLElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      if (!blob) throw new Error('Failed to generate blob');
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      fallbackCopyText('图片导出失败，请尝试下载功能');
    } finally {
      if (offscreen) offscreen.remove();
      setExporting(false);
    }
  }, [svgRef]);

  const copyRichText = useCallback(async () => {
    if (!svgRef.current) return;
    setExporting(true);
    try {
      const svg = svgRef.current;
      const nodeGroups = svg.querySelectorAll('.markmap-node');
      if (nodeGroups.length === 0) throw new Error('No mind map nodes found');

      interface MindMapNode { text: string; depth: number }
      const nodes: MindMapNode[] = [];

      for (const group of nodeGroups) {
        const foreign = group.querySelector('.markmap-foreign');
        if (!foreign) continue;
        const innerDiv = foreign.querySelector('div');
        if (!innerDiv) continue;
        const text = innerDiv.textContent?.trim();
        if (!text) continue;

        let depth = 0;
        let parent = group.parentElement;
        while (parent) {
          if (parent.classList?.contains('markmap-branch')) depth++;
          parent = parent.parentElement;
        }
        nodes.push({ text, depth });
      }

      if (nodes.length === 0) throw new Error('No valid nodes found');

      function buildHtmlList(items: MindMapNode[], start: number): { html: string; end: number } {
        let html = '<ul>\n';
        let i = start;
        while (i < items.length) {
          const item = items[i];
          html += `<li>${escapeHtml(item.text)}`;
          if (i + 1 < items.length && items[i + 1].depth > item.depth) {
            const child = buildHtmlList(items, i + 1);
            html += child.html;
            i = child.end;
          }
          html += '</li>\n';
          i++;
          if (i < items.length && items[i].depth <= item.depth - 1) break;
        }
        html += '</ul>\n';
        return { html, end: i };
      }

      function buildPlainText(items: MindMapNode[]): string {
        return items.map(item => '\t'.repeat(item.depth) + item.text).join('\n');
      }

      const { html: htmlContent } = buildHtmlList(nodes, 0);
      const plainText = buildPlainText(nodes);

      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });

      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }),
      ]);
    } catch (err) {
      console.error('Failed to copy rich text:', err);
      fallbackCopyText('脑图内容复制失败');
    } finally {
      setExporting(false);
    }
  }, [svgRef]);

  const copySvg = useCallback(async () => {
    if (!svgRef.current) return;
    setExporting(true);
    try {
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgRef.current);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/svg+xml': blob }),
      ]);
    } catch (err) {
      console.error('Failed to copy SVG:', err);
      fallbackCopyText('SVG 复制失败，请尝试下载功能');
    } finally {
      setExporting(false);
    }
  }, [svgRef]);

  const downloadSvg = useCallback(async (filename = 'mindmap.svg') => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [svgRef]);

  return { downloadPng, copyPngToClipboard, copyRichText, copySvg, downloadSvg, exporting };
}

/**
 * 降级复制方案（文本）
 */
function fallbackCopyText(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    // ignore
  }
  document.body.removeChild(ta);
}
