# Select Ask Analytics Service

简单的用户统计服务，用于追踪开源版本的使用情况，并提供免费试用功能。

## 功能特性

- **统计服务**: 追踪插件使用情况（启动、功能使用、错误）
- **免费试用**: 允许未注册用户体验 AI 功能
- **智能限流**: 基于设备指纹的每日限流（30次/天）
- **AI 转发**: 集成 DeepSeek AI，提供智能问答服务

## 架构

```
┌─────────────────┐      ┌─────────────────────┐
│  Chrome 插件    │─────▶│  Cloudflare Worker  │
│  (统计上报)     │      │  (接收事件)          │
│  (免费试用)     │      │  (限流 + AI转发)    │
└─────────────────┘      └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  Cloudflare KV      │
                         │  (数据存储)          │
                         └─────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │  DeepSeek AI        │
                         │  (AI服务)            │
                         └─────────────────────┘
```

## 部署步骤

### 1. 安装依赖

```bash
cd analytics-service
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 创建 KV 命名空间

```bash
# 创建生产环境 KV
npx wrangler kv:namespace create STATS

# 输出示例：
# { binding = "STATS", id = "xxxx..." }
```

### 4. 更新配置

将输出的 ID 复制到 `wrangler.toml` 中：

```toml
[[kv_namespaces]]
binding = "STATS"
id = "你的KV-ID"  # 替换这里
```

### 5. 配置 Secrets

```bash
# 设置 DeepSeek API Key（必需，用于免费试用功能）
npx wrangler secret put DEEPSEEK_API_KEY
# 输入你的 DeepSeek API Key

# 设置管理员密码（可选，用于查看统计）
npx wrangler secret put ADMIN_PASSWORD
# 输入你的密码
```

**获取 DeepSeek API Key**:
1. 访问 https://platform.deepseek.com/
2. 注册并登录
3. 在 API Keys 页面创建新的 API Key

### 6. 部署

```bash
npm run deploy
```

部署成功后会得到一个 URL，如：
```
https://select-ask-analytics.你的账户.workers.dev
```

## API 接口

### 免费试用 AI 接口（新增）

允许未注册用户体验 AI 功能，每日限制30次。

```bash
POST /free-trial
Content-Type: application/json

{
  "fingerprint": "device-fingerprint-string",  // 设备指纹（必需）
  "message": "用户的问题",                     // 消息内容（必需）
  "context": "选中的文本上下文"                // 可选
}
```

**成功响应**:
```json
{
  "success": true,
  "content": "AI 的回复内容",
  "remaining": 29
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "Daily limit exceeded. You have used 30/30 requests today.",
  "remaining": 0
}
```

**限流规则**:
- 每个设备指纹每天30次请求
- 跨天自动重置
- 设备指纹格式: 16-64位字母、数字、横杠、下划线

**详细文档**: 参见 [CONFIG.md](./CONFIG.md)

### 上报事件

```bash
POST /event
Content-Type: application/json

{
  "action": "startup",      // startup | feature_use | error
  "version": "1.0.0",       // 插件版本
  "feature": "explain",     // 功能名称（feature_use 时必填）
  "model": "gpt-4"          // 使用的模型（可选）
}
```

### 查看统计

```bash
GET /stats?password=你的密码
```

返回示例：
```json
{
  "overview": {
    "lastUpdate": "2024-03-18T10:00:00.000Z",
    "totalDays": 7,
    "dates": ["2024-03-12", "2024-03-13", ...]
  },
  "recent": [
    {
      "date": "2024-03-18",
      "startups": 150,
      "uniqueUsers": ["user1", "user2", ...],
      "features": {
        "explain": 50,
        "translate": 30,
        "ask": 80
      },
      "models": {
        "gpt-4": 60,
        "claude-3": 40
      },
      "errors": 2
    }
  ]
}
```

### 健康检查

```bash
GET /health
```

## 费用

### Cloudflare Workers
免费额度：
- 每天 10 万次请求
- 每次请求 10ms CPU 时间
- KV 读取 10 万次/天
- KV 写入 1 千次/天

对于小型项目完全够用。

### DeepSeek API
- 定价: 约 $0.14 / 1M tokens（输入）+ $0.28 / 1M tokens（输出）
- 估算: 每次对话约 1,000 tokens，成本约 $0.00042
- 每日 100,000 次 ≈ $42

**建议**: 设置消费限额，避免超支。

## 本地开发

```bash
npm run dev
```

本地开发服务器将在 http://localhost:8787 启动。

## 测试

运行测试脚本：

```bash
# 使用 Node.js
npx ts-node test-free-trial.ts

# 或使用 curl（参见 test-free-trial.ts 中的示例）
```

## 查看日志

```bash
npm run tail
```

## 文档

- [CONFIG.md](./CONFIG.md) - 免费试用功能配置指南
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署检查清单

## 安全建议

1. **API Key 保护**: 使用 `wrangler secret` 存储，不要硬编码
2. **限流保护**: 防止单个设备滥用
3. **指纹验证**: 严格验证设备指纹格式
4. **CORS 配置**: 生产环境建议限制允许的域名

## 故障排查

常见问题请参考 [DEPLOYMENT.md](./DEPLOYMENT.md) 的故障排查部分。

## License

MIT