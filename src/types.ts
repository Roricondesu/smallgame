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
  marbles?: Record<string, number>;
  // 当前选中的弹珠元素 ID，'' 表示使用普通弹珠
  selectedMarble?: string;
  // 已观看过对话的 ID 集合（避免重复播放）
  seenDialogues?: string[];
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

/** 元素弹珠配置：不同弹珠有不同效果与元素 */
export interface MarbleConfig {
  id: string;
  name: string;
  element: 'fire' | 'ice' | 'thunder' | 'poison' | 'holy' | 'dark';
  color: number;
  /** 每章自动补充的使用次数 */
  charges: number;
  /** 效果简述（HUD 展示用） */
  effect: string;
  desc: string;
  /** 释放时触发：返回特殊倍率（作用于本球），或副作用描述 */
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
