// 存档系统：LocalStorage 读写、版本迁移、离线收益计算
// 大数值字段使用 BigInt（内部 ×100 缩放，两位小数精度）。
// 序列化时 bigint 包装为 { __bigint__: "..." }，加载时还原。
// 支持 3 个独立存档槽位：key 形如 pinball_alchemy_save_v1_slot${slot}。

import type { SaveData, AutoDropperSave, MarbleSave } from '../types';
import { BALANCE } from '../types';
import { AUTO_MAP } from '../data/chapters';
import { CHAPTERS, CHAPTER_MAP } from '../data/chapters';
import { MARBLES } from '../data/marbles';
import { toBig, fromBig } from './BigNum';

const SAVE_KEY_PREFIX = 'pinball_alchemy_save_v1_slot';
const LEGACY_SAVE_KEY = 'pinball_alchemy_save_v1'; // 旧版单槽位存档，迁移到 slot 0
const ACTIVE_SLOT_KEY = 'pinball_alchemy_active_slot';

export const SLOT_COUNT = 3;

function slotKey(slot: number): string {
  return `${SAVE_KEY_PREFIX}${slot}`;
}

const VERSION = '1.4.0';

export const DEFAULT_SAVE: SaveData = {
  version: VERSION,
  chapterId: 1,
  gold: toBig(100), // 初始 100 金币（缩放值 10000n）
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

/** 槽位元信息（用于主菜单展示，无需加载完整存档） */
export interface SlotMeta {
  slot: number;
  exists: boolean;
  chapterId: number;
  chapterName: string;
  gold: bigint;
  crystal: bigint;
  lastSeen: number;
  totalBalls: number;
}

export class SaveSystem {
  // 当前活动槽位（-1 表示未选择，仅在 GameState 初始化前的过渡态）
  static currentSlot: number = 0;

  /** 读取 localStorage 中的活动槽位（用于启动时恢复） */
  static readActiveSlot(): number {
    const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 && n < SLOT_COUNT ? n : 0;
  }

  static setActiveSlot(slot: number) {
    this.currentSlot = slot;
    try { localStorage.setItem(ACTIVE_SLOT_KEY, String(slot)); } catch { /* 忽略 */ }
  }

  static slotExists(slot: number): boolean {
    return localStorage.getItem(slotKey(slot)) !== null;
  }

  static loadSlot(slot: number): SaveData {
    try {
      const raw = localStorage.getItem(slotKey(slot));
      if (!raw) {
        // 首次：尝试把旧版单槽位存档迁移到 slot 0
        if (slot === 0) {
          const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
          if (legacy) {
            const parsed = JSON.parse(legacy, reviver);
            return SaveSystem.migrate(parsed);
          }
        }
        return SaveSystem.migrate({});
      }
      const parsed = JSON.parse(raw, reviver);
      return SaveSystem.migrate(parsed);
    } catch (e) {
      console.error(`存档读取失败 slot=${slot}`, e);
      return SaveSystem.migrate({});
    }
  }

  static saveSlot(slot: number, data: SaveData): boolean {
    try {
      data.lastSeen = Date.now();
      const json = JSON.stringify(data, replacer);
      localStorage.setItem(slotKey(slot), json);
      return true;
    } catch (e) {
      console.error(`存档写入失败 slot=${slot}`, e);
      return false;
    }
  }

  static wipeSlot(slot: number) {
    localStorage.removeItem(slotKey(slot));
  }

  /** 读取槽位元信息（轻量，不解析完整存档） */
  static getSlotMeta(slot: number): SlotMeta {
    const base: SlotMeta = {
      slot, exists: false,
      chapterId: 1, chapterName: CHAPTERS[0].name,
      gold: 0n, crystal: 0n, lastSeen: 0, totalBalls: 0,
    };
    try {
      const raw = localStorage.getItem(slotKey(slot));
      if (!raw) {
        // 兼容旧版单槽位存档 → slot 0
        if (slot === 0) {
          const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
          if (legacy) {
            const parsed = JSON.parse(legacy, reviver) as SaveData;
            return {
              slot, exists: true,
              chapterId: parsed.chapterId ?? 1,
              chapterName: CHAPTER_MAP[parsed.chapterId ?? 1]?.name ?? CHAPTERS[0].name,
              gold: parsed.gold ?? 0n,
              crystal: parsed.crystal ?? 0n,
              lastSeen: parsed.lastSeen ?? 0,
              totalBalls: parsed.stats?.totalBalls ?? 0,
            };
          }
        }
        return base;
      }
      const parsed = JSON.parse(raw, reviver) as SaveData;
      return {
        slot, exists: true,
        chapterId: parsed.chapterId ?? 1,
        chapterName: CHAPTER_MAP[parsed.chapterId ?? 1]?.name ?? CHAPTERS[0].name,
        gold: parsed.gold ?? 0n,
        crystal: parsed.crystal ?? 0n,
        lastSeen: parsed.lastSeen ?? 0,
        totalBalls: parsed.stats?.totalBalls ?? 0,
      };
    } catch {
      return base;
    }
  }

  // ===== 旧 API（基于 currentSlot）兼容 =====
  static load(): SaveData { return SaveSystem.loadSlot(SaveSystem.currentSlot); }
  static save(data: SaveData): boolean { return SaveSystem.saveSlot(SaveSystem.currentSlot, data); }
  static wipe(): void { SaveSystem.wipeSlot(SaveSystem.currentSlot); }

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
    if (!merged.marbles) merged.marbles = {};
    if (merged.selectedMarble === undefined) merged.selectedMarble = '';
    if (!merged.seenDialogues) merged.seenDialogues = [];
    if (!merged.bossDefeated) merged.bossDefeated = {};
    // 章节解锁/无尽模式迁移：旧档默认仅解锁第 1 章，无尽关闭
    if (merged.maxChapterUnlocked == null) {
      merged.maxChapterUnlocked = Math.max(1, merged.chapterId ?? 1);
    }
    if (merged.endlessUnlocked == null) merged.endlessUnlocked = false;
    if (merged.endlessMode == null) merged.endlessMode = false;

    // 迁移旧版弹珠（Record<string, number> 充次数 → Record<string, MarbleSave> 拥有+等级）
    // 旧版：每种弹珠每章自动补充，玩家可任意使用 → 视作全部已购买 1 级
    for (const m of MARBLES) {
      const cur = (merged.marbles as Record<string, unknown>)[m.id];
      if (typeof cur === 'number') {
        (merged.marbles as Record<string, MarbleSave>)[m.id] = { owned: true, level: 1 };
      } else if (!cur || typeof cur !== 'object') {
        (merged.marbles as Record<string, MarbleSave>)[m.id] = { owned: false, level: 0 };
      }
    }

    // 迁移旧版 number → bigint（×100 缩放）
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
    const maxHours = BALANCE.offlineMaxHours + (data.skillLevels?.offlineMax || 0) + (data.crystalUpgrades?.offlineCap || 0);
    const maxSeconds = maxHours * 3600;
    const diff = Math.max(0, Math.min((now - data.lastSeen) / 1000, maxSeconds));
    if (diff <= 0) return { gold: 0n, seconds: 0 };

    // 永久自动效率：离线结算同样享受全局提速
    const autoSpeedMul = Math.max(0.1, 1 - (data.crystalUpgrades?.autoSpeed || 0) * 0.03);
    let rate = 0;
    for (const [id, info] of Object.entries(data.autoDroppers)) {
      const cfg = AUTO_MAP[id];
      if (!cfg || info.count <= 0) continue;
      const speedMul = 1 - info.speedLevel * cfg.speedPerLevel;
      const interval = cfg.interval * Math.max(0.1, speedMul) * autoSpeedMul;
      const mulMatch = cfg.id.match(/^multi(\d+)?$/);
      const mul = mulMatch ? (mulMatch[1] ? parseInt(mulMatch[1], 10) : 2) : 1;
      rate += (info.count * mul) / interval;
    }
    if (rate <= 0) return { gold: 0n, seconds: diff };

    const offlineRateMul = 1 + (data.skillLevels?.offlineRate || 0) * 0.1;
    const avgValueOrig = Math.max(1, fromBig(data.ballInitialValue) * 100);
    const goldOrig = diff * rate * avgValueOrig * 0.5 * offlineRateMul;
    return { gold: toBig(Math.floor(goldOrig)), seconds: diff };
  }
}

// ===== JSON reviver / replacer =====
function reviver(_k: string, v: unknown): unknown {
  if (v && typeof v === 'object' && '__bigint__' in v) {
    return BigInt((v as { __bigint__: string }).__bigint__);
  }
  return v;
}

function replacer(_k: string, v: unknown): unknown {
  if (typeof v === 'bigint') return { __bigint__: v.toString() };
  return v;
}
