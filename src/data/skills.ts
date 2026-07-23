// 技能与升级配置表

import type { SkillConfig } from '../types';

export const SKILLS: SkillConfig[] = [
  // 手动系
  {
    id: 'initialValue', name: '初始弹珠数字', category: 'manual', maxLevel: 20,
    baseCost: 50, costGrowth: 1.7, unlockChapter: 1,
    effect: (lvl) => `初始值提升至 ${[1,5,10,25,50,100,250,500,1000,2500,5000,10000][lvl] ?? 10000 * Math.pow(2, lvl-11)}`,
    icon: 'ball', desc: '提升每次投下的弹珠起始数值',
  },
  {
    id: 'chargeThrow', name: '蓄力投掷', category: 'manual', maxLevel: 10,
    baseCost: 300, costGrowth: 1.8, unlockChapter: 1,
    effect: (lvl) => `手动弹珠额外 +${(lvl * 10)}%`,
    getValue: (lvl) => 1 + lvl * 0.1,
    icon: 'charge', desc: '手动点击投下的弹珠获得加成',
  },
  {
    id: 'multiThrow', name: '多重投掷', category: 'manual', maxLevel: 5,
    baseCost: 800, costGrowth: 2.5, unlockChapter: 2,
    effect: (lvl) => `同时投下 ${1 + lvl} 颗弹珠`,
    getValue: (lvl) => 1 + lvl,
    icon: 'double', desc: '每次点击额外投下弹珠',
  },
  {
    id: 'critRate', name: '暴击率', category: 'manual', maxLevel: 10,
    baseCost: 500, costGrowth: 1.9, unlockChapter: 1,
    effect: (lvl) => `碰撞暴击率 +${(lvl * 2)}%`,
    getValue: (lvl) => lvl * 0.02,
    icon: 'crit', desc: '弹珠碰撞钉子时概率暴击',
  },
  {
    id: 'critDmg', name: '暴击伤害', category: 'manual', maxLevel: 10,
    baseCost: 1000, costGrowth: 2.0, unlockChapter: 2,
    effect: (lvl) => `暴击倍率 ×${(2 + lvl * 0.25).toFixed(2)}`,
    getValue: (lvl) => 2 + lvl * 0.25,
    icon: 'critDmg', desc: '暴击时获得更高倍率',
  },
  // 自动系
  {
    id: 'autoCrit', name: '自动暴击', category: 'auto', maxLevel: 5,
    baseCost: 3000, costGrowth: 2.2, unlockChapter: 2,
    effect: (lvl) => `自动弹珠暴击率 +${(lvl * 5)}%`,
    getValue: (lvl) => lvl * 0.05,
    icon: 'autoCrit', desc: '自动器投下的弹珠也享受暴击',
  },
  {
    id: 'smartDrop', name: '智能投放', category: 'auto', maxLevel: 1,
    baseCost: 500000, costGrowth: 1, unlockChapter: 4,
    effect: () => '自动器优先选择高收益落点',
    icon: 'smart', desc: '自动投弹器变得更聪明',
  },
  {
    id: 'offlineMax', name: '离线时长', category: 'auto', maxLevel: 16,
    baseCost: 200000, costGrowth: 1.6, unlockChapter: 2,
    effect: (lvl) => `离线上限 +${lvl} 小时`,
    getValue: (lvl) => lvl,
    icon: 'offline', desc: '延长离线收益结算时间',
  },
  // 全局系
  {
    id: 'gravity', name: '重力调节', category: 'global', maxLevel: 10,
    baseCost: 400, costGrowth: 1.7, unlockChapter: 1,
    effect: (lvl) => `下落速度 +${(lvl * 10)}%`,
    getValue: (lvl) => 1 + lvl * 0.1,
    icon: 'gravity', desc: '弹珠下落更快，结算更频繁',
  },
  {
    id: 'capacity', name: '弹珠容量', category: 'global', maxLevel: 10,
    baseCost: 600, costGrowth: 1.8, unlockChapter: 1,
    effect: (lvl) => `同屏弹珠上限 +${(lvl * 5)}`,
    getValue: (lvl) => lvl * 5,
    icon: 'box', desc: '允许更多弹珠同时存在',
  },
  {
    id: 'capacityPegs', name: '钉子容量', category: 'global', maxLevel: 10,
    baseCost: 1000, costGrowth: 1.9, unlockChapter: 1,
    effect: (lvl) => `钉子数量上限 +${(lvl * 3)}`,
    getValue: (lvl) => lvl * 3,
    icon: 'pin', desc: '可放置更多钉子',
  },
  {
    id: 'goldBonus', name: '金币加成', category: 'global', maxLevel: 20,
    baseCost: 1500, costGrowth: 1.8, unlockChapter: 1,
    effect: (lvl) => `结算金币 +${(lvl * 5)}%`,
    getValue: (lvl) => lvl * 0.05,
    icon: 'coin', desc: '所有弹珠结算金币提升',
  },
  {
    id: 'sageBlueprint', name: '贤者蓝图', category: 'global', maxLevel: 5,
    baseCost: 50000, costGrowth: 2.5, unlockChapter: 3,
    effect: (lvl) => `钉子等级上限 +${(lvl * 2)}`,
    getValue: (lvl) => lvl * 2,
    icon: 'matrix', desc: '突破单颗钉子的等级上限',
  },
  // 主动技能
  {
    id: 'frenzy', name: '狂热', category: 'active', maxLevel: 1,
    baseCost: 5000, costGrowth: 1, unlockChapter: 1,
    effect: () => '10 秒内手动投放不消耗间隔且连击×2',
    cooldown: 60, duration: 10,
    icon: 'frenzy', desc: '短时间内爆发式手动投弹',
  },
  {
    id: 'goldenRain', name: '黄金雨', category: 'active', maxLevel: 1,
    baseCost: 20000, costGrowth: 1, unlockChapter: 2,
    effect: () => '8 秒内所有弹珠视为黄金弹（×1.5）',
    cooldown: 120, duration: 8,
    icon: 'rain', desc: '弹珠全部变成黄金弹',
  },
  {
    id: 'blast', name: '爆破', category: 'active', maxLevel: 1,
    baseCost: 8000, costGrowth: 1, unlockChapter: 2,
    effect: () => '立即结算屏幕上所有弹珠',
    cooldown: 90, duration: 0,
    icon: 'blast', desc: '一键回收全部弹珠',
  },
  {
    id: 'slowdown', name: '时缓', category: 'active', maxLevel: 1,
    baseCost: 12000, costGrowth: 1, unlockChapter: 3,
    effect: () => '12 秒内物理时间减半，便于观察',
    cooldown: 150, duration: 12,
    icon: 'snail', desc: '减速世界，看清每次运算',
  },
  {
    id: 'rhythm', name: '律动', category: 'active', maxLevel: 1,
    baseCost: 25000, costGrowth: 1, unlockChapter: 3,
    effect: () => '15 秒内自动器效率翻倍',
    cooldown: 180, duration: 15,
    icon: 'rhythm', desc: '自动投弹器超速运转',
  },
];

export const SKILL_MAP: Record<string, SkillConfig> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const ACTIVE_SKILLS = SKILLS.filter((s) => s.category === 'active');
