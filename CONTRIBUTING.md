# 贡献指南

感谢您有兴趣为 Select Ask 项目做出贡献！ 🎉

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发指南](#开发指南)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [代码规范](#代码规范)
- [测试要求](#测试要求)

## 行为准则

本项目采用贡献者公约作为行为准则。参与此项目即表示您同意遵守其条款。请阅读 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) 了解详情。

## 如何贡献

### 报告 Bug

如果您发现了 bug，请先查看 [Issues](../../issues) 确保该问题尚未被报告。如果没有，请创建一个新的 Issue：

1. 使用清晰、描述性的标题
2. 详细描述问题
3. 提供重现步骤
4. 说明预期行为和实际行为
5. 提供环境信息（操作系统、浏览器版本、插件版本）
6. 如果可能，提供截图或日志

### 建议新功能

我们欢迎新功能建议！请创建一个 Issue：

1. 使用清晰、描述性的标题
2. 详细描述功能
3. 说明为什么这个功能有用
4. 如果可能，提供示例或原型

### 提交代码

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'feat: 添加某个很棒的功能'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建一个 Pull Request

## 开发指南

### 环境设置

```bash
# 克隆仓库
git clone https://github.com/your-username/select-ask.git
cd select-ask

# 前端设置

npm install

# 后端设置（可选）
cd ../select-ask-server
npm install
```

### 运行测试

```bash
# 前端测试

npm test

# 后端测试
cd select-ask-server
npm test
```

### 代码风格

- 使用 TypeScript 编写代码
- 遵循现有的代码风格
- 使用有意义的变量和函数名
- 添加必要的注释
- 保持函数简洁（不超过50行）

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

### 提交消息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动
- `ci`: CI/CD 配置变更

### 示例

```
feat(content): 添加网页内容总结功能

- 实现智能内容提取算法
- 支持4层提取策略
- 集成LLM总结生成

Closes #123
```

## Pull Request 流程

1. **确保测试通过**: 运行 `npm test` 确保所有测试通过
2. **更新文档**: 如果需要，更新 README.md 或其他文档
3. **遵循代码规范**: 确保代码符合项目的编码标准
4. **写好描述**: 在 PR 描述中说明您的更改
5. **关联 Issue**: 如果相关，在描述中引用 Issue 编号

### PR 标题格式

使用与提交消息相同的格式：

```
feat(scope): 简短描述
fix(scope): 简短描述
docs: 简短描述
```

### PR 描述模板

```markdown
## 更改类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 代码重构
- [ ] 文档更新
- [ ] 其他

## 描述
简要描述您的更改

## 相关 Issue
Closes #

## 测试
描述您如何测试这些更改

## 截图
如果适用，添加截图

## 检查清单
- [ ] 代码遵循项目风格
- [ ] 已添加必要的测试
- [ ] 所有测试通过
- [ ] 文档已更新
```

## 代码规范

### TypeScript

- 使用严格模式
- 为所有函数和变量添加类型注解
- 使用接口定义对象结构
- 避免使用 `any` 类型

### React

- 使用函数组件和 Hooks
- 组件名称使用 PascalCase
- Props 使用接口定义
- 保持组件简洁，遵循单一职责原则

### CSS/TailwindCSS

- 优先使用 TailwindCSS 类
- 自定义样式使用 CSS 模块
- 保持响应式设计

### 文件命名

- React 组件: `PascalCase.tsx`
- TypeScript 文件: `camelCase.ts`
- 样式文件: `kebab-case.css`
- 测试文件: `*.test.ts` 或 `*.spec.ts`

## 测试要求

### 单元测试

- 为新功能添加单元测试
- 测试覆盖率目标: 80%+
- 使用 Jest 框架

### 集成测试

- 为关键流程添加集成测试
- 确保端到端功能正常

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- <test-file>

# 生成覆盖率报告
npm run test:coverage
```

## 文档

### 代码注释

- 为复杂逻辑添加注释
- 使用 JSDoc 注释公共 API
- 避免冗余注释

### README 更新

如果您添加或更改功能，请相应更新：
- README.md
- API 文档（如适用）
- 使用示例

## 发布流程

（维护者专用）

1. 更新版本号
2. 更新 CHANGELOG.md
3. 创建 Git 标签
4. 构建 production 版本
5. 发布到 Chrome Web Store
6. 创建 GitHub Release

## 获取帮助

如果您有任何问题，可以：

- 在 [Discussions](../../discussions) 中提问
- 加入我们的社区聊天室
- 发送邮件至 maintainers@example.com

## 许可证

通过贡献代码，您同意您的代码将在 MIT 许可证下发布。

---

再次感谢您的贡献！🙏