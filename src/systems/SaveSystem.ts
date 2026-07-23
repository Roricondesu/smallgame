// 存档系统：LocalStorage 读写、版本迁移、离线收益计算

import type { SaveData } from '../types';
import { BALANCE } from '../types';
import { AUTO_DROPPERS } from '../data/chapters';

const SAVE_KEY = 'pinball_alchemy_save_v1';
const VERSION = '1.1.0';

export const DEFAULT_SAVE: SaveData = {
  version: VERSION,
  chapterId: 1,
  gold: 0,
  totalGold: 0,
  crystal: 0,
  ballInitialValue: 1,
  pegs: [],
  autoDroppers: [],
  skillLevels: {},
  crystalUpgrades: {},
  storyProgress: 'ch1_intro',
  lastSeen: Date.now(),
  stats: {
    totalBalls: 0,
    totalPegsPlaced: 0,
    totalGoldEarned: 0,
    highestBallValue: 0,
  },
};

export class SaveSystem {
  static load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return SaveSystem.migrate({});
      const parsed = JSON.parse(raw);
      return SaveSystem.migrate(parsed);
    } catch (e) {
      console.error('存档读取失败', e);
      return SaveSystem.migrate({});
    }
  }

  static save(data: SaveData) {
    try {
      data.lastSeen = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('存档写入失败', e);
      return false;
    }
  }

  static wipe() {
    localStorage.removeItem(SAVE_KEY);
  }

  static migrate(data: Partial<SaveData>): SaveData {
    const merged: SaveData = { ...DEFAULT_SAVE, ...data, stats: { ...DEFAULT_SAVE.stats, ...data.stats } };
    // 版本迁移：未来版本在此处处理字段变更
    merged.version = VERSION;
    if (!merged.pegs) merged.pegs = [];
    if (!merged.autoDroppers) merged.autoDroppers = [];
    if (!merged.skillLevels) merged.skillLevels = {};
    if (!merged.crystalUpgrades) merged.crystalUpgrades = {};
    return merged;
  }

  // 离线收益：基于已购买自动器的投放效率估算
  static calculateOffline(data: SaveData): { gold: number; seconds: number } {
    const now = Date.now();
    const maxSeconds = (BALANCE.offlineMaxHours + (data.skillLevels?.offlineMax || 0) * 3600) * 3600;
    const diff = Math.max(0, Math.min((now - data.lastSeen) / 1000, maxSeconds));
    if (diff <= 0 || data.autoDroppers.length === 0) return { gold: 0, seconds: 0 };

    let rate = 0; // 每秒投放弹珠数
    for (const id of data.autoDroppers) {
      const cfg = AUTO_DROPPERS.find((a) => a.id === id);
      if (cfg) rate += 1 / cfg.interval;
    }
    // 假设每颗弹珠平均收益为当前初始值的 100 倍（粗略估算）
    const avgValue = Math.max(1, data.ballInitialValue * 100);
    const gold = diff * rate * avgValue * 0.5;
    return { gold: Math.floor(gold), seconds: diff };
  }
}
