// DOM 层 HUD：现代深色像素 UI，SVG 图标，事件驱动更新

import { GameState, formatNum, toBig, fromBig } from '../systems/GameState';
import { SaveSystem } from '../systems/SaveSystem';
import { bus, EVT } from '../systems/EventBus';
import { PEG_TYPES, PEG_MAP } from '../data/pegs';
import { SKILLS, SKILL_MAP, ACTIVE_SKILLS } from '../data/skills';
import { AUTO_DROPPERS, AUTO_MAP, CRYSTAL_UPGRADES } from '../data/chapters';
import { svgIcon, operatorIcon, type IconKey } from './icons';
import type { PegSave } from '../types';

const KEY_HINTS = ['1', '2', '3', '4', '5'];

export class HUD {
  private scene: Phaser.Scene;
  private root: HTMLElement;
  private shopTab: 'pegs' | 'autos' | 'global' = 'pegs';
  private activeSlots: Map<string, HTMLElement> = new Map();
  private onPlacementSelect?: (typeId: string | null) => void;
  private selectedPegType: string | null = null;

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
    this.renderSkills();
    this.renderActives();
    this.bindModals();
    this.bindEvents();
    this.updateHeader();
    this.updateChapterProgress();
  }

  unmount() {
    this.root.style.display = 'none';
  }

  private injectIcons() {
    const map: Record<string, IconKey> = {
      'icon-gold': 'gold', 'icon-crystal': 'crystal', 'icon-ball': 'ball',
      'icon-chapter': 'chapter', 'icon-menu': 'menu', 'icon-pegs': 'pegs',
      'icon-skills': 'skills', 'icon-prestige': 'prestige', 'icon-ending': 'ending',
      'icon-save': 'save', 'icon-save2': 'save', 'icon-home': 'home', 'icon-trash': 'trash',
      'icon-pegs-dup': 'pegs', 'icon-skills-dup': 'skills',
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
  }

  private bindPanelToggles() {
    const shopBtn = document.getElementById('toggle-shop');
    const skillBtn = document.getElementById('toggle-skill');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    shopBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      leftPanel?.classList.toggle('open');
      rightPanel?.classList.remove('open');
    });
    skillBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      rightPanel?.classList.toggle('open');
      leftPanel?.classList.remove('open');
    });
    // 面板标题折叠按钮（所有屏幕尺寸）
    document.querySelectorAll('.collapse-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = (btn as HTMLElement).dataset.target;
        if (!targetId) return;
        document.getElementById(targetId)?.classList.toggle('collapsed');
      });
    });
    // 点击空白处收起移动端面板
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#left-panel') && !target.closest('#toggle-shop') && !target.closest('.shop-item')) {
        if (window.innerWidth <= 640) leftPanel?.classList.remove('open');
      }
      if (!target.closest('#right-panel') && !target.closest('#toggle-skill') && !target.closest('.skill-item')) {
        if (window.innerWidth <= 640) rightPanel?.classList.remove('open');
      }
    });
  }

  private bindShopTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach((t) => {
      t.addEventListener('click', (e) => {
        tabs.forEach((x) => x.classList.remove('active'));
        (e.currentTarget as HTMLElement).classList.add('active');
        this.shopTab = (e.currentTarget as HTMLElement).dataset.tab as 'pegs' | 'autos' | 'global';
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
    bus.on(EVT.CRYSTAL_CHANGED, () => this.updateHeader());
    bus.on(EVT.BALL_VALUE_CHANGED, () => this.updateHeader());
    bus.on(EVT.CHAPTER_CHANGED, () => this.updateChapterProgress());
    bus.on(EVT.PEG_PLACED, () => { this.updateHeader(); this.renderShop(); });
    bus.on(EVT.PEG_UPGRADED, () => { this.updateHeader(); this.renderShop(); });
    bus.on(EVT.PEG_SOLD, () => { this.updateHeader(); this.renderShop(); });
    bus.on(EVT.SKILL_BOUGHT, () => { this.updateHeader(); this.renderSkills(); this.renderActives(); });
    bus.on(EVT.AUTO_BOUGHT, () => { this.updateHeader(); this.renderShop(); });
    bus.on(EVT.PRESTIGE_AVAILABLE, () => this.showPrestigeModal());
    bus.on(EVT.TOAST, (msg: unknown) => this.showToast(String(msg), 'info'));
  }

  private updateHeader() {
    document.getElementById('gold-val')!.textContent = formatNum(GameState.gold);
    document.getElementById('crystal-val')!.textContent = formatNum(GameState.crystal);
    document.getElementById('ball-val')!.textContent = formatNum(GameState.ballInitialValue);
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
  }

  private renderShop() {
    const list = document.getElementById('shop-list')!;
    list.innerHTML = '';
    if (this.shopTab === 'pegs') this.renderPegShop(list);
    else if (this.shopTab === 'autos') this.renderAutoShop(list);
    else this.renderGlobalShop(list);
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

  private renderSkills() {
    const list = document.getElementById('skill-list')!;
    list.innerHTML = '';
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

  private renderActives() {
    const bar = document.getElementById('active-bar')!;
    bar.innerHTML = '';
    this.activeSlots.clear();
    let idx = 0;
    for (const cfg of ACTIVE_SKILLS) {
      const el = document.createElement('div');
      el.className = 'active-slot';
      el.title = `${cfg.name}: ${cfg.desc} (冷却 ${cfg.cooldown}s)`;
      el.innerHTML = `
        <div class="icon-wrap">${svgIcon(cfg.icon as IconKey, 26)}</div>
        <div class="cooldown" style="height:0%"></div>
        <div class="dur-bar" style="width:0%"></div>
        <div class="key-hint">${KEY_HINTS[idx] ?? ''}</div>
      `;
      el.addEventListener('click', () => GameState.triggerActive(cfg.id));
      bar.appendChild(el);
      this.activeSlots.set(cfg.id, el);
      idx++;
    }
  }

  updateActives() {
    for (const cfg of ACTIVE_SKILLS) {
      const el = this.activeSlots.get(cfg.id);
      if (!el) continue;
      const info = GameState.activeCooldownInfo(cfg.id);
      const cdOverlay = el.querySelector('.cooldown') as HTMLElement;
      const durBar = el.querySelector('.dur-bar') as HTMLElement;
      if (info.durRatio > 0 && info.durRatio < 1) {
        el.classList.add('active-now');
        el.classList.remove('ready');
        cdOverlay.style.height = '0%';
        durBar.style.width = `${(1 - info.durRatio) * 100}%`;
      } else if (!info.ready) {
        el.classList.remove('active-now', 'ready');
        cdOverlay.style.height = `${(1 - info.cdRatio) * 100}%`;
        durBar.style.width = '0%';
      } else {
        el.classList.add('ready');
        el.classList.remove('active-now');
        cdOverlay.style.height = '0%';
        durBar.style.width = '0%';
      }
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
