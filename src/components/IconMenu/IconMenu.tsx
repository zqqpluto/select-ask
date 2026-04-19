import React, { useRef } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import type { IconMenuProps } from './types';
import './style.css';

function ExplainIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function TranslateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

const ICONS: Record<string, React.FC> = {
  explain: ExplainIcon,
  translate: TranslateIcon,
  search: SearchIcon,
  question: QuestionIcon,
};

export function IconMenu({ position, onExplain, onTranslate, onQuestion, onSearch, onClose }: IconMenuProps) {
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
    { key: 'explain', label: '解释', Icon: ICONS.explain, action: onExplain },
    { key: 'translate', label: '翻译', Icon: ICONS.translate, action: onTranslate },
    { key: 'search', label: '搜索', Icon: ICONS.search, action: onSearch },
    { key: 'question', label: '提问', Icon: ICONS.question, action: onQuestion },
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
              <span className="select-ask-icon-menu-icon">
                <item.Icon />
              </span>
              <span className="select-ask-icon-menu-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
