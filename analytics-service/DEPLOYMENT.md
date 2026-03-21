# 部署检查清单

## 部署前准备

### 1. 环境要求
- [x] Node.js >= 16.x
- [x] npm 或 yarn
- [x] Cloudflare 账号
- [x] Wrangler CLI 已安装并登录

### 2. 配置文件检查

#### wrangler.toml
- [ ] 更新 KV namespace ID
- [ ] 确认 `compatibility_date` 正确

#### secrets 配置
- [ ] 设置 `DEEPSEEK_API_KEY`（必需）
- [ ] 设置 `ADMIN_PASSWORD`（可选，用于查看统计）

## 部署步骤

### 1. 安装依赖
```bash
cd analytics-service
npm install
```

### 2. 创建 KV 命名空间（如果还没有）
```bash
# 创建生产环境 KV
wrangler kv:namespace create STATS

# 记录输出的 id，更新到 wrangler.toml 文件中
```

### 3. 配置 Secrets
```bash
# 配置 DeepSeek API Key（必需）
wrangler secret put DEEPSEEK_API_KEY
# 输入你的 DeepSeek API Key

# 配置管理员密码（可选）
wrangler secret put ADMIN_PASSWORD
# 输入管理员密码
```

### 4. 本地测试
```bash
# 启动本地开发服务器
npm run dev

# 在另一个终端运行测试
npx ts-node test-free-trial.ts
# 或使用 curl 测试
```

### 5. 部署到生产环境
```bash
npm run deploy
```

### 6. 验证部署
```bash
# 测试健康检查
curl https://your-worker.your-subdomain.workers.dev/health

# 测试免费试用接口
curl -X POST https://your-worker.your-subdomain.workers.dev/free-trial \
  -H "Content-Type: application/json" \
  -d '{
    "fingerprint": "test-fingerprint-12345678",
    "message": "Hello, AI!"
  }'

# 查看实时日志
npm run tail
```

## 部署后检查

### 1. 功能验证
- [ ] `/health` 接口返回 `OK`
- [ ] `/free-trial` 接口返回成功响应
- [ ] 限流功能正常（第31次请求被拒绝）
- [ ] 跨天重置正常（可选，需要等到第二天验证）

### 2. 日志监控
```bash
# 查看实时日志
npm run tail

# 或在 Cloudflare Dashboard 查看
```

### 3. KV 数据验证
```bash
# 列出限流数据
wrangler kv:key list --namespace-id=<your-kv-id>

# 查看特定设备的限流数据
wrangler kv:key get "ratelimit:<fingerprint>:$(date +%Y-%m-%d)" --namespace-id=<your-kv-id>
```

## 常见问题

### 问题1: KV namespace not found
**原因**: KV 命名空间 ID 配置错误
**解决**: 运行 `wrangler kv:namespace create STATS` 并更新 wrangler.toml

### 问题2: Service not configured
**原因**: 未设置 DEEPSEEK_API_KEY
**解决**: 运行 `wrangler secret put DEEPSEEK_API_KEY`

### 问题3: DeepSeek API error
**原因**: API Key 无效或余额不足
**解决**:
1. 验证 API Key 是否正确
2. 检查 DeepSeek 账户余额
3. 查看 DeepSeek API 文档

### 问题4: 本地开发时 KV 不可用
**原因**: 需要配置预览 KV
**解决**:
```bash
wrangler kv:namespace create STATS --preview
# 更新 wrangler.toml 中的 preview_id
```

## 性能优化建议

1. **缓存策略**: 对于重复查询，可以考虑添加缓存（KV 缓存）
2. **并发控制**: 当前未限制并发，如果成本过高可添加并发限制
3. **监控告警**: 使用 Cloudflare Analytics 监控请求量和错误率
4. **成本控制**: 设置 DeepSeek API 消费限额

## 安全建议

1. **API Key 保护**: 使用 wrangler secret 存储，不要硬编码
2. **指纹验证**: 严格验证指纹格式，防止注入
3. **限流保护**: 防止单个设备滥用
4. **CORS 配置**: 生产环境建议限制允许的域名
5. **日志脱敏**: 不要在日志中记录敏感信息

## 回滚计划

如果部署后出现问题，可以快速回滚：

```bash
# 查看历史版本
wrangler deployments list

# 回滚到上一版本
wrangler rollback

# 或指定版本
wrangler rollback --version <version-id>
```