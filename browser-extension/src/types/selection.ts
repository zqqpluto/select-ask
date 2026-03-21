export interface ContextData {
  selectedText: string;
  beforeText: string;
  afterText: string;
}

export interface SelectionContext {
  text: string;
  context: ContextData;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FloatingBoxPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}