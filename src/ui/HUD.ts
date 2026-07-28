// DOM 层 HUD：现代深色像素 UI，SVG 图标，事件驱动更新

import { GameState, formatNum, toBig, fromBig } from '../systems/GameState';
import { bigLog10Abs, SCALE } from '../systems/BigNum';
import { SaveSystem } from '../systems/SaveSystem';
import { bus, EVT } from '../systems/EventBus';
import { PEG_TYPES, PEG_MAP } from '../data/pegs';
import { SKILLS, SKILL_MAP } from '../data/skills';
import { AUTO_DROPPERS, AUTO_MAP, CRYSTAL_UPGRADES } from '../data/chapters';
import { MARBLES } from '../data/marbles';
import { svgIcon, operatorIcon, type IconKey } from './icons';
import type { PegSave } from '../types';

export class HUD {
  private scene: Phaser.Scene;
  private root: HTMLElement;
  private shopTab: 'pegs' | 'autos' | 'skills' | 'global' | 'marbles' = 'pegs';
  private onPlacementSelect?: (typeId: string | null) => void;
  private selectedPegType: string | null = null;


  // 实时金币获取速率：基于 totalGold 的 5s 滚动窗口
  private rateSamples: { t: number; total: number }[] = [];
  private rateTimer: number | null = null;
  private rateLastTotal = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.root = document.getElementById('hud')!;
  }

  setPlacementCallback(cb: (typeId: string | null) => void) {
    this.onPlacementSelect = cb;
  }

  mount() {
    this.root.style.display = 'block';
    this.injectIcons();
    this.bindHeader();
    this.bindShopTabs();
    this.bindPanelToggles();
    this.renderShop();
    this.bindModals();
    this.bindEvents();

    this.updateHeader();
    this.startRateTracking();
    this.updateChapterProgress();
  }

  unmount() {
    this.root.style.display = 'none';
    this.stopRateTracking();
  }

  private injectIcons() {
    const map: Record<string, IconKey> = {
      'icon-gold': 'gold', 'icon-crystal': 'crystal', 'icon-ball': 'ball',
      'icon-chapter': 'chapter', 'icon-menu': 'menu', 'icon-pegs': 'pegs',
      'icon-prestige': 'prestige', 'icon-ending': 'ending',
      'icon-save': 'save', 'icon-save2': 'save', 'icon-home': 'home', 'icon-trash': 'trash',
      'icon-pegs-dup': 'pegs', 'icon-prestige2': 'prestige',
    };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.innerHTML = svgIcon(key, 14);
    }
  }

  private bindHeader() {
    document.getElementById('btn-menu')!.addEventListener('click', () => {
      // 归零弹窗只在 _ready 时显示，菜单按钮保持原样
      document.getElementById('modal-menu')!.classList.add('open');
    });
    document.getElementById('btn-prestige')!.addEventListener('click', () => {
      this.handlePrestigeClick();
    });
  }

  /** 归零按钮：达标则打开归零试炼弹窗，未达标则提示进度 */
  private handlePrestigeClick() {
    const ch = GameState.chapter;
    if (GameState.save.totalGold >= ch.targetGold) {
      this.showPrestigeModal();
      return;
    }
    const tg = fromBig(ch.targetGold);
    const cur = fromBig(GameState.save.totalGold);
    const pct = isFinite(tg) && tg > 0 ? Math.min(99.9, (cur / tg) * 100) : 0;
    this.showToast(`归零进度 ${pct.toFixed(1)}%`, 'prestige');
  }

  /** 根据是否达到归零条件切换按钮高亮态 */
  private updatePrestigeButtonState() {
    const btn = document.getElementById('btn-prestige');
    if (!btn) return;
    const ready = GameState.save.totalGold >= GameState.chapter.targetGold;
    btn.classList.toggle('ready', ready);
  }

  private bindPanelToggles() {
    const panel = document.getElementById('left-panel')!;
    const backdrop = document.getElementById('shop-backdrop')!;
    const toggle = (open?: boolean) => {
      const willOpen = open !== undefined ? open : panel.classList.contains('collapsed');
      panel.classList.toggle('collapsed', !willOpen);
      backdrop.classList.toggle('show', willOpen);
    };
    // 点击标题条切换展开/收起
    document.querySelector('#left-panel .panel-title')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });
    // 点击遮罩收起
    backdrop.addEventListener('click', () => toggle(false));
  }

  private bindShopTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach((t) => {
      t.addEventListener('click', (e) => {
        tabs.forEach((x) => x.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        this.shopTab = (e.currentTarget as HTMLElement).dataset.tab as 'pegs' | 'autos' | 'skills' | 'global';
        this.renderShop();
      });
    });
  }

  private bindModals() {
    document.getElementById('prestige-cancel')!.addEventListener('click', () => {
      document.getElementById('modal-prestige')!.classList.remove('open');
    });
    document.getElementById('prestige-confirm')!.addEventListener('click', () => {
      document.getElementById('modal-prestige')!.classList.remove('open');
      GameState.prestige(GameState.chapterId + 1);
      // 归零后直接进入下一章游戏，不再播放剧情
      this.scene.scene.start('Game');
    });

    document.getElementById('menu-home')!.addEventListener('click', () => {
      document.getElementById('modal-menu')!.classList.remove('open');
      GameState.saveGame();
      this.scene.scene.start('Menu');
    });
    document.getElementById('menu-save')!.addEventListener('click', () => {
      GameState.saveGame();
      this.showToast('已保存', 'save');
      document.getElementById('modal-menu')!.classList.remove('open');
    });
    document.getElementById('menu-wipe')!.addEventListener('click', () => {
      if (confirm(`确定要清空当前存档（槽位 ${GameState.slot + 1}）吗？此操作不可恢复。`)) {
        SaveSystem.wipeSlot(GameState.slot);
        location.reload();
      }
    });

    // 点击遮罩关闭
    for (const id of ['modal-prestige', 'modal-menu']) {
      document.getElementById(id)!.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          (e.currentTarget as HTMLElement).classList.remove('open');
        }
      });
    }
  }

  private bindEvents() {
    bus.on(EVT.GOLD_CHANGED, () => this.updateHeader());
    bus.on(EVT.GOLD_CHANGED, () => this.updateRate());
    bus.on(EVT.GOLD_CHANGED, () => this.updatePrestigeButtonState());
    bus.on(EVT.CRYSTAL_CHANGED, () => this.updateHeader());
    bus.on(EVT.BALL_VALUE_CHANGED, () => this.updateHeader());
    bus.on(EVT.CHAPTER_CHANGED, () => this.updateChapterProgress());
    bus.on(EVT.PEG_PLACED, () => { this.updateHeader(); this.renderShop(); });
    bus.on(EVT.PEG_UPGRADED, () => { this.updateHeader(); this.renderShop(); });
    bus.on(EVT.PEG_SOLD, () => { this.updateHeader(); this.renderShop(); });
    bus.on(EVT.SKILL_BOUGHT, () => { this.updateHeader(); this.renderShop(); });
    bus.on(EVT.AUTO_BOUGHT, () => { this.updateHeader(); this.renderShop(); });
    bus.on(EVT.PRESTIGE_AVAILABLE, () => this.showPrestigeModal());
    bus.on(EVT.TOAST, (msg: unknown) => this.showToast(String(msg), 'info'));
  }

  private updateHeader() {
    document.getElementById('gold-val')!.textContent = formatNum(GameState.gold);
    document.getElementById('crystal-val')!.textContent = formatNum(GameState.crystal);
    document.getElementById('ball-val')!.textContent = formatNum(GameState.ballInitialValue);
    this.updateDigitProgress();
  }

  // ===== 实时金币获取速率 =====
  private startRateTracking() {
    this.rateLastTotal = fromBig(GameState.save.totalGold);
    this.rateSamples = [{ t: performance.now(), total: this.rateLastTotal }];
    if (this.rateTimer !== null) clearInterval(this.rateTimer);
    this.rateTimer = window.setInterval(() => this.updateRate(), 250);
    this.updateRate();
  }

  private stopRateTracking() {
    if (this.rateTimer !== null) {
      clearInterval(this.rateTimer);
      this.rateTimer = null;
    }
  }

  /** 基于 totalGold 的 5s 滚动窗口计算金币/秒；窗口内无收益时速率平滑衰减至 0 */
  private updateRate() {
    const now = performance.now();
    let total = fromBig(GameState.save.totalGold);
    // 归零/换章会重置 totalGold → 清空样本重新计量
    if (!isFinite(total) || total < this.rateLastTotal) {
      this.rateSamples = [];
      this.rateLastTotal = isFinite(total) ? total : 0;
    } else {
      this.rateLastTotal = total;
    }
    this.rateSamples.push({ t: now, total: this.rateLastTotal });
    const WINDOW = 5000;
    while (this.rateSamples.length > 2 && now - this.rateSamples[0].t > WINDOW) {
      this.rateSamples.shift();
    }
    let rate = 0;
    if (this.rateSamples.length >= 2) {
      const first = this.rateSamples[0];
      const dt = (now - first.t) / 1000;
      if (dt > 0.15) rate = (this.rateLastTotal - first.total) / dt;
    }
    const el = document.getElementById('gold-rate');
    if (el) {
      el.textContent = this.formatRate(rate);
      el.classList.toggle('has', rate > 0.01);
    }
  }

  private formatRate(r: number): string {
    if (!isFinite(r) || r <= 0) return '+0/s';
    if (r < 1000) return '+' + (r < 10 ? r.toFixed(1) : Math.floor(r)) + '/s';
    return '+' + formatNum(toBig(r)) + '/s';
  }

  // ===== 金币位数进度条 =====
  /** 当前金币距离下一个 10 的幂（位数）的进度，0~100% */
  private updateDigitProgress() {
    const fillEl = document.getElementById('dp-fill');
    const targetEl = document.getElementById('dp-target');
    if (!fillEl || !targetEl) return;
    const gold = GameState.gold;
    if (gold <= 0n) {
      fillEl.style.width = '0%';
      targetEl.textContent = '10';
      return;
    }
    // log10(原始值) = log10(缩放值) - log10(SCALE)
    const log10Gold = bigLog10Abs(gold) - Math.log10(Number(SCALE));
    const floor = Math.floor(log10Gold);
    const frac = log10Gold - floor; // 当前位数内的对数余量 0~1
    // 转为数值空间进度：(10^frac - 1) / 9，越接近下一位数越接近 100%
    const progress = (Math.pow(10, frac) - 1) / 9;
    fillEl.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
    targetEl.textContent = this.formatPow10(floor + 1);
  }

  private formatPow10(pow: number): string {
    if (pow <= 0) return '10';
    if (pow <= 15) return formatNum(toBig(Math.pow(10, pow)));
    return '10^' + pow;
  }

  private updateChapterProgress() {
    const ch = GameState.chapter;
    document.getElementById('chapter-name')!.textContent = `第 ${ch.id} 章 · ${ch.name}`;
    // bigint 比较避免大数精度问题；未达标时用 fromBig 估算比例
    let progress: number;
    if (GameState.save.totalGold >= ch.targetGold) progress = 1;
    else {
      const tg = fromBig(ch.targetGold);
      progress = isFinite(tg) && tg > 0 ? Math.min(1, fromBig(GameState.save.totalGold) / tg) : 0;
    }
    document.getElementById('chapter-progress')!.style.width = `${progress * 100}%`;
    this.updatePrestigeButtonState();
  }

  private renderShop() {
    const list = document.getElementById('shop-list')!;
    list.innerHTML = '';
    if (this.shopTab === 'pegs') this.renderPegShop(list);
    else if (this.shopTab === 'autos') this.renderAutoShop(list);
    else if (this.shopTab === 'skills') this.renderSkillShop(list);
    else if (this.shopTab === 'marbles') this.renderMarbleCodex(list);
    else this.renderGlobalShop(list);
  }

  /** 弹珠图鉴刷新：仅在弹珠 tab 激活时重渲染 */
  refreshMarbleCodex() {
    if (this.shopTab === 'marbles') this.renderShop();
  }

  /** 弹珠图鉴：展示所有元素弹珠的剩余次数与效果说明 */
  private renderMarbleCodex(list: HTMLElement) {
    const tip = document.createElement('div');
    tip.style.cssText = 'color: var(--muted); font-size: 11px; line-height: 1.6; margin-bottom: 10px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px;';
    tip.textContent = '点击选中弹珠后，手动投放时消耗 1 次。每章自动补充。';
    list.appendChild(tip);

    for (const m of MARBLES) {
      const charges = GameState.getMarbleCharges(m.id);
      const selected = GameState.selectedMarble === m.id;
      const el = document.createElement('div');
      el.className = 'marble-codex-card';
      el.innerHTML = `
        <div class="marble-codex-icon" style="background: #${(m.color).toString(16).padStart(6, '0')}33; border-color: #${(m.color).toString(16).padStart(6, '0')};">
          <div class="marble-ball" style="background: radial-gradient(circle at 35% 35%, #${(m.color).toString(16).padStart(6, '0')}, #${(m.color).toString(16).padStart(6, '0')}99); box-shadow: 0 0 6px #${(m.color).toString(16).padStart(6, '0')}66;"></div>
        </div>
        <div class="marble-codex-body">
          <div class="marble-codex-name">
            <span>${m.name}</span>
            <span class="marble-codex-charges">剩余 ${charges}/${m.charges}</span>
            ${selected ? `<span class="marble-codex-charges" style="color:var(--gold); border-color: var(--gold);">已选中</span>` : ''}
          </div>
          <div class="marble-codex-effect">${m.effect}</div>
          <div class="marble-codex-desc">${m.desc}</div>
        </div>
      `;
      el.addEventListener('click', () => {
        if (charges > 0) {
          GameState.selectMarble(selected ? '' : m.id);
          this.renderShop();
        } else {
          this.showToast(`${m.name} 已用完`, 'info');
        }
      });
      list.appendChild(el);
    }
  }



  private renderPegShop(list: HTMLElement) {
    for (const cfg of PEG_TYPES) {
      // 直接前置本身的前置未达 → 当前项隐藏（递归隐藏：前置链上某项未解锁则整条链不显示）
      if (cfg.prereq) {
        const pre = PEG_MAP[cfg.prereq.id];
        if (pre && !GameState.isPegPrereqMet(pre)) continue;
      }

      const prereqMet = GameState.isPegPrereqMet(cfg);
      const count = GameState.pegs.filter((p) => p.typeId === cfg.id).length;
      const cost = toBig(Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, count)));
      const afford = GameState.gold >= cost;
      const selected = this.selectedPegType === cfg.id;

      // 前置未达成的锁定文案
      let lockText = '';
      if (!prereqMet && cfg.prereq) {
        const pre = PEG_MAP[cfg.prereq.id];
        const cur = GameState.pegs.filter((p) => p.typeId === cfg.prereq!.id).length;
        lockText = `前置：${pre?.name ?? cfg.prereq.id} ${cur}/${cfg.prereq.level}`;
      }

      const el = document.createElement('div');
      el.className = `shop-item ${prereqMet ? '' : 'locked'}`;
      if (selected) el.style.borderColor = '#f5c542';
      el.innerHTML = `
        <div class="item-head">
          <div class="item-icon peg-icon" style="border-color:#${cfg.color.toString(16).padStart(6,'0')}">${operatorIcon(cfg.operator, 16, '#'+cfg.color.toString(16).padStart(6,'0'))}</div>
          <div class="item-name">${cfg.name}</div>
          ${count > 0 ? `<div class="item-level">×${count}</div>` : ''}
        </div>
        <div class="item-desc">${cfg.desc}</div>
        ${!prereqMet ? `<div class="item-cost cant">${lockText}</div>` :
          `<div class="item-cost ${afford ? 'afford' : 'cant'}">${svgIcon('gold', 12)} ${formatNum(cost)}</div>`}
      `;
      if (prereqMet) {
        el.addEventListener('click', () => {
          this.selectedPegType = this.selectedPegType === cfg.id ? null : cfg.id;
          this.onPlacementSelect?.(this.selectedPegType);
          this.renderShop();
        });
      }
      list.appendChild(el);
    }
  }

  private renderAutoShop(list: HTMLElement) {
    for (const cfg of AUTO_DROPPERS) {
      // 直接前置本身的前置未达 → 当前项隐藏（递归隐藏）
      if (cfg.prereq) {
        const pre = AUTO_MAP[cfg.prereq.id];
        if (pre && !GameState.isAutoPrereqMet(pre)) continue;
      }

      const prereqMet = GameState.isAutoPrereqMet(cfg);
      const info = GameState.getAutoDropperInfo(cfg.id);
      const buyCost = GameState.getAutoDropperCost(cfg.id);
      const speedCost = GameState.getAutoDropperSpeedUpgradeCost(cfg.id);
      const canBuy = prereqMet && info.count < cfg.maxCount && GameState.gold >= buyCost;
      const canSpeed = prereqMet && info.count > 0 && info.speedLevel < cfg.maxSpeedLevel && GameState.gold >= speedCost;
      const buyMaxed = info.count >= cfg.maxCount;
      const speedMaxed = info.speedLevel >= cfg.maxSpeedLevel;
      const currentInterval = cfg.interval * Math.max(0.1, 1 - info.speedLevel * cfg.speedPerLevel);

      // 前置未达成的锁定文案
      let lockText = '';
      if (!prereqMet && cfg.prereq) {
        const pre = AUTO_MAP[cfg.prereq.id];
        const cur = GameState.getAutoDropperInfo(cfg.prereq.id).count;
        lockText = `前置：${pre?.name ?? cfg.prereq.id} ${cur}/${cfg.prereq.level}`;
      }

      const el = document.createElement('div');
      el.className = `shop-item ${prereqMet ? '' : 'locked'}`;
      el.innerHTML = `
        <div class="item-head">
          <div class="item-icon">${svgIcon(cfg.icon as IconKey, 16)}</div>
          <div class="item-name">${cfg.name}</div>
          <div class="item-level">×${info.count}/${cfg.maxCount}</div>
        </div>
        <div class="item-desc">${cfg.desc}</div>
        <div class="item-effect">间隔 ${currentInterval.toFixed(2)}s · 速度 Lv.${info.speedLevel}/${cfg.maxSpeedLevel}</div>
        ${!prereqMet ? `<div class="item-cost cant">${lockText}</div>` : `
        <div class="item-actions">
          <button class="mini-btn ${buyMaxed ? 'maxed' : (canBuy ? 'afford' : 'cant')}" data-act="buy" ${buyMaxed ? 'disabled' : ''}>
            ${buyMaxed ? '已满' : `${svgIcon('gold', 11)} 买 ${formatNum(buyCost)}`}
          </button>
          <button class="mini-btn speed ${speedMaxed ? 'maxed' : (canSpeed ? 'afford' : 'cant')}" data-act="speed" ${speedMaxed || info.count === 0 ? 'disabled' : ''}>
            ${speedMaxed ? '满速' : `${svgIcon('gold', 11)} 升 ${formatNum(speedCost)}`}
          </button>
        </div>`}
      `;
      if (prereqMet) {
        el.querySelector('[data-act="buy"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (GameState.buyAutoDropper(cfg.id)) this.renderShop();
        });
        el.querySelector('[data-act="speed"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (GameState.upgradeAutoDropperSpeed(cfg.id)) this.renderShop();
        });
      }
      list.appendChild(el);
    }
  }

  private renderGlobalShop(list: HTMLElement) {
    for (const cfg of CRYSTAL_UPGRADES) {
      const lvl = GameState.getCrystalLevel(cfg.id);
      const cost = toBig(Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, lvl)));
      const afford = GameState.crystal >= cost;
      const maxed = lvl >= cfg.maxLevel;
      const el = document.createElement('div');
      el.className = `shop-item ${maxed ? 'locked' : ''}`;
      el.innerHTML = `
        <div class="item-head">
          <div class="item-icon">${svgIcon(cfg.icon as IconKey, 16)}</div>
          <div class="item-name">${cfg.name}</div>
          <div class="item-level">Lv.${lvl}/${cfg.maxLevel}</div>
        </div>
        <div class="item-desc">${cfg.desc}</div>
        <div class="item-effect">${cfg.effect(lvl)}</div>
        ${maxed ? `<div class="item-cost cant">已满级</div>` :
          `<div class="item-cost ${afford ? 'afford' : 'cant'}">${svgIcon('crystal', 12)} ${formatNum(cost)}</div>`}
      `;
      if (!maxed) {
        el.addEventListener('click', () => {
          GameState.buyCrystalUpgrade(cfg.id);
          this.updateHeader();
          this.renderShop();
        });
      }
      list.appendChild(el);
    }
  }

  private renderSkillShop(list: HTMLElement) {
    for (const cfg of SKILLS) {
      if (cfg.category === 'active') continue;
      // 直接前置本身的前置未达 → 当前项隐藏（递归隐藏）
      if (cfg.prereq) {
        const pre = SKILL_MAP[cfg.prereq.id];
        if (pre && !GameState.isSkillPrereqMet(pre)) continue;
      }

      const prereqMet = GameState.isSkillPrereqMet(cfg);
      const lvl = GameState.getSkillLevel(cfg.id);
      const maxLevel = GameState.getSkillMaxLevel(cfg);
      const maxed = lvl >= maxLevel;
      const cost = toBig(Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, lvl)));
      const afford = GameState.gold >= cost;

      // 前置未达成的锁定文案
      let lockText = '';
      if (!prereqMet && cfg.prereq) {
        const pre = SKILL_MAP[cfg.prereq.id];
        const cur = GameState.getSkillLevel(cfg.prereq.id);
        lockText = `前置：${pre?.name ?? cfg.prereq.id} Lv.${cur}/${cfg.prereq.level}`;
      }

      const el = document.createElement('div');
      el.className = `skill-item ${(!prereqMet || maxed) ? 'locked' : ''}`;
      el.innerHTML = `
        <div class="item-head">
          <div class="item-icon">${svgIcon(cfg.icon as IconKey, 16)}</div>
          <div class="item-name">${cfg.name}</div>
          <div class="item-level">Lv.${lvl}/${maxLevel}</div>
        </div>
        <div class="item-desc">${cfg.desc}</div>
        <div class="item-effect">${cfg.effect(lvl)}</div>
        ${!prereqMet ? `<div class="item-cost cant">${lockText}</div>` :
          (maxed ? `<div class="item-cost cant">已满级</div>` :
          `<div class="item-cost ${afford ? 'afford' : 'cant'}">${svgIcon('gold', 12)} ${formatNum(cost)}</div>`)}
      `;
      if (prereqMet && !maxed) {
        el.addEventListener('click', () => {
          GameState.buySkill(cfg.id);
        });
      }
      list.appendChild(el);
    }
  }

  private showPrestigeModal() {
    document.getElementById('prestige-gold')!.textContent = formatNum(GameState.save.totalGold);
    document.getElementById('modal-prestige')!.classList.add('open');
  }

  showToast(msg: string, icon: IconKey = 'info') {
    const toast = document.getElementById('toast')!;
    toast.innerHTML = `${svgIcon(icon, 14)} ${msg}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // 供 GameScene 调用，显示钉子操作菜单
  showPegContextMenu(peg: PegSave, _x: number, _y: number, onUpgrade: () => void, onSell: () => void) {
    // 简单用 confirm 实现，避免额外 DOM
    const cfg = PEG_MAP[peg.typeId];
    const choice = confirm(`【${cfg.name} Lv.${peg.level}】\n左键确定 = 升级，右键/取消 = 出售`);
    if (choice) onUpgrade();
    else onSell();
  }
}
