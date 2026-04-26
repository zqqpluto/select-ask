# MCP Tools: code-review-graph

**此项目有知识图谱。始终先用 code-review-graph MCP 工具探索代码库。**

## 何时使用

- **探索代码**: `semantic_search_nodes` 或 `query_graph`（替代 Grep）
- **影响分析**: `get_impact_radius`（替代手动追踪 import）
- **代码审查**: `detect_changes` + `get_review_context`
- **追踪关系**: `query_graph` — callers_of/callees_of/imports_of/tests_for

仅在图谱未覆盖时回退到 Grep/Glob/Read。

## 关键工具

| 工具 | 何时使用 |
|------|----------|
| `detect_changes` | 审查代码变更 |
| `get_review_context` | 需要源码片段 |
| `get_impact_radius` | 变更影响范围 |
| `get_affected_flows` | 执行路径影响 |
| `query_graph` | 追踪调用者/被调用者/import/测试 |
| `semantic_search_nodes` | 按名称/关键词搜索 |
| `get_architecture_overview` | 高层次架构 |
| `refactor_tool` | 重命名规划、死代码 |

## 工作流

1. 图谱随文件变更自动更新
2. `detect_changes` → 代码审查
3. `get_affected_flows` → 影响范围
4. `query_graph` pattern="tests_for" → 测试覆盖
