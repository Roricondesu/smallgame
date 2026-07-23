// 全局类型定义

export interface PegSave {
  id: string;
  typeId: string;
  x: number;
  y: number;
  level: number;
}

export interface SaveData {
  version: string;
  chapterId: number;
  gold: number;
  totalGold: number;
  crystal: number;
  ballInitialValue: number;
  pegs: PegSave[];
  autoDroppers: string[];
  skillLevels: Record<string, number>;
  crystalUpgrades: Record<string, number>;
  storyProgress: string;
  lastSeen: number;
  stats: {
    totalBalls: number;
    totalPegsPlaced: number;
    totalGoldEarned: number;
    highestBallValue: number;
  };
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
  unlockChapter: number;
  desc: string;
  maxLevel: number;
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
  unlockChapter?: number;
}

export interface AutoDropperConfig {
  id: string;
  name: string;
  interval: number;
  cost: number;
  unlockChapter: number;
  icon: import('./ui/icons').IconKey;
}

export interface ChapterConfig {
  id: number;
  name: string;
  scene: string;
  targetGold: number;
  bg: number;
  accent: string;
  storyIntro: string[];
  storyEnding: string[];
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
