# 服务端架构设计规范

**版本**: 1.0
**日期**: 2026-03-20
**状态**: 设计阶段

## 项目概述

### 背景

Select Ask 是一个浏览器插件，允许用户选中文本后通过AI进行解释、翻译和提问。当前版本要求用户自行配置API Key，使用门槛较高。

### 目标

构建一个服务端系统，实现：
1. **统一模型管理**：服务端提供AI模型，用户无需配置API Key
2. **智能限流**：每个设备每天50次免费请求
3. **用户统计**：查看活跃用户数、请求数等数据
4. **后台管理**：模型配置管理、设备管理、封禁功能

### 核心需求

- 用户无需登录即可使用插件
- 服务端后台需要账密登录保护
- 采用成熟技术快速实现
- 控制API调用成本

## 技术栈

### 后端
- **框架**: Express.js
- **数据库**: MongoDB
- **进程管理**: PM2
- **反向代理**: Nginx

### 前端
- **框架**: Vue 3
- **UI库**: Element Plus
- **图表**: ECharts

### 部署
- **平台**: 国内云服务器（阿里云/腾讯云）
- **HTTPS**: Let's Encrypt
- **服务器配置**: 2核4G，Ubuntu 22.04

## 系统架构

### 整体架构

```
┌─────────────────┐
│  浏览器插件      │
│  - 选择模型      │
│  - 发送请求      │
└────────┬────────┘
         │ HTTPS
         ↓
┌─────────────────────────────────────────────────────────┐
│              Express.js 后端服务（国内云服务器）           │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ API路由      │  │ 后台管理     │  │ 定时任务      │  │
│  │ /api/llm     │  │ /admin       │  │ - 清理过期数据│  │
│  │ /api/stats   │  │ /api/admin   │  │ - 统计汇总    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  核心服务层                                        │  │
│  │  - LLM服务（调用AI API）                          │  │
│  │  - 限流服务（50次/天/设备）                       │  │
│  │  - 认证服务（后台登录）                            │  │
│  │  - 统计服务（数据收集）                            │  │
│  └──────────────────────────────────────────────────┘  │
└────────────┬───────────────────────────┬────────────────┘
             │                           │
        ┌────┴────┐                 ┌────┴────┐
        ↓         ↓                 ↓         ↓
   ┌─────────┐ ┌──────────┐    ┌──────────┐ ┌─────────┐
   │ MongoDB │ │ DeepSeek │    │ 通义千问  │ │ Claude  │
   │         │ │   API    │    │   API    │ │   API   │
   └─────────┘ └──────────┘    └──────────┘ └─────────┘
```

### 目录结构

```
select-ask-server/
├── src/
│   ├── api/              # API路由
│   │   ├── llm.ts        # LLM调用接口
│   │   ├── stats.ts      # 统计上报接口
│   │   └── admin.ts      # 后台管理API
│   ├── services/         # 业务逻辑层
│   │   ├── llm-provider.ts    # LLM服务封装
│   │   ├── rate-limiter.ts    # 限流服务
│   │   ├── auth.ts            # 认证服务
│   │   └── analytics.ts       # 统计服务
│   ├── models/           # MongoDB模型
│   │   ├── Device.ts     # 设备指纹
│   │   ├── Model.ts      # 模型配置
│   │   ├── Request.ts    # 请求记录
│   │   └── Admin.ts      # 管理员账户
│   ├── middleware/       # 中间件
│   │   ├── rateLimit.ts  # 限流中间件
│   │   └── auth.ts       # 认证中间件
│   ├── admin/            # 后台管理前端
│   │   ├── views/        # Vue组件
│   │   ├── router.ts     # 路由配置
│   │   └── App.vue       # 主组件
│   ├── utils/            # 工具函数
│   │   ├── crypto.ts     # 加密工具
│   │   └── logger.ts     # 日志工具
│   └── app.ts            # Express应用入口
├── public/               # 静态文件（后台UI构建后）
├── package.json
└── .env                  # 环境变量（API Keys等）
```

## 数据库设计

### 集合设计

#### 1. devices（设备集合）

存储设备信息和限流数据。

```javascript
{
  _id: ObjectId,
  fingerprint: String,        // 设备指纹（唯一索引）
  firstSeen: Date,            // 首次出现时间
  lastSeen: Date,             // 最后活跃时间
  isBlocked: Boolean,         // 是否被封禁
  blockedReason: String,      // 封禁原因
  dailyQuota: {               // 每日限流配额
    count: Number,            // 今日已使用次数
    date: String,             // YYYY-MM-DD（用于重置）
    lastRequest: Date         // 最后请求时间
  },
  metadata: {
    version: String,          // 插件版本
    browser: String           // 浏览器类型
  }
}
```

**索引**：
- `fingerprint`：唯一索引
- `isBlocked`：普通索引
- `dailyQuota.date`：普通索引

#### 2. models（模型配置集合）

存储可用AI模型配置。

```javascript
{
  _id: ObjectId,
  id: String,                 // 模型ID（唯一索引）
  name: String,               // 显示名称
  provider: String,           // 提供商（DeepSeek/Qwen/Claude/OpenAI）
  apiKey: String,             // API密钥（AES-256-GCM加密存储）
  baseUrl: String,            // API地址
  isEnabled: Boolean,         // 是否启用
  priority: Number,           // 显示优先级
  costPerToken: {             // 成本配置
    input: Number,            // 输入token成本
    output: Number            // 输出token成本
  },
  config: {                   // 模型特定配置
    maxTokens: Number,
    temperature: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

**索引**：
- `id`：唯一索引
- `isEnabled`：普通索引
- `priority`：普通索引

#### 3. requests（请求记录集合）

存储每次AI请求的详细记录。

```javascript
{
  _id: ObjectId,
  deviceId: ObjectId,         // 关联设备
  modelId: String,            // 使用的模型ID
  type: String,               // 请求类型（explain/translate/question/custom）
  input: {
    text: String,             // 选中文本
    context: String,          // 上下文
    question: String          // 用户问题（如有）
  },
  output: {
    content: String,          // AI回复
    tokensUsed: {             // token消耗
      input: Number,
      output: Number,
      total: Number
    }
  },
  cost: Number,               // 本次成本（美元）
  duration: Number,           // 响应时长（毫秒）
  success: Boolean,           // 是否成功
  errorMessage: String,       // 错误信息
  timestamp: Date             // 请求时间
}
```

**索引**：
- `deviceId`：普通索引
- `modelId`：普通索引
- `timestamp`：普通索引
- 复合索引：`{ timestamp: 1, deviceId: 1 }`

#### 4. daily_stats（每日统计汇总集合）

存储每日统计数据。

```javascript
{
  _id: ObjectId,
  date: String,               // YYYY-MM-DD（唯一索引）
  activeDevices: Number,      // 活跃设备数
  totalRequests: Number,      // 总请求数
  successRequests: Number,    // 成功请求数
  failedRequests: Number,     // 失败请求数
  modelUsage: {               // 各模型使用情况
    [modelId]: {
      count: Number,
      tokens: Number,
      cost: Number
    }
  },
  typeUsage: {                // 各功能使用情况
    explain: Number,
    translate: Number,
    question: Number,
    custom: Number
  },
  totalCost: Number,          // 总成本
  avgResponseTime: Number,    // 平均响应时间
  createdAt: Date,
  updatedAt: Date
}
```

**索引**：
- `date`：唯一索引

#### 5. admins（管理员集合）

存储后台管理员账户。

```javascript
{
  _id: ObjectId,
  username: String,           // 用户名（唯一索引）
  passwordHash: String,       // 密码哈希（bcrypt）
  role: String,               // 角色（admin/superadmin）
  lastLogin: Date,            // 最后登录时间
  createdAt: Date
}
```

**索引**：
- `username`：唯一索引

## API接口设计

### 插件端API（无需认证）

#### 1. 获取可用模型列表

```http
GET /api/models
```

**响应**：
```json
{
  "success": true,
  "models": [
    {
      "id": "deepseek-chat",
      "name": "DeepSeek Chat",
      "provider": "DeepSeek",
      "priority": 1
    }
  ]
}
```

#### 2. LLM调用接口

```http
POST /api/llm/chat
Content-Type: application/json

{
  "fingerprint": "device-123456",
  "modelId": "deepseek-chat",
  "type": "explain",
  "text": "选中的文本内容",
  "context": "文本上下文",
  "question": "用户问题（可选）"
}
```

**成功响应**：
```json
{
  "success": true,
  "content": "AI的回复内容",
  "remaining": 49,
  "tokensUsed": {
    "input": 150,
    "output": 200,
    "total": 350
  }
}
```

**限流响应**：
```json
{
  "success": false,
  "error": "Daily limit exceeded",
  "remaining": 0,
  "resetAt": "2026-03-21T00:00:00Z"
}
```

**封禁响应**：
```json
{
  "success": false,
  "error": "Device blocked",
  "reason": "Abuse detected"
}
```

#### 3. 统计上报接口

```http
POST /api/stats/event
Content-Type: application/json

{
  "fingerprint": "device-123456",
  "action": "startup",
  "version": "0.2.0",
  "feature": "explain",
  "model": "deepseek-chat"
}
```

**响应**：
```json
{
  "success": true
}
```

### 后台管理API（需要JWT认证）

#### 1. 管理员登录

```http
POST /api/admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

**响应**：
```json
{
  "success": true,
  "token": "jwt-token-here",
  "expiresAt": "2026-03-21T10:00:00Z"
}
```

#### 2. 获取统计概览

```http
GET /api/admin/stats/overview
Authorization: Bearer {token}

Query参数：
- startDate: 2026-03-01
- endDate: 2026-03-20
```

**响应**：
```json
{
  "success": true,
  "data": {
    "totalDevices": 1234,
    "activeDevices": 456,
    "totalRequests": 12345,
    "successRate": 98.5,
    "totalCost": 12.34,
    "avgRequestsPerDevice": 27.1,
    "dailyStats": [...]
  }
}
```

#### 3. 模型管理

**获取模型列表**：
```http
GET /api/admin/models
Authorization: Bearer {token}
```

**添加/更新模型**：
```http
POST /api/admin/models
Authorization: Bearer {token}
Content-Type: application/json

{
  "id": "deepseek-chat",
  "name": "DeepSeek Chat",
  "provider": "DeepSeek",
  "apiKey": "sk-xxxx",
  "baseUrl": "https://api.deepseek.com",
  "isEnabled": true,
  "priority": 1,
  "config": {
    "maxTokens": 2000,
    "temperature": 0.7
  }
}
```

**删除模型**：
```http
DELETE /api/admin/models/{modelId}
Authorization: Bearer {token}
```

#### 4. 设备管理

**获取设备列表**：
```http
GET /api/admin/devices
Authorization: Bearer {token}

Query参数：
- page: 1
- limit: 20
- status: all | active | blocked
```

**封禁设备**：
```http
POST /api/admin/devices/{fingerprint}/block
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Abuse detected",
  "duration": "permanent"
}
```

**解封设备**：
```http
POST /api/admin/devices/{fingerprint}/unblock
Authorization: Bearer {token}
```

**获取设备详情**：
```http
GET /api/admin/devices/{fingerprint}
Authorization: Bearer {token}
```

## 核心服务实现

### 1. 限流服务

**关键特性**：
- 原子性操作（使用MongoDB的findOneAndUpdate）
- 并发安全
- 自动日期重置
- 支持回退（AI调用失败时）

**实现要点**：
```typescript
async checkAndIncrementQuota(fingerprint: string): Promise<QuotaResult> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const device = await Device.findOne({ fingerprint });

  if (!device) {
    // 创建新设备
    const newDevice = await Device.create({
      fingerprint,
      dailyQuota: { count: 1, date: today, lastRequest: new Date() }
    });
    return { allowed: true, remaining: 49 };
  }

  // 检查是否被封禁
  if (device.isBlocked) {
    return { allowed: false, reason: 'blocked' };
  }

  // 检查是否需要重置(新的一天)
  if (device.dailyQuota.date !== today) {
    const updatedDevice = await Device.findOneAndUpdate(
      { fingerprint, 'dailyQuota.date': device.dailyQuota.date },
      {
        $set: {
          'dailyQuota.count': 1,
          'dailyQuota.date': today,
          'dailyQuota.lastRequest': new Date(),
          lastSeen: new Date()
        }
      },
      { new: true }
    );

    if (updatedDevice) {
      return { allowed: true, remaining: 49 };
    }
    // 如果更新失败,说明有并发请求,重新尝试
    return this.checkAndIncrementQuota(fingerprint);
  }

  // 同一天,检查配额
  if (device.dailyQuota.count >= 50) {
    return {
      allowed: false,
      reason: 'limit_exceeded',
      remaining: 0,
      resetAt: getTomorrowMidnight()
    };
  }

  // 增加计数（原子操作防止并发超限）
  const updatedDevice = await Device.findOneAndUpdate(
    {
      fingerprint,
      'dailyQuota.date': today,
      'dailyQuota.count': { $lt: 50 }
    },
    {
      $inc: { 'dailyQuota.count': 1 },
      $set: {
        'dailyQuota.lastRequest': new Date(),
        lastSeen: new Date()
      }
    },
    { new: true }
  );

  if (!updatedDevice) {
    // 并发竞争导致失败,重试
    return this.checkAndIncrementQuota(fingerprint);
  }

  return {
    allowed: true,
    remaining: 50 - updatedDevice.dailyQuota.count
  };
}
```

**关键点**：
1. **日期检查**：首先检查是否是新的一天，如果是则重置计数器
2. **原子操作**：使用findOneAndUpdate确保检查和更新是原子操作
3. **并发处理**：如果更新失败（并发竞争），自动重试
4. **配额限制**：严格执行50次/天限制

### 2. LLM服务

**支持的提供商**：
- DeepSeek（推荐，成本低）
- 通义千问（DashScope API）
- Claude（Anthropic API）
- OpenAI（标准API）

**关键特性**：
- 统一接口封装
- 动态max_tokens计算（节省成本）
- 超时控制（30秒）
- 错误重试

**成本优化策略**：
```typescript
// 根据输入长度动态计算max_tokens
private calculateMaxTokens(messages: any[]): number {
  const inputLength = JSON.stringify(messages).length;

  if (inputLength < 500) return 500;
  if (inputLength < 2000) return 1000;
  return 2000;
}
```

### 3. 统计服务

**关键功能**：
- 实时记录请求
- 每日统计汇总（定时任务）
- 成本计算
- 响应时间统计

**定时任务**：
- 每天01:00汇总前一天统计
- 每周清理30天前的详细请求记录

### 4. 认证服务

**关键特性**：
- JWT token认证
- bcrypt密码哈希
- 24小时token有效期
- 密码强度验证
- 首次部署安全初始化

**管理员账户初始化**：

```typescript
// scripts/create-admin.ts
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { Admin } from '../src/models/Admin';
import { logger } from '../src/utils/logger';

interface PasswordValidation {
  valid: boolean;
  message?: string;
}

// 密码强度验证
function validatePassword(password: string): PasswordValidation {
  if (password.length < 12) {
    return { valid: false, message: 'Password must be at least 12 characters' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }

  return { valid: true };
}

async function createAdmin() {
  try {
    // 1. 从环境变量读取（不是命令行参数）
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD environment variables must be set');
    }

    // 2. 仅在服务器环境执行
    if (process.env.NODE_ENV === 'development') {
      console.warn('Warning: Creating admin in development environment');
    }

    // 3. 连接数据库
    await mongoose.connect(process.env.MONGODB_URI!);

    // 4. 检查是否已存在
    const existing = await Admin.findOne({ username });
    if (existing) {
      console.log('Admin already exists, skipping creation');
      return;
    }

    // 5. 密码强度验证
    const validation = validatePassword(password);
    if (!validation.valid) {
      throw new Error(`Weak password: ${validation.message}`);
    }

    // 6. 创建管理员（bcrypt cost factor: 12）
    const passwordHash = await bcrypt.hash(password, 12);
    await Admin.create({
      username,
      passwordHash,
      role: 'superadmin',
      createdAt: new Date()
    });

    console.log('✅ Admin created successfully');
    console.log('⚠️  IMPORTANT: Remove ADMIN_PASSWORD from environment immediately!');

    // 7. 首次登录强制修改密码标记（可选）
    // 可以在Admin模型中添加 mustChangePassword: Boolean 字段

  } catch (error) {
    console.error('Failed to create admin:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// 执行
createAdmin();
```

**部署脚本**：

```bash
#!/bin/bash
# scripts/init-admin.sh

# 检查环境
if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo "Error: ADMIN_USERNAME and ADMIN_PASSWORD must be set"
  exit 1
fi

# 运行创建脚本
npx ts-node scripts/create-admin.ts

# 立即从环境变量中删除密码
unset ADMIN_PASSWORD

echo "Admin initialization complete"
```

**登录流程改进**：

```typescript
// src/services/auth.ts
class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_EXPIRES = '24h';
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_TIME = 15 * 60 * 1000; // 15分钟

  /**
   * 登录验证（含防暴力破解）
   */
  async login(username: string, password: string, ip: string): Promise<{
    success: boolean;
    token?: string;
    expiresAt?: Date;
    error?: string;
  }> {
    const admin = await Admin.findOne({ username });

    if (!admin) {
      // 返回通用错误，避免用户名枚举
      return { success: false, error: 'Invalid credentials' };
    }

    // 检查账户锁定
    if (admin.lockUntil && admin.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((admin.lockUntil.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Account locked. Try again in ${remainingMinutes} minutes`
      };
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isValid) {
      // 增加失败次数
      admin.loginAttempts = (admin.loginAttempts || 0) + 1;

      // 达到最大尝试次数，锁定账户
      if (admin.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        admin.lockUntil = new Date(Date.now() + this.LOCK_TIME);
        await admin.save();

        logger.warn('Admin account locked', {
          username,
          ip,
          attempts: admin.loginAttempts
        });

        return {
          success: false,
          error: 'Account locked due to too many failed attempts'
        };
      }

      await admin.save();
      return { success: false, error: 'Invalid credentials' };
    }

    // 登录成功，重置失败次数
    admin.loginAttempts = 0;
    admin.lockUntil = undefined;
    admin.lastLogin = new Date();
    await admin.save();

    // 生成JWT
    const token = jwt.sign(
      {
        id: admin._id,
        username: admin.username,
        role: admin.role
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES }
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    logger.info('Admin logged in', { username, ip });

    return { success: true, token, expiresAt };
  }
}
```

**Admin模型改进**：

```typescript
// src/models/Admin.ts
import { Schema, model } from 'mongoose';

const adminSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 30,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 60 // bcrypt hash长度
  },
  role: {
    type: String,
    enum: ['admin', 'superadmin'],
    default: 'admin'
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  lastLogin: {
    type: Date
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 虚拟字段：账户是否锁定
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

export const Admin = model('Admin', adminSchema);
```

## 后台管理界面

### 页面结构

```
/admin/
├── 登录页
├── 首页 - 统计概览
│   ├── 数据卡片（设备数、请求数、成本等）
│   ├── 每日请求趋势图
│   └── 模型使用分布图
├── 模型管理
│   ├── 模型列表
│   ├── 添加/编辑模型
│   └── 删除模型
├── 设备管理
│   ├── 设备列表
│   ├── 设备详情
│   ├── 封禁设备
│   └── 解封设备
└── 系统设置
    └── 管理员账户
```

### 技术实现

- **框架**: Vue 3 + Composition API
- **UI库**: Element Plus
- **图表**: ECharts
- **路由**: Vue Router
- **状态管理**: Pinia

## 部署方案

### 服务器配置

**推荐配置**：
- CPU: 2核
- 内存: 4GB
- 存储: 40GB SSD
- 带宽: 3Mbps
- 系统: Ubuntu 22.04

### 部署架构

```
Nginx (反向代理 + HTTPS)
    ↓
Express.js (PM2集群模式，2实例)
    ↓
MongoDB (自建或云服务)
```

### 部署步骤

1. **服务器初始化**
   - 安装Node.js 18+
   - 安装MongoDB 7.0
   - 安装PM2
   - 安装Nginx
   - 配置防火墙（开放80、443、22端口）

2. **应用部署**
   - 克隆代码仓库
   - 安装依赖
   - 配置环境变量
   - 构建前端
   - 使用PM2启动应用

3. **Nginx配置**
   - 配置反向代理
   - 配置HTTPS（Let's Encrypt）
   - 启用gzip压缩
   - 配置缓存策略

4. **MongoDB安全配置**
   - 创建管理员账户
   - 启用认证
   - 创建应用数据库用户
   - 配置备份策略

### 环境变量

```env
# 服务配置
PORT=3000
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://selectask:password@localhost:27017/select-ask

# JWT
JWT_SECRET=your-random-jwt-secret-key

# 加密密钥（32字节）
ENCRYPTION_KEY=your-32-byte-encryption-key

# AI API Keys
DEEPSEEK_API_KEY=sk-xxxx
QWEN_API_KEY=sk-xxxx
CLAUDE_API_KEY=sk-ant-xxxx

# 管理员账户（首次启动时创建）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

## 安全措施

### 1. API Key安全存储方案

**方案A：环境变量存储（推荐）**

API Key存储在服务器环境变量中，不存入数据库：

```typescript
// config/models.ts
const modelConfigs = {
  'deepseek-chat': {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: 'https://api.deepseek.com',
    maxTokens: 2000
  },
  'qwen-turbo': {
    apiKey: process.env.QWEN_API_KEY,
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    maxTokens: 2000
  },
  'claude-sonnet': {
    apiKey: process.env.CLAUDE_API_KEY,
    baseUrl: 'https://api.anthropic.com',
    maxTokens: 2000
  }
};

// 使用时直接从配置读取
export function getModelConfig(modelId: string) {
  const config = modelConfigs[modelId];
  if (!config || !config.apiKey) {
    throw new Error(`Model ${modelId} not configured`);
  }
  return config;
}
```

**优点**：
- ✅ 最安全：密钥不进入数据库
- ✅ 易于管理：通过环境变量集中管理
- ✅ 易于轮换：直接修改环境变量即可
- ✅ 无需解密：性能最优

**配置管理**：
- 生产环境：使用云服务器密钥管理服务（如阿里云KMS、腾讯云KMS）
- CI/CD：在部署流水线中注入环境变量
- 开发环境：使用.env文件（不提交到git）

---

**方案B：数据库加密存储（备选）**

如果必须存储在数据库，使用以下方案：

```typescript
import crypto from 'crypto';

// 每个模型使用不同的加密密钥（密钥派生）
function deriveKey(modelId: string): Buffer {
  const masterKey = process.env.MASTER_ENCRYPTION_KEY; // 32字节主密钥
  return crypto.createHmac('sha256', masterKey)
    .update(modelId)
    .digest();
}

export function encryptApiKey(apiKey: string, modelId: string): string {
  const key = deriveKey(modelId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decryptApiKey(encryptedKey: string, modelId: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedKey.split(':');

  const key = deriveKey(modelId);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**密钥轮换机制**：
```typescript
// 1. 生成新的主密钥
const newMasterKey = crypto.randomBytes(32);

// 2. 重新加密所有API Keys
async function rotateKeys(newMasterKey: Buffer) {
  const models = await Model.find({});

  for (const model of models) {
    // 用旧密钥解密
    const plainKey = decryptApiKey(model.apiKey, model.id);

    // 临时设置新主密钥
    process.env.MASTER_ENCRYPTION_KEY = newMasterKey.toString('hex');

    // 用新密钥加密
    model.apiKey = encryptApiKey(plainKey, model.id);
    await model.save();
  }
}
```

**推荐选择**：
- ✅ 优先使用**方案A**（环境变量）
- 仅在需要动态添加模型且无法重启服务时使用**方案B**

### 2. 请求验证

使用Joi进行请求参数验证，防止：
- SQL注入
- XSS攻击
- 参数篡改
- 非法输入

**验证规则定义**：

```typescript
// src/validators/schemas.ts
import Joi from 'joi';

// 设备指纹验证（32-64位十六进制字符串）
export const fingerprintSchema = Joi.string()
  .pattern(/^[a-f0-9]{32,64}$/)
  .required()
  .messages({
    'string.pattern.base': 'Invalid device fingerprint format',
    'any.required': 'Device fingerprint is required'
  });

// LLM聊天请求验证
export const chatRequestSchema = Joi.object({
  fingerprint: fingerprintSchema,

  modelId: Joi.string()
    .pattern(/^[a-z0-9-]{3,50}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid model ID format',
      'any.required': 'Model ID is required'
    }),

  type: Joi.string()
    .valid('explain', 'translate', 'question', 'custom')
    .required()
    .messages({
      'any.only': 'Invalid request type',
      'any.required': 'Request type is required'
    }),

  text: Joi.string()
    .min(1)
    .max(10000, 'utf8') // 最大10K字符
    .required()
    .messages({
      'string.min': 'Text cannot be empty',
      'string.max': 'Text exceeds maximum length (10000 characters)',
      'any.required': 'Text is required'
    }),

  context: Joi.string()
    .max(5000)
    .optional()
    .allow(''),

  question: Joi.string()
    .max(2000)
    .when('type', {
      is: 'question',
      then: Joi.required().messages({
        'any.required': 'Question is required when type is "question"'
      }),
      otherwise: Joi.forbidden().messages({
        'any.unknown': 'Question field is only allowed when type is "question"'
      })
    })
});

// 统计事件验证
export const statsEventSchema = Joi.object({
  fingerprint: fingerprintSchema,

  action: Joi.string()
    .valid('startup', 'feature_use', 'error')
    .required(),

  version: Joi.string()
    .pattern(/^\d+\.\d+\.\d+$/)
    .optional(),

  feature: Joi.string()
    .valid('explain', 'translate', 'question', 'custom')
    .when('action', {
      is: 'feature_use',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),

  model: Joi.string()
    .optional()
});

// 管理员登录验证
export const adminLoginSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.min': 'Username must be at least 3 characters',
      'string.max': 'Username cannot exceed 30 characters',
      'any.required': 'Username is required'
    }),

  password: Joi.string()
    .min(8)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'any.required': 'Password is required'
    })
});

// 模型配置验证
export const modelConfigSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-z0-9-]{3,50}$/)
    .required(),

  name: Joi.string()
    .min(1)
    .max(100)
    .required(),

  provider: Joi.string()
    .valid('DeepSeek', 'Qwen', 'Claude', 'OpenAI')
    .required(),

  apiKey: Joi.string()
    .min(10)
    .required()
    .messages({
      'string.min': 'API Key must be at least 10 characters',
      'any.required': 'API Key is required'
    }),

  baseUrl: Joi.string()
    .uri()
    .required(),

  isEnabled: Joi.boolean()
    .default(true),

  priority: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(5),

  config: Joi.object({
    maxTokens: Joi.number()
      .integer()
      .min(100)
      .max(4000)
      .default(2000),

    temperature: Joi.number()
      .min(0)
      .max(2)
      .default(0.7)
  }).optional()
});
```

**验证中间件实现**：

```typescript
// src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export function validateRequest(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // 返回所有错误
      stripUnknown: true // 删除未知字段
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: errors
      });
    }

    // 替换req.body为验证后的值（包含类型转换和默认值）
    req.body = value;
    next();
  };
}

// 在路由中使用
import { chatRequestSchema } from '../validators/schemas';

app.post('/api/llm/chat',
  validateRequest(chatRequestSchema),
  chatHandler
);
```

**XSS防护**：

```typescript
// 使用xss库清理用户输入
import xss from 'xss';

export function sanitizeInput(text: string): string {
  return xss(text, {
    whiteList: {}, // 不允许任何HTML标签
    stripIgnoreTag: true, // 删除不在白名单中的标签
    stripIgnoreTagBody: ['script'] // 删除script标签及其内容
  });
}

// 在验证后清理
app.post('/api/llm/chat',
  validateRequest(chatRequestSchema),
  (req, res, next) => {
    req.body.text = sanitizeInput(req.body.text);
    if (req.body.context) {
      req.body.context = sanitizeInput(req.body.context);
    }
    if (req.body.question) {
      req.body.question = sanitizeInput(req.body.question);
    }
    next();
  },
  chatHandler
);
```

### 3. 限流保护

**应用层限流**：
- 每个IP：100次/15分钟
- 管理后台：50次/15分钟

**业务层限流**：
- 每个设备：50次/天

### 4. 认证与授权

- JWT token认证
- Token有效期：24小时
- bcrypt密码哈希（cost factor: 10）
- 敏感操作需要二次验证

### 5. 数据安全

- HTTPS强制加密传输
- MongoDB启用认证
- 定期数据备份
- 日志脱敏（不记录API Key）

### 6. 监控与日志

**日志记录**：
- 所有API请求
- 错误日志
- 性能指标
- 成本消耗

**监控指标**：
- 服务健康状态
- MongoDB连接状态
- 响应时间
- 错误率

## 成本估算

### 服务器成本（月度）

| 项目 | 配置 | 成本 |
|------|------|------|
| 云服务器 | 2核4G | ¥30-50 |
| 域名 | .com | ¥50/年 |
| SSL证书 | Let's Encrypt | 免费 |
| **小计** | | **¥30-50/月** |

### API成本（月度，假设100活跃设备/天）

| 模型 | 单次成本 | 月请求数 | 月成本 |
|------|---------|---------|--------|
| DeepSeek | $0.0003 | 150,000 | ¥50-80 |
| 通义千问 | $0.0005 | 150,000 | ¥80-120 |
| Claude | $0.002 | 150,000 | ¥300-400 |
| OpenAI | $0.002 | 150,000 | ¥300-400 |

**推荐策略**：
- 优先使用DeepSeek或通义千问
- 月成本控制在¥80-150

### 总成本（月度）

- **最低配置**：¥80-150/月
- **推荐配置**：¥150-250/月

## 监控与维护

### 1. 健康检查

- MongoDB连接状态
- 磁盘空间使用率
- 内存使用率
- CPU使用率

### 2. 自动化任务

- **每日01:00**：汇总前一天统计
- **每周日02:00**：清理30天前的请求记录
- **每日03:00**：MongoDB备份

### 3. 备份策略

- MongoDB每日自动备份
- 保留最近30天的备份
- 备份文件压缩存储
- 异地备份（可选）

### 4. 故障恢复

**服务故障**：
- PM2自动重启
- 监控告警

**数据库故障**：
- MongoDB副本集（可选）
- 数据备份恢复

**回滚方案**：
```bash
git revert <commit-hash>
pm2 restart all
```

## 性能优化

### 1. 数据库优化

- 合理使用索引
- 查询优化（避免全表扫描）
- 分页查询（limit + skip）
- 聚合管道优化

### 2. API性能优化

- 响应压缩（gzip）
- 静态资源缓存
- 连接池管理
- 异步处理

### 3. 前端优化

- 代码分割
- 路由懒加载
- 图片压缩
- CDN加速

## 扩展性考虑

### 1. 水平扩展

- 使用PM2集群模式
- 负载均衡（Nginx）
- MongoDB分片（需要时）

### 2. 功能扩展

- 支持更多AI模型
- 用户分级（免费/付费）
- API密钥自定义配置
- 批量操作API

### 3. 国际化

- 多语言支持
- 多时区处理
- 多货币支持

## 风险与应对

### 风险1：API成本超支

**应对措施**：
- 严格的限流控制
- 动态max_tokens
- 成本监控告警
- 消费限额设置

### 风险2：并发超限

**应对措施**：
- 原子性操作
- MongoDB事务支持
- 分布式锁（需要时）

### 风险3：数据丢失

**应对措施**：
- 每日自动备份
- 副本集部署
- 异地容灾（可选）

### 风险4：安全攻击

**应对措施**：
- HTTPS加密
- 请求验证
- 限流保护
- 定期安全审计

## 后续优化方向

### 短期（1-2周）

- [ ] 完善错误处理
- [ ] 优化日志记录
- [ ] 添加更多监控指标

### 中期（1-2月）

- [ ] 支持更多AI模型
- [ ] 优化成本控制策略
- [ ] 实现用户分级

### 长期（3-6月）

- [ ] 付费功能
- [ ] 多租户支持
- [ ] 国际化部署

## 附录

### A. 环境变量配置清单

```env
# 服务配置
PORT=3000
NODE_ENV=production

# MongoDB
MONGODB_URI=mongodb://selectask:password@localhost:27017/select-ask

# JWT
JWT_SECRET=<random-32-byte-string>
JWT_EXPIRES=24h

# 加密
ENCRYPTION_KEY=<random-32-byte-string>

# AI API Keys
DEEPSEEK_API_KEY=sk-xxxx
QWEN_API_KEY=sk-xxxx
CLAUDE_API_KEY=sk-ant-xxxx

# 管理员
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<secure-password>

# 日志
LOG_LEVEL=info
```

### B. 依赖包清单

**生产依赖**：
- express
- mongoose
- bcrypt
- jsonwebtoken
- joi
- axios
- winston
- node-cron
- express-rate-limit
- cors
- helmet

**开发依赖**：
- typescript
- @types/node
- @types/express
- ts-node
- nodemon
- vite
- vue
- element-plus
- echarts

### C. 常见问题处理

**Q1: MongoDB连接失败**
- 检查MongoDB服务状态
- 验证连接字符串
- 检查防火墙设置

**Q2: API Key调用失败**
- 检查API Key是否正确
- 验证API地址配置
- 检查网络连接

**Q3: 限流失效**
- 检查数据库索引
- 验证findOneAndUpdate逻辑
- 检查并发处理

**Q4: 内存占用过高**
- 检查是否有内存泄漏
- 优化数据库查询
- 增加服务器内存

---

**文档版本**: 1.0
**最后更新**: 2026-03-20
**作者**: Claude Code