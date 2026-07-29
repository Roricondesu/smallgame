// 元素弹珠配置表
// 6 种元素弹珠：火/冰/雷/毒/圣/暗
// 购买后永久拥有；可升级提升效果强度与自动触发概率；可选中作为手动投放弹珠
// 元素图标素材来自 public/skills/{element}.png

import type { MarbleConfig } from '../types';

export const MARBLES: MarbleConfig[] = [
  {
    id: 'fire',
    name: '烈焰弹珠',
    element: 'fire',
    color: 0xff6b3d,
    purchaseCost: 500,
    upgradeBaseCost: 800,
    upgradeGrowth: 1.45,
    maxLevel: 10,
    getValue: (lv) => 1.5 + (lv - 1) * 0.1,
    getAutoWeight: (lv) => lv,
    effect: (lv) => `碰撞时数值额外 ×${(1.5 + (lv - 1) * 0.1).toFixed(2)}`,
    desc: '燃烧的弹珠，每次撞击钉子都获得额外加成',
  },
  {
    id: 'ice',
    name: '寒冰弹珠',
    element: 'ice',
    color: 0x6ec5ff,
    purchaseCost: 2000,
    upgradeBaseCost: 2500,
    upgradeGrowth: 1.5,
    maxLevel: 10,
    getValue: (lv) => 2 + (lv - 1) * 0.2,
    getAutoWeight: (lv) => lv,
    effect: (lv) => `落底结算时再翻倍 ×${(2 + (lv - 1) * 0.2).toFixed(2)}`,
    desc: '凝结的弹珠，结算时如冰花绽放再翻一倍',
  },
  {
    id: 'thunder',
    name: '雷霆弹珠',
    element: 'thunder',
    color: 0xffd166,
    purchaseCost: 8000,
    upgradeBaseCost: 8000,
    upgradeGrowth: 1.5,
    maxLevel: 10,
    getValue: (lv) => 2 + (lv - 1),
    getAutoWeight: (lv) => lv,
    effect: (lv) => `随机链击 ${2 + (lv - 1)} 个钉子`,
    desc: '充能的弹珠，撞击时会跳跃至附近其他钉子',
  },
  {
    id: 'poison',
    name: '毒蚀弹珠',
    element: 'poison',
    color: 0x4ade80,
    purchaseCost: 20000,
    upgradeBaseCost: 18000,
    upgradeGrowth: 1.5,
    maxLevel: 10,
    getValue: (lv) => 1.3 + (lv - 1) * 0.1,
    getAutoWeight: (lv) => lv,
    effect: (lv) => `撞击的钉子下次结算 ×${(1.3 + (lv - 1) * 0.1).toFixed(2)}`,
    desc: '腐蚀性的弹珠，被触碰的钉子会被标记',
  },
  {
    id: 'holy',
    name: '圣光弹珠',
    element: 'holy',
    color: 0xfff5b3,
    purchaseCost: 100000,
    upgradeBaseCost: 80000,
    upgradeGrowth: 1.55,
    maxLevel: 10,
    getValue: (lv) => 2 + (lv - 1) * 0.2,
    getAutoWeight: (lv) => lv,
    effect: (lv) => `落下瞬间数值翻倍 ×${(2 + (lv - 1) * 0.2).toFixed(2)}`,
    desc: '神圣的弹珠，落下瞬间数值直接翻倍',
  },
  {
    id: 'dark',
    name: '暗影弹珠',
    element: 'dark',
    color: 0xa371f7,
    purchaseCost: 500000,
    upgradeBaseCost: 350000,
    upgradeGrowth: 1.6,
    maxLevel: 10,
    getValue: (lv) => 2 + (lv - 1) * 0.2,
    getAutoWeight: (lv) => lv,
    effect: (lv) => `结算时复制为 ×${(2 + (lv - 1) * 0.2).toFixed(2)} 颗弹珠的数值`,
    desc: '分裂的弹珠，落底时会复制自身的数值',
  },
];

export const MARBLE_MAP: Record<string, MarbleConfig> = Object.fromEntries(
  MARBLES.map((m) => [m.id, m]),
);

/** 自动投放时普通弹珠的基础权重（与各元素弹珠权重之和一起加权随机） */
export const MARBLE_NORMAL_WEIGHT = 10;
