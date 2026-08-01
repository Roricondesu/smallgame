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
    desc: '燃烧的弹珠，每次撞击钉子都获得额外数值加成',
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
    effect: (lv) => `落底结算总额 ×${(2 + (lv - 1) * 0.2).toFixed(2)}`,
    desc: '冰封：落底时结算总额翻倍（含槽位/连击等所有加成）',
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
    desc: '充能的弹珠，撞击时连锁电击附近其他钉子',
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
    effect: (lv) => `污染钉子，其下次结算 ×${(1.3 + (lv - 1) * 0.1).toFixed(2)}`,
    desc: '腐蚀性的弹珠，被触碰的钉子会被标记并获得结算加成',
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
    effect: (lv) => `生成时初始数值 ×${(2 + (lv - 1) * 0.2).toFixed(2)}`,
    desc: '神圣祝福：弹珠生成时即拥有倍率化的初始数值（高起点）',
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
    effect: (lv) => `落底额外奖金 ×${(2 + (lv - 1) * 0.2).toFixed(2)} 原值（不受槽位影响）`,
    desc: '暗影：落底时额外获得倍率化原始数值奖金，无视落点槽位',
  },
];

export const MARBLE_MAP: Record<string, MarbleConfig> = Object.fromEntries(
  MARBLES.map((m) => [m.id, m]),
);

/** 自动投放时普通弹珠的基础权重（与各元素弹珠权重之和一起加权随机） */
export const MARBLE_NORMAL_WEIGHT = 10;
