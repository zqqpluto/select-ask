# Select Ask - 仓库分离开源计划

**目标**: 将前端插件开源，后端服务保持私有

**创建日期**: 2026-03-21

---

## 📋 总体策略

**采用方案**: 拆分成两个独立仓库

**原因**:
- ✅ 后端历史包含敏感信息，不能公开
- ✅ 法律边界清晰，风险最小
- ✅ 独立管理，互不干扰

---

## 🎯 目标结构

### 公开仓库：select-ask
```
https://github.com/zqqpluto/select-ask (公开)

├── browser-extension/          # 前端插件代码
│   ├── src/
│   ├── public/
│   ├── manifest.json
│   ├── package.json
│   └── vite.config.ts
├── docs/                       # 文档
│   ├── comprehensive-launch-plan.md
│   ├── security-test-report.md
│   └── integrated-technical-review-report.md
├── .github/                    # GitHub配置
│   └── workflows/
│       └── ci.yml             # 前端CI
├── LICENSE                     # Apache 2.0
├── README.md                   # 项目说明
├── PRIVACY_POLICY.md          # 隐私政策
├── TERMS_OF_SERVICE.md        # 服务条款
├── DISCLAIMER.md              # 免责声明
├── CONTRIBUTING.md            # 贡献指南
├── CHANGELOG.md               # 更新日志
├── .gitignore
└── analytics-service/         # 可选：分析服务（如果开源）
    └── (保留或移除，取决于是否开源)
```

### 私有仓库：select-ask-server
```
https://github.com/zqqpluto/select-ask-server (私有)

├── src/                       # 后端源码
│   ├── api/
│   ├── middleware/
│   ├── models/
│   ├── services/
│   └── __tests__/
├── tests/
├── .env.example              # 环境变量示例
├── .env                      # 实际环境变量（不提交）
├── docker-compose.yml
├── Dockerfile
├── package.json
├── README.md                 # 后端README
└── .gitignore
```

---

## 🔧 迁移步骤

### Step 1: 准备工作（已完成 ✅）

- [x] 创建备份分支 `backup-before-split-20260321`
- [x] 推送备份到远程

### Step 2: 创建新的公开仓库

**操作在GitHub网页完成**:

1. 访问 https://github.com/new
2. 填写信息：
   - Repository name: `select-ask`
   - Description: `🤖 选中文本，AI秒回 - 开源浏览器插件`
   - **Public** (公开)
   - ❌ 不要勾选 "Add a README file"（我们要推送现有代码）
   - ❌ 不要勾选 "Add .gitignore"
   - ✅ 勾选 "Choose a license" → 选择 **Apache 2.0**

3. 创建后，记录仓库URL（例如：`https://github.com/zqqpluto/select-ask`）

### Step 3: 本地准备前端代码

在当前仓库执行：

```bash
# 创建一个临时目录存放前端代码
cd /tmp
mkdir select-ask-public
cd select-ask-public

# 初始化新的Git仓库
git init

# 从现有仓库复制前端相关文件
# 注意：使用 --no-index 避免Git跟踪问题
cp -r /Users/zhaoqiqiang/code/ai/claude/select-ask/browser-extension .
cp -r /Users/zhaoqiqiang/code/ai/claude/select-ask/docs .
cp /Users/zhaoqiqiang/code/ai/claude/select-ask/LICENSE .
cp /Users/zhaoqiqiang/code/ai/claude/select-ask/README.md .
cp /Users/zhaoqiqiang/code/ai/claude/select-ask/PRIVACY_POLICY.md .
cp /Users/zhaoqiqiang/code/ai/claude/select-ask/TERMS_OF_SERVICE.md .
cp /Users/zhaoqiqiang/code/ai/claude/select-ask/DISCLAIMER.md .
cp /Users/zhaoqiqiang/code/ai/claude/select-ask/CONTRIBUTING.md .
cp /Users/zhaoqiqiang/code/ai/claude/select-ask/CHANGELOG.md .
cp /Users/zhaoqiqiang/code/ai/claude/select-ask/.gitignore .

# 复制GitHub工作流（仅前端CI）
mkdir -p .github/workflows
cp /Users/zhaoqiqiang/code/ai/claude/select-ask/.github/workflows/ci.yml .github/workflows/

# 检查analytics-service是否要开源
# 如果开源，复制它
# cp -r /Users/zhaoqiqiang/code/ai/claude/select-ask/analytics-service .
```

### Step 4: 更新前端README

需要更新 `README.md`，移除后端相关内容：

```bash
# 创建一个新的前端专用README
# 我会帮你生成这个文件
```

### Step 5: 推送到公开仓库

```bash
cd /tmp/select-ask-public

# 添加所有文件
git add .

# 创建初始提交
git commit -m "feat: 初始化 Select Ask 开源项目

- 浏览器插件前端代码（React + TypeScript + Vite）
- 支持5大AI服务提供商
- 设备指纹验证、内容总结、智能问答
- Apache 2.0 许可证

详细功能见 README.md"

# 添加远程仓库（替换为你的实际URL）
git remote add origin https://github.com/zqqpluto/select-ask.git

# 推送到main分支
git branch -M main
git push -u origin main
```

### Step 6: 更新原有仓库为后端私有仓库

回到原有仓库：

```bash
cd /Users/zhaoqiqiang/code/ai/claude/select-ask

# 选项A：将现有仓库重命名为后端仓库
# 直接在GitHub设置中重命名仓库为 select-ask-server

# 选项B：创建新的私有仓库作为后端
# 1. 在GitHub创建新的私有仓库 select-ask-server
# 2. 更新远程URL
git remote set-url origin https://github.com/zqqpluto/select-ask-server.git
git push -u origin main

# 删除前端相关文件（保留后端）
# 注意：此时Git会保留历史，但私有仓库不会公开
rm -rf browser-extension docs analytics-service
rm -f PRIVACY_POLICY.md TERMS_OF_SERVICE.md DISCLAIMER.md CONTRIBUTING.md
rm -rf .github/workflows/ci.yml  # 删除前端CI

# 提交删除
git add -A
git commit -m "refactor: 前端代码已迁移至公开仓库

前端代码已移动到 https://github.com/zqqpluto/select-ask
本仓库现在仅包含后端服务代码"

git push
```

### Step 7: 更新文档中的链接

需要更新以下文件中的链接：

**前端仓库**:
- `README.md`: 更新后端仓库链接
- `CONTRIBUTING.md`: 更新仓库URL

**后端仓库**:
- `README.md`: 更新前端仓库链接
- 添加说明：前端插件见 https://github.com/zqqpluto/select-ask

---

## ⚠️ 注意事项

### 敏感信息处理

**前端代码中可能需要移除的敏感信息**:

1. 检查 `browser-extension/src` 中是否有硬编码的：
   - API endpoints（如果是私有后端）
   - API keys（应该在.env中）
   - 内部服务地址

2. 更新 `.env.example`（如果有）:
   - 只保留示例值
   - 不要包含真实的API密钥

3. 检查Git历史：
   ```bash
   # 在推送前，检查是否有敏感信息
   git log --all --full-history -- "*.env"
   git log --all --full-history -- "*config*"
   ```

### 依赖关系处理

**前后端之间的依赖**:

1. **API接口**:
   - 前端需要配置后端API地址
   - 在README中说明如何配置

2. **共享类型**（如果有）:
   - 考虑是否需要提取到独立的npm包
   - 或者在前端重新定义类型

3. **环境变量**:
   - 前端：`.env.example` 中说明需要的环境变量
   - 后端：保留完整的 `.env.example`

---

## 📝 迁移后检查清单

### 前端仓库（公开）

- [ ] LICENSE 文件存在且为 Apache 2.0
- [ ] README.md 清晰说明项目功能
- [ ] .gitignore 正确配置
- [ ] 没有敏感信息（API keys、私有配置）
- [ ] CI/CD 配置正确（仅前端测试）
- [ ] package.json 正确配置
- [ ] 仓库描述和topics设置正确

### 后端仓库（私有）

- [ ] .gitignore 正确配置
- [ ] .env 文件不包含在Git中
- [ ] .env.example 提供配置说明
- [ ] README.md 说明这是私有后端服务
- [ ] docker-compose.yml 配置正确
- [ ] CI/CD 配置正确（如果有）

### GitHub设置

- [ ] 前端仓库：Public，设置topics（chrome-extension, ai, chatgpt, open-source）
- [ ] 后端仓库：Private
- [ ] 更新个人资料中的仓库链接
- [ ] 更新项目网站中的链接（如果有）

---

## 🔄 回滚计划

如果迁移出现问题，可以恢复：

```bash
# 回到原仓库目录
cd /Users/zhaoqiqiang/code/ai/claude/select-ask

# 恢复到备份分支
git checkout backup-before-split-20260321

# 如果需要，重新推送
git push -f origin main
```

---

## 📚 参考资源

- [Git - 拆分仓库](https://git-scm.com/book/zh/v2/Git-%E5%B7%A5%E5%85%B7-%E9%87%8D%E5%86%99%E5%8E%86%E5%8F%B2)
- [GitHub - 仓库可见性设置](https://docs.github.com/zh/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)
- [Apache 2.0 许可证说明](https://choosealicense.com/licenses/apache-2.0/)

---

## 💡 建议

### 开源后的维护策略

1. **Issue管理**:
   - 前端issues在公开仓库管理
   - 后端issues在私有仓库管理
   - 跨仓库的issue可以相互引用

2. **版本发布**:
   - 前端：使用GitHub Releases发布到Chrome Web Store
   - 后端：使用私有tag管理版本

3. **文档维护**:
   - 用户文档在前端仓库
   - 开发文档在后端仓库
   - API文档在后端仓库，公开访问

4. **贡献流程**:
   - 公开仓库：接受社区PR
   - 私有仓库：仅团队内部开发

---

**执行人**: Claude Code
**预计时间**: 30-60分钟
**风险等级**: 低（已有备份）

**准备好开始执行了吗？**