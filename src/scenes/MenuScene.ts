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

    // 场景被停止/切换时隐藏菜单 UI 并清理定时器
    this.events.once('shutdown', () => {
      this.hideMenuUI();
      if (this.dropTimer) this.dropTimer.remove();
    });
    this.events.once('destroy', () => {
      this.hideMenuUI();
      if (this.dropTimer) this.dropTimer.remove();
    });

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
        if (act === 'start') this.openChapterSelect();
        else if (act === 'slots') this.showSlotPicker();
        else if (act === 'shop') this.showCrystalShop();
        else if (act === 'codex') this.showCodex();
        else if (act === 'settings') this.showSettings();
      });
    });
  }

  /** 进入章节选择场景（开始游戏入口，含存档选择与章节/无尽入口） */
  private openChapterSelect() {
    this.hideMenuUI();
    this.scene.start('ChapterSelect');
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
        <div class="modal" style="width:min(480px,92vw)">
          <h3>设置</h3>
          <div class="settings-section">
            <div class="settings-row">
              <div class="settings-label">音效</div>
              <div class="toggle" data-settings="sfx"><span class="toggle-dot"></span></div>
            </div>
            <div class="settings-row">
              <div class="settings-label">背景音乐</div>
              <div class="toggle" data-settings="bgm"><span class="toggle-dot"></span></div>
            </div>
            <div class="settings-row">
              <div class="settings-label">显示帧率</div>
              <div class="toggle" data-settings="fps"><span class="toggle-dot"></span></div>
            </div>
            <div class="settings-row">
              <div class="settings-label">自动保存间隔</div>
              <select id="settings-autosave" class="settings-select">
                <option value="15">15 秒</option>
                <option value="30">30 秒</option>
                <option value="60">60 秒</option>
                <option value="0">关闭</option>
              </select>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-row" style="flex-direction:column; align-items:stretch; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <div class="settings-label" style="color:#ff8b8b;">Dev 模式 · 金币倍率</div>
                <div class="toggle" data-settings="dev"><span class="toggle-dot"></span></div>
              </div>
              <div id="dev-mul-row" style="display:none;">
                <div style="display:flex; align-items:center; gap:10px;">
                  <input type="range" id="dev-mul-slider" min="1" max="1000" step="1" value="100" style="flex:1; accent-color:var(--gold);">
                  <span id="dev-mul-val" style="min-width:80px; text-align:right; color:var(--gold); font-weight:600; font-size:12px;">×1</span>
                </div>
                <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
                  <button class="mini-btn" data-mul="1" style="flex:1; padding:6px; font-size:11px;">×1</button>
                  <button class="mini-btn" data-mul="10" style="flex:1; padding:6px; font-size:11px;">×10</button>
                  <button class="mini-btn" data-mul="100" style="flex:1; padding:6px; font-size:11px;">×100</button>
                  <button class="mini-btn" data-mul="1000" style="flex:1; padding:6px; font-size:11px;">×1000</button>
                  <button class="mini-btn danger" data-mul="0" style="flex:1; padding:6px; font-size:11px; background:rgba(255,107,107,0.1); border-color:rgba(255,107,107,0.3); color:var(--bad);">关闭</button>
                </div>
                <p class="muted" style="margin-top:8px; font-size:11px;">倍率仅对游戏内弹珠金币收益生效，离线收益不翻倍。开发测试用，不影响存档。</p>
              </div>
            </div>
          </div>
          <div class="settings-section">
            <div class="settings-row">
              <button class="settings-action" data-act="export">导出存档</button>
              <button class="settings-action" data-act="import">导入存档</button>
            </div>
            <div class="settings-row">
              <button class="settings-action danger" data-act="wipe-current">清空当前槽位</button>
              <button class="settings-action danger" data-act="wipe-all">清空所有存档</button>
            </div>
          </div>
          <input type="file" id="settings-import-file" accept=".json" style="display:none">
          <p class="muted settings-hint">游戏数据保存在本地浏览器，清除浏览器缓存将丢失存档。建议定期导出备份。</p>
          <div class="settings-section">
            <h4 style="margin:0 0 6px; color:#f0b429; font-size:13px; font-weight:600;">关于</h4>
            <p style="margin:0 0 4px; font-size:13px;">弹珠炼金术 · Pinball Alchemy</p>
            <p class="muted" style="margin:0 0 4px; font-size:12px;">像素风物理弹珠挂机游戏。投放弹珠穿过钉子阵列，通过加减乘除等运算累积金币，归零进入下一周目获取数晶强化永久加成。通关 5 章后解锁无尽模式。</p>
            <p class="muted" style="margin:0; font-size:11px;">v1.4.0 · 3 槽位存档</p>
          </div>
          <div class="modal-actions"><button id="menu-settings-close" class="btn">关闭</button></div>
        </div>
      `;
      document.body.appendChild(overlay);
      const ov = overlay;
      document.getElementById('menu-settings-close')!.addEventListener('click', () => ov.classList.remove('open'));
      ov.addEventListener('click', (e) => {
        if (e.target === ov) ov.classList.remove('open');
      });
      this.bindSettingsActions(ov as HTMLElement);
    }
    overlay.classList.add('open');
    this.loadSettingsState(overlay as HTMLElement);
  }

  private bindSettingsActions(ov: HTMLElement) {
    // 开关
    ov.querySelectorAll('.toggle').forEach((t) => {
      t.addEventListener('click', () => {
        const key = (t as HTMLElement).dataset.settings!;
        const cur = localStorage.getItem(`pa_setting_${key}`) === '1';
        localStorage.setItem(`pa_setting_${key}`, cur ? '0' : '1');
        t.classList.toggle('on', !cur);
        if (key === 'fps') this.toggleFps(!cur);
        if (key === 'dev') this.toggleDevMode(!cur, ov);
      });
    });
    // 自动保存间隔
    const sel = ov.querySelector('#settings-autosave') as HTMLSelectElement;
    sel?.addEventListener('change', () => {
      localStorage.setItem('pa_setting_autosave', sel.value);
    });
    // Dev 倍率滑块
    const slider = ov.querySelector('#dev-mul-slider') as HTMLInputElement;
    const valEl = ov.querySelector('#dev-mul-val') as HTMLElement;
    if (slider && valEl) {
      slider.addEventListener('input', () => {
        const mul = parseInt(slider.value, 10);
        valEl.textContent = `×${mul}`;
        localStorage.setItem('pa_setting_dev_mul', String(mul));
        GameState.setDevGoldMul(mul);
      });
    }
    // Dev 倍率预设按钮
    ov.querySelectorAll('[data-mul]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mul = parseInt((btn as HTMLElement).dataset.mul!, 10);
        if (slider && valEl) {
          slider.value = String(mul > 0 ? Math.min(1000, mul) : 1);
          valEl.textContent = mul > 0 ? `×${mul}` : '关闭';
        }
        localStorage.setItem('pa_setting_dev_mul', String(mul));
        GameState.setDevGoldMul(mul);
        // 关闭按钮：关闭 Dev 模式开关
        if (mul === 0) {
          const devToggle = ov.querySelector('[data-settings="dev"]') as HTMLElement;
          if (devToggle) {
            devToggle.classList.remove('on');
            localStorage.setItem('pa_setting_dev', '0');
            this.toggleDevMode(false, ov);
          }
        }
      });
    });
    // 导出
    ov.querySelector('[data-act="export"]')?.addEventListener('click', () => this.exportSave());
    ov.querySelector('[data-act="import"]')?.addEventListener('click', () => {
      (ov.querySelector('#settings-import-file') as HTMLInputElement).click();
    });
    (ov.querySelector('#settings-import-file') as HTMLInputElement).addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.importSave(file);
    });
    // 清空当前槽位
    ov.querySelector('[data-act="wipe-current"]')?.addEventListener('click', () => {
      if (confirm(`确定要清空当前槽位 ${GameState.slot + 1} 吗？此操作不可恢复。`)) {
        SaveSystem.wipeSlot(GameState.slot);
        this.showToast('已清空当前槽位');
        this.refreshSlotHint();
      }
    });
    // 清空所有存档
    ov.querySelector('[data-act="wipe-all"]')?.addEventListener('click', () => {
      if (confirm('确定要清空所有 3 个存档槽位吗？此操作不可恢复！')) {
        for (let s = 0; s < SLOT_COUNT; s++) SaveSystem.wipeSlot(s);
        this.showToast('已清空所有存档');
        this.refreshSlotHint();
      }
    });
  }

  /** Dev 模式开关：显示/隐藏倍率滑块行，并应用倍率 */
  private toggleDevMode(on: boolean, ov: HTMLElement) {
    const row = ov.querySelector('#dev-mul-row') as HTMLElement;
    if (row) row.style.display = on ? 'block' : 'none';
    if (on) {
      // 启用时读取已保存的倍率
      const saved = parseInt(localStorage.getItem('pa_setting_dev_mul') || '100', 10);
      GameState.setDevGoldMul(saved);
      const slider = ov.querySelector('#dev-mul-slider') as HTMLInputElement;
      const valEl = ov.querySelector('#dev-mul-val') as HTMLElement;
      if (slider) slider.value = String(saved > 0 ? Math.min(1000, saved) : 100);
      if (valEl) valEl.textContent = saved > 0 ? `×${saved}` : '×100';
    } else {
      GameState.setDevGoldMul(0);
    }
  }

  private loadSettingsState(ov: HTMLElement) {
    ov.querySelectorAll('.toggle').forEach((t) => {
      const key = (t as HTMLElement).dataset.settings!;
      const isOn = localStorage.getItem(`pa_setting_${key}`) === '1';
      t.classList.toggle('on', isOn);
      if (key === 'dev' && isOn) {
        // 显示倍率行
        const row = ov.querySelector('#dev-mul-row') as HTMLElement;
        if (row) row.style.display = 'block';
        const saved = parseInt(localStorage.getItem('pa_setting_dev_mul') || '100', 10);
        GameState.setDevGoldMul(saved);
        const slider = ov.querySelector('#dev-mul-slider') as HTMLInputElement;
        const valEl = ov.querySelector('#dev-mul-val') as HTMLElement;
        if (slider) slider.value = String(saved > 0 ? Math.min(1000, saved) : 100);
        if (valEl) valEl.textContent = saved > 0 ? `×${saved}` : '×100';
      }
    });
    const sel = ov.querySelector('#settings-autosave') as HTMLSelectElement;
    if (sel) sel.value = localStorage.getItem('pa_setting_autosave') || '30';
  }

  private fpsRaf: number | null = null;
  private toggleFps(on: boolean) {
    let el = document.getElementById('fps-display');
    if (!on) {
      el?.remove();
      if (this.fpsRaf !== null) { cancelAnimationFrame(this.fpsRaf); this.fpsRaf = null; }
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'fps-display';
      el.style.cssText = 'position:fixed;top:4px;right:4px;z-index:200;color:#4dd6c1;font-size:11px;font-family:monospace;pointer-events:none;text-shadow:0 1px 2px #000;background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;';
      document.body.appendChild(el);
    }
    let last = performance.now(), frames = 0;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 500) {
        el!.textContent = `${Math.round((frames * 1000) / (now - last))} FPS`;
        frames = 0; last = now;
      }
      this.fpsRaf = requestAnimationFrame(tick);
    };
    this.fpsRaf = requestAnimationFrame(tick);
  }

  private exportSave() {
    const data: Record<string, string> = {};
    for (let s = 0; s < SLOT_COUNT; s++) {
      const raw = localStorage.getItem(`pinball_alchemy_save_v1_slot${s}`);
      if (raw) data[`slot${s}`] = raw;
    }
    const blob = new Blob([JSON.stringify({ version: 1, exported: Date.now(), saves: data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pinball-alchemy-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.showToast('已导出存档');
  }

  private async importSave(file: File) {
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      if (!obj.saves) throw new Error('格式错误');
      if (!confirm('导入将覆盖当前所有存档，是否继续？')) return;
      for (let s = 0; s < SLOT_COUNT; s++) {
        const v = obj.saves[`slot${s}`];
        if (v) localStorage.setItem(`pinball_alchemy_save_v1_slot${s}`, v);
        else localStorage.removeItem(`pinball_alchemy_save_v1_slot${s}`);
      }
      this.showToast('导入成功，即将刷新');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      this.showToast('导入失败：文件格式错误');
    }
  }

  private showToast(msg: string) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  // ===== 图鉴 =====
  private showCodex() {
    let overlay = document.getElementById('menu-codex-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'menu-codex-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="width:min(920px,96vw);max-height:88vh;overflow-y:auto;">
          <h3 style="display:flex;align-items:center;gap:8px;">${svgIcon('info', 18)} 角色图鉴</h3>
          <p class="muted" style="margin-bottom:14px;">游戏中登场的所有角色、立绘与简介</p>
          <div id="codex-list" class="codex-list"></div>
          <div class="modal-actions"><button id="menu-codex-close" class="btn">关闭</button></div>
        </div>
      `;
      document.body.appendChild(overlay);
      const ov = overlay;
      document.getElementById('menu-codex-close')!.addEventListener('click', () => ov.classList.remove('open'));
      ov.addEventListener('click', (e) => {
        if (e.target === ov) ov.classList.remove('open');
      });
      this.renderCodexList();
    }
    overlay.classList.add('open');
  }

  private renderCodexList() {
    const list = document.getElementById('codex-list');
    if (!list) return;
    const characters: Array<{ key: string; name: string; title: string; portrait: string; desc: string; join: string }> = [
      {
        key: 'linn',
        name: '林恩',
        title: '失落贤者之徒 · 主角',
        portrait: '/portraits/linn.png',
        desc: '被暴雪掩埋在贤者遗迹外的少年，由零号刨出后苏醒。记忆丢失大半，但身上似乎隐藏着贤者的核心。勇敢、善良、好奇心强，随着旅程推进逐渐成长为真正的炼金术士。',
        join: '第 1 章 · 零号镇',
      },
      {
        key: 'zero',
        name: '零号',
        title: '贤者机器的残片 · 神秘机器导师',
        portrait: '/portraits/zero.png',
        desc: '贤者遗迹里仅存的"会动的机器"。冷静、理性、暗藏秘密，实则是被拆分的贤者意识之一。引导林恩学习运算，一直在等待三份核心合一的那一天。其真实身份是贤者机器的运算核心载体。',
        join: '第 1 章 · 零号镇',
      },
      {
        key: 'lily',
        name: '莉莉',
        title: '能看见"数值"的神秘少女',
        portrait: '/portraits/lily.png',
        desc: '被封印在贤者遗迹水晶棺中的小女孩，能直接看见所有人身上的"数值"。天真、活泼、偶尔敏锐。其体内封存着贤者的第二份意识核心。被林恩救出后成为同行伙伴，能洞察 Boss 的弱点。',
        join: '第 2 章 · 贤者遗迹（水晶棺救援）',
      },
      {
        key: 'vera',
        name: '薇拉',
        title: '金辉城首席炼金术师 · 御姐',
        portrait: '/portraits/vera.png',
        desc: '金辉城精英炼金术师，零号的老朋友。优雅、骄傲、外冷内热。为守护城市而战，其母亲曾是贤者机器的研究者之一。在第 3 章加入队伍，最终也选择跟随林恩走向圣殿。',
        join: '第 3 章 · 金辉城（炼金术师协会）',
      },
      {
        key: 'boss_skull',
        name: '骷髅守卫',
        title: '第 1 章 Boss · 贤者遗迹守护者',
        portrait: '/portraits/boss_skull.png',
        desc: '贤者用来看守核心区域的构装体守护者，感应到封印被解除后苏醒。会召唤骨盾抵挡攻击，需要先击破护盾才能伤到本体。是林恩遇到的第一位强敌，也是踏入炼金世界的第一道门槛。',
        join: '第 1 章 · 贤者遗迹外',
      },
      {
        key: 'boss_frost',
        name: '霜卫',
        title: '第 2 章 Boss · 北境远古守护者',
        portrait: '/portraits/boss_frost.png',
        desc: '北境最古老的冰霜构装体，比零号的记忆还要久远。感应到遗迹被惊扰后苏醒，召唤冰盾护体。投掷的冰球数值更大更快，是林恩在遗迹深处遇到的强敌。',
        join: '第 2 章 · 贤者遗迹深处',
      },
      {
        key: 'boss_ghost',
        name: '熵之幻影',
        title: '第 3 章 Boss · 熵增的具象化',
        portrait: '/portraits/boss_ghost.png',
        desc: '非实体存在，是金辉城熵增加速的具象化。能周期性虚化躲避攻击，只在显形时暴露弱点。扬言一切运算终将归零，被林恩等人击碎核心后暂时遏制了熵的增长。',
        join: '第 3 章 · 金辉城',
      },
      {
        key: 'boss_chameleon',
        name: '幻彩守卫',
        title: '第 4 章 Boss · 零之圣殿最终防线',
        portrait: '/portraits/boss_chameleon.png',
        desc: '零之圣殿的最终防线，能模仿弹珠的运算——乘法会被它乘回来，指数会被反弹。弱点会变色切换，需要在对应颜色时使用对应元素弹珠才能造成有效伤害。莉莉的"数值视觉"能解析它的模式。',
        join: '第 4 章 · 零之圣殿',
      },
      {
        key: 'boss_entropy',
        name: '熵核',
        title: '第 5 章 Boss · 贤者机器的核心残片',
        portrait: '/portraits/boss_entropy.png',
        desc: '零号昔日对抗熵增失败后留下的伤口，凝聚成形的混沌核心。弱点在四种元素间高速切换，比幻彩守卫更难捕捉。是林恩一行人在无限回廊面对的最终考验，击败它才能暂时对冲熵增。',
        join: '第 5 章 · 无限回廊核心',
      },
    ];

    // 场景图鉴
    const scenes: Array<{ key: string; name: string; chapter: string; image: string; desc: string }> = [
      {
        key: 'ch1',
        name: '零号镇 · 北境小村',
        chapter: '第 1 章',
        image: '/backgrounds/ch1.png',
        desc: '贤者遗迹外北境山脚下的寂静小村。暴雪将至的黄昏，木屋炊烟袅袅，雪线已压到屋檐。林恩被埋在遗迹外的雪堆中，由零号刨出苏醒——故事从这里开始。',
      },
      {
        key: 'ch2',
        name: '贤者遗迹',
        chapter: '第 2 章',
        image: '/backgrounds/ch2.png',
        desc: '深埋山腹的远古炼金圣所。断裂的石柱、发光的符文水晶、散落的旧式弹珠机构残骸。封印着莉莉的水晶棺就在遗迹深处，骷髅守卫与霜卫在此驻守。',
      },
      {
        key: 'ch3',
        name: '金辉城',
        chapter: '第 3 章',
        image: '/backgrounds/ch3.png',
        desc: '大陆最繁华的炼金都市，以黄金与机械闻名。灯火通明的市街、巍峨的炼金术师协会、远处的钟楼。熵增的阴影悄然蔓延，薇拉在此加入队伍。',
      },
      {
        key: 'ch4',
        name: '零之圣殿',
        chapter: '第 4 章',
        image: '/backgrounds/ch4.png',
        desc: '隐于极地的远古圣殿，白银殿堂与冰晶吊灯，圣光从穹顶倾泻而下。贤者机器的最后守护力量在此驻守——幻彩守卫能模仿一切弹珠运算。',
      },
      {
        key: 'ch5',
        name: '无限回廊',
        chapter: '第 5 章',
        image: '/backgrounds/ch5.png',
        desc: '贤者机器的核心区域，现实在此破碎。混沌数据流奔涌、碎片化的时空漂浮，紫红色的熵核在尽头脉动。林恩一行人面对最终的考验。',
      },
    ];

    const charCards = characters.map(c => `
      <div class="codex-card">
        <div class="codex-portrait">
          <img src="${c.portrait}" alt="${c.name}" onerror="this.style.opacity=0.2;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 128 128%22%3E%3Crect width=%22128%22 height=%22128%22 fill=%22%23222%22/%3E%3C/svg%3E'"/>
        </div>
        <div class="codex-info">
          <div class="codex-name">${c.name}</div>
          <div class="codex-title">${c.title}</div>
          <div class="codex-join">${svgIcon('chapter', 12)} ${c.join}</div>
          <div class="codex-desc">${c.desc}</div>
        </div>
      </div>
    `).join('');

    const sceneCards = scenes.map(s => `
      <div class="codex-card scene-card">
        <div class="codex-scene-img">
          <img src="${s.image}" alt="${s.name}" onerror="this.style.opacity=0.2"/>
        </div>
        <div class="codex-info">
          <div class="codex-name">${s.name}</div>
          <div class="codex-title">${s.chapter}</div>
          <div class="codex-desc">${s.desc}</div>
        </div>
      </div>
    `).join('');

    list.innerHTML = `
      <div class="codex-section-title">${svgIcon('chapter', 14)} 角色 · Character</div>
      ${charCards}
      <div class="codex-section-title">${svgIcon('chapter', 14)} 场景 · Scene</div>
      ${sceneCards}
    `;
  }

  // 关于内容已合并至设置弹窗底部
}
