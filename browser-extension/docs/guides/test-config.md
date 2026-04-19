# 测试配置规范

> 此文件包含本地测试配置信息，**不应提交到 GitHub**。
> 已在 `.gitignore` 中忽略此文件。

## 测试前必须配置模型

所有需要真实 API 调用的测试（`extension-real.spec.ts`、`extension-full.spec.ts` 等）在运行前必须先配置模型。

### 测试用模型配置

| 配置项 | 值 |
|--------|-----|
| 模型名称 | qwen3.6-plus |
| Provider | qwen |
| Base URL | https://coding.dashscope.aliyuncs.com/v1 |
| Model ID | qwen3.6-plus |
| API Key | sk-sp-4def71a569994340abbf0cace2e7585e |

### 配置步骤

1. 加载扩展（`npm run build` 后在 Chrome 中加载 `dist/` 目录）
2. 打开扩展选项页面
3. 添加上述模型配置
4. 启用该模型并选中作为问答模型
5. 然后再运行测试

### 注意事项

- 运行 `npm test` 前确保扩展已加载且模型已配置
- 如果测试失败显示"请先在设置中选择问答模型"，说明模型未正确配置
- 本地测试可以使用此 key，但不要将其提交到仓库
