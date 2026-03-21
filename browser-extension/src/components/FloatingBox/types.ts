import type { Message } from '../../types';

export interface FloatingBoxProps {
  visible: boolean;
  position: { x: number; y: number };
  mode: 'explain' | 'translate' | 'question' | 'questions';
  messages: Message[];
  isStreaming: boolean;
  questions: string[];
  isGeneratingQuestions: boolean;
  onSendMessage: (content: string) => void;
  onQuestionClick: (question: string) => void;
  onClose: () => void;
  onResize?: (size: { width: number; height: number }) => void;
}

export type FloatingBoxMode = 'explain' | 'translate' | 'question' | 'questions';