// 主菜单：标题、存档槽位选择、数晶商店

import Phaser from 'phaser';
import { GameState, formatNum, toBig } from '../systems/GameState';
import { SaveSystem, SLOT_COUNT } from '../systems/SaveSystem';
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

    this.add.text(W / 2, H * 0.15, '弹珠炼金术', {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: `${Math.min(56, Math.max(32, W * 0.07))}px`,
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5).setShadow(0, 2, 'rgba(0,0,0,0.6)', 6);

    this.add.text(W / 2, H * 0.24, 'Pinball Alchemy', {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: `${Math.min(20, Math.max(12, W * 0.022))}px`,
      color: '#f5c542',
    }).setOrigin(0.5);

    // 当前活动槽位状态
    this.refreshActiveSlotHint();

    this.makeBtn(W / 2, H * 0.55, '选择存档', () => this.showSlotPicker(), false, true);
    this.makeBtn(W / 2, H * 0.65, '数晶商店', () => this.showCrystalShop());

    this.add.text(W / 2, H - 20, 'v1.4.0 · 3 槽位存档 · 像素风物理弹珠挂机', {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: '11px',
      color: '#484f58',
    }).setOrigin(0.5);
  }

  private activeSlotHintText?: Phaser.GameObjects.Text;

  private refreshActiveSlotHint() {
    if (this.activeSlotHintText) this.activeSlotHintText.destroy();
    const W = this.scale.width;
    const slot = GameState.slot;
    const meta = SaveSystem.getSlotMeta(slot);
    const line = meta.exists
      ? `当前槽位 ${slot + 1} · 第 ${meta.chapterId} 章 · ${meta.chapterName}`
      : `当前槽位 ${slot + 1} · 空`;
    this.activeSlotHintText = this.add.text(W / 2, this.scale.height * 0.40, line, {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: `${Math.min(16, Math.max(12, W * 0.018))}px`,
      color: '#4dd6c1',
    }).setOrigin(0.5);
  }

  private makeBtn(x: number, y: number, label: string, onClick: () => void, danger = false, primary = false) {
    const w = Math.min(260, this.scale.width * 0.6), h = 44;
    let fill = 0x21262d, stroke = 0x484f58;
    let textColor = '#e6edf3';
    if (danger) { fill = 0x1c2330; stroke = 0xf85149; textColor = '#f85149'; }
    if (primary) { fill = 0xf5c542; stroke = 0xf5c542; textColor = '#000000'; }
    const rect = this.add.rectangle(x, y, w, h, fill, 1).setStrokeStyle(1, stroke);
    rect.setInteractive();
    this.add.text(x, y, label, {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: '15px',
      color: textColor,
    }).setOrigin(0.5);
    rect.on('pointerover', () => {
      rect.setFillStyle(danger ? 0x2d1b1b : (primary ? 0xffd966 : 0x30363d));
    });
    rect.on('pointerout', () => rect.setFillStyle(fill));
    rect.on('pointerdown', onClick);
  }

  // ===== 槽位选择 =====
  private showSlotPicker() {
    let overlay = document.getElementById('menu-slot-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'menu-slot-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="width:min(540px,94vw)">
          <h3>${svgIcon('save', 18)} 选择存档</h3>
          <p class="muted">共 3 个独立存档槽位。点击"继续"加载已有存档；点击"新游戏"在空槽位开始。</p>
          <div id="menu-slot-list"></div>
          <div class="modal-actions"><button id="menu-slot-close" class="btn">关闭</button></div>
        </div>
      `;
      document.body.appendChild(overlay);
      const ov = overlay;
      document.getElementById('menu-slot-close')!.addEventListener('click', () => ov.classList.remove('open'));
      ov.addEventListener('click', (e) => {
        if (e.target === ov) ov.classList.remove('open');
      });
    }
    overlay.classList.add('open');
    this.renderSlotList(overlay as HTMLElement);
  }

  private renderSlotList(overlay: HTMLElement) {
    const list = document.getElementById('menu-slot-list')!;
    list.innerHTML = '';
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const meta = SaveSystem.getSlotMeta(slot);
      const el = document.createElement('div');
      el.className = `slot-card ${meta.exists ? '' : 'empty'}`;
      if (meta.exists) {
        const timeStr = meta.lastSeen > 0
          ? new Date(meta.lastSeen).toLocaleString('zh-CN', { hour12: false })
          : '未知';
        el.innerHTML = `
          <div class="slot-card-head">
            <div class="slot-card-no">存档 ${slot + 1}</div>
            <div class="slot-card-title">第 ${meta.chapterId} 章 · ${meta.chapterName}</div>
          </div>
          <div class="slot-card-meta">
            <span class="kv">${svgIcon('gold', 11)} <b>${formatNum(meta.gold)}</b></span>
            <span class="kv">${svgIcon('crystal', 11)} <b>${formatNum(meta.crystal)}</b></span>
            <span class="kv">弹珠 <b>${meta.totalBalls}</b></span>
          </div>
          <div class="slot-card-meta">最后保存：${timeStr}</div>
          <div class="slot-card-actions">
            <button class="btn primary" data-act="continue">继续</button>
            <button class="btn danger" data-act="delete">${svgIcon('trash', 12)} 删除</button>
          </div>
        `;
      } else {
        el.innerHTML = `
          <div class="slot-card-head">
            <div class="slot-card-no">存档 ${slot + 1}</div>
            <div class="slot-card-title">空槽位</div>
          </div>
          <div class="slot-card-meta">尚未开始游戏</div>
          <div class="slot-card-actions">
            <button class="btn primary" data-act="new">新游戏</button>
          </div>
        `;
      }
      list.appendChild(el);
      const cont = el.querySelector('[data-act="continue"]') as HTMLButtonElement | null;
      const newGame = el.querySelector('[data-act="new"]') as HTMLButtonElement | null;
      const del = el.querySelector('[data-act="delete"]') as HTMLButtonElement | null;
      cont?.addEventListener('click', () => this.selectSlot(slot, false, overlay));
      newGame?.addEventListener('click', () => this.selectSlot(slot, true, overlay));
      del?.addEventListener('click', () => {
        if (confirm(`确定删除存档 ${slot + 1}？此操作不可恢复。`)) {
          SaveSystem.wipeSlot(slot);
          this.renderSlotList(overlay);
          this.refreshActiveSlotHint();
        }
      });
    }
  }

  /** 选中槽位 → 加载到 GameState → 进入游戏 */
  private selectSlot(slot: number, isNew: boolean, overlay: HTMLElement) {
    if (isNew) {
      // 新游戏：确保槽位为空，先清空再让 GameState 加载默认存档
      SaveSystem.wipeSlot(slot);
    }
    GameState.loadSlot(slot);
    overlay.classList.remove('open');
    this.refreshActiveSlotHint();
    // 进入游戏（OfflineReport 计算离线收益，新游戏时离线为 0）
    this.scene.start('OfflineReport');
  }

  // ===== 数晶商店 =====
  private showCrystalShop() {
    let overlay = document.getElementById('menu-shop-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'menu-shop-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="width:min(480px,92vw)">
          <h3>${svgIcon('crystal', 18)} 数晶商店</h3>
          <div class="muted" id="menu-shop-crystal"></div>
          <div id="menu-shop-list"></div>
          <div class="modal-actions"><button id="menu-shop-close" class="btn">关闭</button></div>
        </div>
      `;
      document.body.appendChild(overlay);
      const ov = overlay;
      document.getElementById('menu-shop-close')!.addEventListener('click', () => ov.classList.remove('open'));
      ov.addEventListener('click', (e) => {
        if (e.target === ov) ov.classList.remove('open');
      });
    }
    overlay.classList.add('open');
    this.renderCrystalShop();
  }

  private renderCrystalShop() {
    const cur = document.getElementById('menu-shop-crystal')!;
    cur.textContent = `当前数晶：${formatNum(GameState.crystal)}（槽位 ${GameState.slot + 1}）`;
    const list = document.getElementById('menu-shop-list')!;
    list.innerHTML = '';
    for (const cfg of CRYSTAL_UPGRADES) {
      if (cfg.unlockChapter > GameState.chapterId) continue;
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
          if (GameState.buyCrystalUpgrade(cfg.id)) {
            this.renderCrystalShop();
          }
        });
      }
      list.appendChild(el);
    }
  }
}
