// 主菜单：标题、新游戏/继续、数晶商店

import Phaser from 'phaser';
import { GameState, formatNum } from '../systems/GameState';
import { SaveSystem } from '../systems/SaveSystem';
import { CRYSTAL_UPGRADES } from '../data/chapters';
import { svgIcon, type IconKey } from '../ui/icons';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor('#0d1117');

    // 背景星点
    const bg = this.add.graphics();
    for (let i = 0; i < 120; i++) {
      const c = Math.random() > 0.7 ? 0xf0b429 : 0xffffff;
      bg.fillStyle(c, Math.random() * 0.5 + 0.1);
      bg.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    bg.setDepth(-1);

    this.add.text(W / 2, H * 0.18, '弹珠炼金术', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '36px',
      color: '#f0b429',
      align: 'center',
    }).setOrigin(0.5).setShadow(0, 4, '#000', 8);

    this.add.text(W / 2, H * 0.28, 'Pinball Alchemy', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '14px',
      color: '#768390',
    }).setOrigin(0.5);

    // 资源信息
    this.add.text(W / 2, H * 0.38, `数晶 ${formatNum(GameState.crystal)}`, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '16px',
      color: '#2db7a3',
    }).setOrigin(0.5);

    const hasSave = GameState.save.stats.totalBalls > 0 || GameState.pegs.length > 0 || GameState.gold > 0;

    this.makeBtn(W / 2, H * 0.52, hasSave ? '继续游戏' : '开始游戏', () => {
      if (GameState.storyProgress.endsWith('_intro') && GameState.save.stats.totalBalls === 0) {
        this.scene.start('Story', { type: 'intro', chapterId: GameState.chapterId });
      } else {
        this.scene.start('OfflineReport');
      }
    });

    this.makeBtn(W / 2, H * 0.62, '数晶商店', () => this.showCrystalShop());

    this.makeBtn(W / 2, H * 0.72, '清空存档', () => {
      if (confirm('确定清空存档？')) {
        SaveSystem.wipe();
        location.reload();
      }
    }, true);

    this.add.text(W / 2, H - 20, 'v0.1.0 · 像素风物理弹珠挂机', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      color: '#484f58',
    }).setOrigin(0.5);
  }

  private makeBtn(x: number, y: number, label: string, onClick: () => void, danger = false) {
    const w = 220, h = 44;
    const rect = this.add.rectangle(x, y, w, h, danger ? 0x1c2330 : 0x21262d, 1)
      .setStrokeStyle(1, danger ? 0xf85149 : 0x484f58);
    rect.setInteractive();
    this.add.text(x, y, label, {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '14px',
      color: danger ? '#f85149' : '#e6edf3',
    }).setOrigin(0.5);
    rect.on('pointerover', () => rect.setFillStyle(danger ? 0x2d1b1b : 0x30363d));
    rect.on('pointerout', () => rect.setFillStyle(danger ? 0x1c2330 : 0x21262d));
    rect.on('pointerdown', onClick);
  }

  private showCrystalShop() {
    // 在 DOM 中创建简单商店覆盖层
    let overlay = document.getElementById('menu-shop-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'menu-shop-overlay';
      overlay.className = 'modal-overlay open';
      overlay.innerHTML = `
        <div class="modal" style="width:min(480px,92vw)">
          <h3>${svgIcon('crystal', 18)} 数晶商店</h3>
          <div id="menu-shop-list"></div>
          <div class="modal-actions"><button id="menu-shop-close" class="btn">关闭</button></div>
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById('menu-shop-close')!.addEventListener('click', () => overlay!.classList.remove('open'));
    }
    overlay.classList.add('open');
    const list = document.getElementById('menu-shop-list')!;
    list.innerHTML = '';
    for (const cfg of CRYSTAL_UPGRADES) {
      const lvl = GameState.getCrystalLevel(cfg.id);
      const cost = Math.floor(cfg.baseCost * Math.pow(cfg.costGrowth, lvl));
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
        <div class="item-cost ${afford && !maxed ? 'afford' : 'cant'}">${svgIcon('crystal', 12)} ${formatNum(cost)}</div>
      `;
      if (!maxed) {
        el.addEventListener('click', () => {
          GameState.buyCrystalUpgrade(cfg.id);
          this.showCrystalShop();
        });
      }
      list.appendChild(el);
    }
  }
}
