// 主游戏场景：物理弹珠 + 钉子布局 + HUD 交互
// 物理修复：使用 staticGroup 存放钉子，弹珠用动态 body，collider 自动计算反弹

import Phaser from 'phaser';
import { GameState, formatNum } from '../systems/GameState';
import { PEG_MAP } from '../data/pegs';
import { ACTIVE_SKILLS } from '../data/skills';
import { bus, EVT } from '../systems/EventBus';
import { HUD } from '../ui/HUD';
import type { PegSave } from '../types';
import { BALANCE } from '../types';

interface Ball {
  sprite: Phaser.Physics.Arcade.Image;
  text: Phaser.GameObjects.Text;
  value: number;
  source: 'manual' | 'auto';
  golden: boolean;
  sageCopy: number;
  lastPegId?: string;
}

interface PegSprite {
  sprite: Phaser.Physics.Arcade.Image;
  pegId: string;
  typeId: string;
  text: Phaser.GameObjects.Text;
  gridX: number;
  gridY: number;
}

const GAME_W = 960;
const GRID_X = (GAME_W - BALANCE.gridCols * BALANCE.cellSize) / 2;
const GRID_Y = BALANCE.pegGridTopOffset;
const DROP_ZONE_H = 70;
const SETTLE_Y = GRID_Y + BALANCE.gridRows * BALANCE.cellSize + 10;

export class GameScene extends Phaser.Scene {
  private balls: Ball[] = [];
  private ballsGroup!: Phaser.Physics.Arcade.Group;
  private pegsGroup!: Phaser.Physics.Arcade.StaticGroup;
  private pegSprites: Map<string, PegSprite> = new Map();
  private hud!: HUD;
  private placementMode: { typeId: string | null } = { typeId: null };
  private dropZoneRect!: Phaser.GameObjects.Rectangle;
  private settleSlots: Phaser.GameObjects.Rectangle[] = [];
  private comboDisplay!: Phaser.GameObjects.Text;
  private frenzyOverlay!: Phaser.GameObjects.Rectangle;
  private placementCursor: Phaser.GameObjects.Arc | null = null;
  private autoAccumulator = 0;

  constructor() {
    super('Game');
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const ch = GameState.chapter;
    this.cameras.main.setBackgroundColor(ch.bg);

    this.drawBackground();

    // 网格背景
    this.add.rectangle(
      GRID_X + BALANCE.gridCols * BALANCE.cellSize / 2,
      GRID_Y + BALANCE.gridRows * BALANCE.cellSize / 2,
      BALANCE.gridCols * BALANCE.cellSize,
      BALANCE.gridRows * BALANCE.cellSize,
      0x000000, 0.25,
    ).setStrokeStyle(1, 0x30363d);

    const g = this.add.graphics();
    g.lineStyle(1, 0x30363d, 0.2);
    for (let i = 0; i <= BALANCE.gridCols; i++) {
      g.lineBetween(GRID_X + i * BALANCE.cellSize, GRID_Y, GRID_X + i * BALANCE.cellSize, GRID_Y + BALANCE.gridRows * BALANCE.cellSize);
    }
    for (let j = 0; j <= BALANCE.gridRows; j++) {
      g.lineBetween(GRID_X, GRID_Y + j * BALANCE.cellSize, GRID_X + BALANCE.gridCols * BALANCE.cellSize, GRID_Y + j * BALANCE.cellSize);
    }

    // 投放区
    this.dropZoneRect = this.add.rectangle(W / 2, DROP_ZONE_H / 2, W, DROP_ZONE_H, 0x161b22, 0.4)
      .setStrokeStyle(1, 0xf0b429, 0.5);
    this.dropZoneRect.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, DROP_ZONE_H), Phaser.Geom.Rectangle.Contains);
    this.add.text(W / 2, DROP_ZONE_H / 2, '点击此处投下弹珠 ↓', {
      fontFamily: '"Alimama FangYuanTi VF Thin", "JetBrains Mono", monospace', fontSize: '14px', color: '#f0b429',
    }).setOrigin(0.5).setAlpha(0.7);

    // 结算槽
    this.settleSlots = [];
    const slotW = (W - 40) / BALANCE.bottomSlots;
    for (let i = 0; i < BALANCE.bottomSlots; i++) {
      const x = 20 + slotW * (i + 0.5);
      const isCenter = i === Math.floor(BALANCE.bottomSlots / 2);
      const color = isCenter ? 0xf0b429 : 0x2db7a3;
      const rect = this.add.rectangle(x, SETTLE_Y + 20, slotW - 8, 40, color, 0.15).setStrokeStyle(2, color, 0.8);
      this.settleSlots.push(rect);
      this.add.text(x, SETTLE_Y + 20, isCenter ? '×2' : '×1', {
        fontFamily: '"Alimama FangYuanTi VF Thin", "JetBrains Mono", monospace', fontSize: '14px', color: isCenter ? '#f0b429' : '#2db7a3',
      }).setOrigin(0.5);
    }

    // 物理世界
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.physics.world.gravity.y = BALANCE.gravityBase * (1 + (GameState.getSkillLevel('gravity') || 0) * 0.1);

    // 使用动态组存放弹珠，静态组存放钉子
    this.ballsGroup = this.physics.add.group();
    this.pegsGroup = this.physics.add.staticGroup();

    // collider 会自动处理碰撞反弹：弹珠（动态）碰钉子（静态）会弹开
    this.physics.add.collider(this.ballsGroup, this.pegsGroup, (ballObj, pegObj) => {
      const ball = this.balls.find((b) => b.sprite === ballObj);
      const ps = [...this.pegSprites.values()].find((p) => p.sprite === pegObj);
      if (ball && ps) this.onBallPeg(ball, ps);
    }, undefined, this);

    // 边墙（静态）
    this.physics.add.existing(this.add.rectangle(0, H / 2, 4, H, 0x30363d).setOrigin(0, 0.5), true);
    this.physics.add.existing(this.add.rectangle(W, H / 2, 4, H, 0x30363d).setOrigin(1, 0.5), true);

    // 加载钉子
    for (const peg of GameState.pegs) {
      this.renderPeg(peg);
    }

    // 输入事件
    this.dropZoneRect.on('pointerdown', (_p: unknown, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.dropBallManual();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < DROP_ZONE_H) return;
      if (pointer.y > SETTLE_Y + 40) return;
      if (this.placementMode.typeId) {
        const gx = Math.floor((pointer.x - GRID_X) / BALANCE.cellSize);
        const gy = Math.floor((pointer.y - GRID_Y) / BALANCE.cellSize);
        if (gx >= 0 && gx < BALANCE.gridCols && gy >= 0 && gy < BALANCE.gridRows) {
          const peg = GameState.placePeg(this.placementMode.typeId, gx, gy);
          if (peg) {
            this.renderPeg(peg);
            this.updatePlacementCursor();
          }
        }
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.placementMode.typeId) this.updatePlacementCursor(pointer);
    });

    // HUD
    this.hud = new HUD(this);
    this.hud.setPlacementCallback((typeId) => {
      this.placementMode.typeId = typeId;
      if (typeId) {
        if (!this.placementCursor) {
          this.placementCursor = this.add.circle(0, 0, 10, 0xf0b429, 0.4).setStrokeStyle(2, 0xf0b429);
        }
        this.placementCursor.setVisible(true);
      } else if (this.placementCursor) {
        this.placementCursor.setVisible(false);
      }
    });
    this.hud.mount();

    // 连击显示
    this.comboDisplay = this.add.text(W - 20, 80, '', {
      fontFamily: '"Alimama FangYuanTi VF Thin", "JetBrains Mono", monospace', fontSize: '16px', color: '#f0b429',
    }).setOrigin(1, 0).setAlpha(0);

    // 狂热 overlay
    this.frenzyOverlay = this.add.rectangle(0, 0, W, H, 0xf0b429, 0).setOrigin(0).setDepth(99);

    // 事件监听
    bus.on(EVT.ACTIVE_TRIGGERED, (payload: unknown) => {
      const p = payload as { skillId: string; duration: number };
      if (p.skillId === 'frenzy' || p.skillId === 'rhythm') {
        this.tweens.add({ targets: this.frenzyOverlay, alpha: 0.12, duration: 200 });
      } else if (p.skillId === 'slowdown') {
        this.physics.world.timeScale = 0.5;
      } else if (p.skillId === 'blast') {
        this.executeBlast();
      }
    });
    bus.on(EVT.ACTIVE_EXPIRED, (skillId: unknown) => {
      const id = String(skillId);
      if (id === 'frenzy' || id === 'rhythm') {
        this.tweens.add({ targets: this.frenzyOverlay, alpha: 0, duration: 200 });
      } else if (id === 'slowdown') {
        this.physics.world.timeScale = 1;
      }
    });

    // 定时器
    this.time.addEvent({ delay: 100, loop: true, callback: this.tickAuto, callbackScope: this });
    this.time.addEvent({ delay: 250, loop: true, callback: this.tickActives, callbackScope: this });
    this.time.addEvent({ delay: 5000, loop: true, callback: () => GameState.saveGame() });

    if (GameState.pegs.length === 0 && GameState.save.stats.totalBalls === 0) {
      this.showTutorialTip();
    }

    this.checkEndingChoice();

    this.events.on('shutdown', () => {
      GameState.saveGame();
      this.hud.unmount();
    });
    this.events.on('pause', () => GameState.saveGame());

    // 键盘快捷键：主动技能 1-5
    this.input.keyboard?.on('keydown-ONE', () => GameState.triggerActive(ACTIVE_SKILLS[0]?.id));
    this.input.keyboard?.on('keydown-TWO', () => GameState.triggerActive(ACTIVE_SKILLS[1]?.id));
    this.input.keyboard?.on('keydown-THREE', () => GameState.triggerActive(ACTIVE_SKILLS[2]?.id));
    this.input.keyboard?.on('keydown-FOUR', () => GameState.triggerActive(ACTIVE_SKILLS[3]?.id));
    this.input.keyboard?.on('keydown-FIVE', () => GameState.triggerActive(ACTIVE_SKILLS[4]?.id));
  }

  // 程序化绘制每章背景
  private drawBackground() {
    const W = this.scale.width, H = this.scale.height;
    const ch = GameState.chapter;
    const bg = this.add.graphics();

    if (ch.id === 1) {
      // 暖色村庄：星空 + 屋顶轮廓
      for (let i = 0; i < 80; i++) {
        bg.fillStyle(0xffffff, Math.random() * 0.6 + 0.2);
        bg.fillRect(Math.random() * W, Math.random() * (H - 200), 2, 2);
      }
      bg.fillStyle(0x2a1a0a, 1);
      bg.fillRect(0, H - 100, W, 100);
      for (let i = 0; i < 8; i++) {
        const x = i * (W / 8) + 20;
        bg.fillStyle(0x1a0a05, 1);
        bg.fillTriangle(x, H - 40, x + 30, H - 80, x + 60, H - 40);
        bg.fillStyle(0xf0b429, 0.4);
        bg.fillRect(x + 8, H - 50, 4, 4);
        bg.fillRect(x + 30, H - 50, 4, 4);
      }
    } else if (ch.id === 2) {
      // 蓝色遗迹：符文光柱
      for (let i = 0; i < 100; i++) {
        bg.fillStyle(0x5ad1ff, Math.random() * 0.3 + 0.05);
        bg.fillRect(Math.random() * W, Math.random() * H, 2, 2);
      }
      for (let i = 0; i < 5; i++) {
        const x = (i + 1) * (W / 6);
        bg.fillStyle(0x5ad1ff, 0.08);
        bg.fillRect(x - 30, 0, 60, H);
      }
      bg.fillStyle(0x0a1a15, 1);
      bg.fillRect(0, H - 60, W, 60);
    } else if (ch.id === 3) {
      // 金辉城：金色光点
      for (let i = 0; i < 50; i++) {
        bg.fillStyle(0xffcc33, Math.random() * 0.4);
        bg.fillRect(Math.random() * W, Math.random() * H, 3, 3);
      }
      bg.fillStyle(0x2a1a0a, 1);
      bg.fillRect(0, H - 80, W, 80);
      bg.fillStyle(0xffcc33, 0.1);
      bg.fillRect(0, H - 80, W, 80);
    } else if (ch.id === 4) {
      // 冰冷圣殿
      for (let i = 0; i < 5; i++) {
        const x = (i + 1) * (W / 6);
        bg.fillStyle(0xccccff, 0.06);
        bg.fillRect(x - 40, 0, 80, H);
      }
      for (let i = 0; i < 100; i++) {
        bg.fillStyle(0xffffff, Math.random() * 0.5 + 0.1);
        bg.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      }
    } else {
      // 宇宙
      for (let i = 0; i < 250; i++) {
        const c = Math.random() > 0.5 ? 0xaa88ff : 0xffffff;
        bg.fillStyle(c, Math.random() * 0.7 + 0.1);
        bg.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      }
    }
    bg.setDepth(-1);
  }

  update() {
    // 清理落底弹珠
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (ball.sprite.y > SETTLE_Y + 50) {
        this.settleBall(ball);
        this.destroyBall(i);
      }
    }
  }

  // ===== 投弹 =====
  private dropBallManual() {
    const lvl = GameState.getSkillLevel('chargeThrow');
    const init = GameState.ballInitialValue;
    let value = init;
    if (lvl > 0) value = Math.floor(init * (1 + lvl * 0.1));

    const multiThrow = GameState.getSkillLevel('multiThrow');
    const count = 1 + multiThrow;
    for (let i = 0; i < count; i++) {
      const x = (0.2 + Math.random() * 0.6) * this.scale.width + (i - count / 2) * 16;
      this.spawnBall(x, 30, value, 'manual');
    }
    GameState.onBallDropped('manual');
  }

  private spawnBall(x: number, y: number, value: number, source: 'manual' | 'auto') {
    if (this.balls.length >= BALANCE.maxBallsBase + GameState.getSkillLevel('capacity') * 5) return;
    const golden = GameState.isSkillActive('goldenRain');
    const texture = this.ballTextureFor(value, golden);
    const sprite = this.physics.add.image(x, y, texture);
    // 弹珠：圆形碰撞体 + 世界边界反弹 + 钉子反弹
    sprite.setCircle(7, 1, 1).setCollideWorldBounds(true).setBounce(0.8).setVelocityY(50);
    sprite.setDisplaySize(16, 16);
    if (GameState.isSkillActive('slowdown')) {
      sprite.setVelocity(sprite.body!.velocity.x * 0.5, sprite.body!.velocity.y * 0.5);
    }

    const text = this.add.text(x, y - 14, formatNum(value), {
      fontFamily: '"Alimama FangYuanTi VF Thin", "JetBrains Mono", monospace', fontSize: '11px',
      color: golden ? '#ffd700' : '#ffffff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);

    const ball: Ball = { sprite, text, value, source, golden, sageCopy: 0 };
    this.balls.push(ball);
    this.ballsGroup.add(sprite);
  }

  private ballTextureFor(value: number, golden: boolean): string {
    if (golden) return 'ball_golden';
    if (value >= 1e9) return 'ball_rainbow';
    if (value >= 1e6) return 'ball_purple';
    if (value >= 1e3) return 'ball_gold';
    if (value >= 100) return 'ball_green';
    if (value >= 10) return 'ball_blue';
    return 'ball_gray';
  }

  private onBallPeg(ball: Ball, ps: PegSprite) {
    if (ball.lastPegId === ps.pegId) return;
    ball.lastPegId = ps.pegId;
    const peg = GameState.pegs.find((p) => p.id === ps.pegId);
    if (!peg) return;
    const t = PEG_MAP[peg.typeId];
    if (!t) return;

    // 贤者钉：复制数字
    if (t.operator === '%') {
      ball.sageCopy = ball.value;
      this.spawnFloatText(ball.sprite.x, ball.sprite.y - 20, '复制!', 0xffffff);
      return;
    }

    const goldenMul = ball.golden ? 1.5 : 1;
    const { value: newVal, crit } = GameState.computePeg(peg, ball.value, goldenMul);
    ball.value = newVal;
    ball.text.setText(formatNum(newVal));
    ball.text.setColor(crit ? '#ff6b6b' : (newVal > 1e6 ? '#f0b429' : '#ffffff'));

    const opLabel = t.operator === '+' ? `+${Math.floor(t.operand + (peg.level - 1) * t.growth)}`
      : t.operator === '*' ? `×${(t.operand + (peg.level - 1) * t.growth).toFixed(1)}`
      : t.operator === '/' ? `÷${t.operand}` : t.operator === '^' ? '^2'
      : t.operator === 'addPercent' ? `+${Math.floor((t.operand + (peg.level - 1) * t.growth) * 100)}%`
      : t.operator === 'maxMul' ? '×2+' : '';
    this.spawnFloatText(ball.sprite.x, ball.sprite.y - 14, opLabel, t.color);

    this.tweens.add({ targets: ps.sprite, scaleX: 1.3, scaleY: 1.3, duration: 80, yoyo: true });
    this.tweens.add({ targets: ps.text, scaleX: 1.4, scaleY: 1.4, duration: 80, yoyo: true });

    const emitter = this.add.particles(ball.sprite.x, ball.sprite.y, 'particle', {
      speed: { min: 40, max: 120 },
      angle: { min: 0, max: 360 },
      lifespan: 300,
      quantity: crit ? 12 : 6,
      scale: { start: 1, end: 0 },
      tint: crit ? 0xff6b6b : t.color,
    });
    this.time.delayedCall(400, () => emitter.destroy());

    if (ball.sprite.texture.key !== this.ballTextureFor(ball.value, ball.golden)) {
      ball.sprite.setTexture(this.ballTextureFor(ball.value, ball.golden));
    }
  }

  private settleBall(ball: Ball) {
    const slotIdx = Math.min(BALANCE.bottomSlots - 1, Math.max(0, Math.floor((ball.sprite.x - 20) / ((this.scale.width - 40) / BALANCE.bottomSlots))));
    const isCenter = slotIdx === Math.floor(BALANCE.bottomSlots / 2);
    const multiplier = isCenter ? 2 : 1;
    let gold = ball.value * multiplier;

    if (ball.sageCopy > 0) {
      gold += ball.sageCopy * multiplier;
    }

    const combo = GameState.addCombo();
    const comboMul = 1 + Math.min(2, combo * 0.05);
    gold = Math.floor(gold * comboMul);

    GameState.addGold(gold);
    GameState.onBallSettled(ball.value);
    this.spawnFloatText(ball.sprite.x, ball.sprite.y - 20, `+${formatNum(gold)}`, 0xf0b429);
    if (combo > 2) {
      this.comboDisplay.setText(`${combo} 连击! ×${comboMul.toFixed(2)}`);
      this.comboDisplay.setAlpha(1);
      this.tweens.killTweensOf(this.comboDisplay);
      this.tweens.add({ targets: this.comboDisplay, alpha: 0, duration: 800, delay: 600 });
    }
  }

  private destroyBall(index: number) {
    const ball = this.balls[index];
    this.ballsGroup.remove(ball.sprite, true, true);
    ball.text.destroy();
    this.balls.splice(index, 1);
  }

  // ===== 钉子 =====
  private renderPeg(peg: PegSave) {
    const cfg = PEG_MAP[peg.typeId];
    if (!cfg) return;
    const x = GRID_X + peg.x * BALANCE.cellSize + BALANCE.cellSize / 2;
    const y = GRID_Y + peg.y * BALANCE.cellSize + BALANCE.cellSize / 2;

    let texKey = 'peg_plus';
    if (cfg.operator === '*') texKey = 'peg_mul';
    else if (cfg.operator === '/') texKey = 'peg_div';
    else if (cfg.operator === '^') texKey = 'peg_power';
    else if (cfg.operator === '%') texKey = 'peg_sage';
    else if (cfg.operator === 'addPercent') texKey = 'peg_chart';
    else if (cfg.operator === 'maxMul') texKey = 'peg_double';

    // 使用 staticGroup 创建静态钉子，物理引擎自动处理碰撞反弹
    const sprite = this.pegsGroup.create(x, y, texKey) as Phaser.Physics.Arcade.Image;
    sprite.setCircle(9, 2, 2);
    sprite.setDisplaySize(18, 18);
    // 刷新静态体缓冲（StaticGroup 专用，类型定义不全，需 cast 调用）
    (sprite as unknown as { setRefreshBuffer?: () => void }).setRefreshBuffer?.();

    const label = this.pegLabel(cfg, peg);
    const text = this.add.text(x, y, label, {
      fontFamily: '"Alimama FangYuanTi VF Thin", "JetBrains Mono", monospace', fontSize: '10px',
      color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    const ps: PegSprite = { sprite, pegId: peg.id, typeId: peg.typeId, text, gridX: peg.x, gridY: peg.y };
    this.pegSprites.set(peg.id, ps);

    sprite.setInteractive();
    sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 2) {
        GameState.sellPeg(peg.id);
        this.removePegSprite(peg.id);
      } else {
        GameState.upgradePeg(peg.id);
        this.updatePegLabel(ps, peg);
      }
    });
    sprite.on('pointerover', () => sprite.setAlpha(0.8));
    sprite.on('pointerout', () => sprite.setAlpha(1));
  }

  private pegLabel(cfg: typeof PEG_MAP[string], peg: PegSave): string {
    if (cfg.operator === '+') return `+${Math.floor(cfg.operand + (peg.level - 1) * cfg.growth)}`;
    if (cfg.operator === '*') return `×${(cfg.operand + (peg.level - 1) * cfg.growth).toFixed(1)}`;
    if (cfg.operator === '/') return '÷2';
    if (cfg.operator === '^') return '^2';
    if (cfg.operator === 'addPercent') return '%';
    if (cfg.operator === 'maxMul') return '×2+';
    return '贤';
  }

  private removePegSprite(pegId: string) {
    const ps = this.pegSprites.get(pegId);
    if (!ps) return;
    this.pegsGroup.remove(ps.sprite, true, true);
    ps.text.destroy();
    this.pegSprites.delete(pegId);
  }

  private updatePegLabel(ps: PegSprite, peg: PegSave) {
    const cfg = PEG_MAP[peg.typeId];
    if (!cfg) return;
    ps.text.setText(this.pegLabel(cfg, peg));
  }

  private updatePlacementCursor(pointer?: Phaser.Input.Pointer) {
    if (!this.placementCursor || !this.placementMode.typeId) return;
    const p = pointer ?? this.input.activePointer;
    this.placementCursor.setPosition(p.x, p.y);
  }

  // ===== 自动器 =====
  private tickAuto() {
    const rate = GameState.getAutoDropRate();
    if (rate <= 0) return;
    const rhythmMul = GameState.isSkillActive('rhythm') ? 2 : 1;
    this.autoAccumulator += 0.1 * rate * rhythmMul;
    while (this.autoAccumulator >= 1) {
      this.autoAccumulator -= 1;
      const x = GameState.getSkillLevel('smartDrop') > 0 ? this.scale.width / 2 : (0.2 + Math.random() * 0.6) * this.scale.width;
      this.spawnBall(x, 30, GameState.ballInitialValue, 'auto');
      GameState.onBallDropped('auto');
    }
  }

  private tickActives() {
    GameState.tickActives(Date.now());
    this.hud.updateActives();
  }

  private executeBlast() {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      this.settleBall(ball);
      this.destroyBall(i);
    }
  }

  // ===== 视觉 =====
  private spawnFloatText(x: number, y: number, text: string, color: number) {
    const t = this.add.text(x, y, text, {
      fontFamily: '"Alimama FangYuanTi VF Thin", "JetBrains Mono", monospace', fontSize: '12px',
      color: '#' + color.toString(16).padStart(6, '0'), stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private showTutorialTip() {
    this.time.delayedCall(1500, () => {
      this.hud.showToast('先买 +1 钉，再点击投放区开始赚钱', 'pin');
    });
  }

  private checkEndingChoice() {
    if (GameState.save.storyProgress === 'ch5_choosing') {
      bus.emit(EVT.ENDING_CHOICE);
    }
  }
}
