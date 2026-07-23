// 钉子（运算符）配置表

import type { PegConfig } from '../types';

export const PEG_TYPES: PegConfig[] = [
  {
    id: 'plus1', name: '+1 钉', operator: '+', operand: 1, growth: 1,
    baseCost: 10, costGrowth: 1.5, color: 0x3fb950, icon: 'plus',
    unlockChapter: 1, desc: '弹珠数值 +1，升级后每次 +1', maxLevel: 50,
  },
  {
    id: 'plus5', name: '+5 钉', operator: '+', operand: 5, growth: 2,
    baseCost: 80, costGrowth: 1.6, color: 0x2db7a3, icon: 'plus',
    unlockChapter: 2, desc: '弹珠数值 +5，适合中期加法放大', maxLevel: 40,
  },
  {
    id: 'plus10', name: '+10 钉', operator: '+', operand: 10, growth: 3,
    baseCost: 500, costGrowth: 1.7, color: 0x56d4dd, icon: 'plus',
    unlockChapter: 3, desc: '弹珠数值 +10，后期加法放大', maxLevel: 30,
  },
  {
    id: 'mul12', name: '×1.2 钉', operator: '*', operand: 1.2, growth: 0.1,
    baseCost: 200, costGrowth: 1.8, color: 0xf0b429, icon: 'multiply',
    unlockChapter: 1, desc: '弹珠数值 ×1.2，升级后倍率提升', maxLevel: 30,
  },
  {
    id: 'mul2', name: '×2 钉', operator: '*', operand: 2, growth: 0.15,
    baseCost: 2000, costGrowth: 2.0, color: 0xd97757, icon: 'multiply',
    unlockChapter: 2, desc: '弹珠数值 ×2，强力倍增', maxLevel: 20,
  },
  {
    id: 'div2', name: '÷2 钉', operator: '/', operand: 2, growth: 0,
    baseCost: 50, costGrowth: 1.4, color: 0xf85149, icon: 'divide',
    unlockChapter: 1, desc: '弹珠数值 ÷2，用于策略性复位', maxLevel: 10,
  },
  {
    id: 'square', name: '^2 钉', operator: '^', operand: 2, growth: 0,
    baseCost: 50000, costGrowth: 2.5, color: 0x8b949e, icon: 'power',
    unlockChapter: 4, desc: '弹珠数值平方，指数爆炸', maxLevel: 10,
  },
  {
    id: 'addPercent', name: '+10% 钉', operator: 'addPercent', operand: 0.1, growth: 0.02,
    baseCost: 1500, costGrowth: 1.9, color: 0x79c0ff, icon: 'chart',
    unlockChapter: 2, desc: '弹珠数值 +10%，随等级提升百分比', maxLevel: 25,
  },
  {
    id: 'maxMul', name: 'max(×2,×3) 钉', operator: 'maxMul', operand: 0, growth: 0.1,
    baseCost: 12000, costGrowth: 2.2, color: 0xffa198, icon: 'double',
    unlockChapter: 3, desc: '至少 ×2，升级后概率 ×3', maxLevel: 15,
  },
  {
    id: 'sage', name: '贤者钉', operator: '%', operand: 0, growth: 0,
    baseCost: 200000, costGrowth: 2.0, color: 0xffffff, icon: 'sage',
    unlockChapter: 5, desc: '复制当前弹珠数值给下一颗弹珠', maxLevel: 5,
  },
];

export const PEG_MAP: Record<string, PegConfig> = Object.fromEntries(PEG_TYPES.map((p) => [p.id, p]));
