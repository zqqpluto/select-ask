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

  const downloadPng = useCallback(async (filename = 'mindmap.png') => {
    if (!svgRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(svgRef.current as unknown as HTMLElement, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        pixelRatio: 2,
      });
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
      const blob = await toBlob(svgRef.current as unknown as HTMLElement, { backgroundColor: '#ffffff' });
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
      const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const htmlBlob = new Blob([svgClone.outerHTML], { type: 'text/html' });
      const textBlob = new Blob([svgClone.outerHTML], { type: 'text/plain' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);
    } catch (err) {
      console.error('Failed to copy rich text:', err);
      fallbackCopyText('SVG 源码已复制到剪贴板（文本格式）');
    } finally {
      setExporting(false);
    }
  }, [svgRef]);

  return { downloadPng, copyPngToClipboard, copyRichText, exporting };
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
