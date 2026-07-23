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
  if (!isFinite(n) || n >= 1e308) return '∞';
  if (n < 1) return '0';
  if (n < 1000) {
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(1);
  }
  // 字母表示：1e3=A, 1e6=B, ..., 1e78=Z, 1e81=AA, 1e84=AB...
  // 大数会自动进位到 AQ, BR, CZA 等多字母组合
  let k = Math.floor(Math.log10(n) / 3);
  if (k < 1) k = 1;
  let val = n / Math.pow(1000, k);
  while (val < 1 && k > 1) { val *= 1000; k--; }
  while (val >= 1000) { val /= 1000; k++; }
  return val.toFixed(2) + suffix(k);
}

export function shortNum(n: number): string {
  if (!isFinite(n) || n >= 1e308) return '∞';
  if (n < 1000) return String(Math.floor(n));
  let k = Math.floor(Math.log10(n) / 3);
  if (k < 1) k = 1;
  let val = n / Math.pow(1000, k);
  while (val < 1 && k > 1) { val *= 1000; k--; }
  while (val >= 1000) { val /= 1000; k++; }
  return val.toFixed(1) + suffix(k);
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// k 是 1000 的幂次：1=A, 2=B, ..., 26=Z, 27=AA, 28=AB...
function suffix(k: number): string {
  if (k <= 0) return '';
  let s = '';
  let n = k;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = LETTERS[rem] + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
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
  /** 该类型钉子的有效等级上限：基础 + sageBlueprint 奖励 + 前置解锁奖励 */
  getPegMaxLevel(cfg: import('../types').PegConfig): number {
    let max = cfg.maxLevel + this.getSkillLevel('sageBlueprint') * 2;
    if (cfg.prereq) {
      const cnt = this._save.pegs.filter((p) => p.typeId === cfg.prereq!.id).length;
      if (cnt >= cfg.prereq.level) max += cfg.prereqBonusLevels ?? 5;
    }
    return max;
  }

  /** 前置是否满足：钉子看放置数量 */
  isPegPrereqMet(cfg: import('../types').PegConfig): boolean {
    if (!cfg.prereq) return true;
    const cnt = this._save.pegs.filter((p) => p.typeId === cfg.prereq!.id).length;
    return cnt >= cfg.prereq.level;
  }

  placePeg(typeId: string, gx: number, gy: number): PegSave | null {
    const cfg = PEG_MAP[typeId];
    if (!cfg || cfg.unlockChapter > this._save.chapterId) return null;
    if (!this.isPegPrereqMet(cfg)) {
      const pre = PEG_MAP[cfg.prereq!.id];
      bus.emit(EVT.TOAST, `需要先放置 ${cfg.prereq!.level} 个${pre?.name ?? cfg.prereq!.id}`);
      return null;
    }

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

    const maxLevel = this.getPegMaxLevel(cfg);
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
        // 指数钉：v = v^exponent，exponent = operand + (level-1) * growth
        // 例如 1.1 + (level-1) * 0.1。用 Math.pow 而非 v*v，避免大数平方爆炸到 Infinity
        const exponent = cfg.operand + (peg.level - 1) * cfg.growth;
        const r = Math.pow(v, exponent);
        v = safeMul(r, 1); // 通过 safeMul clamp 到 MAX_NUMBER，防 Infinity
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

  /** 前置是否满足：技能看前置技能等级 */
  isSkillPrereqMet(cfg: import('../types').SkillConfig): boolean {
    if (!cfg.prereq) return true;
    return this.getSkillLevel(cfg.prereq.id) >= cfg.prereq.level;
  }

  /** 该技能的有效等级上限：基础 + 前置解锁奖励 */
  getSkillMaxLevel(cfg: import('../types').SkillConfig): number {
    let max = cfg.maxLevel;
    if (cfg.prereq && this.getSkillLevel(cfg.prereq.id) >= cfg.prereq.level) {
      max += cfg.prereqBonusLevels ?? 5;
    }
    return max;
  }

  isSkillUnlocked(id: string): boolean {
    const cfg = SKILL_MAP[id];
    if (!cfg) return false;
    if (cfg.unlockChapter > this._save.chapterId) return false;
    return this.isSkillPrereqMet(cfg);
  }

  buySkill(id: string): boolean {
    const cfg = SKILL_MAP[id];
    if (!cfg) return false;
    if (cfg.unlockChapter > this._save.chapterId) {
      bus.emit(EVT.TOAST, `第 ${cfg.unlockChapter} 章解锁`);
      return false;
    }
    if (!this.isSkillPrereqMet(cfg)) {
      const pre = SKILL_MAP[cfg.prereq!.id];
      bus.emit(EVT.TOAST, `需要先升满 ${cfg.prereq!.level} 级${pre?.name ?? cfg.prereq!.id}`);
      return false;
    }
    const lvl = this.getSkillLevel(id);
    const maxLevel = this.getSkillMaxLevel(cfg);
    if (lvl >= maxLevel) {
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

  /** 前置是否满足：自动器看购买数量 */
  isAutoPrereqMet(cfg: import('../types').AutoDropperConfig): boolean {
    if (!cfg.prereq) return true;
    const info = this.getAutoDropperInfo(cfg.prereq.id);
    return info.count >= cfg.prereq.level;
  }

  buyAutoDropper(id: string): boolean {
    const cfg = AUTO_MAP[id];
    if (!cfg) return false;
    if (cfg.unlockChapter > this._save.chapterId) {
      bus.emit(EVT.TOAST, `第 ${cfg.unlockChapter} 章解锁`);
      return false;
    }
    if (!this.isAutoPrereqMet(cfg)) {
      const pre = AUTO_MAP[cfg.prereq!.id];
      const cur = this.getAutoDropperInfo(cfg.prereq!.id).count;
      bus.emit(EVT.TOAST, `前置：${pre?.name ?? cfg.prereq!.id} ${cur}/${cfg.prereq!.level}`);
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
      // multi/multi3/multiN：每次投多颗，按 id 中的数字决定倍数
      const mulMatch = cfg.id.match(/^multi(\d+)?$/);
      const mul = mulMatch ? (mulMatch[1] ? parseInt(mulMatch[1], 10) : 2) : 1;
      rate += (info.count * mul) / interval;
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
    // 已展示过归零试炼则不再重复弹窗
    if (this._save.storyProgress.endsWith('_ready')) return;
    // 标记为已展示
    this._save.storyProgress = `ch${this._save.chapterId}_ready`;
    bus.emit(EVT.PRESTIGE_AVAILABLE);
  }

  // 玩家主动关闭归零弹窗：保持 _ready 状态，不再重复弹
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
    this._save.storyProgress = `ch${this._save.chapterId}_ready`;
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
