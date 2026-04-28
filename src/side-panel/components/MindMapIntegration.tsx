/**
 * 脑图全屏集成组件
 * 通过 content script 在页面层级渲染真正的全屏覆盖层
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import MindMapToolbar from './MindMapToolbar';

interface Props {
  mindMapMarkdown: string | null;
  onClose: () => void;
}

export default function MindMapIntegration({ mindMapMarkdown, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [entering, setEntering] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mindMapMarkdown) return;
    // 发消息给 content script 在页面层级渲染全屏脑图
    chrome.runtime.sendMessage({
      type: 'MINDMAP_FULLSCREEN',
      markdown: mindMapMarkdown,
    });

    // 监听 content script 的全屏关闭事件
    const handler = (message: any) => {
      if (message.type === 'MINDMAP_FULLSCREEN_CLOSED') {
        onClose();
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, [mindMapMarkdown, onClose]);

  if (!mindMapMarkdown) return null;

  // 在 side-panel 内也显示一个简易的占位，让用户知道脑图已全屏打开
  const content = (
    <div className={`doubao-fullscreen-overlay${closing ? ' exit' : ''}${entering ? ' enter' : ''}`} onClick={() => onClose()}>
      <div className="doubao-fullscreen-header">
        <div className="doubao-header-left">
          <span className="doubao-title">脑图</span>
        </div>
      </div>
      <div className="doubao-fullscreen-content">
        <div className="doubao-mindmap-loading">
          <div className="doubao-mindmap-loading-spinner" />
          <span>已在页面全屏打开...</span>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="side-panel-mindmap-fullscreen-placeholder">
      {content}
    </div>
  );
}
