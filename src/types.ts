// 全局类型定义

export interface PegSave {
  id: string;
  typeId: string;
  x: number;
  y: number;
  level: number;
}

/** 自动器存档：id -> { count: 拥有数量, speedLevel: 速度升级等级 } */
export interface AutoDropperSave {
  count: number;
  speedLevel: number;
}

export interface SaveData {
  version: string;
  chapterId: number;
  // 大数值字段用 BigInt（内部已 ×100 缩放，保留两位小数精度）
  gold: bigint;
  totalGold: bigint;
  crystal: bigint;
  ballInitialValue: bigint;
  pegs: PegSave[];
  autoDroppers: Record<string, AutoDropperSave>;
  skillLevels: Record<string, number>;
  crystalUpgrades: Record<string, number>;
  storyProgress: string;
  lastSeen: number;
  stats: {
    totalBalls: number;
    totalPegsPlaced: number;
    totalGoldEarned: bigint;
    highestBallValue: bigint;
  };
  // 弹珠系统：每种元素弹珠的剩余使用次数（每章自动补充）
  marbles?: Record<string, MarbleSave>;
  // 当前选中的弹珠元素 ID（手动投放使用），'' 表示使用普通弹珠
  selectedMarble?: string;
  // 已观看过对话的 ID 集合（避免重复播放）
  seenDialogues?: string[];
  // Boss 战击败记录：bossId -> 是否已击败（章节内）
  bossDefeated?: Record<string, boolean>;
  // 最大已解锁章节（1..5）。归零后可重玩已解锁章节
  maxChapterUnlocked?: number;
  // 无尽模式是否解锁（5 章全部通关后开启）
  endlessUnlocked?: boolean;
  // 是否处于无尽模式（无尽模式下无目标金币，持续挂机）
  endlessMode?: boolean;
  // 无尽模式已击败的 boss 阶层（每达到一个阈值触发一次 boss，击败后 +1）
  endlessBossTier?: number;
  // 底部结算槽位倍率（5 个槽位，基础 1.0，每次升级 +0.1，永久生效）
  slotMultipliers?: number[];
}

export interface PegConfig {
  id: string;
  name: string;
  operator: '+' | '*' | '/' | '^' | '%' | 'addPercent' | 'maxMul';
  operand: number;
  growth: number;
  baseCost: number;
  costGrowth: number;
  color: number;
  icon: import('./ui/icons').IconKey;
  desc: string;
  maxLevel: number;
  /** 前置：需要前置钉子放置数量达到 level 才解锁，并额外 +prereqBonusLevels 等级上限 */
  prereq?: { id: string; level: number };
  prereqBonusLevels?: number;
}

export interface SkillConfig {
  id: string;
  name: string;
  category: 'manual' | 'auto' | 'global' | 'active';
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  effect: (level: number) => string;
  getValue?: (level: number) => number;
  cooldown?: number;
  duration?: number;
  icon: import('./ui/icons').IconKey;
  desc: string;
  /** 前置：需要前置技能等级达到 level 才解锁，并额外 +prereqBonusLevels 等级上限 */
  prereq?: { id: string; level: number };
  prereqBonusLevels?: number;
}

export interface AutoDropperConfig {
  id: string;
  name: string;
  interval: number;
  baseCost: number;
  costGrowth: number;
  speedUpgradeCost: number;
  speedUpgradeGrowth: number;
  speedPerLevel: number;
  maxSpeedLevel: number;
  maxCount: number;
  icon: import('./ui/icons').IconKey;
  desc: string;
  /** 前置：需要前置自动器购买数量达到 level 才解锁 */
  prereq?: { id: string; level: number };
}

export interface ChapterConfig {
  id: number;
  name: string;
  scene: string;
  targetGold: bigint;
  bg: number;
  accent: string;
}

export interface CrystalUpgrade {
  id: string;
  name: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  effect: (level: number) => string;
  getValue: (level: number) => number;
  icon: import('./ui/icons').IconKey;
  desc: string;
}

/** 元素弹珠存档：owned 是否已购买（永久拥有），level 当前升级等级（1=刚购买） */
export interface MarbleSave {
  owned: boolean;
  level: number;
}

/** 元素弹珠配置：购买后永久拥有，可升级，提升效果与自动触发概率 */
export interface MarbleConfig {
  id: string;
  name: string;
  element: 'fire' | 'ice' | 'thunder' | 'poison' | 'holy' | 'dark';
  color: number;
  /** 一次性购买成本（金币） */
  purchaseCost: number;
  /** 升级基础成本（金币） */
  upgradeBaseCost: number;
  /** 升级成本每级增长系数 */
  upgradeGrowth: number;
  /** 最大升级等级（含初始 1 级） */
  maxLevel: number;
  /** 当前等级效果值：火/冰/毒/圣/暗为倍率，雷为链击钉子数 */
  getValue: (level: number) => number;
  /** 当前等级自动投放权重（与普通弹珠权重 10 + 其他弹珠权重之和参与加权随机） */
  getAutoWeight: (level: number) => number;
  /** 当前等级效果简述（HUD 展示） */
  effect: (level: number) => string;
  desc: string;
}

export const BALANCE = {
  gridCols: 12,
  gridRows: 16,
  cellSize: 42,
  pegGridTopOffset: 96,
  bottomSlots: 5,
  gravityBase: 400,
  maxBallsBase: 50,
  offlineMaxHours: 8,
  critChanceBase: 0.05,
  goldMulBase: 1,
  sellReturnRate: 0.5,
  maxPegsBase: 10,
  maxPegLevelBase: 10,
} as const;
