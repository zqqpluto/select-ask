/**
 * 脑图 Content Script 模块
 * 在悬浮窗口的 AI 回复中添加"生成脑图"按钮
 * 纯 TS 实现，不依赖 React
 */

import {
  detectMarkdownStructure,
  createTransformer,
  transformMarkdown,
  getMarkmapAssets,
  loadCSS,
  loadJS,
  injectChineseFontCSS,
} from '../components/MindMap/mindmap-utils';
import { MARKMAP_OPTIONS } from '../components/MindMap/mindmap-options';

let currentMindMapPanel: HTMLElement | null = null;

/**
 * 在 AI 回答操作区添加脑图按钮
 */
export function addMindMapButton(
  actionsArea: HTMLElement,
  markdownContent: string,
  _messageElement: HTMLElement
): void {
  if (!detectMarkdownStructure(markdownContent)) return;
  if (actionsArea.querySelector('.select-ask-mindmap-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'select-ask-mindmap-btn';
  btn.title = '生成脑图';

  const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgIcon.setAttribute('viewBox', '0 0 24 24');
  svgIcon.setAttribute('width', '14');
  svgIcon.setAttribute('height', '14');
  svgIcon.setAttribute('fill', 'none');
  svgIcon.setAttribute('stroke', 'currentColor');
  svgIcon.setAttribute('stroke-width', '2');
  ['12,12', '4,6', '20,6', '4,18', '20,18'].forEach((cx, i) => {
    const [x, y] = cx.split(',');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', i === 0 ? '3' : '2');
    svgIcon.appendChild(circle);
  });
  [
    ['9.5', '10.5', '5.5', '7.5'],
    ['14.5', '10.5', '18.5', '7.5'],
    ['9.5', '13.5', '5.5', '16.5'],
    ['14.5', '13.5', '18.5', '16.5'],
  ].forEach(([x1, y1, x2, y2]) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    svgIcon.appendChild(line);
  });
  btn.appendChild(svgIcon);

  const label = document.createElement('span');
  label.textContent = '脑图';
  btn.appendChild(label);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentMindMapPanel) {
      currentMindMapPanel.remove();
      currentMindMapPanel = null;
      return;
    }
    createMindMapPanel(markdownContent);
  });

  const disclaimer = actionsArea.querySelector('.select-ask-ai-disclaimer');
  if (disclaimer) {
    actionsArea.insertBefore(btn, disclaimer);
  } else {
    actionsArea.appendChild(btn);
  }
}

/**
 * 创建脑图面板
 */
async function createMindMapPanel(markdown: string) {
  const panel = document.createElement('div');
  panel.className = 'select-ask-mindmap-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'select-ask-mindmap-panel-header';

  const title = document.createElement('div');
  title.className = 'select-ask-mindmap-panel-title';
  const titleSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  titleSvg.setAttribute('viewBox', '0 0 24 24');
  titleSvg.setAttribute('fill', 'none');
  titleSvg.setAttribute('stroke', 'currentColor');
  titleSvg.setAttribute('stroke-width', '2');
  const titleCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  titleCircle.setAttribute('cx', '12');
  titleCircle.setAttribute('cy', '12');
  titleCircle.setAttribute('r', '3');
  titleSvg.appendChild(titleCircle);
  title.appendChild(titleSvg);
  title.appendChild(document.createTextNode('脑图'));

  // Toolbar buttons container
  const toolbar = document.createElement('div');
  toolbar.className = 'select-ask-mindmap-panel-toolbar';

  const closeBtn = createToolbarBtn('select-ask-mindmap-panel-toolbar-btn', '关闭', '✕');
  toolbar.appendChild(closeBtn);

  header.appendChild(title);
  header.appendChild(toolbar);

  // Body
  const body = document.createElement('div');
  body.className = 'select-ask-mindmap-panel-body';

  const loading = document.createElement('div');
  loading.className = 'select-ask-mindmap-panel-loading';
  const spinner = document.createElement('div');
  spinner.className = 'select-ask-mindmap-panel-loading-spinner';
  const loadingText = document.createElement('span');
  loadingText.textContent = '正在生成脑图...';
  loading.appendChild(spinner);
  loading.appendChild(loadingText);
  body.appendChild(loading);

  panel.appendChild(header);
  panel.appendChild(body);
  document.body.appendChild(panel);
  currentMindMapPanel = panel;

  const closeHandler = () => {
    observer?.disconnect();
    panel.remove();
    if (currentMindMapPanel === panel) currentMindMapPanel = null;
  };
  closeBtn.addEventListener('click', closeHandler);

  // Render mindmap
  let svg: SVGSVGElement | null = null;
  let mm: any = null;
  let observer: ResizeObserver | null = null;
  try {
    const transformer = await createTransformer();
    const { root, features } = await transformMarkdown(transformer as any, markdown);

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
        assets.scripts.map((s: any) => loadJS(s.url))
      );
    }

    injectChineseFontCSS();

    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '100%';
    svg.style.height = '100%';
    body.innerHTML = '';
    body.appendChild(svg);

    mm = (await import('markmap-view')).Markmap.create(svg, MARKMAP_OPTIONS, root as any);

    // ResizeObserver for auto-fit
    observer = new ResizeObserver(() => {
      setTimeout(() => mm?.fit(), 50);
    });
    observer.observe(body);

    setTimeout(() => mm.fit(), 100);
  } catch (err) {
    body.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'select-ask-mindmap-panel-loading';
    const errorText = document.createElement('span');
    errorText.style.color = '#f53f3f';
    errorText.textContent = '脑图生成失败';
    const detailText = document.createElement('span');
    detailText.style.fontSize = '11px';
    detailText.style.color = '#86909c';
    detailText.textContent = err instanceof Error ? err.message : String(err);
    errorDiv.appendChild(errorText);
    errorDiv.appendChild(detailText);
    body.appendChild(errorDiv);
    return;
  }

  // Add toolbar actions after successful render
  if (mm && svg) {
    addToolbarActions(toolbar, svg, mm, panel);
  }
}

/**
 * 添加工具栏操作按钮
 */
function addToolbarActions(
  toolbar: HTMLElement,
  svg: SVGSVGElement,
  mm: any,
  panel: HTMLElement
) {
  const btnClass = 'select-ask-mindmap-panel-toolbar-btn';

  // Fullscreen
  const fullscreenBtn = createToolbarBtn(btnClass, '全屏', '⛶');
  fullscreenBtn.addEventListener('click', () => {
    panel.classList.toggle('select-ask-mindmap-panel-fullscreen');
  });
  toolbar.insertBefore(fullscreenBtn, toolbar.firstChild);

  // Zoom in
  const zoomInBtn = createToolbarBtn(btnClass, '放大', '+');
  zoomInBtn.addEventListener('click', () => mm.scaleBy(1.25));
  toolbar.insertBefore(zoomInBtn, toolbar.firstChild);

  // Zoom out
  const zoomOutBtn = createToolbarBtn(btnClass, '缩小', '−');
  zoomOutBtn.addEventListener('click', () => mm.scaleBy(0.8));
  toolbar.insertBefore(zoomOutBtn, toolbar.firstChild);

  // Fit
  const fitBtn = createToolbarBtn(btnClass, '适配', '⊡');
  fitBtn.addEventListener('click', () => mm.fit());
  toolbar.insertBefore(fitBtn, toolbar.firstChild);

  // Copy image
  const copyBtn = createToolbarBtn(btnClass, '复制图片', '⊡');
  copyBtn.addEventListener('click', async () => {
    try {
      const { toBlob } = await import('html-to-image');
      const blob = await toBlob(svg as unknown as HTMLElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      }
    } catch (err) {
      console.error('Copy failed:', err);
    }
  });
  toolbar.insertBefore(copyBtn, toolbar.firstChild);

  // Download PNG
  const downloadBtn = createToolbarBtn(btnClass, '下载图片', '↓');
  downloadBtn.addEventListener('click', async () => {
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(svg as unknown as HTMLElement, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `mindmap-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    }
  });
  toolbar.insertBefore(downloadBtn, toolbar.firstChild);
}

function createToolbarBtn(className: string, title: string, text: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = className;
  btn.title = title;
  btn.textContent = text;
  return btn;
}
