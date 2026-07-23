// 周目、自动器、数晶商店配置

import type { ChapterConfig, AutoDropperConfig, CrystalUpgrade } from '../types';

export const CHAPTERS: ChapterConfig[] = [
  {
    id: 1, name: '学徒之始', scene: '零号镇 · 北境小村',
    targetGold: 1e6, bg: 0x1a1025, accent: '#ff8c42',
    storyIntro: [
      '艾尔加西亚大陆，北境小村"零号镇"。',
      '少年林恩在祖父遗物中发现一颗发光弹珠，乌鸦"零"苏醒。',
      '"你是失落贤者的血脉，数字即万物。"',
      '林恩投下第一颗弹珠，钉子符文泛起微光。',
    ],
    storyEnding: [
      '遗迹大门在林恩面前开启。',
      '"去寻找贤者机器吧，"零说，"但记住，无限是危险的。"',
      '林恩离开村庄，踏上旅程。',
    ],
  },
  {
    id: 2, name: '符文觉醒', scene: '贤者遗迹 · 古老弹珠机废墟',
    targetGold: 1e8, bg: 0x0a1a2a, accent: '#5ad1ff',
    storyIntro: [
      '废墟中，古老弹珠机只剩骨架。',
      '零停在符文墙上："贤者曾用这些钉子创造财富。"',
      '林恩拾起 ×2 钉子符文，感受到熵增的低语。',
    ],
    storyEnding: [
      '遗迹中央浮现预言——"无限之金将引来虚无"。',
      '零的羽毛微微颤抖："这不是祝福，是警告。"',
    ],
  },
  {
    id: 3, name: '熵的预兆', scene: '金辉城 · 繁华都市',
    targetGold: 1e10, bg: 0x2a1a0a, accent: '#ffcc33',
    storyIntro: [
      '金辉城的贵族们用弹珠机榨取民财。',
      '林恩的暴击之力在此觉醒，数字开始失控。',
      '黄金弹从天空落下，城市却因金币泛滥而崩坏。',
    ],
    storyEnding: [
      '林恩站在钟楼之巅，看着龟裂的街道。',
      '"真正的贤者懂得节制，"他低语，"我要找到归零之法。"',
    ],
  },
  {
    id: 4, name: '归零之途', scene: '零之圣殿 · 极北圣地',
    targetGold: 1e12, bg: 0x101820, accent: '#ccccff',
    storyIntro: [
      '零之圣殿的冰柱映着圣火。',
      '圣殿记载：贤者机器本应在归零时重启世界。',
      '林恩是最后一个被赋予"归零权"的血脉。',
    ],
    storyEnding: [
      '贤者之灵显现："数之纪元的崩坏，正因先贤追求无限。"',
      '林恩握紧拳头，走向最终的贤者机器。',
    ],
  },
  {
    id: 5, name: '贤者归来', scene: '无限回廊 · 贤者机器核心',
    targetGold: 1e15, bg: 0x0a0a12, accent: '#aa88ff',
    storyIntro: [
      '无限回廊中，贤者机器轰鸣。',
      '贤者钉能复制数字，象征"无限"的诱惑。',
      '最终试炼：在 1e15 金币前，主动选择归零。',
    ],
    storyEnding: [
      '选择摆在林恩面前：归零，还是无限？',
      '世界的命运，由你决定。',
    ],
  },
];

export const CHAPTER_MAP: Record<number, ChapterConfig> = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

export const AUTO_DROPPERS: AutoDropperConfig[] = [
  {
    id: 'I', name: '自动投弹器 I', interval: 3.0, baseCost: 500, costGrowth: 1.7,
    speedUpgradeCost: 2000, speedUpgradeGrowth: 1.9, speedPerLevel: 0.15,
    maxSpeedLevel: 8, maxCount: 10, unlockChapter: 1, icon: 'auto1',
    desc: '每 3 秒自动投下 1 颗弹珠，可购买多个并升级速度',
  },
  {
    id: 'II', name: '自动投弹器 II', interval: 1.5, baseCost: 5000, costGrowth: 1.8,
    speedUpgradeCost: 20000, speedUpgradeGrowth: 2.1, speedPerLevel: 0.12,
    maxSpeedLevel: 8, maxCount: 10, unlockChapter: 2, icon: 'auto2',
    desc: '每 1.5 秒投 1 颗，比 I 型更快',
    prereq: { id: 'I', level: 5 },
  },
  {
    id: 'III', name: '自动投弹器 III', interval: 0.5, baseCost: 50000, costGrowth: 1.9,
    speedUpgradeCost: 200000, speedUpgradeGrowth: 2.3, speedPerLevel: 0.08,
    maxSpeedLevel: 6, maxCount: 5, unlockChapter: 3, icon: 'auto3',
    desc: '极速投弹器，每 0.5 秒投 1 颗',
    prereq: { id: 'II', level: 5 },
  },
  {
    id: 'multi', name: '多重投弹', interval: 1.0, baseCost: 100000, costGrowth: 2.1,
    speedUpgradeCost: 400000, speedUpgradeGrowth: 2.6, speedPerLevel: 0.1,
    maxSpeedLevel: 6, maxCount: 3, unlockChapter: 4, icon: 'double',
    desc: '每次投下 2 颗弹珠',
    prereq: { id: 'III', level: 3 },
  },
  {
    id: 'IV', name: '自动投弹器 IV', interval: 0.2, baseCost: 800000, costGrowth: 2.0,
    speedUpgradeCost: 3000000, speedUpgradeGrowth: 2.4, speedPerLevel: 0.05,
    maxSpeedLevel: 5, maxCount: 3, unlockChapter: 4, icon: 'auto3',
    desc: '超极速投弹器，每 0.2 秒投 1 颗',
    prereq: { id: 'III', level: 5 },
  },
  {
    id: 'multi3', name: '三重投弹', interval: 1.2, baseCost: 1500000, costGrowth: 2.2,
    speedUpgradeCost: 6000000, speedUpgradeGrowth: 2.8, speedPerLevel: 0.08,
    maxSpeedLevel: 5, maxCount: 2, unlockChapter: 5, icon: 'double',
    desc: '每次投下 3 颗弹珠',
    prereq: { id: 'multi', level: 3 },
  },
];

export const AUTO_MAP: Record<string, AutoDropperConfig> = Object.fromEntries(AUTO_DROPPERS.map((a) => [a.id, a]));

export const CRYSTAL_UPGRADES: CrystalUpgrade[] = [
  {
    id: 'goldBonus', name: '永久金币加成', maxLevel: 25, baseCost: 10, costGrowth: 1.4,
    effect: (lvl) => `全局金币 +${(lvl * 2)}%`,
    getValue: (lvl) => 1 + lvl * 0.02,
    icon: 'coin', desc: '每一周目都生效的金币加成', unlockChapter: 1,
  },
  {
    id: 'startGold', name: '初始金币', maxLevel: 10, baseCost: 20, costGrowth: 1.6,
    effect: (lvl) => `新周目开局金币 +${formatShort(lvl * 1000)}`,
    getValue: (lvl) => lvl * 1000,
    icon: 'box', desc: '每次归零后获得启动资金', unlockChapter: 2,
  },
  {
    id: 'crystalGain', name: '数晶获取', maxLevel: 15, baseCost: 30, costGrowth: 1.5,
    effect: (lvl) => `归零时数晶 +${(lvl * 5)}%`,
    getValue: (lvl) => 1 + lvl * 0.05,
    icon: 'crystal', desc: '提升每次归零获得的数晶', unlockChapter: 2,
  },
];

export const CRYSTAL_MAP: Record<string, CrystalUpgrade> = Object.fromEntries(CRYSTAL_UPGRADES.map((c) => [c.id, c]));

function formatShort(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
