import React, { useEffect, useRef, useState } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { ChatMessage } from '../ChatMessage';
import type { FloatingBoxProps } from './types';
import './style.css';

const INITIAL_WIDTH = 400;
const INITIAL_HEIGHT = 300;

export function FloatingBox({
  visible,
  position,
  mode,
  messages,
  isStreaming,
  questions,
  isGeneratingQuestions,
  onSendMessage,
  onQuestionClick,
  onClose,
  onResize,
}: FloatingBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [size, setSize] = useState({ width: INITIAL_WIDTH, height: INITIAL_HEIGHT });

  // 点击外部关闭
  useClickOutside(boxRef, onClose);

  // 更新位置和尺寸
  useEffect(() => {
    if (visible && boxRef.current) {
      adjustPosition();
    }
  }, [visible, position, size]);

  // 问题生成完成后调整尺寸
  useEffect(() => {
    if (!isGeneratingQuestions && questions.length > 0 && boxRef.current) {
      adjustSizeForQuestions();
    }
  }, [isGeneratingQuestions, questions]);

  // 调整位置确保不超出视口
  const adjustPosition = () => {
    if (!boxRef.current) return;

    const box = boxRef.current;
    const boxRect = box.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // 检查右边界
    if (x + boxRect.width > viewportWidth - 20) {
      x = viewportWidth - boxRect.width - 20;
    }

    // 检查下边界
    if (y + boxRect.height > viewportHeight - 20) {
      y = viewportHeight - boxRect.height - 20;
    }

    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
  };

  // 根据问题列表调整尺寸
  const adjustSizeForQuestions = () => {
    if (!boxRef.current) return;

    const questionList = boxRef.current.querySelector('.select-ask-floating-box-questions');
    if (!questionList) return;

    const listHeight = questionList.scrollHeight;
    const newHeight = Math.min(INITIAL_HEIGHT + listHeight, 500);

    const questionItems = boxRef.current.querySelectorAll('.select-ask-floating-box-question');
    let maxWidth = 0;
    questionItems.forEach((item) => {
      const itemWidth = item.scrollWidth;
      if (itemWidth > maxWidth) {
        maxWidth = itemWidth;
      }
    });

    const newWidth = Math.max(INITIAL_WIDTH, maxWidth + 48);

    setSize({ width: newWidth, height: newHeight });
    onResize?.(size);
  };

  // 发送消息
  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  // 按Enter发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 获取标题
  const getTitle = () => {
    switch (mode) {
      case 'explain':
        return '解释';
      case 'translate':
        return '翻译';
      case 'question':
        return '提问';
      case 'questions':
        return '常见问题';
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={boxRef}
      className="select-ask-floating-box"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
    >
      <div className="select-ask-floating-box-header">
        <span className="select-ask-floating-box-title">{getTitle()}</span>
        <button className="select-ask-floating-box-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="select-ask-floating-box-content">
        {mode === 'questions' && isGeneratingQuestions ? (
          <div className="select-ask-floating-box-loading">
            <div className="select-ask-floating-box-loading-spinner" />
            生成中...
          </div>
        ) : mode === 'questions' && questions.length > 0 ? (
          <div className="select-ask-floating-box-questions">
            {questions.map((question, index) => (
              <button
                key={index}
                className="select-ask-floating-box-question"
                onClick={() => onQuestionClick(question)}
              >
                {question}
              </button>
            ))}
          </div>
        ) : messages.length > 0 || isStreaming ? (
          <div className="select-ask-floating-box-messages">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isStreaming && (
              <ChatMessage
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: '',
                  timestamp: Date.now(),
                }}
                isStreaming
              />
            )}
          </div>
        ) : null}
      </div>

      {mode === 'question' && (
        <div className="select-ask-floating-box-input-area">
          <textarea
            className="select-ask-floating-box-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入您的问题..."
            rows={2}
          />
        </div>
      )}
    </div>
  );
}