// 游戏核心状态。所有玩法规则集中在这里，Phaser 场景只负责渲染与输入。
// 所有"原始数值"（gold/ballValue 等）在内部以 BigInt × SCALE 存储，支持任意大数。
// BigInt 工具与精度逻辑统一由 BigNum.ts 提供，本文件仅 re-export 以保持调用方兼容。

import { SaveSystem } from './SaveSystem';
import { bus, EVT } from './EventBus';
import { PEG_MAP } from '../data/pegs';
import { SKILL_MAP, ACTIVE_SKILLS } from '../data/skills';
import { CHAPTERS, CHAPTER_MAP, AUTO_MAP, CRYSTAL_MAP } from '../data/chapters';
import type { SaveData, PegSave, AutoDropperSave } from '../types';
import { BALANCE } from '../types';
import {
  SCALE,
  toBig,
  fromBig,
  bigMulNum,
  bigAddNum,
  bigPow,
  formatNum,
  shortNum,
} from './BigNum';

export { SCALE, toBig, fromBig, bigMulNum, bigAddNum, bigPow, formatNum, shortNum };

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
  private _slot: number = SaveSystem.readActiveSlot();
  private _save: SaveData = SaveSystem.loadSlot(SaveSystem.readActiveSlot());
  private actives = new ActiveState();
  private combo = 0;
  private comboTimer = 0;

  get save() { return this._save; }
  get slot() { return this._slot; }
  get chapterId() { return this._save.chapterId; }
  get chapter() { return CHAPTER_MAP[this._save.chapterId] ?? CHAPTERS[0]; }
  get gold() { return this._save.gold; }
  get crystal() { return this._save.crystal; }
  get ballInitialValue() { return this._save.ballInitialValue; }
  get pegs() { return this._save.pegs; }
  get autoDroppers() { return this._save.autoDroppers; }
  get storyProgress() { return this._save.storyProgress; }

  init() {}

  /** 切换到指定槽位并加载存档（主菜单选槽位时调用） */
  loadSlot(slot: number) {
    this._slot = slot;
    SaveSystem.setActiveSlot(slot);
    this._save = SaveSystem.loadSlot(slot);
  }

  /** 当前槽位是否已有存档（用于主菜单"新游戏"判断） */
  slotExists(slot: number = this._slot): boolean {
    return SaveSystem.slotExists(slot);
  }

  saveGame() {
    SaveSystem.saveSlot(this._slot, this._save);
    bus.emit(EVT.SAVE_DONE);
  }

  // ===== 金币 =====
  addGold(n: bigint, _source: 'ball' | 'offline' = 'ball') {
    this._save.gold += n;
    this._save.totalGold += n;
    this._save.stats.totalGoldEarned += n;
    bus.emit(EVT.GOLD_CHANGED, this._save.gold);
    this.checkChapterGoal();
  }

  spendGold(n: bigint): boolean {
    if (this._save.gold < n) return false;
    this._save.gold -= n;
    bus.emit(EVT.GOLD_CHANGED, this._save.gold);
    return true;
  }

  addCrystal(n: bigint) {
    this._save.crystal += n;
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
    if (!cfg) return null;
    if (!this.isPegPrereqMet(cfg)) {
      const pre = PEG_MAP[cfg.prereq!.id];
      bus.emit(EVT.TOAST, `需要先放置 ${cfg.prereq!.level} 个${pre?.name ?? cfg.prereq!.id}`);
      return null;
    }

    const existing = this._save.pegs.find((p) => p.x === gx && p.y === gy);
    if (existing) return null;

    const maxPegs = BALANCE.maxPegsBase + this.getSkillLevel('capacityPegs') * 3 + this.getCrystalLevel('pegCap');
    if (this._save.pegs.length >= maxPegs) {
      bus.emit(EVT.TOAST, '钉子数量已达上限');
      return null;
    }

    const count = this._save.pegs.filter((p) => p.typeId === typeId).length;
    const cost = toBig(Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, count)));
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

    const cost = toBig(Math.floor(cfg.baseCost * 0.5 * Math.pow(cfg.costGrowth, peg.level)));
    if (!this.spendGold(cost)) {
      bus.emit(EVT.TOAST, '金币不足');
      return false;
    }
    peg.level++;
    bus.emit(EVT.PEG_UPGRADED, peg);
    return true;
  }

  sellPeg(pegId: string): bigint {
    const idx = this._save.pegs.findIndex((p) => p.id === pegId);
    if (idx < 0) return 0n;
    const peg = this._save.pegs[idx];
    const cfg = PEG_MAP[peg.typeId];
    let total = cfg.baseCost;
    for (let i = 1; i < peg.level; i++) total += Math.floor(cfg.baseCost * 0.5 * Math.pow(cfg.costGrowth, i));
    const back = toBig(Math.floor(total * BALANCE.sellReturnRate));
    this._save.pegs.splice(idx, 1);
    this.addGold(back);
    bus.emit(EVT.PEG_SOLD, pegId);
    return back;
  }

  computePeg(peg: PegSave, value: bigint, goldenMul = 1): { value: bigint; crit: boolean } {
    const cfg = PEG_MAP[peg.typeId];
    let v = value;
    let crit = false;

    const critChance = BALANCE.critChanceBase + this.getSkillLevel('critRate') * 0.02;
    if (Math.random() < critChance) {
      crit = true;
      const critMul = 2 + this.getSkillLevel('critDmg') * 0.25 + this.getCrystalLevel('critPower') * 0.2;
      v = bigMulNum(v, critMul);
    }

    switch (cfg.operator) {
      case '+':
        v = bigAddNum(v, cfg.operand + (peg.level - 1) * cfg.growth);
        break;
      case '*':
        v = bigMulNum(v, cfg.operand + (peg.level - 1) * cfg.growth);
        break;
      case '/': {
        // 整数除法：v / operand（operand 是 number 小数，先转 bigint）
        const divisor = toBig(cfg.operand);
        if (divisor > 0n) v = v / divisor;
        if (v < SCALE) v = SCALE; // 最少保留 1（缩放值 100）
        break;
      }
      case '^': {
        // 指数钉：v = v^exponent，exponent = operand + (level-1) * growth
        const exponent = cfg.operand + (peg.level - 1) * cfg.growth;
        v = bigPow(v, exponent);
        break;
      }
      case '%':
        break;
      case 'addPercent':
        // v += v * percent
        v = v + bigMulNum(v, cfg.operand + (peg.level - 1) * cfg.growth);
        break;
      case 'maxMul': {
        const mul = Math.max(2, 3 + (peg.level - 1) * cfg.growth);
        v = bigMulNum(v, mul);
        break;
      }
    }

    v = bigMulNum(v, goldenMul);

    const goldMul = BALANCE.goldMulBase + this.getSkillLevel('goldBonus') * 0.05 + this.getCrystalLevel('goldBonus') * 0.02;
    if (goldMul > 1) v = bigMulNum(v, goldMul);

    return { value: v, crit };
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
    return this.isSkillPrereqMet(cfg);
  }

  buySkill(id: string): boolean {
    const cfg = SKILL_MAP[id];
    if (!cfg) return false;
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
    const cost = toBig(Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, lvl)));
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

  computeInitialValue(): bigint {
    const base = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    const lvl = this.getSkillLevel('initialValue');
    let v: bigint;
    if (lvl < base.length) v = toBig(base[lvl]);
    else v = toBig(base[base.length - 1] * Math.pow(2, lvl - base.length + 1));
    // 永久弹珠强化：每周目生效的起始数值加成
    const boost = 1 + this.getCrystalLevel('ballValueBoost') * 0.1;
    if (boost > 1) v = bigMulNum(v, boost);
    return v;
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

  getAutoDropperCost(id: string): bigint {
    const cfg = AUTO_MAP[id];
    if (!cfg) return 0n;
    const info = this.getAutoDropperInfo(id);
    return toBig(Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, info.count)));
  }

  getAutoDropperSpeedUpgradeCost(id: string): bigint {
    const cfg = AUTO_MAP[id];
    if (!cfg) return 0n;
    const info = this.getAutoDropperInfo(id);
    return toBig(Math.floor(cfg.speedUpgradeCost * Math.pow(cfg.speedUpgradeGrowth, info.speedLevel)));
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
    // 永久自动效率：全局缩短所有自动器间隔
    const autoSpeedMul = Math.max(0.1, 1 - this.getCrystalLevel('autoSpeed') * 0.03);
    for (const [id, info] of Object.entries(this._save.autoDroppers)) {
      const cfg = AUTO_MAP[id];
      if (!cfg || info.count <= 0) continue;
      const speedMul = Math.max(0.1, 1 - info.speedLevel * cfg.speedPerLevel);
      const interval = cfg.interval * speedMul * autoSpeedMul;
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
    return true;
  }

  buyCrystalUpgrade(id: string): boolean {
    const cfg = CRYSTAL_MAP[id];
    if (!cfg) return false;
    const lvl = this.getCrystalLevel(id);
    if (lvl >= cfg.maxLevel) return false;
    const cost = toBig(Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, lvl)));
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
    // totalGold / 1e6 × crystalGainMul，全在 bigint 域
    const totalGoldNum = fromBig(this._save.totalGold);
    const crystalGain = Math.max(1, Math.floor(totalGoldNum / 1e6 * crystalGainMul));
    this._save.crystal += toBig(crystalGain);
    this._save.chapterId = Math.min(5, nextChapter);
    this._save.gold = toBig(this.getCrystalLevel('startGold') * 1000);
    this._save.totalGold = 0n;
    this._save.pegs = [];
    this._save.autoDroppers = {};
    this._save.skillLevels = {};
    this._save.ballInitialValue = toBig(1);
    this._save.storyProgress = `ch${this._save.chapterId}_ready`;
    bus.emit(EVT.GOLD_CHANGED, this._save.gold);
    bus.emit(EVT.CRYSTAL_CHANGED, this._save.crystal);
    bus.emit(EVT.BALL_VALUE_CHANGED, this._save.ballInitialValue);
    bus.emit(EVT.CHAPTER_CHANGED, this._save.chapterId);
    this.saveGame();
  }

  // ===== 统计 =====
  onBallDropped(_source: 'manual' | 'auto') {
    this._save.stats.totalBalls++;
  }

  onBallSettled(value: bigint) {
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
    if (gold > 0n) {
      this._save.gold += gold;
      this._save.totalGold += gold;
      this._save.stats.totalGoldEarned += gold;
      bus.emit(EVT.GOLD_CHANGED, this._save.gold);
    }
    this._save.lastSeen = Date.now();
    return { gold, seconds };
  }
}

export const GameState = new GameStateClass();
