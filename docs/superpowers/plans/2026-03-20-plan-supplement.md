# 实施计划补充 - 缺失任务

本文档补充 `2026-03-20-server-implementation.md` 中缺失的关键任务。

---

## 补充任务 1: 创建Express应用入口

**Files:**
- Create: `select-ask-server/src/app.ts`

### 详细步骤

- [ ] **Step 1: 创建Express应用主文件**

创建 `select-ask-server/src/app.ts`:
```typescript
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';

config();

const app = express();

// 安全中间件
app.use(helmet());

// CORS配置
app.use(cors({
  origin: (origin, callback) => {
    // 允许浏览器扩展
    if (!origin ||
        origin.startsWith('chrome-extension://') ||
        origin.startsWith('moz-extension://')) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));

// 解析JSON
app.use(express.json());

// 健康检查
app.get('/health', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
      mongodb: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      mongodb: 'disconnected'
    });
  }
});

// API路由（后续添加）
// import llmRouter from './api/llm';
// app.use('/api', llmRouter);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  });
});

// 连接MongoDB并启动服务器
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

export default app;
```

- [ ] **Step 2: 测试应用启动**

```bash
npm run dev
```

Expected: 服务器成功启动，输出 "✅ MongoDB connected" 和 "🚀 Server running on port 3000"

- [ ] **Step 3: 测试健康检查**

```bash
curl http://localhost:3000/health
```

Expected: 返回健康状态JSON

- [ ] **Step 4: 提交**

```bash
git add src/app.ts
git commit -m "feat: 创建Express应用入口

- 配置安全中间件（helmet、CORS）
- 实现健康检查端点
- MongoDB连接管理
- 错误处理中间件"
```

---

## 补充任务 2: 设备指纹验证中间件

**Files:**
- Create: `select-ask-server/src/middleware/fingerprint-validator.ts`
- Create: `select-ask-server/tests/unit/middleware/fingerprint-validator.test.ts`

### 详细步骤

- [ ] **Step 1: 编写设备指纹验证中间件测试**

创建 `tests/unit/middleware/fingerprint-validator.test.ts`:
```typescript
import { validateFingerprint } from '../../src/middleware/fingerprint-validator';
import { Device } from '../../src/models/Device';

describe('Fingerprint Validator', () => {
  it('should reject invalid fingerprint format', async () => {
    const req: any = {
      body: { fingerprint: 'invalid' },
      ip: '127.0.0.1'
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    await validateFingerprint(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'INVALID_FINGERPRINT',
      message: 'Invalid device fingerprint format'
    });
  });

  it('should accept valid fingerprint', async () => {
    const fingerprint = 'a'.repeat(64);
    const req: any = {
      body: { fingerprint },
      ip: '127.0.0.1'
    };
    const res: any = {};
    const next = jest.fn();

    await validateFingerprint(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.device).toBeDefined();
  });

  it('should detect suspicious activity', async () => {
    const fingerprint = 'b'.repeat(64);

    // 创建有多个IP的设备
    await Device.create({
      fingerprint,
      metadata: {
        ips: Array(15).fill('192.168.1.').map((_, i) => `${_}${i}`)
      }
    });

    const req: any = {
      body: { fingerprint },
      ip: '10.0.0.1'
    };
    const res: any = {};
    const next = jest.fn();

    await validateFingerprint(req, res, next);

    const device = await Device.findOne({ fingerprint });
    expect(device?.metadata?.suspiciousActivity).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test tests/unit/middleware/fingerprint-validator.test.ts
```

Expected: FAIL

- [ ] **Step 3: 实现设备指纹验证中间件**

创建 `src/middleware/fingerprint-validator.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { Device } from '../models/Device';
import { logger } from '../utils/logger';

export async function validateFingerprint(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { fingerprint } = req.body;

  // 1. 格式验证
  if (!fingerprint || !/^[a-f0-9]{64}$/.test(fingerprint)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_FINGERPRINT',
      message: 'Invalid device fingerprint format'
    });
  }

  // 2. 查找或创建设备
  let device = await Device.findOne({ fingerprint });

  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent');

  if (device) {
    // 3. 检查IP异常
    const previousIPs = device.metadata?.ips || [];
    const suspiciousIPCount = previousIPs.filter(ip => ip !== clientIP).length;

    if (suspiciousIPCount > 10) {
      logger.warn('Suspicious device detected', {
        fingerprint: fingerprint.substring(0, 8),
        ips: previousIPs.length,
        currentIP: clientIP
      });

      device.metadata.suspiciousActivity = true;
      await device.save();
    }

    // 更新IP记录
    if (!previousIPs.includes(clientIP)) {
      device.metadata.ips = [...previousIPs.slice(-19), clientIP];
      await device.save();
    }
  } else {
    // 新设备
    device = await Device.create({
      fingerprint,
      firstSeen: new Date(),
      lastSeen: new Date(),
      isBlocked: false,
      dailyQuota: {
        count: 0,
        date: new Date().toISOString().split('T')[0]
      },
      metadata: {
        ips: [clientIP],
        userAgent,
        suspiciousActivity: false
      }
    });

    logger.info('New device registered', {
      fingerprint: fingerprint.substring(0, 8),
      ip: clientIP
    });
  }

  // 4. 检查封禁状态
  if (device.isBlocked) {
    return res.status(403).json({
      success: false,
      error: 'DEVICE_BLOCKED',
      message: device.blockedReason || 'Device has been blocked'
    });
  }

  // 5. 附加设备信息
  (req as any).device = device;
  next();
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test tests/unit/middleware/fingerprint-validator.test.ts
```

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/middleware/fingerprint-validator.ts tests/unit/middleware/fingerprint-validator.test.ts
git commit -m "feat: 实现设备指纹验证中间件

- 指纹格式验证
- IP异常检测（>10个IP标记可疑）
- 设备信息追踪
- 封禁状态检查
- 完整测试覆盖"
```

---

## 补充任务 3: 监控告警服务

**Files:**
- Create: `select-ask-server/src/services/monitoring.ts`
- Create: `select-ask-server/tests/unit/services/monitoring.test.ts`

### 详细步骤

- [ ] **Step 1: 编写监控服务测试**

创建 `tests/unit/services/monitoring.test.ts`:
```typescript
import { AlertService } from '../../src/services/monitoring';

describe('AlertService', () => {
  it('should send warning alert', async () => {
    await AlertService.sendAlert('warning', 'Test warning');
    // 验证日志输出
  });

  it('should check health status', async () => {
    const health = await AlertService.checkHealth();
    expect(health).toBeDefined();
    expect(health.mongodb).toBe('connected');
  });
});
```

- [ ] **Step 2: 实现监控告警服务**

创建 `src/services/monitoring.ts`:
```typescript
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';
import axios from 'axios';

export class AlertService {
  private static async sendAlert(
    level: 'warning' | 'critical',
    message: string
  ) {
    logger.error(`[${level.toUpperCase()}] ${message}`);

    // 发送邮件（关键告警）
    if (level === 'critical' && process.env.ADMIN_EMAIL) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: process.env.ADMIN_EMAIL,
          subject: `SelectAsk Alert: ${level}`,
          text: message
        });
      } catch (error) {
        logger.error('Failed to send email alert', { error });
      }
    }

    // Webhook通知
    if (process.env.ALERT_WEBHOOK) {
      try {
        await axios.post(process.env.ALERT_WEBHOOK, {
          level,
          message,
          timestamp: new Date()
        });
      } catch (error) {
        logger.error('Failed to send webhook alert', { error });
      }
    }
  }

  static async checkHealth() {
    const health = {
      mongodb: 'disconnected',
      diskUsage: 0,
      errorRate: 0
    };

    // MongoDB连接检查
    if (mongoose.connection.readyState === 1) {
      health.mongodb = 'connected';
    } else {
      await this.sendAlert('critical', 'MongoDB connection lost');
    }

    // TODO: 磁盘空间检查、错误率检查
    return health;
  }

  static async checkCost(todayCost: number) {
    const dailyLimit = parseFloat(process.env.DAILY_COST_LIMIT || '5');
    if (todayCost > dailyLimit) {
      await this.sendAlert('critical', `Daily cost exceeded: $${todayCost}`);
    } else if (todayCost > dailyLimit * 0.8) {
      await this.sendAlert('warning', `Cost warning: $${todayCost} (80% of limit)`);
    }
  }

  static async checkErrorRate(errorRate: number) {
    if (errorRate > 0.1) {
      await this.sendAlert('warning', `High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
  }
}

// 定时健康检查（在cron.ts中调用）
export async function runHealthCheck() {
  await AlertService.checkHealth();
}
```

- [ ] **Step 3: 运行测试**

```bash
npm test tests/unit/services/monitoring.test.ts
```

- [ ] **Step 4: 提交**

```bash
git add src/services/monitoring.ts tests/unit/services/monitoring.test.ts
git commit -m "feat: 实现监控告警服务

- 健康检查（MongoDB连接）
- 成本告警
- 错误率监控
- 邮件和Webhook通知
- 单元测试"
```

---

## 实施说明

以上补充任务应该插入到主计划的相应位置：

1. **补充任务1** 应该在阶段2之前（创建Express应用入口）
2. **补充任务2** 应该在阶段3的API路由之前（设备指纹验证中间件）
3. **补充任务3** 应该在阶段3之后或阶段4之前（监控告警服务）

按照TDD原则，每个任务都应该先编写测试、运行测试确认失败、实现代码、运行测试确认通过、提交代码。

---

**文档版本**: 1.1
**创建日期**: 2026-03-20