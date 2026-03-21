# 免费试用功能配置指南

## 概述

免费试用功能允许用户在无需注册的情况下体验 AI 功能，基于设备指纹实现每日30次的限流。

## 配置步骤

### 1. 创建 KV 命名空间

如果还没有创建 KV 命名空间：

```bash
# 创建生产环境 KV
wrangler kv:namespace create STATS

# 创建预览环境 KV（可选）
wrangler kv:namespace create STATS --preview
```

记录输出的 `id`，更新到 `wrangler.toml` 文件中。

### 2. 配置 DeepSeek API Key

使用 wrangler secret 命令安全地设置 API Key：

```bash
wrangler secret put DEEPSEEK_API_KEY
```

系统会提示输入 API Key 的值。输入你的 DeepSeek API Key。

**获取 DeepSeek API Key：**
1. 访问 https://platform.deepseek.com/
2. 注册并登录
3. 在 API Keys 页面创建新的 API Key

### 3. 配置管理员密码（可选）

```bash
wrangler secret put ADMIN_PASSWORD
```

### 4. 部署服务

```bash
npm run deploy
```

## 使用方式

### API 接口

**POST /free-trial**

请求体：
```json
{
  "fingerprint": "device-fingerprint-string",
  "message": "用户的问题",
  "context": "选中的文本上下文（可选）"
}
```

成功响应：
```json
{
  "success": true,
  "content": "AI 的回复内容",
  "remaining": 29
}
```

错误响应：
```json
{
  "success": false,
  "error": "错误信息",
  "remaining": 0
}
```

### 限流规则

- **每个设备指纹**：每天 30 次请求
- **跨天自动重置**：UTC+0 时区的午夜自动重置计数
- **数据自动过期**：KV 存储的限流数据 24 小时后自动过期

## 客户端集成示例

### 浏览器端生成设备指纹

推荐使用 `@fingerprintjs/fingerprintjs` 库：

```bash
npm install @fingerprintjs/fingerprintjs
```

```typescript
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// 获取设备指纹
const fp = await FingerprintJS.load();
const { visitorId } = await fp.get();

// 调用免费试用接口
const response = await fetch('https://your-worker.your-subdomain.workers.dev/free-trial', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fingerprint: visitorId,
    message: '请解释一下这段代码',
    context: 'const foo = bar;'
  })
});

const data = await response.json();
```

### 设备指纹格式要求

- 长度：16-64 个字符
- 允许字符：字母（a-z, A-Z）、数字（0-9）、横杠（-）、下划线（_）
- 正则表达式：`/^[a-zA-Z0-9_-]{16,64}$/`

## 监控与调试

### 查看限流数据

```bash
# 列出所有限流键
wrangler kv:key list --namespace-id=<your-kv-id>

# 查看特定设备的限流数据
wrangler kv:key get "ratelimit:<fingerprint>:2024-01-01" --namespace-id=<your-kv-id>
```

### 查看日志

```bash
# 实时查看 Worker 日志
npm run tail
```

## 安全考虑

1. **设备指纹验证**：严格验证指纹格式，防止注入攻击
2. **API Key 保护**：使用 Secret 存储，不暴露在代码中
3. **限流保护**：防止滥用，保护 API 配额
4. **CORS 配置**：当前允许所有来源，生产环境建议限制域名

## 成本估算

### Cloudflare Workers
- 免费额度：每天 100,000 次请求
- 足够支持约 3,333 个活跃设备（每个设备 30 次/天）

### DeepSeek API
- 定价：约 $0.14 / 1M tokens（输入）+ $0.28 / 1M tokens（输出）
- 估算：每次对话约 1,000 tokens，成本约 $0.00042
- 每日 100,000 次 ≈ $42

## 故障排查

### 常见错误

1. **"Service not configured"**
   - 原因：未设置 DEEPSEEK_API_KEY
   - 解决：运行 `wrangler secret put DEEPSEEK_API_KEY`

2. **"Daily limit exceeded"**
   - 原因：该设备当天已使用 30 次
   - 解决：等待第二天自动重置

3. **"Invalid fingerprint format"**
   - 原因：设备指纹格式不符合要求
   - 解决：检查客户端生成的指纹格式

4. **DeepSeek API error**
   - 原因：API Key 无效或网络问题
   - 解决：验证 API Key 是否正确，检查 DeepSeek 服务状态