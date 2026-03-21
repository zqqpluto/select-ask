import React, { useRef } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import type { IconMenuProps } from './types';
import './style.css';

export function IconMenu({ position, onExplain, onTranslate, onQuestion, onQuestions, onClose }: IconMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useClickOutside(menuRef, onClose);

  // 初始位置
  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y + 35}px`, // 显示在图标下方
    zIndex: 2147483647,
  };

  const menuItems = [
    { key: 'explain', label: '解释', icon: '💡', action: onExplain },
    { key: 'translate', label: '翻译', icon: '🌐', action: onTranslate },
    { key: 'question', label: '提问', icon: '❓', action: onQuestion },
    { key: 'questions', label: '常见问题', icon: '📋', action: onQuestions },
  ] as const;

  return (
    <div
      ref={menuRef}
      className="select-ask-icon-menu-dropdown"
      style={menuStyle}
    >
      <ul className="select-ask-icon-menu-list">
        {menuItems.map((item) => (
          <li key={item.key} className="select-ask-icon-menu-item">
            <button
              className="select-ask-icon-menu-button"
              onClick={(e) => {
                e.stopPropagation();
                item.action();
              }}
            >
              <span className="select-ask-icon-menu-icon">{item.icon}</span>
              <span className="select-ask-icon-menu-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}