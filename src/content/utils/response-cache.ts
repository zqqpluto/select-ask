/**
 * Response cache for storing AI responses by text hash.
 * In-memory only (cleared on page refresh).
 */

export interface CachedResponse {
  explain: string;
  explainReasoning: string;
  translate: string;
  translateReasoning: string;
  timestamp: number;
}

// In-memory cache
const responseCache = new Map<string, CachedResponse>();
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour

function getTextHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export async function loadCache(): Promise<void> {
  try {
    await chrome.storage.local.remove('responseCache');
  } catch (error) {
    console.error('Failed to load cache:', error);
  }
}

export async function saveCache(): Promise<void> {
  // No-op: cache is in-memory only
}

export function getCachedResponse(text: string): CachedResponse | null {
  const hash = getTextHash(text);
  const cached = responseCache.get(hash);

  if (cached) {
    if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
      responseCache.delete(hash);
      return null;
    }
    return cached;
  }
  return null;
}

export function saveToCache(text: string, data: Partial<CachedResponse>): void {
  const hash = getTextHash(text);
  const existing = responseCache.get(hash) || {
    explain: '',
    translate: '',
    explainReasoning: '',
    translateReasoning: '',
    timestamp: Date.now(),
  };

  if (data.explain) existing.explain = data.explain;
  if (data.translate) existing.translate = data.translate;
  if (data.explainReasoning) existing.explainReasoning = data.explainReasoning;
  if (data.translateReasoning) existing.translateReasoning = data.translateReasoning;

  existing.timestamp = Date.now();
  responseCache.set(hash, existing);
  saveCache();
}

export function clearTextCache(text: string): void {
  const hash = getTextHash(text);
  responseCache.delete(hash);
}

export function clearCache(): void {
  responseCache.clear();
}
