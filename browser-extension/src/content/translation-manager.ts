/**
 * 行内翻译管理器
 * 单例模式，管理所有译文实例的状态
 */

/**
 * 译文条目接口
 * 管理每个译文的状态和关联元素
 */
export interface TranslationEntry {
  id: string;                    // 唯一标识
  originalText: string;          // 原文
  sourceElement: HTMLElement;    // 原文所在段落
  translationElement: HTMLElement; // 译文容器
  isVisible: boolean;            // 是否可见
  createdAt: number;             // 创建时间
  streamCompleted: boolean;      // 流式传输是否完成
}

/**
 * 译文管理器单例类
 */
class TranslationManagerClass {
  private static instance: TranslationManagerClass;
  private translations: Map<string, TranslationEntry> = new Map();

  // 私有构造函数，防止外部实例化
  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): TranslationManagerClass {
    if (!TranslationManagerClass.instance) {
      TranslationManagerClass.instance = new TranslationManagerClass();
    }
    return TranslationManagerClass.instance;
  }

  /**
   * 注册新的译文条目
   */
  public register(entry: TranslationEntry): void {
    this.translations.set(entry.id, entry);
    console.log(`[Translation] Registered: ${entry.id}`);
  }

  /**
   * 获取译文条目
   */
  public get(id: string): TranslationEntry | null {
    return this.translations.get(id) || null;
  }

  /**
   * 移除译文条目
   */
  public remove(id: string): void {
    const entry = this.translations.get(id);
    if (entry) {
      this.translations.delete(id);
      console.log(`[Translation] Removed: ${entry.id}`);
    }
  }

  /**
   * 获取指定段落的所有译文
   */
  public getByParagraph(paragraph: HTMLElement): TranslationEntry[] {
    const entries: TranslationEntry[] = [];
    for (const entry of this.translations.values()) {
      if (entry.sourceElement === paragraph) {
        entries.push(entry);
      }
    }
    return entries;
  }

  /**
   * 关闭指定段落的所有译文
   */
  public closeByParagraph(paragraph: HTMLElement): void {
    const entries = this.getByParagraph(paragraph);
    entries.forEach(entry => {
      entry.translationElement.remove();
      this.translations.delete(entry.id);
    });
    if (entries.length > 0) {
      console.log(`[Translation] Closed ${entries.length} translations for paragraph`);
    }
  }

  /**
   * 关闭所有译文
   */
  public closeAll(): void {
    for (const entry of this.translations.values()) {
      entry.translationElement.remove();
    }
    this.translations.clear();
    console.log('[Translation] Closed all translations');
  }

  /**
   * 获取所有可见译文
   */
  public getVisibleTranslations(): TranslationEntry[] {
    const visible: TranslationEntry[] = [];
    for (const entry of this.translations.values()) {
      if (entry.isVisible) {
        visible.push(entry);
      }
    }
    return visible;
  }

  /**
   * 更新译文状态
   */
  public update(id: string, updates: Partial<TranslationEntry>): void {
    const entry = this.translations.get(id);
    if (entry) {
      Object.assign(entry, updates);
    }
  }

  /**
   * 获取译文数量
   */
  public getCount(): number {
    return this.translations.size;
  }

  /**
   * 清理已移除 DOM 的译文条目
   */
  public cleanup(): void {
    for (const [id, entry] of this.translations.entries()) {
      if (!document.contains(entry.translationElement)) {
        this.translations.delete(id);
      }
    }
  }
}

// 导出单例实例
export const TranslationManager = TranslationManagerClass.getInstance();
