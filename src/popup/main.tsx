import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 设置页面标题和描述
document.title = 'Select Ask - 选中即问，知识自来';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);