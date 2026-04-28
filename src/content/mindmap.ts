/**
 * 脑图 Content Script 模块
 * 在悬浮窗口的 AI 回复中添加"生成脑图"按钮
 * 纯 TS 实现，不依赖 React
 */

import {
  detectMarkdownStructure,
} from '../components/MindMap/mindmap-utils';
import { renderMindmap } from '../utils/mindmap-renderer';

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
  let mindmapResult: Awaited<ReturnType<typeof renderMindmap>> | null = null;
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
    document.removeEventListener('keydown', handleEscape);
    mindmapResult?.dispose();
    backdrop?.remove();
    panel.remove();
    if (currentMindMapPanel === panel) currentMindMapPanel = null;
  };
  closeBtn.addEventListener('click', closeHandler);

  // Escape key to close
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeHandler();
  };
  document.addEventListener('keydown', handleEscape);

  // Click backdrop to close
  const backdrop = document.createElement('div');
  backdrop.className = 'select-ask-mindmap-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:2147483644;background:rgba(0,0,0,0.3);';
  backdrop.addEventListener('click', closeHandler);
  document.body.appendChild(backdrop);

  // Render mindmap using shared renderer
  let svg: SVGSVGElement | null = null;
  let mm: any = null;
  try {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.width = '100%';
    svg.style.height = '100%';
    body.innerHTML = '';
    body.appendChild(svg);

    mindmapResult = await renderMindmap(svg, markdown, body);
    mm = mindmapResult.markmap;
  } catch (err) {
    body.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'select-ask-mindmap-panel-loading';
    errorDiv.style.flexDirection = 'column';
    errorDiv.style.gap = '8px';
    const errorText = document.createElement('span');
    errorText.style.color = '#f53f3f';
    errorText.textContent = '脑图生成失败';
    const detailText = document.createElement('span');
    detailText.style.fontSize = '11px';
    detailText.style.color = '#86909c';
    detailText.textContent = err instanceof Error ? err.message : String(err);
    const retryBtn = document.createElement('button');
    retryBtn.className = 'select-ask-mindmap-btn';
    retryBtn.textContent = '重试';
    retryBtn.style.marginTop = '4px';
    retryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.remove();
      if (currentMindMapPanel === panel) currentMindMapPanel = null;
      createMindMapPanel(markdown);
    });
    errorDiv.appendChild(errorText);
    errorDiv.appendChild(detailText);
    errorDiv.appendChild(retryBtn);
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

  // 按钮按正确顺序 append（从左到右）
  // 1. 适配
  const fitBtn = createToolbarBtn(btnClass, '适配', '⊡');
  fitBtn.addEventListener('click', () => mm.fit());
  toolbar.appendChild(fitBtn);

  // 2. 缩小
  const zoomOutBtn = createToolbarBtn(btnClass, '缩小', '−');
  zoomOutBtn.addEventListener('click', () => mm.scaleBy(0.8));
  toolbar.appendChild(zoomOutBtn);

  // 3. 放大
  const zoomInBtn = createToolbarBtn(btnClass, '放大', '+');
  zoomInBtn.addEventListener('click', () => mm.scaleBy(1.25));
  toolbar.appendChild(zoomInBtn);

  // 4. 展开全部
  const expandBtn = createToolbarBtn(btnClass, '展开全部', '⊞');
  expandBtn.addEventListener('click', () => {
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
  });
  toolbar.appendChild(expandBtn);

  // 5. 折叠全部
  const collapseBtn = createToolbarBtn(btnClass, '折叠全部', '⊟');
  collapseBtn.addEventListener('click', () => {
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
  });
  toolbar.appendChild(collapseBtn);

  // 缩放级别显示
  const zoomDisplay = document.createElement('span');
  zoomDisplay.className = 'select-ask-mindmap-toolbar-zoom';
  zoomDisplay.textContent = '100%';
  toolbar.appendChild(zoomDisplay);

  // 更新缩放显示
  const updateZoom = () => {
    const g = svg.querySelector('g');
    if (g) {
      const transform = (g as SVGGraphicsElement).transform?.baseVal;
      if (transform && transform.numberOfItems > 0) {
        const matrix = transform.getItem(0).matrix;
        zoomDisplay.textContent = Math.round(matrix.a * 100) + '%';
      }
    }
  };
  const g = svg.querySelector('g');
  if (g) {
    const mo = new MutationObserver(updateZoom);
    mo.observe(g, { attributes: true, attributeFilter: ['transform'] });
    updateZoom();
  }

  // 分隔线
  const divider = document.createElement('div');
  divider.className = 'select-ask-mindmap-toolbar-divider';
  toolbar.appendChild(divider);

  // 下载图片
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
  toolbar.appendChild(downloadBtn);

  // 复制图片
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
  toolbar.appendChild(copyBtn);

  // 全屏（最右侧）
  const fullscreenBtn = createToolbarBtn(btnClass, '全屏', '⛶');
  fullscreenBtn.addEventListener('click', () => {
    panel.classList.toggle('select-ask-mindmap-panel-fullscreen');
  });
  toolbar.appendChild(fullscreenBtn);
}

function createToolbarBtn(className: string, title: string, text: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = className;
  btn.title = title;
  btn.textContent = text;
  return btn;
}
