import { useState, useCallback } from 'react';
import type { ModelConfig } from '../../types';

interface UseRecommendedQuestionsReturn {
  recommendedQuestions: string[];
  isGenerating: boolean;
  autoGenerateEnabled: boolean;
  hasGenerated: boolean;
  generate: (selectedText: string, context: { before: string; after: string } | null, model: ModelConfig) => Promise<void>;
  setAutoGenerate: (v: boolean) => void;
  reset: () => void;
}

export function useRecommendedQuestions(): UseRecommendedQuestionsReturn {
  const [recommendedQuestions, setRecommendedQuestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoGenerateEnabled, setAutoGenerate] = useState(true);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generate = useCallback(async (selectedText: string, context: { before: string; after: string } | null, model: ModelConfig) => {
    setIsGenerating(true);
    return new Promise<void>((resolve) => {
      const port = chrome.runtime.connect({ name: 'llm-stream' });
      let fullContent = '';

      port.onMessage.addListener((message) => {
        if (message.type === 'LLM_STREAM_CHUNK') {
          fullContent += message.chunk || '';
        } else if (message.type === 'LLM_STREAM_END') {
          const cleaned = fullContent.replace(/\[REASONING\]/g, '').replace(/\[REASONING_DONE\]/g, '').replace(/\[ANSWER\]/g, '').replace(/\[ANSWER_DONE\]/g, '');
          const questions = cleaned.split('\n').map(q => q.trim())
            .filter(q => q.length > 0 && q.length < 200)
            .map(q => { let c = q.replace(/^[\d\-\•\*]+\s*[.)]?\s*/, ''); while (c && !c[0].match(/[\u4e00-\u9fa5a-zA-Z?]/)) c = c.slice(1); return c.trim(); })
            .filter(q => {
              if (!q.length) return false;
              if (['首先', '接下来', '然后', '最后', '用户可能', '用户需要', '我得', '所以', '因为', '这是一个', '分析', '推理', '嗯，', '嗯,', '想想', '第一个问题', '第二个问题', '第三个问题'].some(k => q.includes(k))) return false;
              return q.includes('?') || q.includes('？') || q.includes('什么') || q.includes('如何') || q.includes('怎么') || q.includes('为什么') || q.includes('是否') || q.includes('哪些') || q.includes('哪里') || q.includes('吗');
            }).slice(0, 3);
          port.disconnect();
          setRecommendedQuestions(questions);
          setHasGenerated(true);
          setIsGenerating(false);
          resolve();
        } else if (message.type === 'LLM_STREAM_ERROR') { port.disconnect(); setIsGenerating(false); resolve(); }
      });
      port.onDisconnect.addListener(() => { setIsGenerating(false); resolve(); });
      port.postMessage({ type: 'LLM_STREAM_START', payload: { action: 'generateQuestions', text: selectedText, context: context || undefined, modelId: model.id } });
    });
  }, []);

  const reset = useCallback(() => { setRecommendedQuestions([]); setHasGenerated(false); setIsGenerating(false); }, []);

  return { recommendedQuestions, isGenerating, autoGenerateEnabled, hasGenerated, generate, setAutoGenerate, reset };
}
