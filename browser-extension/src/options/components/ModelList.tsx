import type { ModelConfig, ProviderType } from '../../types';
import { PROVIDER_NAMES } from '../../types/config';

interface ModelListProps {
  models: ModelConfig[];
  onEdit: (model: ModelConfig) => void;
  onDelete: (modelId: string) => void;
  onToggleEnabled: (modelId: string, enabled: boolean) => void;
  getProviderIcon: (provider: ProviderType, size?: 'sm' | 'md') => React.ReactNode;
  // Drag and drop
  onDragStart: (modelId: string) => void;
  onDragOver: (e: React.DragEvent, modelId: string) => void;
  onDrop: (targetModelId: string) => void;
  onDragEnd: () => void;
  dragOverModelId: string | null;
}

export default function ModelList({
  models,
  onEdit,
  onDelete,
  onToggleEnabled,
  getProviderIcon,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragOverModelId,
}: ModelListProps) {
  return (
    <div className="grid gap-3">
      {models.map((model, index) => (
        <div
          key={model.id}
          draggable
          onDragStart={() => onDragStart(model.id)}
          onDragOver={(e) => onDragOver(e, model.id)}
          onDrop={() => onDrop(model.id)}
          onDragEnd={onDragEnd}
          className={`group p-4 rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing ${
            model.enabled
              ? 'border-blue-200 bg-blue-50'
              : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300'
          } ${dragOverModelId === model.id ? 'border-indigo-400 ring-2 ring-indigo-100' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 拖拽手柄 */}
              <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors" title="拖拽排序">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="5" cy="3" r="1.5"/>
                  <circle cx="11" cy="3" r="1.5"/>
                  <circle cx="5" cy="8" r="1.5"/>
                  <circle cx="11" cy="8" r="1.5"/>
                  <circle cx="5" cy="13" r="1.5"/>
                  <circle cx="11" cy="13" r="1.5"/>
                </svg>
              </div>
              {/* 序号 */}
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs text-gray-400 font-medium">{index + 1}</span>
              {getProviderIcon(model.provider, 'md')}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{model.name}</span>
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">{model.modelId}</code>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  <span>{PROVIDER_NAMES[model.provider]}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* 启用/禁用开关 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{model.enabled ? '已启用' : '已禁用'}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={model.enabled}
                    onChange={() => onToggleEnabled(model.id, !model.enabled)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </div>
              <button
                onClick={() => onEdit(model)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                title="编辑"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(model.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="删除"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
