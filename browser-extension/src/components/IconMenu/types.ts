export interface IconMenuProps {
  position: { x: number; y: number };
  onExplain: () => void;
  onTranslate: () => void;
  onQuestion: () => void;
  onQuestions: () => void;
  onClose: () => void;
}

export type MenuAction = 'explain' | 'translate' | 'question' | 'questions';