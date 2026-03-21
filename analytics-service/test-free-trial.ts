/**
 * 免费试用接口测试示例
 * 使用 curl 或 Node.js fetch 测试
 */

// ============= Node.js 测试脚本 =============

const TEST_URL = 'http://localhost:8787/free-trial'; // 本地开发环境
// const TEST_URL = 'https://your-worker.your-subdomain.workers.dev/free-trial'; // 生产环境

// 模拟设备指纹（实际使用时应由客户端生成）
const DEVICE_FINGERPRINT = 'test-device-fingerprint-12345678';

/**
 * 测试免费试用接口
 */
async function testFreeTrial() {
  try {
    console.log('Testing free trial API...\n');

    const response = await fetch(TEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fingerprint: DEVICE_FINGERPRINT,
        message: 'What is JavaScript?',
        context: 'const foo = bar;'
      }),
    });

    const data = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Success!');
      console.log('AI Response:', data.content);
      console.log('Remaining Requests:', data.remaining);
    } else {
      console.log('\n❌ Error:', data.error);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

/**
 * 测试限流功能
 * 连续发送31次请求，验证第31次被限流
 */
async function testRateLimit() {
  console.log('Testing rate limit (30 requests per day)...\n');

  for (let i = 1; i <= 32; i++) {
    try {
      const response = await fetch(TEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fingerprint: `test-device-${i}`, // 每次使用不同的指纹
          message: `Test message ${i}`,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`Request ${i}: ✅ Success (Remaining: ${data.remaining})`);
      } else {
        console.log(`Request ${i}: ❌ ${data.error}`);
      }

      // 添加延迟，避免过快请求
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Request ${i} failed:`, error);
    }
  }
}

/**
 * 测试错误情况
 */
async function testErrorCases() {
  console.log('Testing error cases...\n');

  // 1. 缺少必需字段
  console.log('1. Missing fingerprint:');
  let response = await fetch(TEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'test' }),
  });
  console.log('  ', await response.json());

  // 2. 无效的指纹格式
  console.log('\n2. Invalid fingerprint format:');
  response = await fetch(TEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fingerprint: 'invalid@fingerprint!',
      message: 'test',
    }),
  });
  console.log('  ', await response.json());

  // 3. 缺少消息
  console.log('\n3. Missing message:');
  response = await fetch(TEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprint: 'test-fingerprint' }),
  });
  console.log('  ', await response.json());
}

// 运行测试
// testFreeTrial();
// testRateLimit();
// testErrorCases();

// ============= curl 测试命令 =============

/*
# 1. 基本请求
curl -X POST http://localhost:8787/free-trial \
  -H "Content-Type: application/json" \
  -d '{
    "fingerprint": "test-device-fingerprint-12345678",
    "message": "What is JavaScript?",
    "context": "const foo = bar;"
  }'

# 2. 无上下文请求
curl -X POST http://localhost:8787/free-trial \
  -H "Content-Type: application/json" \
  -d '{
    "fingerprint": "test-device-fingerprint-12345678",
    "message": "Explain quantum computing"
  }'

# 3. 测试限流（运行30次后会返回错误）
for i in {1..35}; do
  echo "Request $i:"
  curl -s -X POST http://localhost:8787/free-trial \
    -H "Content-Type: application/json" \
    -d "{
      \"fingerprint\": \"test-device-fingerprint-12345678\",
      \"message\": \"Test $i\"
    }" | jq '.'
  echo ""
  sleep 0.2
done

# 4. 测试健康检查
curl http://localhost:8787/health

# 5. 测试统计接口（需要密码）
curl "http://localhost:8787/stats?password=your-admin-password"
*/

export { testFreeTrial, testRateLimit, testErrorCases };