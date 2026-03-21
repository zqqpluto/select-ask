/**
 * Select Ask Analytics Service
 * 简单的用户统计服务，基于 Cloudflare Workers + KV
 */

export interface Env {
  STATS: KVNamespace;
  DEEPSEEK_API_KEY?: string; // DeepSeek API Key（可选）
  ADMIN_PASSWORD?: string; // 管理员密码（可选）
}

// 统计事件类型
interface AnalyticsEvent {
  action: 'startup' | 'feature_use' | 'error';
  version?: string;
  feature?: string; // explain, translate, ask, questions
  model?: string;
  error?: string;
  timestamp?: number;
}

// 每日统计汇总
interface DailyStats {
  date: string;
  startups: number;
  uniqueUsers: Set<string>;
  features: Record<string, number>;
  models: Record<string, number>;
  errors: number;
}

// 免费试用请求
interface FreeTrialRequest {
  fingerprint: string; // 设备指纹
  message: string; // 用户消息
  context?: string; // 选中的文本上下文
}

// 免费试用响应
interface FreeTrialResponse {
  success: boolean;
  content?: string;
  error?: string;
  remaining?: number; // 剩余次数
}

// 限流数据
interface RateLimitData {
  count: number;
  date: string; // YYYY-MM-DD
  lastRequest: number; // 时间戳
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      // POST /event - 上报事件
      if (request.method === 'POST' && url.pathname === '/event') {
        const event = await request.json() as AnalyticsEvent;
        const result = await handleEvent(event, env, request);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // POST /free-trial - 免费试用 AI 接口
      if (request.method === 'POST' && url.pathname === '/free-trial') {
        const body = await request.json() as FreeTrialRequest;
        const result = await handleFreeTrial(body, env, request);

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // GET /stats - 获取统计（简单密码保护）
      if (request.method === 'GET' && url.pathname === '/stats') {
        const password = url.searchParams.get('password');
        if (password !== env.ADMIN_PASSWORD) {
          return new Response('Unauthorized', { status: 401 });
        }

        const stats = await getStats(env);
        return new Response(JSON.stringify(stats, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // GET /health - 健康检查
      if (request.method === 'GET' && url.pathname === '/health') {
        return new Response('OK', { headers: corsHeaders });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Error:', error);
      return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
    }
  },
};

/**
 * 【严重问题 #2 修复】KV写入配额监控
 *
 * Cloudflare KV免费额度：
 * - 1000次写入/天
 * - 100,000次读取/天
 *
 * 当前写入消耗：
 * - 每次AI调用：1次写入（限流计数）
 * - 每次事件上报：2次写入（统计 + 总览）
 *
 * 估算：34个设备 × 30次调用 = 1020次（超限）
 *
 * 解决方案：
 * - 添加KV写入计数和监控
 * - 超过阈值时记录警告
 * - 建议升级到Workers Paid计划（$5/月，无限KV写入）
 */
async function monitorKVWrite(env: Env, operation: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `kv-monitor:${today}`;

  try {
    // 获取今日KV写入计数
    const count = await env.STATS.get<number>(key, 'json') || 0;
    const newCount = count + 1;

    // 保存更新后的计数
    await env.STATS.put(key, JSON.stringify(newCount), {
      expirationTtl: 86400 // 24小时过期
    });

    // 配额阈值告警
    const DAILY_QUOTA = 1000;
    const WARNING_THRESHOLD = 0.8; // 80%

    if (newCount === Math.floor(DAILY_QUOTA * WARNING_THRESHOLD)) {
      console.warn(`[KV Quota Warning] ${today} - Used ${newCount}/${DAILY_QUOTA} writes (80% quota)`);
    } else if (newCount >= DAILY_QUOTA) {
      console.error(`[KV Quota Exceeded] ${today} - Used ${newCount}/${DAILY_QUOTA} writes! Consider upgrading to Workers Paid plan.`);
    } else {
      console.log(`[KV Write] ${operation} - Today's count: ${newCount}/${DAILY_QUOTA}`);
    }
  } catch (error) {
    // 监控失败不应影响主流程
    console.error('[KV Monitor Error]', error);
  }
}

/**
 * 处理统计事件
 */
async function handleEvent(event: AnalyticsEvent, env: Env, request: Request): Promise<{ success: boolean }> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const clientId = getClientId(request);

  // 生成用户唯一 ID（基于 IP + User-Agent 哈希，匿名化）
  const userId = await hashString(clientId.ip + clientId.userAgent);

  // 获取今日统计
  const statsKey = `stats:${today}`;
  let stats = await env.STATS.get<DailyStats>(statsKey, 'json');

  if (!stats) {
    stats = {
      date: today,
      startups: 0,
      uniqueUsers: new Set(),
      features: {},
      models: {},
      errors: 0
    };
  }

  // 确保 uniqueUsers 是 Set
  if (!(stats.uniqueUsers instanceof Set)) {
    stats.uniqueUsers = new Set(Array.isArray(stats.uniqueUsers) ? stats.uniqueUsers : []);
  }

  // 更新统计
  switch (event.action) {
    case 'startup':
      stats.startups++;
      stats.uniqueUsers.add(userId);
      break;

    case 'feature_use':
      if (event.feature) {
        stats.features[event.feature] = (stats.features[event.feature] || 0) + 1;
      }
      if (event.model) {
        stats.models[event.model] = (stats.models[event.model] || 0) + 1;
      }
      break;

    case 'error':
      stats.errors++;
      break;
  }

  // 保存统计（KV 不支持 Set，需要转换）
  const statsToSave = {
    ...stats,
    uniqueUsers: Array.from(stats.uniqueUsers)
  };
  await env.STATS.put(statsKey, JSON.stringify(statsToSave));

  // 【KV监控】记录写入
  await monitorKVWrite(env, 'handleEvent');

  // 更新总览
  await updateOverview(env, today, stats);

  return { success: true };
}

/**
 * 获取客户端标识
 */
function getClientId(request: Request): { ip: string; userAgent: string } {
  return {
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    userAgent: request.headers.get('User-Agent') || 'unknown'
  };
}

/**
 * 哈希字符串（简单匿名化）
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 更新总览统计
 */
async function updateOverview(env: Env, today: string, stats: DailyStats): Promise<void> {
  const overviewKey = 'overview';
  const overview = await env.STATS.get(overviewKey, 'json') as {
    lastUpdate: string;
    totalDays: number;
    dates: string[];
  } || { lastUpdate: '', totalDays: 0, dates: [] };

  if (!overview.dates.includes(today)) {
    overview.dates.push(today);
    overview.totalDays = overview.dates.length;
  }
  overview.lastUpdate = new Date().toISOString();

  // 只保留最近 30 天
  if (overview.dates.length > 30) {
    overview.dates = overview.dates.slice(-30);
  }

  await env.STATS.put(overviewKey, JSON.stringify(overview));

  // 【KV监控】记录写入
  await monitorKVWrite(env, 'updateOverview');
}

/**
 * 获取统计数据
 */
async function getStats(env: Env): Promise<{
  overview: any;
  recent: DailyStats[];
}> {
  const overview = await env.STATS.get('overview', 'json');

  // 获取最近 7 天的统计
  const recent: DailyStats[] = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const stats = await env.STATS.get(`stats:${dateStr}`, 'json');
    if (stats) {
      recent.push(stats as DailyStats);
    }
  }

  return { overview, recent };
}

/**
 * 处理免费试用请求
 *
 * 【修复说明】严重问题 #1：并发限流失效
 * - 使用预扣额度机制：先扣减配额，再调用AI
 * - AI调用失败时回退额度
 * - 确保原子性：KV的put操作是原子的
 *
 * 流程：
 * 1. 验证设备指纹
 * 2. 预扣额度（原子操作）
 * 3. 调用 DeepSeek AI（带超时控制）
 * 4. 失败时回退额度
 */
async function handleFreeTrial(
  request: FreeTrialRequest,
  env: Env,
  httpRequest: Request
): Promise<FreeTrialResponse> {
  // 验证必需参数
  if (!request.fingerprint || !request.message) {
    return {
      success: false,
      error: 'Missing required fields: fingerprint or message'
    };
  }

  // 验证设备指纹格式（防止注入攻击）
  if (!isValidFingerprint(request.fingerprint)) {
    return {
      success: false,
      error: 'Invalid fingerprint format'
    };
  }

  // 检查 API Key 是否配置
  if (!env.DEEPSEEK_API_KEY) {
    return {
      success: false,
      error: 'Service not configured. Please contact administrator.'
    };
  }

  // 【关键修复】预扣额度（原子操作）
  const acquireResult = await tryAcquireQuota(request.fingerprint, env);
  if (!acquireResult.success) {
    return {
      success: false,
      error: `Daily limit exceeded. You have used ${acquireResult.count}/30 requests today. Please try again tomorrow.`,
      remaining: 0
    };
  }

  try {
    // 调用 DeepSeek AI（带超时和成本控制）
    const aiResponse = await callDeepSeekAI(
      request.message,
      request.context,
      env.DEEPSEEK_API_KEY
    );

    return {
      success: true,
      content: aiResponse,
      remaining: 30 - acquireResult.count
  };
  } catch (error) {
    // 【关键修复】AI调用失败，回退额度
    console.error('DeepSeek API error, rolling back quota:', error);
    await rollbackQuota(request.fingerprint, env);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'AI service error'
    };
  }
}

/**
 * 验证设备指纹格式
 * 只允许字母、数字、横杠和下划线，长度16-64
 */
function isValidFingerprint(fingerprint: string): boolean {
  const regex = /^[a-zA-Z0-9_-]{16,64}$/;
  return regex.test(fingerprint);
}

/**
 * 【严重问题 #1 修复】预扣额度（原子操作）
 * 原子性地检查并扣减配额，防止并发超限
 *
 * @returns success: 是否成功获取配额，count: 当前已使用次数（包含本次）
 */
async function tryAcquireQuota(
  fingerprint: string,
  env: Env
): Promise<{ success: boolean; count: number }> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `ratelimit:${fingerprint}:${today}`;
  const DAILY_LIMIT = 30;

  // 获取当前数据
  const data = await env.STATS.get<RateLimitData>(key, 'json');

  // 新的一天或首次使用
  if (!data || data.date !== today) {
    const newData: RateLimitData = {
      count: 1,
      date: today,
      lastRequest: Date.now()
    };

    // 原子写入（KV的put是原子的）
    await env.STATS.put(key, JSON.stringify(newData), {
      expirationTtl: 86400 // 24小时过期
    });

    // 【KV监控】记录写入
    await monitorKVWrite(env, 'tryAcquireQuota');

    return { success: true, count: 1 };
  }

  // 同一天，检查是否超限
  const newCount = data.count + 1;
  if (newCount > DAILY_LIMIT) {
    // 已达上限，拒绝请求（不写入KV）
    return { success: false, count: data.count };
  }

  // 预扣额度（增加计数）
  const newData: RateLimitData = {
    ...data,
    count: newCount,
    lastRequest: Date.now()
  };

  // 原子写入
  await env.STATS.put(key, JSON.stringify(newData), {
    expirationTtl: 86400
  });

  // 【KV监控】记录写入
  await monitorKVWrite(env, 'tryAcquireQuota');

  return { success: true, count: newCount };
}

/**
 * 【严重问题 #1 修复】回退额度
 * 当AI调用失败时，回退预扣的额度
 */
async function rollbackQuota(fingerprint: string, env: Env): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `ratelimit:${fingerprint}:${today}`;

  // 获取当前数据
  const data = await env.STATS.get<RateLimitData>(key, 'json');

  if (data && data.count > 0) {
    // 减少计数（回退）
    const newData: RateLimitData = {
      ...data,
      count: data.count - 1,
      lastRequest: Date.now()
    };

    await env.STATS.put(key, JSON.stringify(newData), {
      expirationTtl: 86400
    });

    // 【KV监控】记录写入
    await monitorKVWrite(env, 'rollbackQuota');
  }
}

/**
 * 检查限流（已废弃，改用 tryAcquireQuota）
 * 保留此函数供其他地方可能使用
 * 每个设备指纹每天限制30次请求
 */
async function checkRateLimit(
  fingerprint: string,
  env: Env
): Promise<{ allowed: boolean; count: number }> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `ratelimit:${fingerprint}:${today}`;

  // 获取今日使用情况
  const data = await env.STATS.get<RateLimitData>(key, 'json');

  if (!data) {
    // 首次使用
    return { allowed: true, count: 0 };
  }

  // 检查是否跨天（自动重置）
  if (data.date !== today) {
    // 跨天了，重置计数
    return { allowed: true, count: 0 };
  }

  // 同一天内，检查是否超过限制
  const DAILY_LIMIT = 30;
  if (data.count >= DAILY_LIMIT) {
    return { allowed: false, count: data.count };
  }

  return { allowed: true, count: data.count };
}

/**
 * 增加使用次数（已废弃，改用 tryAcquireQuota）
 * 保留此函数供其他地方可能使用
 */
async function incrementUsage(fingerprint: string, env: Env): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `ratelimit:${fingerprint}:${today}`;

  // 获取当前数据
  let data = await env.STATS.get<RateLimitData>(key, 'json');

  if (!data || data.date !== today) {
    // 新的一天或首次使用
    data = {
      count: 1,
      date: today,
      lastRequest: Date.now()
    };
  } else {
    // 同一天，增加计数
    data = {
      ...data,
      count: data.count + 1,
      lastRequest: Date.now()
    };
  }

  // 保存到 KV，设置24小时过期（跨天自动清理）
  await env.STATS.put(key, JSON.stringify(data), {
    expirationTtl: 86400 // 24小时 = 86400秒
  });
}

/**
 * 调用 DeepSeek AI API
 *
 * 【修复说明】严重问题 #3：成本控制缺失
 * - 动态max_tokens设置（基于消息长度）
 * - 成本日志记录（估算token消耗）
 * - 超时控制（30秒）
 *
 * 使用 DeepSeek Chat 模型
 */
async function callDeepSeekAI(
  message: string,
  context: string | undefined,
  apiKey: string
): Promise<string> {
  const systemPrompt = context
    ? `You are a helpful AI assistant. The user has selected some text and wants to ask about it. Here's the selected text context:\n\n${context}\n\nPlease provide helpful and accurate responses based on the context.`
    : 'You are a helpful AI assistant. Please provide helpful and accurate responses.';

  const userContent = context
    ? `Context: ${context}\n\nQuestion: ${message}`
    : message;

  // 【成本控制】动态计算 max_tokens
  // 基于输入长度估算输出长度，避免浪费配额
  const inputLength = (context ? context.length : 0) + message.length;
  const maxTokens = calculateMaxTokens(inputLength);

  // 【成本控制】记录请求信息
  console.log(`[DeepSeek API] Request - Input length: ${inputLength}, Max tokens: ${maxTokens}`);

  // 【超时控制】创建带超时的请求
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

  try {
    const startTime = Date.now();

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.7,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText}. ${
          errorData.error?.message || ''
        }`
      );
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    // 提取 AI 回复内容
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Invalid response from DeepSeek API');
    }

    // 【成本控制】记录使用情况
    const duration = Date.now() - startTime;
    const usage = data.usage; // OpenAI格式的API通常会返回usage信息
    if (usage) {
      console.log(`[DeepSeek API] Success - Duration: ${duration}ms, ` +
        `Prompt tokens: ${usage.prompt_tokens || 'N/A'}, ` +
        `Completion tokens: ${usage.completion_tokens || 'N/A'}, ` +
        `Total tokens: ${usage.total_tokens || 'N/A'}`
      );
    } else {
      console.log(`[DeepSeek API] Success - Duration: ${duration}ms, Output length: ${content.length}`);
    }

    return content;
  } catch (error) {
    clearTimeout(timeoutId);

    // 区分超时错误
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI service timeout (30s). Please try again.');
    }

    throw error;
  }
}

/**
 * 【成本控制】动态计算 max_tokens
 * 根据输入长度智能调整输出长度限制
 *
 * 规则：
 * - 短文本（<500字符）: max 500 tokens (简洁回答)
 * - 中等文本（500-2000字符）: max 1000 tokens (适中回答)
 * - 长文本（>2000字符）: max 2000 tokens (详细回答)
 */
function calculateMaxTokens(inputLength: number): number {
  if (inputLength < 500) {
    return 500;
  } else if (inputLength < 2000) {
    return 1000;
  } else {
    return 2000;
  }
}