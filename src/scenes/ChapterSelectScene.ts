// 章节选择场景：归零后/从主菜单进入，玩家选择已解锁章节或无尽模式
// 章节需要解锁（按顺序归零解锁）；5 章全部通关后解锁无尽模式

import Phaser from 'phaser';
import { GameState, formatNum } from '../systems/GameState';
import { CHAPTERS } from '../data/chapters';
import { BOSS_INFO } from '../systems/BossBattleSystem';
import { svgIcon } from '../ui/icons';

export class ChapterSelectScene extends Phaser.Scene {
  constructor() {
    super('ChapterSelect');
  }

  create() {
    const W = this.scale.width;
    this.cameras.main.setBackgroundColor('#050709');

    // 顶部标题
    this.add.text(W / 2, 40, '章节选择', {
      fontFamily: '"Z Labs RoundPix 12px M CN", sans-serif',
      fontSize: '22px', color: '#f0b429',
    }).setOrigin(0.5);

    this.add.text(W / 2, 66, `最大解锁：第 ${GameState.maxChapterUnlocked} 章 · 数晶 ${formatNum(GameState.crystal)}`, {
      fontFamily: '"Z Labs RoundPix 12px M CN", sans-serif',
      fontSize: '12px', color: '#8b949e',
    }).setOrigin(0.5);

    // 渲染章节卡片（HTML overlay 实现）
    this.showChapterUI();

    // 退出时清理
    this.events.once('shutdown', () => this.hideChapterUI());
    this.events.once('destroy', () => this.hideChapterUI());
  }

  // ===== HTML 章节选择 UI =====
  private showChapterUI() {
    const ui = document.getElementById('chapter-select-ui');
    if (ui) ui.classList.remove('hidden');
    this.renderChapterList();
  }

  private hideChapterUI() {
    const ui = document.getElementById('chapter-select-ui');
    if (ui) ui.classList.add('hidden');
  }

  private renderChapterList() {
    const list = document.getElementById('chapter-select-list');
    if (!list) return;
    list.innerHTML = '';

    const maxUnlocked = GameState.maxChapterUnlocked;
    const endlessUnlocked = GameState.endlessUnlocked;
    const endlessActive = GameState.endlessMode;

    // 5 个章节卡片
    for (const ch of CHAPTERS) {
      const unlocked = ch.id <= maxUnlocked;
      const bossId = GameState.currentBossIdForChapter(ch.id);
      const bossName = bossId ? BOSS_INFO[bossId].name : '无';
      const card = document.createElement('div');
      card.className = `chapter-card ${unlocked ? '' : 'locked'}`;
      card.innerHTML = `
        <div class="chapter-card-head">
          <div class="chapter-no">第 ${ch.id} 章</div>
          <div class="chapter-name">${ch.name}</div>
        </div>
        <div class="chapter-scene">${svgIcon('chapter', 12)} ${ch.scene}</div>
        <div class="chapter-boss">${svgIcon('chapter', 12)} Boss · ${bossName}</div>
        <div class="chapter-target">目标 ${formatNum(ch.targetGold)} 金币</div>
        ${unlocked
          ? `<button class="btn primary" data-ch="${ch.id}">进入</button>`
          : `<div class="chapter-locked">未解锁</div>`}
      `;
      list.appendChild(card);
      const btn = card.querySelector('[data-ch]') as HTMLButtonElement | null;
      btn?.addEventListener('click', () => this.selectChapter(ch.id));
    }

    // 无尽模式卡片
    const endlessCard = document.createElement('div');
    endlessCard.className = `chapter-card endless ${endlessUnlocked ? '' : 'locked'} ${endlessActive ? 'active' : ''}`;
    const endlessTierText = endlessActive
      ? `已击败 ${GameState.endlessBossTier} 个 Boss · 当前阈值 ${formatNum(GameState.currentEndlessThreshold)}`
      : '每达到金币阈值触发 Boss（循环 5 位 Boss）';
    endlessCard.innerHTML = `
      <div class="chapter-card-head">
        <div class="chapter-no">无尽模式</div>
        <div class="chapter-name">永久挂机</div>
      </div>
      <div class="chapter-scene">${svgIcon('chapter', 12)} 无限回廊 · 贤者机器核心</div>
      <div class="chapter-boss">${svgIcon('chapter', 12)} 循环 Boss · 阈值递增</div>
      <div class="chapter-target">${endlessTierText}</div>
      ${endlessUnlocked
        ? endlessActive
          ? `<button class="btn endless" data-endless="1">继续无尽</button>`
          : `<button class="btn endless" data-endless="1">进入无尽</button>`
        : `<div class="chapter-locked">通关 5 章后解锁</div>`}
    `;
    list.appendChild(endlessCard);
    const endlessBtn = endlessCard.querySelector('[data-endless]') as HTMLButtonElement | null;
    endlessBtn?.addEventListener('click', () => this.selectEndless());

    // 返回主菜单按钮
    const backBtn = document.getElementById('chapter-select-back') as HTMLButtonElement | null;
    if (backBtn && backBtn.dataset.bound !== '1') {
      backBtn.dataset.bound = '1';
      backBtn.addEventListener('click', () => {
        this.hideChapterUI();
        this.scene.start('Menu');
      });
    }
  }

  private selectChapter(chapterId: number) {
    GameState.enterChapter(chapterId);
    this.hideChapterUI();
    this.scene.start('Game');
  }

  private selectEndless() {
    // 已在无尽模式：直接进入游戏继续；否则新进入无尽
    if (!GameState.endlessMode) {
      GameState.enterEndless();
    }
    this.hideChapterUI();
    this.scene.start('Game');
  }
}
