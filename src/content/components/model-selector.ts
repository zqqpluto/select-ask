import { getSelectedChatModel, getAppConfig, setSelectedChatModel } from '../../utils/config-manager';

/**
 * 创建模型选择器
 */
export async function createModelSelector(): Promise<HTMLElement> {
  const wrapper = document.createElement('div');
  wrapper.className = 'select-ask-model-selector-wrapper';

  const selector = document.createElement('select');
  selector.className = 'select-ask-model-selector';

  const arrow = document.createElement('span');
  arrow.className = 'select-ask-model-selector-arrow';
  arrow.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;

  try {
    const config = await getAppConfig();
    const enabledModels = config.models.filter(m => m.enabled);
    const selectedModelIds = config.selectedChatModelIds || [];

    const selectedModels = selectedModelIds.length > 0
      ? enabledModels.filter(m => selectedModelIds.includes(m.id))
      : enabledModels;

    const currentModel = await getSelectedChatModel();

    if (selectedModels.length === 0) {
      selector.innerHTML = '<option value="">无模型</option>';
      selector.disabled = true;
      wrapper.appendChild(selector);
      wrapper.appendChild(arrow);
      return wrapper;
    }

    selector.innerHTML = selectedModels.map(model => {
      const isSelected = currentModel?.id === model.id;
      return `<option value="${model.id}" ${isSelected ? 'selected' : ''}>${model.name}</option>`;
    }).join('');

    selector.addEventListener('change', async (e) => {
      const target = e.target as HTMLSelectElement;
      const modelId = target.value;
      if (modelId) {
        const currentIds = [...selectedModelIds];
        const index = currentIds.indexOf(modelId);
        if (index > 0) {
          currentIds.splice(index, 1);
          currentIds.unshift(modelId);
          await setSelectedChatModel(modelId);
        }
      }
    });
  } catch (error) {
    console.error('Failed to create model selector:', error);
    selector.innerHTML = '<option value="">加载失败</option>';
    selector.disabled = true;
  }

  wrapper.appendChild(selector);
  wrapper.appendChild(arrow);
  return wrapper;
}
