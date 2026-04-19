export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  questionModel: boolean;
}

export interface ModelsResponse {
  public: ModelInfo[];
  custom: ModelInfo[];
}

export interface ChatRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  apiKey?: string;
  context?: {
    selected: string;
    before: string;
    after: string;
  };
}

export interface QuestionsRequest {
  text: string;
  context?: {
    before: string;
    after: string;
  };
}

export interface QuestionsResponse {
  questions: string[];
}