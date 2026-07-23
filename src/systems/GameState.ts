// 游戏核心状态。所有玩法规则集中在这里，Phaser 场景只负责渲染与输入。

import { SaveSystem } from './SaveSystem';
import { bus, EVT } from './EventBus';
import { PEG_MAP } from '../data/pegs';
import { SKILL_MAP, ACTIVE_SKILLS } from '../data/skills';
import { CHAPTERS, CHAPTER_MAP, AUTO_MAP, CRYSTAL_MAP } from '../data/chapters';
import type { SaveData, PegSave, AutoDropperSave } from '../types';
import { BALANCE } from '../types';

const MAX_NUMBER = 1e308;

// 安全加法/乘法，防止 Infinity
export function safeAdd(a: number, b: number): number {
  const r = a + b;
  if (!isFinite(r) || r > MAX_NUMBER) return MAX_NUMBER;
  return r;
}
export function safeMul(a: number, b: number): number {
  const r = a * b;
  if (!isFinite(r) || r > MAX_NUMBER) return MAX_NUMBER;
  return r;
}

export function formatNum(n: number): string {
  if (n >= 1e15) return n.toExponential(2).replace('+', '');
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

export function shortNum(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.floor(n));
}

class ActiveState {
  private actives: Map<string, { start: number; duration: number; cooldownStart: number; cooldown: number }> = new Map();

  trigger(skillId: string, duration: number, cooldown: number) {
    const now = Date.now();
    this.actives.set(skillId, { start: now, duration: duration * 1000, cooldownStart: now, cooldown: cooldown * 1000 });
  }

  isActive(skillId: string): boolean {
    const s = this.actives.get(skillId);
    if (!s) return false;
    return Date.now() - s.start < s.duration;
  }

  isReady(skillId: string): boolean {
    const s = this.actives.get(skillId);
    if (!s) return true;
    return Date.now() - s.cooldownStart >= s.cooldown;
  }

  getState(skillId: string): { start: number; duration: number; cooldownStart: number; cooldown: number } | undefined {
    return this.actives.get(skillId);
  }

  checkExpired(now: number) {
    for (const [id, s] of this.actives) {
      if (this.isActive(id) && now - s.start >= s.duration) {
        bus.emit(EVT.ACTIVE_EXPIRED, id);
      }
    }
  }
}

class GameStateClass {
  private _save: SaveData = SaveSystem.load();
  private actives = new ActiveState();
  private combo = 0;
  private comboTimer = 0;

  get save() { return this._save; }
  get chapterId() { return this._save.chapterId; }
  get chapter() { return CHAPTER_MAP[this._save.chapterId] ?? CHAPTERS[0]; }
  get gold() { return this._save.gold; }
  get crystal() { return this._save.crystal; }
  get ballInitialValue() { return this._save.ballInitialValue; }
  get pegs() { return this._save.pegs; }
  get autoDroppers() { return this._save.autoDroppers; }
  get storyProgress() { return this._save.storyProgress; }

  init() {}

  saveGame() {
    SaveSystem.save(this._save);
    bus.emit(EVT.SAVE_DONE);
  }

  // ===== 金币 =====
  addGold(n: number, _source: 'ball' | 'offline' = 'ball') {
    this._save.gold = safeAdd(this._save.gold, n);
    this._save.totalGold = safeAdd(this._save.totalGold, n);
    this._save.stats.totalGoldEarned = safeAdd(this._save.stats.totalGoldEarned, n);
    bus.emit(EVT.GOLD_CHANGED, this._save.gold);
    this.checkChapterGoal();
  }

  spendGold(n: number): boolean {
    if (this._save.gold < n) return false;
    this._save.gold -= n;
    bus.emit(EVT.GOLD_CHANGED, this._save.gold);
    return true;
  }

  addCrystal(n: number) {
    this._save.crystal = safeAdd(this._save.crystal, n);
    bus.emit(EVT.CRYSTAL_CHANGED, this._save.crystal);
  }

  // ===== 钉子 =====
  placePeg(typeId: string, gx: number, gy: number): PegSave | null {
    const cfg = PEG_MAP[typeId];
    if (!cfg || cfg.unlockChapter > this._save.chapterId) return null;

    const existing = this._save.pegs.find((p) => p.x === gx && p.y === gy);
    if (existing) return null;

    const maxPegs = BALANCE.maxPegsBase + this.getSkillLevel('capacityPegs') * 3;
    if (this._save.pegs.length >= maxPegs) {
      bus.emit(EVT.TOAST, '钉子数量已达上限');
      return null;
    }

    const count = this._save.pegs.filter((p) => p.typeId === typeId).length;
    const cost = Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, count));
    if (!this.spendGold(cost)) {
      bus.emit(EVT.TOAST, '金币不足');
      return null;
    }

    const peg: PegSave = {
      id: `${typeId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      typeId, x: gx, y: gy, level: 1,
    };
    this._save.pegs.push(peg);
    this._save.stats.totalPegsPlaced++;
    bus.emit(EVT.PEG_PLACED, peg);
    return peg;
  }

  upgradePeg(pegId: string): boolean {
    const peg = this._save.pegs.find((p) => p.id === pegId);
    if (!peg) return false;
    const cfg = PEG_MAP[peg.typeId];
    if (!cfg) return false;

    const maxLevel = cfg.maxLevel + this.getSkillLevel('sageBlueprint') * 2;
    if (peg.level >= maxLevel) {
      bus.emit(EVT.TOAST, '钉子等级已达上限');
      return false;
    }

    const cost = Math.floor(cfg.baseCost * 0.5 * Math.pow(cfg.costGrowth, peg.level));
    if (!this.spendGold(cost)) {
      bus.emit(EVT.TOAST, '金币不足');
      return false;
    }
    peg.level++;
    bus.emit(EVT.PEG_UPGRADED, peg);
    return true;
  }

  sellPeg(pegId: string): number {
    const idx = this._save.pegs.findIndex((p) => p.id === pegId);
    if (idx < 0) return 0;
    const peg = this._save.pegs[idx];
    const cfg = PEG_MAP[peg.typeId];
    let total = cfg.baseCost;
    for (let i = 1; i < peg.level; i++) total += Math.floor(cfg.baseCost * 0.5 * Math.pow(cfg.costGrowth, i));
    const back = Math.floor(total * BALANCE.sellReturnRate);
    this._save.pegs.splice(idx, 1);
    this.addGold(back);
    bus.emit(EVT.PEG_SOLD, pegId);
    return back;
  }

  computePeg(peg: PegSave, value: number, goldenMul = 1): { value: number; crit: boolean } {
    const cfg = PEG_MAP[peg.typeId];
    let v = value;
    let crit = false;

    const critChance = BALANCE.critChanceBase + this.getSkillLevel('critRate') * 0.02;
    if (Math.random() < critChance) {
      crit = true;
      const critMul = 2 + this.getSkillLevel('critDmg') * 0.25;
      v = safeMul(v, critMul);
    }

    switch (cfg.operator) {
      case '+':
        v = safeAdd(v, cfg.operand + (peg.level - 1) * cfg.growth);
        break;
      case '*':
        v = safeMul(v, cfg.operand + (peg.level - 1) * cfg.growth);
        break;
      case '/':
        v = Math.max(1, Math.floor(v / cfg.operand));
        break;
      case '^': {
        // 平方运算软上限：避免大数时指数爆炸到 Infinity 导致卡顿
        // 当 v < 1e6 时正常平方；之后用对数缩放，效果衰减
        if (v < 1e6) {
          v = safeMul(v, v);
        } else {
          // log 域运算：v' = exp(2 * log(v) - penalty)
          // 当 v 很大时，平方效果近似 +1e6 线性增量而非指数
          const logV = Math.log(v);
          const newLog = logV * 2 - Math.max(0, (logV - 14) * 0.5);
          v = Math.min(MAX_NUMBER, Math.exp(Math.min(700, newLog)));
        }
        break;
      }
      case '%':
        break;
      case 'addPercent':
        v = safeAdd(v, v * (cfg.operand + (peg.level - 1) * cfg.growth));
        break;
      case 'maxMul': {
        const mul = Math.max(2, 3 + (peg.level - 1) * cfg.growth);
        v = safeMul(v, mul);
        break;
      }
    }

    v = safeMul(v, goldenMul);

    const goldMul = BALANCE.goldMulBase + this.getSkillLevel('goldBonus') * 0.05 + this.getCrystalLevel('goldBonus') * 0.02;
    if (goldMul > 1) v = safeMul(v, goldMul);

    return { value: Math.floor(v), crit };
  }

  // ===== 技能 =====
  getSkillLevel(id: string): number {
    return this._save.skillLevels[id] || 0;
  }

  isSkillUnlocked(id: string): boolean {
    const cfg = SKILL_MAP[id];
    if (!cfg) return false;
    return cfg.unlockChapter <= this._save.chapterId;
  }

  buySkill(id: string): boolean {
    const cfg = SKILL_MAP[id];
    if (!cfg) return false;
    if (cfg.unlockChapter > this._save.chapterId) {
      bus.emit(EVT.TOAST, `第 ${cfg.unlockChapter} 章解锁`);
      return false;
    }
    const lvl = this.getSkillLevel(id);
    if (lvl >= cfg.maxLevel) {
      bus.emit(EVT.TOAST, '技能已满级');
      return false;
    }
    const cost = Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, lvl));
    if (!this.spendGold(cost)) {
      bus.emit(EVT.TOAST, '金币不足');
      return false;
    }
    this._save.skillLevels[id] = lvl + 1;
    if (id === 'initialValue') {
      this._save.ballInitialValue = this.computeInitialValue();
      bus.emit(EVT.BALL_VALUE_CHANGED, this._save.ballInitialValue);
    }
    bus.emit(EVT.SKILL_BOUGHT, id, this._save.skillLevels[id]);
    return true;
  }

  computeInitialValue(): number {
    const base = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    const lvl = this.getSkillLevel('initialValue');
    if (lvl < base.length) return base[lvl];
    return base[base.length - 1] * Math.pow(2, lvl - base.length + 1);
  }

  triggerActive(id: string): boolean {
    const cfg = ACTIVE_SKILLS.find((s) => s.id === id);
    if (!cfg || !cfg.duration || !cfg.cooldown) return false;
    if (!this.actives.isReady(id)) return false;
    this.actives.trigger(id, cfg.duration, cfg.cooldown);
    bus.emit(EVT.ACTIVE_TRIGGERED, { skillId: id, duration: cfg.duration });
    return true;
  }

  isSkillActive(id: string): boolean {
    return this.actives.isActive(id);
  }

  activeCooldownInfo(id: string): { ready: boolean; cdRatio: number; durRatio: number } {
    const cfg = ACTIVE_SKILLS.find((s) => s.id === id);
    if (!cfg || !cfg.cooldown || !cfg.duration) return { ready: true, cdRatio: 0, durRatio: 0 };
    const now = Date.now();
    const s = this.actives.getState(id);
    if (!s) return { ready: true, cdRatio: 0, durRatio: 0 };
    const cdElapsed = now - s.cooldownStart;
    const durElapsed = now - s.start;
    const cdRatio = Math.min(1, Math.max(0, cdElapsed / s.cooldown));
    const durRatio = s.duration > 0 ? Math.min(1, Math.max(0, durElapsed / s.duration)) : 0;
    const ready = cdRatio >= 1;
    return { ready, cdRatio, durRatio };
  }

  tickActives(now: number) {
    this.actives.checkExpired(now);
  }

  // ===== 自动器（可多买 + 速度升级） =====
  getAutoDropperInfo(id: string): AutoDropperSave {
    return this._save.autoDroppers[id] || { count: 0, speedLevel: 0 };
  }

  getAutoDropperCost(id: string): number {
    const cfg = AUTO_MAP[id];
    if (!cfg) return Infinity;
    const info = this.getAutoDropperInfo(id);
    return Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, info.count));
  }

  getAutoDropperSpeedUpgradeCost(id: string): number {
    const cfg = AUTO_MAP[id];
    if (!cfg) return Infinity;
    const info = this.getAutoDropperInfo(id);
    return Math.floor(cfg.speedUpgradeCost * Math.pow(cfg.speedUpgradeGrowth, info.speedLevel));
  }

  buyAutoDropper(id: string): boolean {
    const cfg = AUTO_MAP[id];
    if (!cfg) return false;
    if (cfg.unlockChapter > this._save.chapterId) {
      bus.emit(EVT.TOAST, `第 ${cfg.unlockChapter} 章解锁`);
      return false;
    }
    const info = this.getAutoDropperInfo(id);
    if (info.count >= cfg.maxCount) {
      bus.emit(EVT.TOAST, '已达最大购买数量');
      return false;
    }
    const cost = this.getAutoDropperCost(id);
    if (!this.spendGold(cost)) {
      bus.emit(EVT.TOAST, '金币不足');
      return false;
    }
    if (!this._save.autoDroppers[id]) {
      this._save.autoDroppers[id] = { count: 0, speedLevel: 0 };
    }
    this._save.autoDroppers[id].count++;
    bus.emit(EVT.AUTO_BOUGHT, id);
    return true;
  }

  upgradeAutoDropperSpeed(id: string): boolean {
    const cfg = AUTO_MAP[id];
    if (!cfg) return false;
    const info = this.getAutoDropperInfo(id);
    if (info.count <= 0) {
      bus.emit(EVT.TOAST, '请先购买该自动器');
      return false;
    }
    if (info.speedLevel >= cfg.maxSpeedLevel) {
      bus.emit(EVT.TOAST, '速度已达上限');
      return false;
    }
    const cost = this.getAutoDropperSpeedUpgradeCost(id);
    if (!this.spendGold(cost)) {
      bus.emit(EVT.TOAST, '金币不足');
      return false;
    }
    this._save.autoDroppers[id].speedLevel++;
    bus.emit(EVT.AUTO_BOUGHT, id);
    return true;
  }

  getAutoDropRate(): number {
    let rate = 0;
    for (const [id, info] of Object.entries(this._save.autoDroppers)) {
      const cfg = AUTO_MAP[id];
      if (!cfg || info.count <= 0) continue;
      const speedMul = Math.max(0.1, 1 - info.speedLevel * cfg.speedPerLevel);
      const interval = cfg.interval * speedMul;
      const count = cfg.id === 'multi' ? info.count * 2 : info.count;
      rate += count / interval;
    }
    return rate;
  }

  // ===== 数晶商店 =====
  getCrystalLevel(id: string): number {
    return this._save.crystalUpgrades[id] || 0;
  }

  isCrystalUnlocked(id: string): boolean {
    const cfg = CRYSTAL_MAP[id];
    if (!cfg) return false;
    return cfg.unlockChapter <= this._save.chapterId;
  }

  buyCrystalUpgrade(id: string): boolean {
    const cfg = CRYSTAL_MAP[id];
    if (!cfg) return false;
    if (cfg.unlockChapter > this._save.chapterId) {
      bus.emit(EVT.TOAST, `第 ${cfg.unlockChapter} 章解锁`);
      return false;
    }
    const lvl = this.getCrystalLevel(id);
    if (lvl >= cfg.maxLevel) return false;
    const cost = Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, lvl));
    if (this._save.crystal < cost) {
      bus.emit(EVT.TOAST, '数晶不足');
      return false;
    }
    this._save.crystal -= cost;
    this._save.crystalUpgrades[id] = lvl + 1;
    bus.emit(EVT.CRYSTAL_CHANGED, this._save.crystal);
    return true;
  }

  // ===== 周目 =====
  checkChapterGoal() {
    const ch = this.chapter;
    if (this._save.totalGold < ch.targetGold) return;
    if (this._save.storyProgress.endsWith('_ending')) return;

    // 第 5 章最终选择（优先级最高，不受 _ready 限制）
    if (this._save.chapterId >= 5 && this._save.gold >= 1e15 && !this._save.storyProgress.includes('choosing')) {
      this._save.storyProgress = 'ch5_choosing';
      bus.emit(EVT.ENDING_CHOICE);
      return;
    }

    // 已展示过归零试炼（_ready 后缀）则不再重复弹窗
    if (this._save.storyProgress.endsWith('_ready')) return;

    // 标记为已展示，避免 addGold 每次都重复弹窗
    this._save.storyProgress = `ch${this._save.chapterId}_ready`;
    bus.emit(EVT.PRESTIGE_AVAILABLE);
  }

  // 玩家主动关闭归零试炼弹窗：保持 _ready 状态，不再重复弹
  dismissPrestigeModal() {
    // storyProgress 已是 _ready，无需改动；此方法留给 UI 明确语义
  }

  prestige(nextChapter: number) {
    const crystalGainMul = 1 + this.getCrystalLevel('crystalGain') * 0.05;
    const crystalGain = Math.floor(this._save.totalGold / 1e6 * crystalGainMul);
    this._save.crystal = safeAdd(this._save.crystal, Math.max(1, crystalGain));
    this._save.chapterId = Math.min(5, nextChapter);
    this._save.gold = this.getCrystalLevel('startGold') * 1000;
    this._save.totalGold = 0;
    this._save.pegs = [];
    this._save.autoDroppers = {};
    this._save.skillLevels = {};
    this._save.ballInitialValue = 1;
    this._save.storyProgress = `ch${this._save.chapterId}_intro`;
    bus.emit(EVT.GOLD_CHANGED, this._save.gold);
    bus.emit(EVT.CRYSTAL_CHANGED, this._save.crystal);
    bus.emit(EVT.BALL_VALUE_CHANGED, 1);
    bus.emit(EVT.CHAPTER_CHANGED, this._save.chapterId);
    this.saveGame();
  }

  // ===== 统计 =====
  onBallDropped(_source: 'manual' | 'auto') {
    this._save.stats.totalBalls++;
  }

  onBallSettled(value: number) {
    if (value > this._save.stats.highestBallValue) {
      this._save.stats.highestBallValue = value;
    }
  }

  // ===== 连击 =====
  addCombo() {
    const now = Date.now();
    if (now - this.comboTimer > 1200) this.combo = 0;
    this.combo++;
    this.comboTimer = now;
    return this.combo;
  }

  // ===== 离线 =====
  applyOffline() {
    const { gold, seconds } = SaveSystem.calculateOffline(this._save);
    if (gold > 0) {
      this._save.gold = safeAdd(this._save.gold, gold);
      this._save.totalGold = safeAdd(this._save.totalGold, gold);
      this._save.stats.totalGoldEarned = safeAdd(this._save.stats.totalGoldEarned, gold);
      bus.emit(EVT.GOLD_CHANGED, this._save.gold);
    }
    this._save.lastSeen = Date.now();
    return { gold, seconds };
  }
}

export const GameState = new GameStateClass();
