// 存档系统：LocalStorage 读写、版本迁移、离线收益计算
// 大数值字段使用 BigInt（内部 ×100 缩放，两位小数精度）。
// 序列化时 bigint 包装为 { __bigint__: "..." }，加载时还原。

import type { SaveData, AutoDropperSave } from '../types';
import { BALANCE } from '../types';
import { AUTO_MAP } from '../data/chapters';
import { toBig, fromBig } from './BigNum';

const SAVE_KEY = 'pinball_alchemy_save_v1';
const VERSION = '1.3.0';

export const DEFAULT_SAVE: SaveData = {
  version: VERSION,
  chapterId: 1,
  gold: 0n,
  totalGold: 0n,
  crystal: 0n,
  ballInitialValue: toBig(1), // 100n，代表原值 1
  pegs: [],
  autoDroppers: {},
  skillLevels: {},
  crystalUpgrades: {},
  storyProgress: 'ch1_intro',
  lastSeen: Date.now(),
  stats: {
    totalBalls: 0,
    totalPegsPlaced: 0,
    totalGoldEarned: 0n,
    highestBallValue: 0n,
  },
};

export class SaveSystem {
  static load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return SaveSystem.migrate({});
      const parsed = JSON.parse(raw, (_k, v) => {
        // 还原 bigint：保存时包装为 { __bigint__: "..." }
        if (v && typeof v === 'object' && '__bigint__' in v) {
          return BigInt((v as { __bigint__: string }).__bigint__);
        }
        return v;
      });
      return SaveSystem.migrate(parsed);
    } catch (e) {
      console.error('存档读取失败', e);
      return SaveSystem.migrate({});
    }
  }

  static save(data: SaveData) {
    try {
      data.lastSeen = Date.now();
      // bigint 字段包装为 { __bigint__: "..." }，普通字段原样
      const json = JSON.stringify(data, (_k, v) => {
        if (typeof v === 'bigint') return { __bigint__: v.toString() };
        return v;
      });
      localStorage.setItem(SAVE_KEY, json);
      return true;
    } catch (e) {
      console.error('存档写入失败', e);
      return false;
    }
  }

  static wipe() {
    localStorage.removeItem(SAVE_KEY);
  }

  static migrate(data: Partial<SaveData> & Record<string, unknown>): SaveData {
    const merged: SaveData = {
      ...DEFAULT_SAVE,
      ...(data as SaveData),
      stats: { ...DEFAULT_SAVE.stats, ...(data.stats as SaveData['stats']) },
    };
    merged.version = VERSION;
    if (!merged.pegs) merged.pegs = [];

    // 迁移旧版 autoDroppers（string[] -> Record<string, AutoDropperSave>）
    if (Array.isArray(merged.autoDroppers)) {
      const old = merged.autoDroppers as unknown as string[];
      const migrated: Record<string, AutoDropperSave> = {};
      for (const id of old) migrated[id] = { count: 1, speedLevel: 0 };
      merged.autoDroppers = migrated;
    } else if (!merged.autoDroppers) {
      merged.autoDroppers = {};
    }

    if (!merged.skillLevels) merged.skillLevels = {};
    if (!merged.crystalUpgrades) merged.crystalUpgrades = {};

    // 迁移旧版 number → bigint（×100 缩放）
    // 旧存档的数值字段是 number，新存档已经是 bigint（通过 reviver 还原）
    const numToBig = (v: unknown): bigint => {
      if (typeof v === 'bigint') return v;
      if (typeof v === 'number') return toBig(v);
      return 0n;
    };
    merged.gold = numToBig(merged.gold);
    merged.totalGold = numToBig(merged.totalGold);
    merged.crystal = numToBig(merged.crystal);
    merged.ballInitialValue = numToBig(merged.ballInitialValue);
    if (merged.ballInitialValue === 0n) merged.ballInitialValue = toBig(1);
    merged.stats.totalGoldEarned = numToBig(merged.stats.totalGoldEarned);
    merged.stats.highestBallValue = numToBig(merged.stats.highestBallValue);

    return merged;
  }

  // 离线收益：基于已购买自动器的投放效率估算
  static calculateOffline(data: SaveData): { gold: bigint; seconds: number } {
    const now = Date.now();
    const maxHours = BALANCE.offlineMaxHours + (data.skillLevels?.offlineMax || 0);
    const maxSeconds = maxHours * 3600;
    const diff = Math.max(0, Math.min((now - data.lastSeen) / 1000, maxSeconds));
    if (diff <= 0) return { gold: 0n, seconds: 0 };

    let rate = 0;
    for (const [id, info] of Object.entries(data.autoDroppers)) {
      const cfg = AUTO_MAP[id];
      if (!cfg || info.count <= 0) continue;
      const speedMul = 1 - info.speedLevel * cfg.speedPerLevel;
      const interval = cfg.interval * Math.max(0.1, speedMul);
      const mulMatch = cfg.id.match(/^multi(\d+)?$/);
      const mul = mulMatch ? (mulMatch[1] ? parseInt(mulMatch[1], 10) : 2) : 1;
      rate += (info.count * mul) / interval;
    }
    if (rate <= 0) return { gold: 0n, seconds: diff };

    const offlineRateMul = 1 + (data.skillLevels?.offlineRate || 0) * 0.1;
    // ballInitialValue 是缩放 bigint，原值 = biv / SCALE
    // 原版 avgValue = ballInitialValue原值 × 100，恰好等于 biv（缩放值）作为 number 估算
    const avgValueOrig = Math.max(1, fromBig(data.ballInitialValue) * 100);
    const goldOrig = diff * rate * avgValueOrig * 0.5 * offlineRateMul;
    return { gold: toBig(Math.floor(goldOrig)), seconds: diff };
  }
}
