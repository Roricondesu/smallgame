// 主菜单：左侧纵向导航 + 右侧钉子下球动画

import Phaser from 'phaser';
import { GameState, formatNum, toBig } from '../systems/GameState';
import { SaveSystem, SLOT_COUNT } from '../systems/SaveSystem';
import { CRYSTAL_UPGRADES } from '../data/chapters';
import { svgIcon, type IconKey } from '../ui/icons';

interface FallingBall {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
}

export class MenuScene extends Phaser.Scene {
  private pegs: Phaser.GameObjects.Image[] = [];
  private balls: FallingBall[] = [];
  private dropTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('Menu');
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor('#050709');

    // 右侧钉子（仅桌面端布局区域）
    this.makePegs(W, H);

    // 显示 HTML 菜单
    this.showMenuUI();

    // 每秒下落一个小球
    this.startDropping(W, H);

    // 窗口尺寸变化时重新布局
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.pegs.forEach((p) => p.destroy());
      this.pegs = [];
      this.balls.forEach((b) => b.img.destroy());
      this.balls = [];
      this.makePegs(gameSize.width, gameSize.height);
    });
  }

  /** 右侧区域布置若干钉子 */
  private makePegs(W: number, H: number) {
    // 移动端不显示钉子（菜单居中），节省空间
    if (W < 768) return;
    const startX = W * 0.55;
    const endX = W - 60;
    const topY = H * 0.18;
    const bottomY = H * 0.82;
    const cols = 5, rows = 6;
    const dx = (endX - startX) / (cols - 1);
    const dy = (bottomY - topY) / (rows - 1);
    const colors = [0x3fb950, 0xf0b429, 0xf85149, 0x79c0ff, 0xffa198];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 交错排列
        const offsetX = r % 2 === 0 ? 0 : dx / 2;
        const x = startX + c * dx + offsetX;
        if (x > endX + 10) continue;
        const y = topY + r * dy;
        const color = colors[(r + c) % colors.length];
        const peg = this.add.image(x, y, 'peg_placeholder');
        peg.setTint(color);
        peg.setAlpha(0.55);
        peg.setScale(1.2);
        peg.setDepth(1);
        this.pegs.push(peg);
      }
    }
  }

  /** 每秒生成一个小球，自顶向下下落并左右弹跳 */
  private startDropping(W: number, _H: number) {
    const spawn = () => {
      if (W < 768) return;
      const keys = ['ball_gold', 'ball_blue', 'ball_green', 'ball_purple', 'ball_rainbow'];
      const key = keys[Math.floor(Math.random() * keys.length)];
      const x = Phaser.Math.Between(W * 0.58, W - 80);
      const y = -10;
      const img = this.add.image(x, y, key);
      img.setDepth(2);
      const ball: FallingBall = {
        img,
        vx: Phaser.Math.Between(-30, 30),
        vy: Phaser.Math.Between(40, 70),
      };
      this.balls.push(ball);
    };
    this.dropTimer = this.time.addEvent({
      delay: 1000,
      callback: spawn,
      loop: true,
    });
    spawn();
  }

  update(_t: number, dtMs: number) {
    const dt = dtMs / 1000;
    const W = this.scale.width, H = this.scale.height;
    const gravity = 380;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.vy += gravity * dt;
      let nx = b.img.x + b.vx * dt;
      const ny = b.img.y + b.vy * dt;
      // 简易左右边界反弹（右侧区域）
      const leftBound = W * 0.55;
      const rightBound = W - 20;
      if (nx < leftBound) { nx = leftBound; b.vx = Math.abs(b.vx) * 0.8; }
      if (nx > rightBound) { nx = rightBound; b.vx = -Math.abs(b.vx) * 0.8; }
      // 与钉子碰撞：简单距离检测，命中后向上反弹并改变水平方向
      for (const peg of this.pegs) {
        const ddx = nx - peg.x;
        const ddy = ny - peg.y;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dist < 14) {
          // 反弹
          const angle = Math.atan2(ddy, ddx);
          b.vx = Math.cos(angle) * 90;
          b.vy = -Math.abs(Math.sin(angle) * 90) - 40;
          nx = peg.x + Math.cos(angle) * 15;
          break;
        }
      }
      b.img.x = nx;
      b.img.y = ny;
      // 超出底部移除
      if (b.img.y > H + 20) {
        b.img.destroy();
        this.balls.splice(i, 1);
      }
    }
  }

  // ===== HTML 菜单 =====
  private showMenuUI() {
    const ui = document.getElementById('menu-ui');
    const footer = document.getElementById('menu-footer');
    if (ui) ui.classList.remove('hidden');
    if (footer) footer.style.display = 'block';
    this.refreshSlotHint();
    this.bindMenuLinks();
  }

  private hideMenuUI() {
    const ui = document.getElementById('menu-ui');
    const footer = document.getElementById('menu-footer');
    if (ui) ui.classList.add('hidden');
    if (footer) footer.style.display = 'none';
  }

  shutdown() {
    this.hideMenuUI();
    if (this.dropTimer) this.dropTimer.remove();
  }

  private refreshSlotHint() {
    const el = document.getElementById('menu-slot-hint');
    if (!el) return;
    const slot = GameState.slot;
    const meta = SaveSystem.getSlotMeta(slot);
    el.textContent = meta.exists
      ? `当前槽位 ${slot + 1} · 第 ${meta.chapterId} 章 · ${meta.chapterName}`
      : `当前槽位 ${slot + 1} · 空`;
  }

  private bindMenuLinks() {
    const links = document.querySelectorAll('.menu-link');
    links.forEach((link) => {
      // 避免重复绑定
      if ((link as HTMLElement).dataset.bound === '1') return;
      (link as HTMLElement).dataset.bound = '1';
      link.addEventListener('click', () => {
        const act = (link as HTMLElement).dataset.menu;
        if (act === 'start') this.handleStart();
        else if (act === 'slots') this.showSlotPicker();
        else if (act === 'shop') this.showCrystalShop();
        else if (act === 'settings') this.showSettings();
        else if (act === 'about') this.showAbout();
      });
    });
  }

  /** 开始游戏：当前槽位若已有存档则直接继续，否则进入选择存档 */
  private handleStart() {
    const meta = SaveSystem.getSlotMeta(GameState.slot);
    if (meta.exists) {
      GameState.loadSlot(GameState.slot);
      this.scene.start('OfflineReport');
    } else {
      this.showSlotPicker();
    }
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
          this.refreshSlotHint();
        }
      });
    }
  }

  private selectSlot(slot: number, isNew: boolean, overlay: HTMLElement) {
    if (isNew) SaveSystem.wipeSlot(slot);
    GameState.loadSlot(slot);
    overlay.classList.remove('open');
    this.refreshSlotHint();
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

  // ===== 设置 =====
  private showSettings() {
    let overlay = document.getElementById('menu-settings-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'menu-settings-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="width:min(440px,92vw)">
          <h3>设置</h3>
          <p class="muted">游戏数据保存在本地浏览器，清除浏览器缓存将丢失存档。</p>
          <div class="modal-actions">
            <button id="menu-settings-close" class="btn">关闭</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const ov = overlay;
      document.getElementById('menu-settings-close')!.addEventListener('click', () => ov.classList.remove('open'));
      ov.addEventListener('click', (e) => {
        if (e.target === ov) ov.classList.remove('open');
      });
    }
    overlay.classList.add('open');
  }

  // ===== 关于 =====
  private showAbout() {
    let overlay = document.getElementById('menu-about-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'menu-about-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="width:min(440px,92vw)">
          <h3>关于</h3>
          <p>弹珠炼金术 · Pinball Alchemy</p>
          <p class="muted">像素风物理弹珠挂机游戏。投放弹珠穿过钉子阵列，通过加减乘除等运算累积金币，归零进入下一周目获取数晶强化永久加成。</p>
          <p class="muted">v1.4.0 · 3 槽位存档</p>
          <div class="modal-actions">
            <button id="menu-about-close" class="btn">关闭</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const ov = overlay;
      document.getElementById('menu-about-close')!.addEventListener('click', () => ov.classList.remove('open'));
      ov.addEventListener('click', (e) => {
        if (e.target === ov) ov.classList.remove('open');
      });
    }
    overlay.classList.add('open');
  }
}
