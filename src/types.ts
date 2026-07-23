// 游戏类型定义

export interface PegSave {
  id: string;
  typeId: string;
  x: number; // grid x
  y: number; // grid y
  level: number;
}

export interface AutoDropperSave {
  id: string;
  owned: boolean;
}

export interface SkillSave {
  id: string;
  level: number;
}

export interface CrystalShopSave {
  id: string;
  level: number;
}

export interface ActiveSkillState {
  id: string;
  readyAt: number; // 下次可用时间戳 ms
  expiresAt: number; // 效果结束时间戳 ms
}

export interface GameStats {
  totalBalls: number;
  totalGold: number;
  totalPegsPlaced: number;
  highestGold: number;
  highestBallValue: number;
  manualClicks: number;
  endings: Record<string, boolean>;
}

export interface SaveData {
  version: string;
  chapterId: number;
  gold: number;
  crystal: number;
  ballInitialValue: number;
  pegs: PegSave[];
  autoDroppers: Record<string, boolean>;
  skills: Record<string, number>; // 被动/自动技能等级
  crystalShop: Record<string, number>;
  activeStates: Record<string, ActiveSkillState>;
  storyProgress: string;
  lastSeen: number;
  stats: GameStats;
  pegCapacity: number;
}

export interface PegType {
  id: string;
  name: string;
  operator: '+' | '*' | '/' | '^' | '%' | 'max' | 'chain';
  operand: number;
  growth: number; // 每级提升量
  baseCost: number;
  costGrowth: number; // 价格增长倍率
  unlockChapter: number;
  color: number;
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
  unlockChapter: number;
  effect: (level: number) => string;
  apply: (state: SaveData, level: number) => void;
  icon: string; // 对应 ui/icons.ts 的 IconKey
  desc: string;
  cooldown?: number; // active 冷却秒数
  duration?: number; // active 持续秒数
}

export interface AutoDropperConfig {
  id: string;
  name: string;
  interval: number; // 秒
  cost: number;
  unlockChapter: number;
  icon: string;
}

export interface CrystalShopItem {
  id: string;
  name: string;
  cost: number;
  maxLevel: number;
  effect: (level: number) => string;
  apply: (state: SaveData, level: number) => void;
  icon: string;
}

export interface ChapterConfig {
  id: number;
  name: string;
  scene: string;
  targetGold: number;
  bg: string;
  accent: string;
  unlockPegs: string[];
  storyIntro: string[];
  storyEnding: string[];
}
