/**
 * 设备指纹生成器
 * 通过多维度硬件特征生成唯一设备标识,防止身份伪造
 */

/**
 * 设备指纹组件
 */
export interface DeviceFingerprintComponents {
  canvas: string;
  webgl: string;
  audio: string;
  screen: string;
  timezone: string;
  language: string;
  platform: string;
  hardwareConcurrency: number;
  deviceMemory: number;
}

/**
 * 生成Canvas指纹
 * 通过Canvas渲染特定图形,不同硬件会产生细微差异
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 绘制特定图形
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Select Ask 🔐', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Device Fingerprint', 4, 17);

    // 获取Canvas数据
    const dataUrl = canvas.toDataURL();

    // 生成hash
    let hash = 0;
    for (let i = 0; i < dataUrl.length; i++) {
      const char = dataUrl.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16);
  } catch (error) {
    console.error('Canvas fingerprint error:', error);
    return '';
  }
}

/**
 * 生成WebGL指纹
 * 通过WebGL渲染器信息和扩展列表生成指纹
 */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) return '';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

    // 获取WebGL扩展列表
    const extensions = gl.getSupportedExtensions() || [];
    const extensionsHash = extensions.slice(0, 10).join(',');

    // 组合信息生成指纹
    const fingerprint = `${vendor}|${renderer}|${extensionsHash}`;

    // 简单hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16);
  } catch (error) {
    console.error('WebGL fingerprint error:', error);
    return '';
  }
}

/**
 * 生成Audio指纹
 * 通过AudioContext处理特定音频信号,不同硬件会产生差异
 */
async function getAudioFingerprint(): Promise<string> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // 创建振荡器
    const oscillator = audioContext.createOscillator();
    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';

    // 创建分析器
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    // 创建增益节点
    const gain = audioContext.createGain();
    gain.gain.value = 0;

    // 连接节点
    oscillator.connect(analyser);
    analyser.connect(gain);
    gain.connect(audioContext.destination);

    // 开始振荡
    oscillator.start();

    // 获取频率数据
    const frequencyData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(frequencyData);

    // 停止振荡
    oscillator.stop();
    audioContext.close();

    // 计算hash
    let hash = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      const value = Math.round(frequencyData[i] * 100);
      hash = ((hash << 5) - hash) + value;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16);
  } catch (error) {
    console.error('Audio fingerprint error:', error);
    return '';
  }
}

/**
 * 获取屏幕信息
 */
function getScreenFingerprint(): string {
  const screen = window.screen;
  return `${screen.width}x${screen.height}x${screen.colorDepth}x${screen.pixelDepth}`;
}

/**
 * 生成完整的设备指纹
 */
export async function generateDeviceFingerprint(): Promise<string> {
  try {
    // 收集各维度指纹
    const canvas = getCanvasFingerprint();
    const webgl = getWebGLFingerprint();
    const audio = await getAudioFingerprint();
    const screen = getScreenFingerprint();

    // 其他特征
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    const platform = navigator.platform;
    const hardwareConcurrency = navigator.hardwareConcurrency || 0;
    const deviceMemory = (navigator as any).deviceMemory || 0;

    // 组合所有特征
    const components: DeviceFingerprintComponents = {
      canvas,
      webgl,
      audio,
      screen,
      timezone,
      language,
      platform,
      hardwareConcurrency,
      deviceMemory,
    };

    console.log('Device fingerprint components:', components);

    // 生成最终hash
    const fingerprintString = JSON.stringify(components);
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintString);

    // 使用Web Crypto API生成SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log('Generated device fingerprint:', hashHex);

    return hashHex;
  } catch (error) {
    console.error('Device fingerprint generation error:', error);
    // 降级方案：使用时间戳 + 随机数（安全性较低，但保证可用）
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * 验证指纹是否有效
 */
export function isValidFingerprint(fingerprint: string): boolean {
  // SHA-256 hash应该是64个十六进制字符
  return /^[a-f0-9]{64}$/.test(fingerprint) || fingerprint.startsWith('fallback-');
}

/**
 * 计算两个指纹的相似度
 * 用于判断是否是同一设备（允许一定变化）
 */
export function calculateSimilarity(fp1: string, fp2: string): number {
  if (fp1 === fp2) return 1.0;
  if (!fp1 || !fp2) return 0.0;

  // 如果是fallback模式，直接比较
  if (fp1.startsWith('fallback-') || fp2.startsWith('fallback-')) {
    return fp1 === fp2 ? 1.0 : 0.0;
  }

  // 计算Hamming距离
  let differences = 0;
  const len = Math.min(fp1.length, fp2.length);

  for (let i = 0; i < len; i++) {
    if (fp1[i] !== fp2[i]) {
      differences++;
    }
  }

  // 相似度 = 1 - (差异数 / 长度)
  return 1 - (differences / len);
}