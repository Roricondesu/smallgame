// 游戏核心状态。所有玩法规则集中在这里，Phaser 场景只负责渲染与输入。
// 所有"原始数值"（gold/ballValue 等）在内部以 BigInt × SCALE 存储，支持任意大数。
// BigInt 工具与精度逻辑统一由 BigNum.ts 提供，本文件仅 re-export 以保持调用方兼容。

import { SaveSystem } from './SaveSystem';
import { bus, EVT } from './EventBus';
import { PEG_MAP } from '../data/pegs';
import { SKILL_MAP, ACTIVE_SKILLS } from '../data/skills';
import { CHAPTERS, CHAPTER_MAP, AUTO_MAP, CRYSTAL_MAP } from '../data/chapters';
import { MARBLES, MARBLE_MAP, MARBLE_NORMAL_WEIGHT } from '../data/marbles';
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
  // Dev 模式：金币倍率（运行时内存态，不存档）。0 = 关闭，>0 时为倍率
  private _devGoldMul = 0;

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
  get marbles() { return this._save.marbles ?? {}; }
  get selectedMarble() { return this._save.selectedMarble ?? ''; }
  get seenDialogues() { return this._save.seenDialogues ?? []; }

  /** Dev 模式：当前金币倍率（0 表示关闭） */
  get devGoldMul() { return this._devGoldMul; }
  /** Dev 模式：设置金币倍率（0=关闭，>0 时所有金币收益乘以该倍率） */
  setDevGoldMul(mul: number) {
    this._devGoldMul = Math.max(0, mul);
  }

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
    // Dev 模式：金币收益倍率（仅对来源为 ball 的收益生效，离线收益不翻倍避免恶性循环）
    let gain = n;
    if (this._devGoldMul > 1 && _source === 'ball') {
      gain = bigMulNum(n, this._devGoldMul);
    }
    this._save.gold += gain;
    this._save.totalGold += gain;
    this._save.stats.totalGoldEarned += gain;
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
  /** 公开入口：Boss 击败后等外部事件可重新检查章节进度 */
  recheckChapterGoal() {
    this.checkChapterGoal();
  }

  checkChapterGoal() {
    // 无尽模式：检测 boss 阈值，每达到一个阈值触发一次 boss
    if (this._save.endlessMode) {
      this.checkEndlessBoss();
      return;
    }
    const ch = this.chapter;
    const progress = this._save.storyProgress;

    // 50% 里程碑：触发中点剧情
    if (this._save.totalGold >= ch.targetGold / 2n
      && !progress.endsWith('_midpoint') && !progress.endsWith('_revelation') && !progress.endsWith('_ready') && !progress.endsWith('_boss')) {
      this._save.storyProgress = `ch${this._save.chapterId}_midpoint`;
      bus.emit(EVT.MILESTONE_REACHED, { type: 'midpoint', chapter: this._save.chapterId });
    }

    // 75% 揭示：仅第 4 章
    if (this._save.chapterId === 4
      && this._save.totalGold >= ch.targetGold * 3n / 4n
      && progress.endsWith('_midpoint')) {
      this._save.storyProgress = `ch${this._save.chapterId}_revelation`;
      bus.emit(EVT.MILESTONE_REACHED, { type: 'revelation', chapter: 4 });
    }

    // 90% Boss 战触发（每章都有 Boss）
    if (this.currentBossId
      && this._save.totalGold >= ch.targetGold * 9n / 10n
      && !progress.endsWith('_boss') && !progress.endsWith('_ready')
      && !this.isBossDefeated()) {
      this._save.storyProgress = `ch${this._save.chapterId}_boss`;
      bus.emit(EVT.BOSS_TRIGGER, this.currentBossId);
    }

    // 100%：归零就绪
    if (this._save.totalGold < ch.targetGold) return;
    if (progress.endsWith('_ready')) return;
    // 有 Boss 的章节：必须先击败 Boss 才能归零
    if (this.currentBossId && !this.isBossDefeated()) return;
    this._save.storyProgress = `ch${this._save.chapterId}_ready`;
    bus.emit(EVT.PRESTIGE_AVAILABLE);
  }

  /** 无尽模式 boss 阈值检测：totalGold 达到当前 tier 阈值时触发 boss */
  private checkEndlessBoss() {
    // 已触发但未击败 → 等待击败
    if (this._save.storyProgress === 'endless_boss') return;
    const threshold = this.currentEndlessThreshold;
    if (this._save.totalGold >= threshold) {
      this._save.storyProgress = 'endless_boss';
      bus.emit(EVT.BOSS_TRIGGER, this.currentEndlessBossId);
    }
  }

  // 玩家主动关闭归零弹窗：保持 _ready 状态，不再重复弹
  dismissPrestigeModal() {
    // storyProgress 已是 _ready，无需改动；此方法留给 UI 明确语义
  }

  // ===== Boss 战系统 =====
  /** 当前章节对应的 Boss ID（每章都有 Boss） */
  get currentBossId(): 'boss_frost' | 'boss_skull' | 'boss_ghost' | 'boss_chameleon' | 'boss_entropy' | null {
    return this.currentBossIdForChapter(this.chapterId);
  }

  /** 指定章节对应的 Boss ID（用于章节选择页展示） */
  currentBossIdForChapter(chapterId: number): 'boss_frost' | 'boss_skull' | 'boss_ghost' | 'boss_chameleon' | 'boss_entropy' | null {
    switch (chapterId) {
      case 1: return 'boss_frost';
      case 2: return 'boss_skull';
      case 3: return 'boss_ghost';
      case 4: return 'boss_chameleon';
      case 5: return 'boss_entropy';
      default: return null;
    }
  }

  /** 当前章节是否已击败 Boss */
  isBossDefeated(): boolean {
    // 无尽模式：boss 总是可触发（按 tier 推进）
    if (this._save.endlessMode) return false;
    const id = this.currentBossId;
    if (!id) return true;
    return !!this._save.bossDefeated?.[id];
  }

  /** 标记当前章节 Boss 已击败（无尽模式下推进 tier） */
  markBossDefeated() {
    if (this._save.endlessMode) {
      this._save.endlessBossTier = (this._save.endlessBossTier ?? 0) + 1;
      this._save.storyProgress = 'endless'; // 重置，允许下一个阈值检测
      bus.emit(EVT.BOSS_DEFEATED, this.currentEndlessBossId);
      this.saveGame();
      return;
    }
    const id = this.currentBossId;
    if (!id) return;
    if (!this._save.bossDefeated) this._save.bossDefeated = {};
    this._save.bossDefeated[id] = true;
    bus.emit(EVT.BOSS_DEFEATED, id);
  }

  /** Boss 战失败时重置进度：仅无尽模式需要（章节模式失败可由 90% 检测重新进入） */
  resetBossProgressOnFail() {
    if (this._save.endlessMode && this._save.storyProgress === 'endless_boss') {
      this._save.storyProgress = 'endless'; // 退回 'endless'，允许再次积累金币后触发
    }
  }

  // ===== 无尽模式 Boss 阈值系统 =====
  /** 无尽模式当前 tier（已击败的 boss 数量） */
  get endlessBossTier(): number {
    return this._save.endlessBossTier ?? 0;
  }

  /** 无尽模式第 tier 个 boss 的阈值（缩放值）
   *  渐进式增长：前 5 tier 每 tier ×3（原值 10B→30B→90B→270B→810B→2.43C），
   *  之后每 tier ×2，避免 ×10 跨度过大导致卡死。
   *  tier 0 起点为 1e9 缩放值（原值 10B） */
  endlessBossThreshold(tier: number): bigint {
    if (tier < 0) return 0n;
    // 1e9 缩放值（对应原值 1e7 = 10B）
    let result = 1000000000n;
    for (let i = 0; i < tier; i++) {
      result *= (i < 5) ? 3n : 2n;
    }
    return result;
  }

  /** 无尽模式当前未击败 boss 的阈值 */
  get currentEndlessThreshold(): bigint {
    return this.endlessBossThreshold(this.endlessBossTier);
  }

  /** 无尽模式第 tier 个 boss（循环 5 个 boss） */
  endlessBossIdAt(tier: number): 'boss_frost' | 'boss_skull' | 'boss_ghost' | 'boss_chameleon' | 'boss_entropy' {
    const ids: Array<'boss_frost' | 'boss_skull' | 'boss_ghost' | 'boss_chameleon' | 'boss_entropy'> =
      ['boss_frost', 'boss_skull', 'boss_ghost', 'boss_chameleon', 'boss_entropy'];
    return ids[tier % 5];
  }

  /** 无尽模式当前应出现的 boss */
  get currentEndlessBossId(): 'boss_frost' | 'boss_skull' | 'boss_ghost' | 'boss_chameleon' | 'boss_entropy' {
    return this.endlessBossIdAt(this.endlessBossTier);
  }

  /** Boss 最大 HP：章节模式 = targetGold/2，无尽模式 = 当前阈值/2 */
  get bossMaxHpForCurrent(): bigint {
    if (this._save.endlessMode) {
      return this.currentEndlessThreshold / 2n;
    }
    return this.chapter.targetGold / 2n;
  }

  prestige(nextChapter: number) {
    const crystalGainMul = 1 + this.getCrystalLevel('crystalGain') * 0.05;
    // totalGold / 1e6 × crystalGainMul，全在 bigint 域
    const totalGoldNum = fromBig(this._save.totalGold);
    const crystalGain = Math.max(1, Math.floor(totalGoldNum / 1e6 * crystalGainMul));
    this._save.crystal += toBig(crystalGain);
    // 解锁逻辑：归零时把 nextChapter 标记为已解锁
    this._save.chapterId = Math.min(5, nextChapter);
    this._save.maxChapterUnlocked = Math.max(this._save.maxChapterUnlocked ?? 1, this._save.chapterId);
    // 5 章全部通关（nextChapter > 5）→ 解锁无尽模式
    if (nextChapter > 5) {
      this._save.endlessUnlocked = true;
    }
    this._save.endlessMode = false; // 归零后默认进入章节选择，由玩家选择是否进入无尽
    this._save.gold = toBig(this.getCrystalLevel('startGold') * 1000);
    this._save.totalGold = 0n;
    this._save.pegs = [];
    this._save.autoDroppers = {};
    this._save.skillLevels = {};
    this._save.ballInitialValue = toBig(1);
    this._save.storyProgress = `ch${this._save.chapterId}_intro`;
    // 弹珠为永久资产，归零时不重置；仅清除选中状态
    this._save.selectedMarble = '';
    // 重置 Boss 击败记录（进入新章节）
    this._save.bossDefeated = {};
    bus.emit(EVT.GOLD_CHANGED, this._save.gold);
    bus.emit(EVT.CRYSTAL_CHANGED, this._save.crystal);
    bus.emit(EVT.BALL_VALUE_CHANGED, this._save.ballInitialValue);
    bus.emit(EVT.CHAPTER_CHANGED, this._save.chapterId);
    bus.emit(EVT.MARBLE_SELECTED, '');
    this.saveGame();
  }

  /** 最大已解锁章节（1..5） */
  get maxChapterUnlocked(): number {
    return this._save.maxChapterUnlocked ?? 1;
  }

  /** 无尽模式是否已解锁 */
  get endlessUnlocked(): boolean {
    return !!this._save.endlessUnlocked;
  }

  /** 是否处于无尽模式 */
  get endlessMode(): boolean {
    return !!this._save.endlessMode;
  }

  /** 选择并进入已解锁章节（来自章节选择页） */
  enterChapter(chapterId: number) {
    if (chapterId < 1 || chapterId > 5) return;
    if (chapterId > this.maxChapterUnlocked) return;
    this._save.chapterId = chapterId;
    this._save.endlessMode = false;
    this._save.storyProgress = `ch${chapterId}_intro`;
    // 切换章节视为新周目：重置 Boss 击败记录与 pegs
    this._save.pegs = [];
    this._save.autoDroppers = {};
    this._save.skillLevels = {};
    this._save.bossDefeated = {};
    this._save.gold = toBig(this.getCrystalLevel('startGold') * 1000);
    this._save.totalGold = 0n;
    this._save.ballInitialValue = toBig(1);
    this._save.selectedMarble = '';
    bus.emit(EVT.CHAPTER_CHANGED, this._save.chapterId);
    this.saveGame();
  }

  /** 进入无尽模式（无目标金币，持续挂机） */
  enterEndless() {
    if (!this._save.endlessUnlocked) return;
    this._save.endlessMode = true;
    this._save.endlessBossTier = 0; // 重置 tier
    this._save.chapterId = 5; // 使用第 5 章背景
    this._save.pegs = [];
    this._save.autoDroppers = {};
    this._save.skillLevels = {};
    this._save.bossDefeated = {};
    this._save.gold = toBig(this.getCrystalLevel('startGold') * 1000);
    this._save.totalGold = 0n;
    this._save.ballInitialValue = toBig(1);
    this._save.selectedMarble = '';
    this._save.storyProgress = 'endless';
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

  /** 当前连击倍率（只读，不递增连击数；过期返回 1） */
  currentComboMul(): number {
    const now = Date.now();
    if (now - this.comboTimer > 1200) return 1;
    return 1 + Math.min(2, this.combo * 0.05);
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

  // ===== 元素弹珠系统（购买永久拥有 + 升级 + 自动权重） =====
  /** 获取某种元素弹珠的存档状态（未拥有返回默认未购买态） */
  getMarbleSave(id: string): import('../types').MarbleSave {
    return this._save.marbles?.[id] ?? { owned: false, level: 0 };
  }

  /** 是否已购买该弹珠 */
  isMarbleOwned(id: string): boolean {
    return this.getMarbleSave(id).owned;
  }

  /** 当前等级（未拥有返回 0） */
  getMarbleLevel(id: string): number {
    const s = this.getMarbleSave(id);
    return s.owned ? Math.max(1, s.level) : 0;
  }

  /** 当前选中弹珠的配置（无选中返回 null） */
  getSelectedMarbleConfig() {
    const id = this.selectedMarble;
    if (!id || !this.isMarbleOwned(id)) return null;
    return MARBLE_MAP[id] ?? null;
  }

  /** 一次性购买弹珠 */
  buyMarble(id: string): boolean {
    const cfg = MARBLE_MAP[id];
    if (!cfg) return false;
    if (this.isMarbleOwned(id)) {
      bus.emit(EVT.TOAST, '已拥有该弹珠');
      return false;
    }
    const cost = toBig(cfg.purchaseCost);
    if (!this.spendGold(cost)) {
      bus.emit(EVT.TOAST, '金币不足');
      return false;
    }
    if (!this._save.marbles) this._save.marbles = {};
    this._save.marbles[id] = { owned: true, level: 1 };
    bus.emit(EVT.MARBLE_BOUGHT, id);
    return true;
  }

  /** 升级弹珠等级 */
  upgradeMarble(id: string): boolean {
    const cfg = MARBLE_MAP[id];
    if (!cfg) return false;
    if (!this.isMarbleOwned(id)) {
      bus.emit(EVT.TOAST, '请先购买该弹珠');
      return false;
    }
    const lvl = this.getMarbleLevel(id);
    if (lvl >= cfg.maxLevel) {
      bus.emit(EVT.TOAST, '弹珠已满级');
      return false;
    }
    const cost = toBig(Math.floor(cfg.upgradeBaseCost * Math.pow(cfg.upgradeGrowth, lvl - 1)));
    if (!this.spendGold(cost)) {
      bus.emit(EVT.TOAST, '金币不足');
      return false;
    }
    this._save.marbles![id] = { owned: true, level: lvl + 1 };
    bus.emit(EVT.MARBLE_UPGRADED, id, lvl + 1);
    return true;
  }

  /** 升级成本（用于 HUD 显示） */
  getMarbleUpgradeCost(id: string): bigint {
    const cfg = MARBLE_MAP[id];
    if (!cfg) return 0n;
    const lvl = this.getMarbleLevel(id);
    if (lvl <= 0 || lvl >= cfg.maxLevel) return 0n;
    return toBig(Math.floor(cfg.upgradeBaseCost * Math.pow(cfg.upgradeGrowth, lvl - 1)));
  }

  /** 选择元素弹珠（id='' 表示切回普通弹珠）；未拥有不可选 */
  selectMarble(id: string) {
    if (id && !MARBLE_MAP[id]) return;
    if (id && !this.isMarbleOwned(id)) {
      bus.emit(EVT.TOAST, '尚未拥有该弹珠');
      return;
    }
    this._save.selectedMarble = id;
    bus.emit(EVT.MARBLE_SELECTED, id);
  }

  /**
   * 自动投放时按权重抽取一颗元素弹珠；返回其配置或 null（普通弹珠）。
   * 权重池：普通弹珠基础权重 + 各已拥有弹珠的 getAutoWeight(level)。
   */
  pickAutoMarble(): import('../types').MarbleConfig | null {
    const owned = MARBLES.filter((m) => this.isMarbleOwned(m.id));
    if (owned.length === 0) return null;
    let total = MARBLE_NORMAL_WEIGHT;
    for (const m of owned) total += m.getAutoWeight(this.getMarbleLevel(m.id));
    let roll = Math.random() * total;
    if (roll < MARBLE_NORMAL_WEIGHT) return null;
    roll -= MARBLE_NORMAL_WEIGHT;
    for (const m of owned) {
      const w = m.getAutoWeight(this.getMarbleLevel(m.id));
      if (roll < w) return m;
      roll -= w;
    }
    return null;
  }

  // ===== 对话系统 =====
  /** 触发对话：仅在未播放过时触发 */
  triggerDialogue(dialogueId: string, force = false): boolean {
    if (!force && this.seenDialogues.includes(dialogueId)) return false;
    bus.emit(EVT.DIALOGUE_TRIGGER, dialogueId);
    return true;
  }

  /** 标记对话为已观看 */
  markDialogueSeen(dialogueId: string) {
    if (!this._save.seenDialogues) this._save.seenDialogues = [];
    if (!this._save.seenDialogues.includes(dialogueId)) {
      this._save.seenDialogues.push(dialogueId);
    }
  }

  hasSeenDialogue(dialogueId: string): boolean {
    return this.seenDialogues.includes(dialogueId);
  }
}

export const GameState = new GameStateClass();
