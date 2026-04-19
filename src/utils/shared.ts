/**
 * Shared utility functions used across multiple modules.
 * Extracted to avoid duplication.
 */

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format time for display (HH:MM)
 */
export function formatTime(timestamp: number | Date = Date.now()): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format duration in Chinese (e.g., "30秒", "2分15秒")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
}

/**
 * Format URL for display: hostname + shortened path
 */
export function formatUrlForDisplay(url: string): { displayText: string; faviconUrl: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname;
    const pathShort = path.length > 30 ? path.slice(0, 27) + '...' : path;
    const displayText = pathShort ? `${hostname}${pathShort}` : hostname;
    const faviconUrl = `${parsed.origin}/favicon.ico`;
    return { displayText, faviconUrl };
  } catch {
    return { displayText: url, faviconUrl: '' };
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
