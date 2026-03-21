# Select Ask 服务端实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建完整的服务端系统，包括后端API、后台管理界面和数据库，为浏览器插件提供AI模型服务，实现统一模型管理、限流和统计功能。

**Architecture:** Express.js + MongoDB 后端提供RESTful API，Vue 3 + Element Plus 构建后台管理界面，使用PM2和Nginx部署到国内云服务器。系统分为三个独立阶段：后端核心、后台管理、部署配置，每个阶段都可独立测试和运行。

**Tech Stack:** Express.js, MongoDB, Mongoose, Vue 3, Element Plus, ECharts, PM2, Nginx, JWT, bcrypt

**规范文档**:
- `docs/superpowers/specs/2026-03-20-server-architecture-design.md`
- `docs/superpowers/specs/2026-03-20-security-supplement.md`

---

## 项目结构

```
select-ask-server/
├── src/
│   ├── api/                    # API路由
│   │   ├── llm.ts              # LLM调用接口
│   │   ├── stats.ts            # 统计上报接口
│   │   └── admin.ts            # 后台管理API
│   ├── services/               # 业务逻辑层
│   │   ├── llm-provider.ts     # LLM服务封装
│   │   ├── rate-limiter.ts     # 限流服务
│   │   ├── auth.ts             # 认证服务
│   │   └── analytics.ts        # 统计服务
│   ├── models/                 # MongoDB模型
│   │   ├── Device.ts           # 设备指纹
│   │   ├── Model.ts            # 模型配置
│   │   ├── Request.ts          # 请求记录
│   │   ├── Admin.ts            # 管理员账户
│   │   └── DailyStats.ts       # 每日统计
│   ├── middleware/             # 中间件
│   │   ├── validation.ts       # 验证中间件
│   │   ├── auth.ts             # 认证中间件
│   │   ├── rateLimit.ts        # 限流中间件
│   │   └── fingerprint-validator.ts  # 设备指纹验证
│   ├── validators/             # 验证规则
│   │   └── schemas.ts          # Joi验证模式
│   ├── utils/                  # 工具函数
│   │   ├── crypto.ts           # 加密工具
│   │   ├── logger.ts           # 日志工具
│   │   └── errors.ts           # 错误定义
│   ├── jobs/                   # 定时任务
│   │   └── cron.ts             # Cron任务
│   ├── config/                 # 配置
│   │   └── models.ts           # 模型配置
│   └── app.ts                  # Express应用入口
├── admin/                      # 后台管理前端
│   ├── src/
│   │   ├── views/              # Vue组件
│   │   ├── router.ts           # 路由
│   │   └── App.vue             # 主组件
│   └── public/
├── tests/                      # 测试
│   ├── unit/                   # 单元测试
│   └── integration/            # 集成测试
├── scripts/                    # 脚本
│   ├── create-admin.ts         # 创建管理员
│   └── init-admin.sh           # 初始化脚本
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

---

---

## 阶段 1.5：创建Express应用入口（关键前置任务）

### Task 1.5: 创建Express应用入口

**⚠️ 重要：此任务的完整实现代码和步骤见补充计划文档**

- **文档位置**: `docs/superpowers/plans/2026-03-20-plan-supplement.md`
- **任务编号**: 补充任务1
- **文件**:
  - Create: `select-ask-server/src/app.ts`

**必须完成**：在继续阶段2之前，请参考补充计划文档完成此任务，包括：
- Express应用主文件创建
- 安全中间件配置（helmet、CORS）
- 健康检查端点
- MongoDB连接管理
- 错误处理中间件

---

## 阶段 2：项目初始化和数据库层（1-2天）

### Task 1: 项目基础结构搭建

**Files:**
- Create: `select-ask-server/package.json`
- Create: `select-ask-server/tsconfig.json`
- Create: `select-ask-server/.env.example`
- Create: `select-ask-server/.gitignore`

- [ ] **Step 1: 创建项目目录**

```bash
mkdir -p select-ask-server
cd select-ask-server
```

- [ ] **Step 2: 初始化package.json**

```bash
npm init -y
```

- [ ] **Step 3: 安装生产依赖**

```bash
npm install express mongoose bcrypt jsonwebtoken joi axios winston node-cron express-rate-limit cors helmet xss dotenv
```

- [ ] **Step 4: 安装开发依赖**

```bash
npm install -D typescript @types/node @types/express @types/mongoose @types/bcrypt @types/jsonwebtoken @types/joi @types/node-cron @types/cors ts-node nodemon jest @types/jest @types/supertest supertest
```

- [ ] **Step 5: 配置TypeScript**

创建 `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: 创建环境变量模板**

创建 `.env.example`:
```env
# 服务配置
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/select-ask

# JWT
JWT_SECRET=your-random-jwt-secret-key-change-in-production
JWT_EXPIRES=24h

# AI API Keys（生产环境使用环境变量，不要提交到git）
DEEPSEEK_API_KEY=sk-your-deepseek-key
QWEN_API_KEY=sk-your-qwen-key
CLAUDE_API_KEY=sk-ant-your-claude-key

# 管理员账户（首次部署时设置）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeThisPassword123!

# 日志
LOG_LEVEL=info

# 告警（可选）
ADMIN_EMAIL=admin@example.com
ALERT_WEBHOOK=https://your-webhook-url

# 成本控制
DAILY_COST_LIMIT=5
```

- [ ] **Step 7: 创建.gitignore**

```
node_modules/
dist/
.env
*.log
.DS_Store
coverage/
.nyc_output/
```

- [ ] **Step 8: 添加npm脚本**

在 `package.json` 中添加:
```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts"
  }
}
```

- [ ] **Step 9: 提交初始化代码**

```bash
git add .
git commit -m "chore: 项目初始化

- 初始化package.json和TypeScript配置
- 添加生产依赖和开发依赖
- 创建环境变量模板
- 配置npm脚本"
```

---

### Task 1.5: 配置Jest测试框架

**Files:**
- Create: `select-ask-server/jest.config.js`
- Create: `select-ask-server/tests/setup.ts`

- [ ] **Step 1: 创建Jest配置文件**

创建 `select-ask-server/jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/app.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};
```

- [ ] **Step 2: 创建测试环境设置**

创建 `select-ask-server/tests/setup.ts`:
```typescript
import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

// 测试前连接数据库
beforeAll(async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/select-ask-test';
  await mongoose.connect(mongoUri);
});

// 测试后清理数据库
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// 所有测试后断开连接
afterAll(async () => {
  await mongoose.disconnect();
});
```

- [ ] **Step 3: 验证测试环境**

```bash
npm test
```

Expected: "No tests found" (正常，因为还没有测试)

- [ ] **Step 4: 提交**

```bash
git add jest.config.js tests/setup.ts
git commit -m "chore: 配置Jest测试框架

- Jest配置文件
- 测试环境设置（数据库连接和清理）
- 覆盖率目标80%"
```

---

### Task 2: MongoDB模型定义 - Device

**Files:**
- Create: `select-ask-server/src/models/Device.ts`
- Create: `select-ask-server/tests/unit/models/Device.test.ts`

- [ ] **Step 1: 创建模型目录**

```bash
mkdir -p src/models tests/unit/models
```

- [ ] **Step 2: 编写Device模型测试**

创建 `tests/unit/models/Device.test.ts`:
```typescript
import { Device } from '../../../src/models/Device';

describe('Device Model', () => {
  it('should create a device with valid data', async () => {
    const deviceData = {
      fingerprint: 'a'.repeat(64),
      firstSeen: new Date(),
      lastSeen: new Date(),
      isBlocked: false,
      dailyQuota: {
        count: 0,
        date: '2026-03-20',
        lastRequest: new Date()
      }
    };

    const device = new Device(deviceData);
    const savedDevice = await device.save();

    expect(savedDevice.fingerprint).toBe(deviceData.fingerprint);
    expect(savedDevice.isBlocked).toBe(false);
    expect(savedDevice.dailyQuota.count).toBe(0);
  });

  it('should require fingerprint field', async () => {
    const device = new Device({});

    await expect(device.save()).rejects.toThrow();
  });

  it('should enforce unique fingerprint', async () => {
    const fingerprint = 'b'.repeat(64);

    await Device.create({ fingerprint });
    await expect(Device.create({ fingerprint })).rejects.toThrow();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npm test tests/unit/models/Device.test.ts
```

Expected: FAIL (Device model not defined)

- [ ] **Step 4: 实现Device模型**

创建 `src/models/Device.ts`:
```typescript
import { Schema, model, Document } from 'mongoose';

export interface IDevice extends Document {
  fingerprint: string;
  firstSeen: Date;
  lastSeen: Date;
  isBlocked: boolean;
  blockedReason?: string;
  dailyQuota: {
    count: number;
    date: string;
    lastRequest: Date;
  };
  metadata?: {
    version?: string;
    browser?: string;
    ips?: string[];
    userAgent?: string;
    suspiciousActivity?: boolean;
  };
}

const deviceSchema = new Schema<IDevice>({
  fingerprint: {
    type: String,
    required: true,
    unique: true,
    minlength: 32,
    maxlength: 64,
    match: /^[a-f0-9]{32,64}$/
  },
  firstSeen: {
    type: Date,
    default: Date.now
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockedReason: {
    type: String
  },
  dailyQuota: {
    count: {
      type: Number,
      default: 0
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0]
    },
    lastRequest: {
      type: Date,
      default: Date.now
    }
  },
  metadata: {
    version: String,
    browser: String,
    ips: [String],
    userAgent: String,
    suspiciousActivity: {
      type: Boolean,
      default: false
    }
  }
});

// 索引
deviceSchema.index({ fingerprint: 1 }, { unique: true });
deviceSchema.index({ isBlocked: 1 });
deviceSchema.index({ 'dailyQuota.date': 1 });

export const Device = model<IDevice>('Device', deviceSchema);
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npm test tests/unit/models/Device.test.ts
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/models/Device.ts tests/unit/models/Device.test.ts
git commit -m "feat: 添加Device模型

- 定义设备指纹字段和验证规则
- 实现每日配额字段
- 添加索引优化查询性能
- 编写单元测试"
```

---

### Task 3: MongoDB模型定义 - Admin

**Files:**
- Create: `src/models/Admin.ts`
- Create: `tests/unit/models/Admin.test.ts`

- [ ] **Step 1: 编写Admin模型测试**

创建 `tests/unit/models/Admin.test.ts`:
```typescript
import { Admin } from '../../../src/models/Admin';

describe('Admin Model', () => {
  it('should create admin with hashed password', async () => {
    const adminData = {
      username: 'testadmin',
      passwordHash: 'hashedpassword123',
      role: 'admin'
    };

    const admin = new Admin(adminData);
    const savedAdmin = await admin.save();

    expect(savedAdmin.username).toBe(adminData.username);
    expect(savedAdmin.role).toBe('admin');
  });

  it('should require username and passwordHash', async () => {
    const admin = new Admin({});

    await expect(admin.save()).rejects.toThrow();
  });

  it('should enforce unique username', async () => {
    await Admin.create({
      username: 'duplicate',
      passwordHash: 'hash'
    });

    await expect(Admin.create({
      username: 'duplicate',
      passwordHash: 'hash2'
    })).rejects.toThrow();
  });

  it('should have default values', async () => {
    const admin = await Admin.create({
      username: 'newadmin',
      passwordHash: 'hash'
    });

    expect(admin.loginAttempts).toBe(0);
    expect(admin.mustChangePassword).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test tests/unit/models/Admin.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现Admin模型**

创建 `src/models/Admin.ts`:
```typescript
import { Schema, model, Document } from 'mongoose';

export type AdminRole = 'admin' | 'superadmin';

export interface IAdmin extends Document {
  username: string;
  passwordHash: string;
  role: AdminRole;
  loginAttempts: number;
  lockUntil?: Date;
  lastLogin?: Date;
  mustChangePassword: boolean;
  createdAt: Date;
}

const adminSchema = new Schema<IAdmin>({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 30,
    trim: true,
    match: /^[a-zA-Z0-9_]+$/
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
adminSchema.virtual('isLocked').get(function(this: IAdmin) {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// 索引
adminSchema.index({ username: 1 }, { unique: true });

export const Admin = model<IAdmin>('Admin', adminSchema);
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test tests/unit/models/Admin.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/models/Admin.ts tests/unit/models/Admin.test.ts
git commit -m "feat: 添加Admin模型

- 定义管理员账户字段
- 实现登录尝试计数和账户锁定
- 添加角色枚举
- 编写单元测试"
```

---

### Task 4-8: 继续实现其他模型（Model, Request, DailyStats）

按照相同的TDD模式继续实现：
- `src/models/Model.ts` - 模型配置
- `src/models/Request.ts` - 请求记录
- `src/models/DailyStats.ts` - 每日统计

每个模型都遵循：测试先行 → 实现 → 验证 → 提交。

---

---

## 阶段 2.5：关键中间件实现（安全必需）

### Task 8.5: 设备指纹验证中间件

**⚠️ 重要：此任务的完整实现代码和步骤见补充计划文档**

- **文档位置**: `docs/superpowers/plans/2026-03-20-plan-supplement.md`
- **任务编号**: 补充任务2
- **文件**:
  - Create: `select-ask-server/src/middleware/fingerprint-validator.ts`
  - Create: `select-ask-server/tests/unit/middleware/fingerprint-validator.test.ts`

**必须完成**：在实现API路由之前，请参考补充计划文档完成此任务，包括：
- 指纹格式验证
- IP异常检测
- 设备信息追踪
- 封禁状态检查
- 完整测试覆盖

---

## 阶段 3：核心服务层实现（2-3天）

### Task 9: 实现限流服务

**Files:**
- Create: `src/services/rate-limiter.ts`
- Create: `tests/unit/services/rate-limiter.test.ts`

- [ ] **Step 1: 编写限流服务测试**

创建 `tests/unit/services/rate-limiter.test.ts`:
```typescript
import { RateLimiterService } from '../../src/services/rate-limiter';
import { Device } from '../../src/models/Device';

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  beforeEach(() => {
    service = new RateLimiterService();
  });

  afterEach(async () => {
    await Device.deleteMany({});
  });

  it('should allow request within limit', async () => {
    const fingerprint = 'a'.repeat(64);
    const result = await service.checkAndIncrementQuota(fingerprint);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(49);
  });

  it('should block request exceeding limit', async () => {
    const fingerprint = 'b'.repeat(64);
    const today = new Date().toISOString().split('T')[0];

    // 创建已达上限的设备
    await Device.create({
      fingerprint,
      dailyQuota: { count: 50, date: today, lastRequest: new Date() }
    });

    const result = await service.checkAndIncrementQuota(fingerprint);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset quota on new day', async () => {
    const fingerprint = 'c'.repeat(64);
    const yesterday = '2026-03-19';

    await Device.create({
      fingerprint,
      dailyQuota: { count: 50, date: yesterday, lastRequest: new Date() }
    });

    const result = await service.checkAndIncrementQuota(fingerprint);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(49);
  });

  it('should block blocked devices', async () => {
    const fingerprint = 'd'.repeat(64);

    await Device.create({
      fingerprint,
      isBlocked: true,
      blockedReason: 'Test block'
    });

    await expect(
      service.checkAndIncrementQuota(fingerprint)
    ).rejects.toThrow('Device blocked');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test tests/unit/services/rate-limiter.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现限流服务**

创建 `src/services/rate-limiter.ts`:
```typescript
import { Device } from '../models/Device';

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  reason?: string;
  resetAt?: Date;
}

export class RateLimiterService {
  private readonly DAILY_LIMIT = 50;

  async checkAndIncrementQuota(fingerprint: string): Promise<QuotaResult> {
    const today = new Date().toISOString().split('T')[0];

    const device = await Device.findOne({ fingerprint });

    // 新设备
    if (!device) {
      await Device.create({
        fingerprint,
        dailyQuota: { count: 1, date: today, lastRequest: new Date() }
      });
      return { allowed: true, remaining: 49 };
    }

    // 检查封禁
    if (device.isBlocked) {
      throw new Error('Device blocked');
    }

    // 检查日期，必要时重置
    if (device.dailyQuota.date !== today) {
      const updated = await Device.findOneAndUpdate(
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

      if (updated) {
        return { allowed: true, remaining: 49 };
      }
      // 并发冲突，重试
      return this.checkAndIncrementQuota(fingerprint);
    }

    // 同一天，检查配额
    if (device.dailyQuota.count >= this.DAILY_LIMIT) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      return {
        allowed: false,
        remaining: 0,
        reason: 'limit_exceeded',
        resetAt: tomorrow
      };
    }

    // 增加计数
    const updated = await Device.findOneAndUpdate(
      {
        fingerprint,
        'dailyQuota.date': today,
        'dailyQuota.count': { $lt: this.DAILY_LIMIT }
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

    if (!updated) {
      // 并发冲突，重试
      return this.checkAndIncrementQuota(fingerprint);
    }

    return {
      allowed: true,
      remaining: this.DAILY_LIMIT - updated.dailyQuota.count
    };
  }

  async rollbackQuota(fingerprint: string): Promise<void> {
    await Device.findOneAndUpdate(
      { fingerprint },
      { $inc: { 'dailyQuota.count': -1 } }
    );
  }

  async getDeviceStatus(fingerprint: string) {
    const device = await Device.findOne({ fingerprint });

    if (!device) {
      return {
        isBlocked: false,
        quotaUsed: 0,
        quotaRemaining: this.DAILY_LIMIT
      };
    }

    const today = new Date().toISOString().split('T')[0];
    const quotaUsed = device.dailyQuota.date === today
      ? device.dailyQuota.count
      : 0;

    return {
      isBlocked: device.isBlocked,
      quotaUsed,
      quotaRemaining: this.DAILY_LIMIT - quotaUsed
    };
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test tests/unit/services/rate-limiter.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/rate-limiter.ts tests/unit/services/rate-limiter.test.ts
git commit -m "feat: 实现限流服务

- 实现每日50次请求限制
- 原子操作防止并发超限
- 自动日期重置
- 配额回退功能
- 编写完整测试"
```

---

### Task 10-15: 继续实现其他核心服务

按照TDD模式实现：
- `src/services/auth.ts` - 认证服务（JWT、登录、防暴力破解）
- `src/services/llm-provider.ts` - LLM服务封装
- `src/services/analytics.ts` - 统计服务
- `src/validators/schemas.ts` - Joi验证规则
- `src/utils/errors.ts` - 错误定义
- `src/utils/logger.ts` - 日志系统

---

## 阶段 3：API路由实现（2-3天）

### Task 16: 实现LLM API路由

**Files:**
- Create: `src/api/llm.ts`
- Create: `tests/integration/api/llm.test.ts`

- [ ] **Step 1: 编写集成测试**

创建 `tests/integration/api/llm.test.ts`:
```typescript
import request from 'supertest';
import app from '../../src/app';
import { Device } from '../../src/models/Device';

describe('LLM API', () => {
  beforeEach(async () => {
    await Device.deleteMany({});
  });

  it('should reject invalid fingerprint', async () => {
    const response = await request(app)
      .post('/api/llm/chat')
      .send({
        fingerprint: 'invalid',
        modelId: 'deepseek-chat',
        type: 'explain',
        text: 'Hello'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should enforce rate limit', async () => {
    const fingerprint = 'a'.repeat(64);
    const today = new Date().toISOString().split('T')[0];

    await Device.create({
      fingerprint,
      dailyQuota: { count: 50, date: today }
    });

    const response = await request(app)
      .post('/api/llm/chat')
      .send({
        fingerprint,
        modelId: 'deepseek-chat',
        type: 'explain',
        text: 'Hello'
      });

    expect(response.status).toBe(429);
    expect(response.body.error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should return available models', async () => {
    const response = await request(app)
      .get('/api/models');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.models)).toBe(true);
  });
});
```

- [ ] **Step 2: 实现LLM API路由**

创建 `src/api/llm.ts`:
```typescript
import { Router } from 'express';
import { RateLimiterService } from '../services/rate-limiter';
import { LLMProviderService } from '../services/llm-provider';
import { validateRequest } from '../middleware/validation';
import { chatRequestSchema } from '../validators/schemas';
import { AppError, ErrorCodes } from '../utils/errors';

const router = Router();
const rateLimiter = new RateLimiterService();
const llmProvider = new LLMProviderService();

// 获取可用模型列表
router.get('/models', async (req, res, next) => {
  try {
    const models = await llmProvider.getAvailableModels();
    res.json({ success: true, models });
  } catch (error) {
    next(error);
  }
});

// LLM聊天接口
router.post('/chat',
  validateRequest(chatRequestSchema),
  async (req, res, next) => {
    try {
      const { fingerprint, modelId, type, text, context, question } = req.body;

      // 检查限流
      const quotaResult = await rateLimiter.checkAndIncrementQuota(fingerprint);

      if (!quotaResult.allowed) {
        throw new AppError(
          ErrorCodes.RATE_LIMIT_EXCEEDED,
          'Daily limit exceeded',
          429,
          { remaining: 0, resetAt: quotaResult.resetAt }
        );
      }

      // 调用LLM
      try {
        const response = await llmProvider.chat({
          modelId,
          type,
          text,
          context,
          question
        });

        res.json({
          success: true,
          content: response.content,
          remaining: quotaResult.remaining,
          tokensUsed: response.tokensUsed
        });
      } catch (error) {
        // 回退配额
        await rateLimiter.rollbackQuota(fingerprint);
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

- [ ] **Step 3: 在app.ts中注册路由**

```typescript
import llmRouter from './api/llm';
app.use('/api', llmRouter);
```

- [ ] **Step 4: 运行测试**

```bash
npm test tests/integration/api/llm.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add src/api/llm.ts tests/integration/api/llm.test.ts
git commit -m "feat: 实现LLM API路由

- GET /api/models - 获取可用模型
- POST /api/llm/chat - LLM调用接口
- 集成限流和验证
- 编写集成测试"
```

---

### Task 17-20: 继续实现其他API路由

- `src/api/stats.ts` - 统计上报API
- `src/api/admin.ts` - 后台管理API
- `src/middleware/fingerprint-validator.ts` - 设备指纹验证
- `src/middleware/auth.ts` - JWT认证中间件

---

---

## 阶段 3.5：监控告警系统（运维必需）

### Task 20.5: 监控告警服务

**⚠️ 重要：此任务的完整实现代码和步骤见补充计划文档**

- **文档位置**: `docs/superpowers/plans/2026-03-20-plan-supplement.md`
- **任务编号**: 补充任务3
- **文件**:
  - Create: `select-ask-server/src/services/monitoring.ts`
  - Create: `select-ask-server/tests/unit/services/monitoring.test.ts`

**必须完成**：在进入前端开发前，请参考补充计划文档完成此任务，包括：
- 健康检查（MongoDB连接）
- 成本告警（超限额发送通知）
- 错误率监控
- 邮件和Webhook通知
- 单元测试

---

## 阶段 4：后台管理界面（2-3天）

### Task 21: 初始化Vue项目

**Files:**
- Create: `admin/` 目录结构
- Create: `admin/src/App.vue`
- Create: `admin/src/router.ts`

- [ ] **Step 1: 在admin目录初始化Vue项目**

```bash
cd admin
npm init vue@latest
# 选择: Vue 3, TypeScript, Router, Pinia
```

- [ ] **Step 2: 安装Element Plus**

```bash
npm install element-plus echarts axios
```

- [ ] **Step 3: 创建基础布局**

创建 `admin/src/App.vue`:
```vue
<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup lang="ts">
import { ElConfigProvider } from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
</script>
```

- [ ] **Step 4: 配置路由**

创建 `admin/src/router.ts`:
```typescript
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./views/Login.vue')
  },
  {
    path: '/',
    component: () => import('./views/Layout.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('./views/Dashboard.vue')
      },
      {
        path: 'models',
        name: 'Models',
        component: () => import('./views/Models.vue')
      },
      {
        path: 'devices',
        name: 'Devices',
        component: () => import('./views/Devices.vue')
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');

  if (to.path !== '/login' && !token) {
    next('/login');
  } else {
    next();
  }
});

export default router;
```

- [ ] **Step 5: 提交**

```bash
git add admin/
git commit -m "feat: 初始化Vue 3后台管理项目

- Vue 3 + TypeScript + Vite
- 配置Element Plus
- 设置路由和布局"
```

---

### Task 22-30: 实现后台管理页面

按照组件化开发：
- `admin/src/views/Login.vue` - 登录页
- `admin/src/views/Layout.vue` - 主布局
- `admin/src/views/Dashboard.vue` - 统计概览
- `admin/src/views/Models.vue` - 模型管理
- `admin/src/views/Devices.vue` - 设备管理
- `admin/src/composables/useAuth.ts` - 认证逻辑
- `admin/src/composables/useApi.ts` - API调用

每个页面遵循：编写组件 → 集成API → 测试 → 提交。

---

## 阶段 5：部署配置（1天）

### Task 31: 创建部署脚本

**Files:**
- Create: `scripts/create-admin.ts`
- Create: `scripts/init-admin.sh`
- Create: `ecosystem.config.js` (PM2配置)
- Create: `nginx.conf.example`

- [ ] **Step 1: 创建管理员初始化脚本**

创建 `scripts/create-admin.ts`:
```typescript
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { Admin } from '../src/models/Admin';
import '../src/app';

function validatePassword(password: string) {
  if (password.length < 12) {
    return { valid: false, message: '密码至少12位' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码需要大写字母' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码需要小写字母' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码需要数字' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: '密码需要特殊字符' };
  }
  return { valid: true };
}

async function createAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('❌ ADMIN_USERNAME 和 ADMIN_PASSWORD 必须设置');
    process.exit(1);
  }

  const validation = validatePassword(password);
  if (!validation.valid) {
    console.error(`❌ 密码强度不足: ${validation.message}`);
    process.exit(1);
  }

  const existing = await Admin.findOne({ username });
  if (existing) {
    console.log('✅ 管理员已存在，跳过创建');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({
    username,
    passwordHash,
    role: 'superadmin'
  });

  console.log('✅ 管理员创建成功');
  console.log('⚠️  重要: 请立即从环境变量中删除 ADMIN_PASSWORD!');
}

createAdmin()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ 创建失败:', error);
    process.exit(1);
  });
```

- [ ] **Step 2: 创建PM2配置**

创建 `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'select-ask-server',
    script: './dist/app.js',
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

- [ ] **Step 3: 创建Nginx配置示例**

创建 `nginx.conf.example`:
```nginx
server {
    listen 80;
    server_name api.select-ask.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 4: 创建部署文档**

创建 `DEPLOYMENT.md`:
```markdown
# 部署指南

## 服务器要求
- Ubuntu 22.04
- Node.js 18+
- MongoDB 7.0
- 2核4G内存

## 部署步骤

1. 安装依赖
\`\`\`bash
npm install
npm run build
\`\`\`

2. 配置环境变量
\`\`\`bash
cp .env.example .env
nano .env
\`\`\`

3. 初始化管理员
\`\`\`bash
npm run create-admin
\`\`\`

4. 启动服务
\`\`\`bash
pm2 start ecosystem.config.js
\`\`\`

5. 配置Nginx和HTTPS
\`\`\`bash
sudo certbot --nginx -d api.select-ask.com
\`\`\`
```

- [ ] **Step 5: 提交**

```bash
git add scripts/ ecosystem.config.js nginx.conf.example DEPLOYMENT.md
git commit -m "feat: 添加部署配置和脚本

- 管理员初始化脚本
- PM2集群配置
- Nginx反向代理配置
- 完整部署文档"
```

---

## 阶段 6：测试与文档（1天）

### Task 32-35: 完善测试和文档

- 编写端到端测试
- 更新README.md
- 编写API文档（Swagger）
- 性能测试

---

## 提交规范

每个任务完成后立即提交，提交信息格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档
- `test`: 测试
- `chore`: 构建/工具

---

## 测试策略

- **单元测试**: Jest，覆盖率目标80%
- **集成测试**: Supertest，测试API端点
- **端到端测试**: Playwright，测试完整流程

---

## 注意事项

1. **TDD**: 先写测试，再实现
2. **DRY**: 不要重复代码
3. **YAGNI**: 只实现需要的功能
4. **频繁提交**: 每个小功能都提交
5. **安全优先**: 所有输入都要验证
6. **性能考虑**: 使用索引、避免N+1查询

---

**计划版本**: 1.0
**创建日期**: 2026-03-20
**预估工期**: 10-15天