/**
 * 打开侧边栏时调整页面布局
 */
export function openSidebarLayout(): void {
  const sidebarWidth = 420;
  document.body.style.marginRight = `${sidebarWidth}px`;
  document.body.style.transition = 'margin-right 0.25s ease-out';
  document.body.style.width = `calc(100% - ${sidebarWidth}px)`;
}

/**
 * 关闭侧边栏时恢复页面布局
 */
export function closeSidebarLayout(): void {
  document.body.style.marginRight = '0';
  document.body.style.width = '100%';
}

/**
 * 调整浮动框位置（确保不超出视口边界）
 */
export function adjustBoxPosition(box: HTMLElement, initialX: number, initialY: number): void {
  const boxRect = box.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const margin = 10;

  let x = initialX;
  let y = initialY;

  if (x + boxRect.width > scrollX + viewportWidth - margin) {
    x = scrollX + viewportWidth - boxRect.width - margin;
  }
  if (x < scrollX + margin) {
    x = scrollX + margin;
  }
  if (y + boxRect.height > scrollY + viewportHeight - margin) {
    y = scrollY + viewportHeight - boxRect.height - margin;
  }
  if (y < scrollY + margin) {
    y = scrollY + margin;
  }

  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
}

/**
 * 确保对话框在视口内
 */
export function ensureBoxInViewport(box: HTMLElement): void {
  const boxRect = box.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;
  const margin = 10;

  let x = parseFloat(box.style.left) || boxRect.left + scrollX;
  let y = parseFloat(box.style.top) || boxRect.top + scrollY;

  if (boxRect.right > viewportWidth - margin) {
    x = scrollX + viewportWidth - boxRect.width - margin;
  }
  if (boxRect.left < margin) {
    x = scrollX + margin;
  }
  if (boxRect.bottom > viewportHeight - margin) {
    y = scrollY + viewportHeight - boxRect.height - margin;
  }
  if (boxRect.top < margin) {
    y = scrollY + margin;
  }

  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
}
