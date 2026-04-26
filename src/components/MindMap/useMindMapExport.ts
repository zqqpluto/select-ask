/**
 * 脑图导出功能 Hook
 * 提供下载图片、复制图片、复制富文本等功能
 */

import { useState, useCallback } from 'react';

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
    clone.style.position = 'fixed';
    clone.style.left = '-10000px';
    clone.style.top = '0';
    clone.style.width = svgRef.current.style.width || '800px';
    clone.style.height = svgRef.current.style.height || '600px';
    clone.style.zIndex = '-1';
    document.body.appendChild(clone);
    return clone;
  }

  const downloadPng = useCallback(async (filename = 'mindmap.png') => {
    if (!svgRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const offscreen = createOffscreenClone();
      const target = offscreen || svgRef.current;
      const dataUrl = await toPng(target as unknown as HTMLElement, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
      });
      if (offscreen) offscreen.remove();
      triggerDownload(dataUrl, filename);
    } catch (err) {
      console.error('Failed to download PNG:', err);
    } finally {
      setExporting(false);
    }
  }, [svgRef]);

  const copyPngToClipboard = useCallback(async () => {
    if (!svgRef.current) return;
    setExporting(true);
    try {
      const { toBlob } = await import('html-to-image');
      const offscreen = createOffscreenClone();
      const target = offscreen || svgRef.current;
      const blob = await toBlob(target as unknown as HTMLElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      if (offscreen) offscreen.remove();
      if (!blob) throw new Error('Failed to generate blob');
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      fallbackCopyText('图片导出失败，请尝试下载功能');
    } finally {
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

  return { downloadPng, copyPngToClipboard, copyRichText, exporting };
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 触发浏览器下载
 */
function triggerDownload(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
