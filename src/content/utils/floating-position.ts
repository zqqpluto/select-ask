/**
 * 比例 ↔ 像素转换 + 持久化
 * 比例值范围 0~1，0 = 屏幕顶部，1 = 屏幕底部
 */

const STORAGE_KEY = 'floatingIconTopRatio';

export function loadRatio(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const v = parseFloat(raw);
      if (!isNaN(v) && v >= 0 && v <= 1) return v;
    }
  } catch { /* ignore */ }
  return 0.5;
}

export function saveRatio(ratio: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(ratio));
  } catch { /* ignore */ }
}

/** 比例 → 像素 Y 偏移（正数 = 向下，相对于屏幕顶部） */
export function ratioToPixel(ratio: number): number {
  return ratio * (window.innerHeight - 42);
}

/** 像素 Y 偏移 → 比例 */
export function pixelToRatio(px: number): number {
  return px / (window.innerHeight - 42);
}
