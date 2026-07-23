// 钉子（运算符）配置表

import type { PegConfig } from '../types';

export const PEG_TYPES: PegConfig[] = [
  // 加法系
  {
    id: 'plus1', name: '+1 钉', operator: '+', operand: 1, growth: 1,
    baseCost: 10, costGrowth: 1.6, color: 0x3fb950, icon: 'plus',
    desc: '弹珠数值 +1，升级后每次 +1', maxLevel: 50,
  },
  {
    id: 'plus5', name: '+5 钉', operator: '+', operand: 5, growth: 2,
    baseCost: 80, costGrowth: 1.7, color: 0x2db7a3, icon: 'plus',
    desc: '弹珠数值 +5，适合中期加法放大', maxLevel: 40,
    prereq: { id: 'plus1', level: 5 }, prereqBonusLevels: 5,
  },
  {
    id: 'plus10', name: '+10 钉', operator: '+', operand: 10, growth: 3,
    baseCost: 500, costGrowth: 1.8, color: 0x56d4dd, icon: 'plus',
    desc: '弹珠数值 +10，后期加法放大', maxLevel: 30,
    prereq: { id: 'plus5', level: 5 }, prereqBonusLevels: 5,
  },
  {
    id: 'plus25', name: '+25 钉', operator: '+', operand: 25, growth: 5,
    baseCost: 4000, costGrowth: 1.9, color: 0x1f6feb, icon: 'plus',
    desc: '弹珠数值 +25，高阶加法放大', maxLevel: 25,
    prereq: { id: 'plus10', level: 5 }, prereqBonusLevels: 5,
  },
  // 乘法系
  {
    id: 'mul12', name: '×1.2 钉', operator: '*', operand: 1.2, growth: 0.1,
    baseCost: 200, costGrowth: 1.9, color: 0xf0b429, icon: 'multiply',
    desc: '弹珠数值 ×1.2，升级后倍率提升', maxLevel: 30,
  },
  {
    id: 'mul2', name: '×2 钉', operator: '*', operand: 2, growth: 0.15,
    baseCost: 2000, costGrowth: 2.1, color: 0xd97757, icon: 'multiply',
    desc: '弹珠数值 ×2，强力倍增', maxLevel: 20,
    prereq: { id: 'mul12', level: 5 }, prereqBonusLevels: 5,
  },
  {
    id: 'mul3', name: '×3 钉', operator: '*', operand: 3, growth: 0.2,
    baseCost: 30000, costGrowth: 2.3, color: 0xbc8cff, icon: 'multiply',
    desc: '弹珠数值 ×3，高阶倍增', maxLevel: 15,
    prereq: { id: 'mul2', level: 5 }, prereqBonusLevels: 5,
  },
  // 除法系
  {
    id: 'div2', name: '÷2 钉', operator: '/', operand: 2, growth: 0,
    baseCost: 50, costGrowth: 1.5, color: 0xf85149, icon: 'divide',
    desc: '弹珠数值 ÷2，用于策略性复位', maxLevel: 10,
  },
  {
    id: 'div3', name: '÷3 钉', operator: '/', operand: 3, growth: 0,
    baseCost: 1500, costGrowth: 1.7, color: 0xff7b72, icon: 'divide',
    desc: '弹珠数值 ÷3，更激进的复位', maxLevel: 8,
    prereq: { id: 'div2', level: 5 }, prereqBonusLevels: 3,
  },
  // 指数系：1.02 次方，升级 +0.02
  {
    id: 'square', name: '^1.02 钉', operator: '^', operand: 1.02, growth: 0.02,
    baseCost: 50000, costGrowth: 2.6, color: 0x8b949e, icon: 'power',
    desc: '弹珠数值 1.02 次方，升级后指数 +0.02', maxLevel: 20,
    prereq: { id: 'mul3', level: 5 }, prereqBonusLevels: 5,
  },
  // 百分比系
  {
    id: 'addPercent', name: '+10% 钉', operator: 'addPercent', operand: 0.1, growth: 0.02,
    baseCost: 1500, costGrowth: 2.0, color: 0x79c0ff, icon: 'chart',
    desc: '弹珠数值 +10%，随等级提升百分比', maxLevel: 25,
    prereq: { id: 'div2', level: 5 }, prereqBonusLevels: 5,
  },
  {
    id: 'addPercent25', name: '+25% 钉', operator: 'addPercent', operand: 0.25, growth: 0.05,
    baseCost: 20000, costGrowth: 2.2, color: 0xa371f7, icon: 'chart',
    desc: '弹珠数值 +25%，高阶百分比', maxLevel: 20,
    prereq: { id: 'addPercent', level: 5 }, prereqBonusLevels: 5,
  },
  // 保底倍数系
  {
    id: 'maxMul', name: 'max(×2,×3) 钉', operator: 'maxMul', operand: 0, growth: 0.1,
    baseCost: 12000, costGrowth: 2.3, color: 0xffa198, icon: 'double',
    desc: '至少 ×2，升级后概率 ×3', maxLevel: 15,
    prereq: { id: 'square', level: 5 }, prereqBonusLevels: 5,
  },
  // 贤者系
  {
    id: 'sage', name: '贤者钉', operator: '%', operand: 0, growth: 0,
    baseCost: 200000, costGrowth: 2.1, color: 0xffffff, icon: 'sage',
    desc: '复制当前弹珠数值给下一颗弹珠', maxLevel: 5,
    prereq: { id: 'maxMul', level: 5 }, prereqBonusLevels: 3,
  },
];

export const PEG_MAP: Record<string, PegConfig> = Object.fromEntries(PEG_TYPES.map((p) => [p.id, p]));
