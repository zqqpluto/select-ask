/**
 * 脑图组件懒加载包装
 * 使用 React.lazy + Suspense 实现按需加载
 */

import { lazy, Suspense } from 'react';
import type { MindMapProps } from './MindMap';

const MindMapLazy = lazy(() => import('./MindMap'));

function MindMapLoading() {
  return (
    <div className="select-ask-mindmap-loading">
      <div className="select-ask-mindmap-loading-spinner" />
      <span>加载中...</span>
    </div>
  );
}

export function MindMap(props: MindMapProps) {
  return (
    <Suspense fallback={<MindMapLoading />}>
      <MindMapLazy {...props} />
    </Suspense>
  );
}

export { default as MindMapToolbar } from './MindMapToolbar';
export { default as MindMapFullscreen } from './MindMapFullscreen';
export { useMindMapExport } from './useMindMapExport';
export { detectMarkdownStructure } from './mindmap-utils';
