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

export interface UsageRequest {
  model: string;
  action: 'chat' | 'question';
}

export interface UsageResponse {
  success: boolean;
}

export interface StatsOverview {
  today: {
    activeUsers: number;
    totalRequests: number;
  };
  trend: {
    dailyUsers: number[];
    dailyRequests: number[];
  };
  byModel: Array<{
    model: string;
    count: number;
  }>;
}