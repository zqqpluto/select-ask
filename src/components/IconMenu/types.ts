export interface IconMenuProps {
  position: { x: number; y: number };
  onExplain: () => void;
  onTranslate: () => void;
  onQuestion: () => void;
  onQuestions: () => void;
  onSearch: () => void;
  onClose: () => void;
}

export type MenuAction = 'explain' | 'translate' | 'question' | 'search';