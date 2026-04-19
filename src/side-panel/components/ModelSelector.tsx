import type { ModelConfig } from '../../types';

interface Props {
  currentModel: ModelConfig | null;
  availableModels: ModelConfig[];
  show: boolean;
  dropdownPosition: { top: number; left: number } | null;
  onSelect: (modelId: string) => void;
}

export default function ModelSelector({ currentModel, availableModels, show, dropdownPosition, onSelect }: Props) {
  if (!show || !dropdownPosition || availableModels.length === 0) return null;

  return (
    <div className="side-panel-model-dropdown" style={{ bottom: dropdownPosition.top, left: dropdownPosition.left }}>
      {availableModels.map(model => (
        <div
          key={model.id}
          className={`side-panel-model-option ${currentModel?.id === model.id ? 'active' : ''}`}
          onClick={() => onSelect(model.id)}
        >
          <span className="side-panel-model-name">{model.name}</span>
          {model.provider && (
            <span className="side-panel-model-provider">{model.provider}</span>
          )}
        </div>
      ))}
    </div>
  );
}
