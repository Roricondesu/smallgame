// DOM 层 HUD：现代深色像素 UI，SVG 图标，事件驱动更新

import { GameState, formatNum } from '../systems/GameState';
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
      // 如果当前已可归零（_ready 状态），在菜单里显示归零试炼按钮
      const ready = GameState.save.storyProgress.endsWith('_ready');
      const btn = document.getElementById('menu-prestige')!;
      btn.style.display = ready ? '' : 'none';
      document.getElementById('modal-menu')!.classList.add('open');
    });
    // 菜单里的"归零试炼"按钮：重新打开归零弹窗
    document.getElementById('menu-prestige')!.addEventListener('click', () => {
      document.getElementById('modal-menu')!.classList.remove('open');
      this.showPrestigeModal();
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
      this.scene.scene.start('Story', { type: 'intro', chapterId: GameState.chapterId });
    });

    document.getElementById('ending-reset')!.addEventListener('click', () => {
      document.getElementById('modal-ending')!.classList.remove('open');
      GameState.prestige(5);
      this.scene.scene.start('Story', { type: 'ending_true', chapterId: 5 });
    });
    document.getElementById('ending-continue')!.addEventListener('click', () => {
      document.getElementById('modal-ending')!.classList.remove('open');
      GameState.save.storyProgress = 'ch5_bad';
      this.scene.scene.start('Story', { type: 'ending_bad', chapterId: 5 });
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
      if (confirm('确定要清空所有存档吗？此操作不可恢复。')) {
        localStorage.removeItem('pinball_alchemy_save_v1');
        location.reload();
      }
    });

    // 点击遮罩关闭
    for (const id of ['modal-prestige', 'modal-ending', 'modal-menu']) {
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
    bus.on(EVT.ENDING_CHOICE, () => this.showEndingModal());
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
    const progress = Math.min(1, GameState.save.totalGold / ch.targetGold);
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
      const chapterUnlocked = cfg.unlockChapter <= GameState.chapterId;
      const prereqMet = GameState.isPegPrereqMet(cfg);
      const unlocked = chapterUnlocked && prereqMet;
      const count = GameState.pegs.filter((p) => p.typeId === cfg.id).length;
      const cost = Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, count));
      const afford = GameState.gold >= cost;
      const selected = this.selectedPegType === cfg.id;

      // 锁定原因文案
      let lockText = '';
      if (!chapterUnlocked) lockText = `第 ${cfg.unlockChapter} 章解锁`;
      else if (!prereqMet && cfg.prereq) {
        const prereq = cfg.prereq;
        const pre = PEG_MAP[prereq.id];
        const cur = GameState.pegs.filter((p) => p.typeId === prereq.id).length;
        lockText = `前置：${pre?.name ?? prereq.id} ${cur}/${prereq.level}`;
      }

      const el = document.createElement('div');
      el.className = `shop-item ${unlocked ? '' : 'locked'}`;
      if (selected) el.style.borderColor = '#f5c542';
      el.innerHTML = `
        <div class="item-head">
          <div class="item-icon peg-icon" style="border-color:#${cfg.color.toString(16).padStart(6,'0')}">${operatorIcon(cfg.operator, 16, '#'+cfg.color.toString(16).padStart(6,'0'))}</div>
          <div class="item-name">${cfg.name}</div>
          ${count > 0 ? `<div class="item-level">×${count}</div>` : ''}
        </div>
        <div class="item-desc">${cfg.desc}</div>
        ${!unlocked ? `<div class="item-cost cant">${lockText}</div>` :
          `<div class="item-cost ${afford ? 'afford' : 'cant'}">${svgIcon('gold', 12)} ${formatNum(cost)}</div>`}
      `;
      if (unlocked) {
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
      const chapterUnlocked = cfg.unlockChapter <= GameState.chapterId;
      const prereqMet = GameState.isAutoPrereqMet(cfg);
      const unlocked = chapterUnlocked && prereqMet;
      const info = GameState.getAutoDropperInfo(cfg.id);
      const buyCost = GameState.getAutoDropperCost(cfg.id);
      const speedCost = GameState.getAutoDropperSpeedUpgradeCost(cfg.id);
      const canBuy = unlocked && info.count < cfg.maxCount && GameState.gold >= buyCost;
      const canSpeed = unlocked && info.count > 0 && info.speedLevel < cfg.maxSpeedLevel && GameState.gold >= speedCost;
      const buyMaxed = info.count >= cfg.maxCount;
      const speedMaxed = info.speedLevel >= cfg.maxSpeedLevel;
      const currentInterval = cfg.interval * Math.max(0.1, 1 - info.speedLevel * cfg.speedPerLevel);

      // 锁定原因文案
      let lockText = '';
      if (!chapterUnlocked) lockText = `第 ${cfg.unlockChapter} 章解锁`;
      else if (!prereqMet && cfg.prereq) {
        const pre = AUTO_MAP[cfg.prereq.id];
        const cur = GameState.getAutoDropperInfo(cfg.prereq.id).count;
        lockText = `前置：${pre?.name ?? cfg.prereq.id} ${cur}/${cfg.prereq.level}`;
      }

      const el = document.createElement('div');
      el.className = `shop-item ${unlocked ? '' : 'locked'}`;
      el.innerHTML = `
        <div class="item-head">
          <div class="item-icon">${svgIcon(cfg.icon as IconKey, 16)}</div>
          <div class="item-name">${cfg.name}</div>
          <div class="item-level">×${info.count}/${cfg.maxCount}</div>
        </div>
        <div class="item-desc">${cfg.desc}</div>
        <div class="item-effect">间隔 ${currentInterval.toFixed(2)}s · 速度 Lv.${info.speedLevel}/${cfg.maxSpeedLevel}</div>
        ${!unlocked ? `<div class="item-cost cant">${lockText}</div>` : `
        <div class="item-actions">
          <button class="mini-btn ${buyMaxed ? 'maxed' : (canBuy ? 'afford' : 'cant')}" data-act="buy" ${buyMaxed ? 'disabled' : ''}>
            ${buyMaxed ? '已满' : `${svgIcon('gold', 11)} 买 ${formatNum(buyCost)}`}
          </button>
          <button class="mini-btn speed ${speedMaxed ? 'maxed' : (canSpeed ? 'afford' : 'cant')}" data-act="speed" ${speedMaxed || info.count === 0 ? 'disabled' : ''}>
            ${speedMaxed ? '满速' : `${svgIcon('gold', 11)} 升 ${formatNum(speedCost)}`}
          </button>
        </div>`}
      `;
      if (unlocked) {
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
      const unlocked = cfg.unlockChapter <= GameState.chapterId;
      const lvl = GameState.getCrystalLevel(cfg.id);
      const cost = Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, lvl));
      const afford = GameState.crystal >= cost;
      const maxed = lvl >= cfg.maxLevel;
      const el = document.createElement('div');
      el.className = `shop-item ${(!unlocked || maxed) ? 'locked' : ''}`;
      el.innerHTML = `
        <div class="item-head">
          <div class="item-icon">${svgIcon(cfg.icon as IconKey, 16)}</div>
          <div class="item-name">${cfg.name}</div>
          <div class="item-level">Lv.${lvl}/${cfg.maxLevel}</div>
        </div>
        <div class="item-desc">${cfg.desc}</div>
        <div class="item-effect">${cfg.effect(lvl)}</div>
        ${!unlocked ? `<div class="item-cost cant">第 ${cfg.unlockChapter} 章解锁</div>` :
          `<div class="item-cost ${afford && !maxed ? 'afford' : 'cant'}">${svgIcon('crystal', 12)} ${formatNum(cost)}</div>`}
      `;
      if (unlocked && !maxed) {
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
      const chapterUnlocked = cfg.unlockChapter <= GameState.chapterId;
      const prereqMet = GameState.isSkillPrereqMet(cfg);
      const unlocked = chapterUnlocked && prereqMet;
      const lvl = GameState.getSkillLevel(cfg.id);
      const maxLevel = GameState.getSkillMaxLevel(cfg);
      const maxed = lvl >= maxLevel;
      const cost = Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, lvl));
      const afford = GameState.gold >= cost;

      // 锁定原因文案
      let lockText = '';
      if (!chapterUnlocked) lockText = `第 ${cfg.unlockChapter} 章解锁`;
      else if (!prereqMet && cfg.prereq) {
        const pre = SKILL_MAP[cfg.prereq.id];
        const cur = GameState.getSkillLevel(cfg.prereq.id);
        lockText = `前置：${pre?.name ?? cfg.prereq.id} Lv.${cur}/${cfg.prereq.level}`;
      }

      const el = document.createElement('div');
      el.className = `skill-item ${(!unlocked || maxed) ? 'locked' : ''}`;
      el.innerHTML = `
        <div class="item-head">
          <div class="item-icon">${svgIcon(cfg.icon as IconKey, 16)}</div>
          <div class="item-name">${cfg.name}</div>
          <div class="item-level">Lv.${lvl}/${maxLevel}</div>
        </div>
        <div class="item-desc">${cfg.desc}</div>
        <div class="item-effect">${cfg.effect(lvl)}</div>
        ${!unlocked ? `<div class="item-cost cant">${lockText}</div>` :
          (maxed ? `<div class="item-cost cant">已满级</div>` :
          `<div class="item-cost ${afford ? 'afford' : 'cant'}">${svgIcon('gold', 12)} ${formatNum(cost)}</div>`)}
      `;
      if (unlocked && !maxed) {
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

  private showEndingModal() {
    document.getElementById('modal-ending')!.classList.add('open');
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
