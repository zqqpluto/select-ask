# Select Ask - 综合推广发布计划

**目标**: 推广插件，获取更多用户，前端开源但后端闭源
**版本**: v1.0.0
**制定日期**: 2026-03-21

---

## 📋 执行摘要

基于4个专业团队（市场推广、产品功能、技术架构、法务合规）的深入分析，制定本90天推广计划。

**核心策略**：
1. **前端开源（Apache 2.0）+ 后端闭源** - 获取社区流量，保护核心服务
2. **免费模型引流 + 自配置模型留存** - 降低使用门槛，提高付费转化
3. **Chrome Web Store首发 + Product Hunt引爆** - 双渠道获取初始用户
4. **混合云部署（阿里云+Cloudflare Workers）** - 低成本服务全球用户

---

## 一、开源策略

### ✅ 推荐方案：前端开源（Apache 2.0）+ 后端闭源

**开源范围**：
```
✅ 开源（GitHub）：
- 浏览器扩展完整代码
- 文档和示例
- 基础功能实现

❌ 闭源（商业机密）：
- 后端API服务代码
- 设备指纹验证算法细节
- 速率限制策略
- 免费API Key托管服务
```

**许可证选择：Apache 2.0**

理由：
- ✅ 允许商业使用，促进传播
- ✅ 包含专利授权条款，保护贡献者
- ✅ 要求保留版权声明
- ✅ 可以闭源集成（后端服务）

**保护措施**：
1. **商标保护**：
   ```markdown
   本项目中"Select Ask"名称和标识为商标，
   未经授权不得在衍生作品中使用。
   ```

2. **API使用限制**：
   ```markdown
   后端API接口仅供授权用户使用，
   禁止逆向工程、大规模爬取。
   详见服务条款。
   ```

3. **双许可证策略**（未来）：
   - 开源版：Apache 2.0（个人免费）
   - 商业版：付费许可证（企业使用）

---

## 二、推广渠道策略

### 优先级矩阵

```
阶段     渠道                    预期用户    成本      时间线
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 1  Chrome Web Store       500-1000   $5        Week 1-2
Phase 1  Product Hunt           500-2000   $0        Week 2
Phase 2  GitHub开源             持续增长    $0        Week 3-4
Phase 2  Reddit/HN              200-500    $0        Week 3-4
Phase 3  Twitter/X              持续增长    $0-500    持续
Phase 3  内容营销               持续增长    $0        持续
```

### 2.1 Chrome Web Store（立即执行）

**上架准备清单**：
- [ ] 6张高质量截图（1280x800px）
  - 截图1: 主界面展示
  - 截图2: 文本选择+AI回复
  - 截图3: 模型配置界面
  - 截图4: 历史记录
  - 截图5: 多模型支持
  - 截图6: 设置界面

- [ ] 30-60秒演示视频
  - 前5秒：产品Logo+核心价值
  - 5-15秒：选中文本演示
  - 15-25秒：AI对话演示
  - 25-35秒：多模型切换
  - 35-45秒：历史记录查看
  - 45-60秒：Call to Action

- [ ] 完善描述（中英文）
  ```markdown
  # Select Ask - 选中文本，AI秒回

  🎯 核心功能：
  - 🖱️ 选中文本即可获得AI解释、翻译、问答
  - 🤖 支持ChatGPT、Claude、DeepSeek等多个AI模型
  - 🔐 API Key本地加密存储，隐私安全
  - 🎁 免费模型配额（每日30次）
  - 📊 支持网页内容总结

  ⭐ 特色：
  - 零配置开始使用（免费模型）
  - 多轮对话，上下文感知
  - 侧边栏/浮动框双模式
  - 完整历史记录管理

  隐私政策：https://selectask.com/privacy
  服务条款：https://selectask.com/terms
  ```

- [ ] ASO关键词优化
  ```
  AI assistant, ChatGPT extension, Claude AI,
  text selection, translation, explanation,
  productivity tool, browser extension, DeepSeek
  ```

**定价策略**：
- 基础版：免费
- Pro版：$9.99/月（未来推出）

### 2.2 Product Hunt发布（Week 2）

**发布时间**：周二或周三（太平洋时间0:01 AM）

**准备工作**：
1. **产品页面**（3天前准备）
   - Tagline: `Select text, get instant AI answers`
   - 缩略图：800x600px，展示核心界面
   - Demo视频：30秒，突出核心功能
   - 5张GIF动图：展示主要使用场景

2. **Maker团队**（至少3人）
   - Maker 1: 主要发布者
   - Maker 2: 负责回复评论
   - Maker 3: 负责社交媒体推广

3. **预热活动**（3天前）
   - Twitter预热帖
   - 在PH社区发布Coming Soon
   - 联系支持者准备点赞

4. **发布当天**
   - 0:01 AM 准时发布
   - 前1小时：快速回复所有评论
   - 前6小时：保持活跃，点赞其他产品
   - 全天：监控排名，及时互动

**预期效果**：
- 前10名：500-1000个用户
- 前5名：1000-2000个用户
- 第1名：2000-5000个用户

### 2.3 GitHub开源推广（Week 3）

**优化GitHub项目**：

1. **README优化**
   ```markdown
   添加：
   - 徽章（Stars、License、Version）
   - 演示GIF动图
   - 快速开始指南
   - 特性对比表格
   - Roadmap
   - 贡献者名单
   ```

2. **Topics标签**
   ```
   chrome-extension, ai, chatgpt, claude,
   deepseek, text-selection, productivity,
   open-source, privacy-first
   ```

3. **提交到Awesome列表**
   - awesome-browser-extensions
   - awesome-ai-tools
   - awesome-productivity
   - awesome-chrome-extension

4. **GitHub Discussion**
   - 创建社区讨论区
   - 发布Roadmap征求反馈
   - 定期分享开发日志

**目标**：
- Week 1-2: 100+ Stars
- Month 1: 500+ Stars
- Month 3: 1000+ Stars

### 2.4 内容营销（持续）

**博客文章计划**：

| 时间 | 标题 | 平台 | 目标 |
|------|------|------|------|
| Week 1 | 为什么开发了Select Ask | 掘金/Medium | 产品介绍 |
| Week 2 | OpenAI vs Claude vs DeepSeek实测 | 知乎/Medium | SEO流量 |
| Week 3 | 5个提升效率的AI插件推荐 | 掘金/知乎 | 植入推广 |
| Week 4 | 如何保护你的API Key安全 | Medium | 建立信任 |
| Month 2 | Select Ask开源背后的故事 | 掘金/GitHub | 社区传播 |

**社交媒体策略**：

**Twitter/X 发布计划**：
```
Day 1: 🚀 产品发布帖 + Demo GIF
Day 2: 🔐 功能介绍 - 隐私安全
Day 3: 📚 用户场景 - 学术研究
Day 4: 💼 用户场景 - 跨境电商
Day 5: ⚖️ 对比竞品（Monica/Merlin）
Day 6: 🎉 开源公告 + GitHub链接
Day 7: 🗺️ Roadmap + 功能预告

Hashtag: #AItools #ChatGPT #OpenSource #Privacy
```

---

## 三、产品功能规划

### 3.1 双模型策略（Phase 1，Week 1-2）

**架构设计**：

```
┌─────────────────────────────────────────┐
│          模型选择器 UI                  │
├─────────────────────────────────────────┤
│ 🎁 免费模型 (推荐新手)                   │
│   GPT-3.5 Turbo                         │
│   今日剩余: 28/30 次                    │
│                                         │
│ ⭐ 我的模型 (已配置 3 个)                │
│   • GPT-4o [默认] ✓                    │
│   • Claude Sonnet                       │
│   • DeepSeek Reasoner                   │
└─────────────────────────────────────────┘
```

**用户体验流程**：

```
首次使用：
├─ 检测API Key配置状态
│  ├─ 未配置 → 高亮免费模型
│  │           └─ "0配置立即使用"
│  └─ 已配置 → 默认用户模型
│              └─ 显示"已配置X个模型"

免费额度用完：
├─ 无API Key用户
│  └─ 弹窗引导："免费额度已用完 🔥
│                配置您的API Key，解锁无限对话"
│
└─ 有API Key用户
   └─ 自动切换提示："已自动切换到您的模型 [GPT-4o]"
```

**技术实现要点**：

```typescript
// 前端配置
const MODEL_CONFIG = {
  freeModels: [{
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'backend',  // 后端托管
    dailyLimit: 30,
    icon: '🎁'
  }],
  userModels: [] // 用户配置的模型
};

// 后端API
router.get('/api/models/free', async (req, res) => {
  const device = req.device; // 已通过指纹验证
  const quota = await checkDailyQuota(device.fingerprint);

  res.json({
    models: FREE_MODELS,
    remaining: quota.remaining,
    resetAt: quota.resetAt
  });
});
```

### 3.2 限流与防滥用（已实现，需增强）

**当前机制**：
- ✅ 设备指纹验证（Canvas + WebGL + Audio）
- ✅ 原子性配额检查
- ✅ 设备封禁机制
- ✅ 每IP每小时10个设备限制

**增强建议**（Phase 2）：

```typescript
interface EnhancedDeviceQuota {
  // 基础配额
  baseQuota: 30;           // 基础每日30次

  // 奖励机制
  bonusQuota: {
    shareReward: 5;        // 每次分享 +5次
    emailVerified: 20;     // 邮箱验证 +20次
    feedbackSubmitted: 10; // 提交反馈 +10次
  };

  // 新用户特权
  newUsersFirst7Days: 50;  // 新用户前7天50次/天

  // 可疑检测
  suspiciousThreshold: 10; // 超过10个IP标记可疑
  penaltyDays: 3;          // 惩罚天数
}
```

**付费转化策略**：

| 触发时机 | 用户状态 | 推送策略 | 预期转化率 |
|---------|---------|---------|-----------|
| 额度剩余5次 | 活跃用户 | 温馨提示 + Pro方案介绍 | 2% |
| 额度用完 | 重度用户 | 强制弹窗 + 限时7折优惠 | 8% |
| 连续3天用完 | 高价值用户 | 邮件推送 + 专属优惠码 | 15% |

### 3.3 国际化支持（Phase 3，Week 5-6）

**语言优先级**：

**Phase 1（当前）**：
- ✅ 简体中文（已完成）
- ✅ English（已完成）

**Phase 2（Month 1）**：
- 繁体中文（港台市场）
- 日语（日本市场，AI接受度高）

**Phase 3（Month 2-3）**：
- 韩语
- 德语
- 法语
- 西班牙语

**实施方案**：

```bash
# 1. 提取硬编码文案（2天）
npm run i18n:extract

# 2. 使用DeepL API自动翻译（1天）
npm run i18n:translate -- --target zh-TW,ja,ko

# 3. 专业翻译核心文案（3天）
# 核心100条 × $5/条 = $500

# 4. 实现动态语言切换（2天）
# 监听浏览器语言变化，实时更新UI

# 5. 测试优化（2天）
```

**成本估算**：
- DeepL API翻译：$50（300+条普通文案）
- 专业翻译服务：$500（100条核心文案）
- 社区翻译：$0（长期维护）
- **总计：$550**

---

## 四、技术架构方案

### 4.1 推荐方案：混合云部署

**架构设计**：

```
               DNS智能分流
            (Cloudflare DNS)
                   │
         ┌─────────┴─────────┐
         │                   │
    国内用户              海外用户
         │                   │
    阿里云ECS          Cloudflare Workers
    (杭州/上海)         (全球310+节点)
         │                   │
         └─────────┬─────────┘
                   │
           MongoDB Atlas
           (全球集群)
         ┌─────────┴─────────┐
      Singapore           Shanghai
      (海外主节点)        (国内节点)
```

**技术栈**：

| 组件 | 国内 | 海外 | 说明 |
|------|------|------|------|
| 计算 | 阿里云ECS | Cloudflare Workers | 边缘计算 |
| 数据库 | MongoDB Atlas Global Cluster | | 全球同步 |
| 存储 | 阿里云OSS | Cloudflare KV | 配置存储 |
| CDN | 阿里云CDN | Cloudflare CDN | 静态资源 |
| DNS | 阿里云DNS | Cloudflare DNS | 智能分流 |

### 4.2 成本优化

**成本对比**（月度）：

| 用户规模 | 纯阿里云 | 混合云 | 节省 |
|---------|---------|--------|------|
| 初期 (1K DAU) | ¥300 | ¥100 | 67% |
| 成长期 (5K DAU) | ¥800 | ¥400 | 50% |
| 规模期 (10K DAU) | ¥1500 | ¥900 | 40% |

**详细成本估算**：

**初期（0-1000 DAU）**：
```
MongoDB Atlas M0: 免费
Cloudflare Workers: 免费（10万请求/天）
阿里云ECS: ¥100/月（按量付费）
域名: ¥100/年

总计: ¥100-200/月
```

**成长期（1000-10000 DAU）**：
```
MongoDB Atlas M10: $150/月（¥1050）
Cloudflare Workers: $5/月（¥35）
阿里云ECS: ¥200/月
监控告警: $20/月（¥140）

总计: ¥1425/月（$203）
```

**规模期（10000+ DAU）**：
```
MongoDB Atlas M20: $500/月（¥3500）
Cloudflare Workers: $10/月（¥70）
阿里云ECS: ¥500/月
CDN加速: ¥300/月

总计: ¥4370/月（$624）
```

### 4.3 关键技术实现

#### MongoDB Atlas配置

```yaml
集群配置:
  类型: Global Cluster
  版本: MongoDB 6.0

  区域分布:
    - Singapore (ap-southeast-1) - 海外主节点
    - Shanghai (cn-shanghai) - 国内只读节点

  规格:
    - M10 (2GB RAM, 10GB存储)
    - 自动扩展: 启用
    - 备份: 每日自动备份，保留7天

  安全:
    - VPC Peering: 阿里云VPC
    - IP白名单: 服务器IP + Workers IP
    - TLS加密: 启用
```

#### Cloudflare Workers核心代码

```typescript
// src/worker.ts
import { validateFingerprint } from './middleware/fingerprint';
import { checkRateLimit } from './services/rate-limiter';
import { LLMProxy } from './services/llm-proxy';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. CORS处理
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // 2. 健康检查
    if (url.pathname === '/health') {
      return new Response('OK');
    }

    // 3. 设备指纹验证
    const device = await validateFingerprint(request, env.KV);
    if (!device.valid) {
      return errorResponse('Invalid device', 403);
    }

    // 4. 速率限制
    const rateLimit = await checkRateLimit(device.id, env.KV);
    if (!rateLimit.allowed) {
      return errorResponse('Rate limit exceeded', 429, {
        remaining: 0,
        resetAt: rateLimit.resetAt
      });
    }

    // 5. LLM代理
    const result = await LLMProxy.chat(request, env);

    // 6. 返回响应
    return successResponse(result, {
      remaining: rateLimit.remaining
    });
  }
};

// CORS配置
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
```

#### KV存储结构

```
# 设备信息
device:{fingerprint} -> {
  "id": "abc123",
  "createdAt": "2026-03-21T00:00:00Z",
  "isBlocked": false,
  "metadata": {...}
}

# 每日配额
quota:{fingerprint}:{date} -> {
  "count": 25,
  "limit": 30,
  "resetAt": "2026-03-22T00:00:00Z"
}
TTL: 86400秒（24小时）

# IP限制
ip_limit:{ip}:{hour} -> {
  "deviceCount": 5
}
TTL: 3600秒（1小时）
```

---

## 五、法务合规准备

### 5.1 必备法律文档

**文档清单**：

```
项目根目录/
├── LICENSE (Apache 2.0)              ✅ 已完成
├── PRIVACY_POLICY.md                  📝 待创建
├── TERMS_OF_SERVICE.md                📝 待创建
├── DISCLAIMER.md                      📝 待创建
└── docs/
    ├── GDPR_COMPLIANCE.md             📝 待创建
    └── CCPA_COMPLIANCE.md             📝 待创建
```

### 5.2 Chrome Web Store合规

**隐私政策URL**：`https://selectask.com/privacy`

**隐私政策要点**：

```markdown
# Select Ask 隐私政策

## 数据收集声明

### 我们收集的数据：
1. **API密钥**（可选）
   - 存储方式：本地AES-256-GCM加密
   - 用途：调用您选择的LLM服务
   - 不上传到我们的服务器

2. **聊天历史**（可选）
   - 存储方式：本地浏览器存储
   - 用户可随时删除

3. **匿名统计数据**（可选，需同意）
   - 功能使用频率
   - 不收集：用户文本、个人信息

### 第三方服务
我们向以下第三方发送您选择的文本：
- OpenAI (美国)
- Anthropic (美国)
- DeepSeek (中国)
- 通义千问 (中国)

### 用户权利
- 查看所有本地数据
- 删除聊天历史
- 导出数据（JSON格式）
- 拒绝匿名统计

### 联系我们
[您的邮箱]
```

### 5.3 GDPR合规

**合规清单**：

```markdown
□ 隐私政策明确易懂
□ 数据收集最小化
□ 明确的同意机制
□ 提供数据删除功能
□ 提供数据导出功能（JSON）
□ 数据加密存储（AES-256-GCM）
□ 72小时数据泄露通知机制
□ 明确数据处理的法律依据
```

**数据主体权利实现**：

```typescript
// 前端实现
class DataRightsManager {
  // 访问权
  static async exportData() {
    const data = {
      models: await getModelConfigs(),
      history: await getHistory(),
      preferences: await getPreferences()
    };

    return new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
  }

  // 删除权
  static async deleteAllData() {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
  }

  // 同意管理
  static async manageConsent() {
    // 显示同意对话框
    // 记录同意时间戳
    // 允许用户随时撤销
  }
}
```

### 5.4 风险防控

**API密钥安全**：

```typescript
// ✅ 最佳实践
class APIKeySecurity {
  // 1. 强制加密存储
  static async store(key: string, provider: string) {
    const encrypted = await encryptAES256GCM(key);
    await chrome.storage.local.set({
      [`api_key_${provider}`]: encrypted
    });
  }

  // 2. 使用时才解密
  static async retrieve(provider: string) {
    const encrypted = await chrome.storage.local.get(
      `api_key_${provider}`
    );
    return await decryptAES256GCM(encrypted);
  }

  // 3. 永不记录日志
  static log(message: string) {
    console.log(message); // ✅ 只记录消息
    // console.log(key);  // ❌ 永不记录密钥
  }
}
```

**防滥用机制**：

```typescript
// 客户端限制
class UsageMonitor {
  private limits = {
    perMinute: 20,
    perHour: 500,
    perDay: 2000
  };

  async checkLimit(): Promise<boolean> {
    const usage = await this.getUsage();

    if (usage.lastMinute >= this.limits.perMinute) {
      throw new Error('请求过于频繁，请稍后再试');
    }

    return true;
  }

  // 友好的错误提示
  showError(type: string) {
    const messages = {
      rate_limit: '您已达到使用限制，请等待 [X] 分钟后再试',
      quota_exceeded: '您今天的配额已用完，明天再来吧'
    };

    return messages[type];
  }
}
```

---

## 六、90天执行计划

### Phase 1: 基础准备（Week 1-2）

**目标**: 完成所有发布准备工作

#### Week 1: 文档与合规

**Day 1-2: 法律文档**
- [ ] 创建隐私政策（中英文）
- [ ] 创建服务条款（中英文）
- [ ] 创建免责声明
- [ ] 准备GDPR/CCPA合规文档

**Day 3-4: Chrome Web Store素材**
- [ ] 制作6张高质量截图
- [ ] 录制30-60秒演示视频
- [ ] 撰写产品描述（中英文）
- [ ] 准备宣传图片

**Day 5-7: Product Hunt准备**
- [ ] 创建Product Hunt账号
- [ ] 准备产品页面素材
- [ ] 制作Demo GIF动图
- [ ] 联系Maker团队（3人）
- [ ] 预热帖发布

#### Week 2: 技术部署

**Day 1-3: MongoDB Atlas设置**
- [ ] 创建MongoDB Atlas账号
- [ ] 创建Global Cluster
- [ ] 配置区域（Singapore + Shanghai）
- [ ] 设置网络白名单
- [ ] 配置自动备份

**Day 4-5: Cloudflare Workers部署**
- [ ] 创建Workers项目
- [ ] 迁移设备指纹验证逻辑
- [ ] 实现KV速率限制
- [ ] 配置环境变量
- [ ] 测试部署

**Day 6-7: 监控告警**
- [ ] 注册Sentry账号
- [ ] 配置错误追踪
- [ ] 设置UptimeRobot监控
- [ ] 配置告警通知

### Phase 2: 正式发布（Week 3-4）

**目标**: 获取首批1000个用户

#### Week 3: 多渠道发布

**Day 1: Chrome Web Store上架**
- [ ] 提交审核
- [ ] 准备审核回复（如被拒绝）
- [ ] 监控审核状态

**Day 2: Product Hunt发布日**
- [ ] 0:01 AM 准时发布
- [ ] 前1小时：快速回复所有评论
- [ ] 前6小时：保持活跃互动
- [ ] 全天：监控排名

**Day 3-4: 社区推广**
- [ ] Reddit发布（r/ArtificialInteligence）
- [ ] Hacker News发布
- [ ] V2EX发布
- [ ] 即刻发布

**Day 5-7: GitHub开源**
- [ ] 更新README（添加徽章、GIF）
- [ ] 发布v1.0.0 Release
- [ ] 提交到Awesome列表
- [ ] 创建GitHub Discussion

#### Week 4: 用户激活

**Day 1-2: 用户引导**
- [ ] 发送Welcome Email
- [ ] 引导配置第一个模型
- [ ] 发放免费Pro试用（可选）

**Day 3-4: 反馈收集**
- [ ] 创建用户反馈表单
- [ ] 收集前100个用户反馈
- [ ] 分析用户痛点

**Day 5-7: 优化迭代**
- [ ] 修复紧急Bug
- [ ] 优化首次使用体验
- [ ] 更新文档FAQ

### Phase 3: 增长阶段（Week 5-12）

**目标**: 达到10000个用户，实现首批付费转化

#### Week 5-6: 国际化

**Day 1-3: 文案提取**
- [ ] 扫描所有硬编码文案
- [ ] 替换为i18n key
- [ ] 生成语言包模板

**Day 4-5: 翻译**
- [ ] DeepL API自动翻译
- [ ] 核心文案专业翻译
- [ ] 校验翻译质量

**Day 6-7: 部署**
- [ ] 实现动态语言切换
- [ ] 测试所有语言
- [ ] 发布更新

#### Week 7-8: 付费功能

**Day 1-3: 支付集成**
- [ ] 选择支付服务商（Stripe/Paddle）
- [ ] 实现订阅逻辑
- [ ] 创建定价页面

**Day 4-5: 付费页面**
- [ ] 设计Pro版介绍页
- [ ] 创建功能对比表
- [ ] 实现转化漏斗

**Day 6-7: 测试上线**
- [ ] 测试支付流程
- [ ] 测试订阅管理
- [ ] 灰度发布

#### Week 9-12: 规模化

**Week 9: 内容营销**
- [ ] 发布3篇博客文章
- [ ] 录制使用教程视频
- [ ] 创建Twitter账号
- [ ] 制定内容日历

**Week 10: 社区建设**
- [ ] 建立Discord/Telegram群
- [ ] 创建用户社区
- [ ] 邀请KOL体验
- [ ] 收集用户案例

**Week 11: SEO优化**
- [ ] 关键词优化
- [ ] 创建落地页
- [ ] 建立反向链接
- [ ] 优化网站速度

**Week 12: 数据分析**
- [ ] 分析用户行为数据
- [ ] 优化转化漏斗
- [ ] A/B测试定价
- [ ] 制定下一步计划

---

## 七、关键里程碑与KPI

### 用户增长目标

| 时间 | 用户数 | GitHub Stars | 收入 | 转化率 |
|------|--------|--------------|------|--------|
| Week 2 | 1,000 | 100 | $0 | - |
| Week 4 | 3,000 | 300 | $0 | - |
| Week 8 | 5,000 | 500 | $500 | 2% |
| Week 12 | 10,000 | 1,000 | $2,000 | 5% |
| Month 6 | 50,000 | 2,000 | $10,000 | 8% |

### 产品指标

| 指标 | Week 4目标 | Week 12目标 |
|------|-----------|------------|
| DAU | 200 | 1,000 |
| DAU/MAU | 15% | 25% |
| 7日留存率 | 25% | 40% |
| 30日留存率 | 10% | 20% |
| NPS评分 | 30 | 50 |

### 技术指标

| 指标 | 目标值 |
|------|--------|
| API响应时间（P95）| < 2秒 |
| 系统可用性 | 99.5% |
| 错误率 | < 1% |
| 海外延迟（P95）| < 500ms |

---

## 八、风险与应对

### 风险矩阵

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|----------|
| Chrome审核被拒 | 中 | 高 | 提前阅读政策，预留整改时间 |
| Product Hunt失败 | 中 | 中 | 准备备用推广渠道 |
| 免费用户成本过高 | 高 | 高 | 设置每日总预算上限 |
| 付费转化率低 | 中 | 高 | A/B测试优化，调整定价 |
| 服务器故障 | 低 | 高 | 多地域部署，自动故障转移 |
| 数据泄露 | 低 | 极高 | 强加密存储，定期安全审计 |
| 竞品抄袭 | 高 | 中 | 快速迭代，差异化功能 |
| 恶意刷量 | 中 | 中 | 强化设备指纹，行为分析 |

### 应急预案

**场景1: Chrome审核被拒**
```
应对步骤：
1. 仔细阅读拒绝原因
2. 24小时内整改
3. 准备详细说明文档
4. 重新提交审核
5. 同步准备Web版本（备用）
```

**场景2: 免费用户API成本超支**
```
应对步骤：
1. 立即设置每日总预算上限
2. 降低免费模型规格（GPT-4 → GPT-3.5）
3. 减少免费配额（30次 → 20次）
4. 推出Pro版加速转化
5. 优化API调用效率
```

**场景3: Product Hunt发布失败**
```
应对步骤：
1. 分析失败原因（时间、文案、竞品）
2. 等待2周后重新发布
3. 加强预热和Maker团队
4. 同步Reddit和HN推广
5. 利用GitHub开源作为长期流量来源
```

---

## 九、预算与资源

### 初期预算（前3个月）

| 项目 | 成本 | 说明 |
|------|------|------|
| Chrome开发者账号 | $5 | 一次性 |
| 域名 | $15/年 | selectask.com |
| MongoDB Atlas M0 | $0 | 免费层 |
| Cloudflare Workers | $0 | 免费层 |
| 阿里云ECS | ¥300 | 3个月 |
| DeepL翻译 | $50 | 一次性 |
| 专业翻译 | $500 | 一次性 |
| 监控服务 | $0 | 免费层 |
| **总计** | **$670 + ¥300** | 约$710 |

### 成长期预算（4-12个月）

| 项目 | 月成本 | 年成本 |
|------|--------|--------|
| MongoDB Atlas M10 | $150 | $1,800 |
| Cloudflare Workers | $5 | $60 |
| 阿里云ECS | ¥200 | ¥2,400 |
| 监控告警 | $20 | $240 |
| CDN加速 | $30 | $360 |
| **总计** | **$235** | **$2,820** |

### 人力需求

| 角色 | 投入 | 工作内容 |
|------|------|----------|
| 产品经理 | 100% | 规划、推广、运营 |
| 前端开发 | 50% | 功能迭代、Bug修复 |
| 后端开发 | 30% | API维护、监控 |
| UI设计 | 20% | 素材制作、优化 |
| 运维 | 10% | 部署、监控 |

---

## 十、成功标准

### 发布成功的定义

**Phase 1（Week 1-2）**：
- ✅ Chrome Web Store审核通过
- ✅ Product Hunt前10名
- ✅ GitHub 100+ Stars
- ✅ 500+ 初始用户

**Phase 2（Week 3-4）**：
- ✅ 1,000+ 活跃用户
- ✅ 7日留存率 > 25%
- ✅ NPS评分 > 30
- ✅ 首批付费用户（5+）

**Phase 3（Week 5-12）**：
- ✅ 5,000+ 活跃用户
- ✅ GitHub 500+ Stars
- ✅ 月收入 > $500
- ✅ 付费转化率 > 2%

### 长期目标（6个月）

- 🎯 50,000+ 注册用户
- 🎯 10,000+ 周活跃用户
- 🎯 GitHub 2,000+ Stars
- 🎯 月收入 > $10,000
- 🎯 付费转化率 > 8%
- 🎯 NPS评分 > 60

---

## 十一、下一步行动

### 立即行动（本周）

**Day 1-2: 法律文档**
- [ ] 复制隐私政策模板并调整
- [ ] 复制服务条款模板并调整
- [ ] 创建GitHub Pages托管文档

**Day 3-4: Chrome Web Store**
- [ ] 制作6张截图
- [ ] 录制演示视频
- [ ] 撰写产品描述
- [ ] 提交审核

**Day 5-7: MongoDB Atlas**
- [ ] 注册账号
- [ ] 创建Global Cluster
- [ ] 配置区域
- [ ] 测试连接

### 关键决策点

**决策1: 开源时间**
- 选项A: Chrome Web Store上架后立即开源（推荐）
- 选项B: 获得100+ Stars后再开源
- **建议**: 选择A，利用Chrome审核期间准备GitHub

**决策2: Product Hunt发布时间**
- 选项A: Week 2（Chrome审核期间）
- 选项B: Week 3（Chrome上架后）
- **建议**: 选择A，同步推进，最大化初期流量

**决策3: 付费功能上线时间**
- 选项A: Week 5-6（有用户基础后）
- 选项B: Week 1（从一开始）
- **建议**: 选择A，先专注用户增长，再考虑变现

---

## 十二、总结

### 核心策略

1. **开源引流，闭源增值**
   - 前端开源获取社区流量
   - 后端服务作为增值点

2. **免费试用，付费转化**
   - 每日30次免费配额降低门槛
   - 高质量模型引导付费

3. **多渠道推广，精准获客**
   - Chrome Web Store作为主阵地
   - Product Hunt引爆初期流量
   - GitHub建立长期品牌

4. **全球部署，低成本运营**
   - MongoDB Atlas全球集群
   - Cloudflare Workers边缘计算
   - 成本节省40-67%

### 成功关键

1. **产品质量**: 功能稳定、体验流畅
2. **用户增长**: 多渠道推广、病毒传播
3. **社区建设**: GitHub开源、用户反馈
4. **持续迭代**: 快速响应、优化体验
5. **成本控制**: Serverless架构、自动扩展

### 最终建议

**立即开始**：
1. 完成法律文档（本周）
2. Chrome Web Store提交（本周）
3. MongoDB Atlas配置（本周）

**90天目标**：
- 10,000+ 用户
- 1,000+ GitHub Stars
- 首批付费用户
- 建立品牌影响力

**长期愿景**：
- 成为最受欢迎的AI浏览器插件
- 建立活跃的用户社区
- 实现可持续的商业化

---

**制定人**: AI Agent团队（市场+产品+技术+法务）
**审核状态**: ✅ 可执行
**更新时间**: 2026-03-21