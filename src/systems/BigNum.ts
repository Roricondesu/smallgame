// BigInt 大数运算工具：所有"原始数值"在内部以 bigint × SCALE 存储。
// SCALE = 100n 表示保留两位小数精度；支持任意大数（无 1.8e308 上限）。

export const SCALE = 100n;
const SCALE_NUM = 100;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** number 原值 → bigint 缩放值（支持任意大数，包括 1e308+） */
export function toBig(n: number): bigint {
  if (!isFinite(n)) return n > 0 ? BigInt(Number.MAX_SAFE_INTEGER) * SCALE : 0n;
  if (n === 0) return 0n;
  const scaled = n * SCALE_NUM;
  // 小数且不溢出：直接转换（快路径）
  if (isFinite(scaled) && Math.abs(scaled) <= Number.MAX_SAFE_INTEGER) {
    return BigInt(Math.round(scaled));
  }
  // 大数：用 toExponential 解析后字符串构造
  const sign = n < 0 ? '-' : '';
  const expStr = Math.abs(n).toExponential(14);
  const match = expStr.match(/^(\d+(?:\.\d+)?)e([+-]\d+)$/);
  if (!match) return BigInt(Number.MAX_SAFE_INTEGER) * SCALE;
  const mantStr = match[1].replace('.', '');
  const decimalDigits = match[1].includes('.') ? match[1].split('.')[1].length : 0;
  // n × 100 = mantissa × 10^(exponent + 2 - decimalDigits)
  const e = parseInt(match[2], 10) + 2 - decimalDigits;
  if (e >= 0) {
    return BigInt(sign + mantStr + '0'.repeat(e));
  } else {
    const cut = mantStr.length + e;
    if (cut <= 0) return 0n;
    return BigInt(sign + mantStr.slice(0, cut));
  }
}

/** bigint 缩放值 → number 原值（仅数值小时精度无损，大数会丢精度） */
export function fromBig(b: bigint): number {
  return Number(b) / SCALE_NUM;
}

/** 估算 log10(|bigint|)，精度约 15 位有效数字 */
export function bigLog10Abs(b: bigint): number {
  if (b === 0n) return -Infinity;
  const s = (b < 0n ? -b : b).toString();
  const len = s.length;
  const head = s.slice(0, Math.min(16, len));
  const headNum = Number(head);
  const tailLen = len - head.length;
  return Math.log10(headNum) + tailLen;
}

/** 10^log10 → bigint（支持任意大指数） */
export function pow10ToBig(log10: number): bigint {
  if (!isFinite(log10)) return log10 > 0 ? BigInt(Number.MAX_SAFE_INTEGER) ** 10n : 0n;
  if (log10 < 0) return 0n;
  if (log10 < 15) {
    return BigInt(Math.round(Math.pow(10, log10)));
  }
  const e = Math.floor(log10);
  const m = Math.pow(10, log10 - e);
  const digits = Math.round(m * 1e15);
  let s = digits.toString();
  if (e >= 15) {
    s = s + '0'.repeat(e - 15);
  } else {
    s = s.slice(0, e + 1);
  }
  try {
    return BigInt(s);
  } catch {
    return 0n;
  }
}

/** v^exponent：v 是缩放 bigint，exponent 是 number（如 1.1, 1.2）。结果也是缩放 bigint */
export function bigPow(v: bigint, exponent: number): bigint {
  if (v === 0n) return 0n;
  const log10V = bigLog10Abs(v);
  const log10Scale = Math.log10(SCALE_NUM);
  const log10Orig = log10V - log10Scale;
  const newLog = exponent * log10Orig + log10Scale;
  return pow10ToBig(newLog);
}

/** bigint × number 小数（结果仍为缩放 bigint） */
export function bigMulNum(a: bigint, b: number): bigint {
  if (a === 0n || b === 0) return 0n;
  const bScaled = BigInt(Math.round(b * 1e6));
  return (a * bScaled) / BigInt(1e6);
}

/** bigint + number 小数 */
export function bigAddNum(a: bigint, b: number): bigint {
  return a + toBig(b);
}

// k 是 1000 的幂次：1=A, 2=B, ..., 26=Z, 27=AA, 28=AB...
function suffix(k: number): string {
  if (k <= 0) return '';
  let s = '';
  let n = k;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = LETTERS[rem] + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** 格式化 bigint 缩放值为显示字符串（字母后缀：1e3=A, 1e6=B, ..., 1e78=Z, 1e81=AA...） */
export function formatNum(b: bigint): string {
  if (b < 0n) return '-' + formatNum(-b);
  if (b === 0n) return '0';
  if (b < 1000n * SCALE) {
    const n = fromBig(b);
    if (n < 1) return '0';
    if (Number.isInteger(n)) return String(n);
    if (n < 1000) return n.toFixed(1);
  }
  const log10Orig = bigLog10Abs(b) - Math.log10(SCALE_NUM);
  if (!isFinite(log10Orig) || log10Orig < 3) {
    const n = fromBig(b);
    if (!isFinite(n)) return '∞';
    return n.toFixed(0);
  }
  let k = Math.floor(log10Orig / 3);
  if (k < 1) k = 1;
  const val = Math.pow(10, log10Orig - k * 3);
  return val.toFixed(2) + suffix(k);
}

/** 短格式：用于 HUD 紧凑显示 */
export function shortNum(b: bigint): string {
  if (b < 0n) return '-' + shortNum(-b);
  if (b === 0n) return '0';
  if (b < 1000n * SCALE) {
    return String(Math.floor(fromBig(b)));
  }
  const log10Orig = bigLog10Abs(b) - Math.log10(SCALE_NUM);
  if (!isFinite(log10Orig) || log10Orig < 3) {
    return String(Math.floor(fromBig(b)));
  }
  let k = Math.floor(log10Orig / 3);
  if (k < 1) k = 1;
  const val = Math.pow(10, log10Orig - k * 3);
  return val.toFixed(1) + suffix(k);
}
