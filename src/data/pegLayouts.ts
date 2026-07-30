// 章节占位钉子布局：每章预设一组"可放置钉子的网格位置"，玩家只能在这些位置放钉。
// 无尽模式复用第 5 章布局。布局按章节主题设计，体现风格差异。
//
// 坐标为网格坐标 (gx, gy)：gx∈[0,11]（奇数行 gy 最大 10），gy∈[0,15]
// 蜂窝布局：奇数行（gy%2===1）只有 11 列且向右偏移半格
// 未在布局中的网格位置不渲染占位钉子，玩家无法在此放钉

/** 网格坐标对 */
export interface GridPos { gx: number; gy: number; }

/** 由一组"行规则"生成位置集合的辅助器，避免手写大量坐标 */
function rangeRows(startY: number, endY: number, colFn: (gy: number) => number[]): GridPos[] {
  const out: GridPos[] = [];
  for (let gy = startY; gy <= endY; gy++) {
    for (const gx of colFn(gy)) out.push({ gx, gy });
  }
  return out;
}

/** 第 1 章 · 学徒之始：简单对称三角形阵列（中心收口），新手友好
 *  - 顶部宽、底部窄，引导弹珠向中心汇聚 */
function ch1(): GridPos[] {
  const out: GridPos[] = [];
  // 顶部 4 行：完整网格（偶数行 12 列，奇数行 11 列）
  for (let gy = 0; gy < 4; gy++) {
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    for (let gx = 0; gx < maxCol; gx++) out.push({ gx, gy });
  }
  // 中间 6 行：每行去掉两侧各 1~2 列，形成漏斗
  for (let gy = 4; gy < 10; gy++) {
    const trim = Math.floor((gy - 2) / 2);
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    for (let gx = trim; gx < maxCol - trim; gx++) out.push({ gx, gy });
  }
  // 底部 3 行：中心 4 列，作为收口
  for (let gy = 10; gy < 13; gy++) {
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    const center = Math.floor(maxCol / 2);
    for (let gx = center - 2; gx <= center + 1; gx++) out.push({ gx, gy });
  }
  return out;
}

/** 第 2 章 · 符文觉醒：菱形/钻石阵列，左右对称 */
function ch2(): GridPos[] {
  const out: GridPos[] = [];
  for (let gy = 0; gy < 16; gy++) {
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    // 菱形：中间行最宽，顶/底最窄
    const dist = Math.abs(gy - 8);
    const width = Math.max(2, Math.floor((12 - dist) / 2));
    const start = Math.floor((maxCol - width * 2) / 2);
    for (let gx = start; gx < start + width * 2 && gx < maxCol; gx++) out.push({ gx, gy });
  }
  return out;
}

/** 第 3 章 · 熵的预兆：交错波浪条带（上下两条宽带 + 中间稀疏列） */
function ch3(): GridPos[] {
  const out: GridPos[] = [];
  // 顶部宽带（gy 0~3）
  out.push(...rangeRows(0, 3, (gy) => {
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    return Array.from({ length: maxCol }, (_, i) => i);
  }));
  // 中间稀疏：仅左右两侧各 2 列，留出中央通道
  out.push(...rangeRows(4, 11, (gy) => {
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    return [0, 1, maxCol - 2, maxCol - 1];
  }));
  // 底部宽带（gy 12~15）
  out.push(...rangeRows(12, 15, (gy) => {
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    return Array.from({ length: maxCol }, (_, i) => i);
  }));
  return out;
}

/** 第 4 章 · 归零之途：螺旋通道（外圈环绕 + 中央十字） */
function ch4(): GridPos[] {
  const out: GridPos[] = [];
  // 外圈：左右各 2 列贯穿全网格
  for (let gy = 0; gy < 16; gy++) {
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    out.push({ gx: 0, gy });
    out.push({ gx: 1, gy });
    out.push({ gx: maxCol - 2, gy });
    out.push({ gx: maxCol - 1, gy });
    // 顶/底各 2 行贯穿
    if (gy < 2 || gy > 13) {
      for (let gx = 2; gx < maxCol - 2; gx++) out.push({ gx, gy });
    }
  }
  // 中央十字：水平中线 + 垂直中线（gy 7~8, gx 中心）
  for (let gy = 6; gy <= 9; gy++) {
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    const center = Math.floor(maxCol / 2);
    for (let gx = center - 2; gx <= center + 1; gx++) out.push({ gx, gy });
  }
  for (let gy = 4; gy <= 11; gy++) {
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    const center = Math.floor(maxCol / 2);
    out.push({ gx: center - 1, gy });
    out.push({ gx: center, gy });
  }
  return out;
}

/** 第 5 章 · 贤者归来：密集满铺（除中央留 1 个"贤者之眼"空位）
 *  复用为无尽模式布局 */
function ch5(): GridPos[] {
  const out: GridPos[] = [];
  for (let gy = 0; gy < 16; gy++) {
    const maxCol = (gy % 2 === 1) ? 11 : 12;
    for (let gx = 0; gx < maxCol; gx++) {
      // 中央留一个空位作为视觉焦点
      if (gy === 8 && gx === Math.floor(maxCol / 2)) continue;
      out.push({ gx, gy });
    }
  }
  return out;
}

const LAYOUTS: Record<number, GridPos[]> = {
  1: ch1(),
  2: ch2(),
  3: ch3(),
  4: ch4(),
  5: ch5(),
};

/** 取某章的可放置位置集合（无尽模式复用第 5 章） */
export function getChapterLayout(chapterId: number): GridPos[] {
  return LAYOUTS[chapterId] ?? LAYOUTS[5];
}

/** 构造位置 key 集合，用于 O(1) 查询某位置是否可放置 */
export function getChapterLayoutKeys(chapterId: number): Set<string> {
  const set = new Set<string>();
  for (const { gx, gy } of getChapterLayout(chapterId)) set.add(`${gx},${gy}`);
  return set;
}
