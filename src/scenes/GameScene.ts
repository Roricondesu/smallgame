// 主游戏场景：Matter.js 物理弹珠 + 钉子布局 + HUD 交互
// 使用 Matter.js 真实刚体物理：圆形钉子（static）+ 圆形弹珠（dynamic），
// restitution 控制弹力，collider 自动计算反弹

import Phaser from 'phaser';
import { GameState, formatNum, bigMulNum } from '../systems/GameState';
import { PEG_MAP } from '../data/pegs';

import { DIALOGUE_MAP, chapterIntroId, chapterMidpointId, chapterPrestigeReadyId } from '../data/dialogues';
import { DialogueSystem } from '../systems/DialogueSystem';
import { BossDialogueTrigger, BOSS_INFO } from '../systems/BossBattleSystem';
import type { BossId } from '../systems/BossBattleSystem';
import { bus, EVT } from '../systems/EventBus';
import { HUD } from '../ui/HUD';
import type { PegSave, MarbleConfig } from '../types';
import { BALANCE } from '../types';

// Matter 弹珠对象
interface Ball {
  sprite: Phaser.Physics.Matter.Image;
  text: Phaser.GameObjects.Text;
  value: bigint;
  source: 'manual' | 'auto' | 'boss';
  golden: boolean;
  sageCopy: bigint;
  lastPegId?: string;
  stuckSince?: number;
  marble?: MarbleConfig | null;
  /** 已被毒蚀标记过的钉子 id（去重用） */
  poisonedPegs?: Set<string>;
  /** 雷霆链击的剩余次数 */
  thunderCharges?: number;
  /** boss 球生成时间戳（用于超时清理，防止卡在场景中） */
  bossSpawnTime?: number;
  /** boss 球每帧施加的向上力（负重力效果） */
  bossForce?: number;
}

// Matter 钉子对象
interface PegSprite {
  // 真实钉子和占位钉子都是 Matter.Image
  sprite: Phaser.Physics.Matter.Image;
  pegId: string;
  typeId: string;
  text: Phaser.GameObjects.Text | null;
  gridX: number;
  gridY: number;
  placeholder?: boolean;
}

// 钉子半径（视觉与碰撞体一致）
const PEG_RADIUS = 9;
// 占位钉子半径（缩小，但仍参与碰撞）
const PLACEHOLDER_RADIUS = 5;
// 弹珠半径
const BALL_RADIUS = 8;
// 弹力系数（0=不弹，1=完全弹性）
const RESTITUTION = 0.7;
// 设计尺寸：游戏内容按此坐标系渲染，camera 缩放适配实际画布
const DESIGN_W = BALANCE.gridCols * BALANCE.cellSize; // 504
const DESIGN_H = 900; // 含顶部投放区 + 网格 + 底部结算区

export class GameScene extends Phaser.Scene {
  private balls: Ball[] = [];
  private pegSprites: Map<string, PegSprite> = new Map();
  private placeholderPegs: Map<string, PegSprite> = new Map();
  private hud!: HUD;
  private dialogue!: DialogueSystem;
  private bossDialogue!: BossDialogueTrigger;

  // ===== 场景内 Boss 战状态 =====
  private bossActive = false;
  private bossId: BossId | null = null;
  private bossHp: bigint = 0n;
  private bossMaxHp: bigint = 0n;
  private bossSprite: Phaser.GameObjects.Image | null = null;
  private bossNameText: Phaser.GameObjects.Text | null = null;
  /** boss 弧形血环（与圆环融合的 Graphics，重绘于 updateBossHpDisplay） */
  private bossHpArc: Phaser.GameObjects.Graphics | null = null;
  private bossHpText: Phaser.GameObjects.Text | null = null;
  private bossBallTimer: Phaser.Time.TimerEvent | null = null;
  private bossBallTexture!: string;
  /** boss 本体半径（命中判定用，纯距离检测，不依赖 Matter 物理体） */
  private bossRadius = 60;
  /** boss 当前中心 x/y（随移动更新，命中检测用） */
  private bossCx = 0;
  private bossCy = 0;
  /** boss 移动 tween */
  private bossMoveTween: Phaser.Tweens.Tween | null = null;
  /** boss 技能定时器 */
  private bossSkillTimer: Phaser.Time.TimerEvent | null = null;
  // ===== boss 专属技能状态 =====
  /** 骷髅 boss：骨盾剩余吸收量，>0 时下一次命中先扣盾 */
  private bossShield = 0n;
  /** 骷髅 boss：骨盾视觉 ring */
  private bossShieldRing: Phaser.GameObjects.Arc | null = null;
  /** 幻影 boss：相位结束时间戳，>now 时无法被命中 */
  private bossPhaseUntil = 0;
  /** 幻彩 boss：当前弱点元素，仅该元素弹珠可造成伤害 */
  private bossWeakness: 'fire' | 'ice' | 'thunder' | 'poison' | 'holy' | 'dark' | null = null;
  /** 幻彩 boss：弱点标记文字 */
  private bossWeaknessText: Phaser.GameObjects.Text | null = null;
  /** 霜卫 boss：冰冻结束时间戳，期间玩家球减速 */
  private bossFrostUntil = 0;
  /** boss 背景圆盘（视觉锚点，确保 boss 位置可见） */
  private bossBgDisk: Phaser.GameObjects.Arc | null = null;
  /** boss 发光描边环 */
  private bossGlowRing: Phaser.GameObjects.Arc | null = null;
  private placementMode: { typeId: string | null } = { typeId: null };
  private settleSlots: Phaser.GameObjects.Rectangle[] = [];
  private settleTexts: Phaser.GameObjects.Text[] = [];
  private comboDisplay!: Phaser.GameObjects.Text;
  private frenzyOverlay!: Phaser.GameObjects.Rectangle;
  private placementCursor: Phaser.GameObjects.Arc | null = null;
  private autoAccumulator = 0;
  // 教程状态机：跟踪玩家是否完成首次放钉/投弹
  private tutorialStage: 'intro' | 'await_peg' | 'await_drop' | 'marbles' | 'done' = 'intro';
  /** 教程状态（供 HUD 任务提示读取） */
  get tutorialState() { return this.tutorialStage; }
  /** 通知 HUD 刷新任务提示 */
  private notifyTaskHint() { this.hud?.updateTaskHint(); }
  // 球/钉子的碰撞体集合，用于碰撞回调过滤
  private ballLabels = new WeakSet<MatterJS.Body>();
  private pegLabels = new WeakSet<MatterJS.Body>();
  // sprite -> Ball 的映射，O(1) 查找
  private ballBySprite = new Map<Phaser.Physics.Matter.Image, Ball>();
  // sprite -> PegSprite 的映射，O(1) 查找（真实钉子和占位钉子都是 Matter.Image）
  private pegBySprite = new Map<Phaser.Physics.Matter.Image, PegSprite>();
  // 墙体 body 集合，用于识别球撞墙
  private wallLabels = new WeakSet<MatterJS.Body>();
  // 球上次撞墙时间，避免连续结算
  private ballWallCooldown = new WeakMap<Ball, number>();
  // 毒蚀钉子的临时增益：pegId -> 过期时间戳
  private poisonedPegBuffs = new Map<string, number>();
  // bus 事件回调引用（shutdown 时统一 off，防止场景重启后残留监听引用旧场景导致卡死）
  private busCbs: Array<{ event: string; cb: (...args: unknown[]) => void }> = [];

  // 布局相关引用（resize 时需重新定位的元素）
  private gridBg!: Phaser.GameObjects.Graphics;
  private gridBgRect!: Phaser.GameObjects.Rectangle;
  private bgImage!: Phaser.GameObjects.Image;   // 章节背景图
  private bgGradient!: Phaser.GameObjects.Graphics; // 上下渐变遮罩
  private wallVisuals: Phaser.GameObjects.Rectangle[] = [];
  private wallBodies: MatterJS.Body[] = [];
  private readonly wallW = 8;

  // 网格布局参数：在 computeLayout 中根据画布尺寸动态计算，使游戏内容居中
  private gridX = 0;
  private gridY = 0;
  private dropZoneH = 70;
  private settleY = 0;

  // 六边形蜂窝布局：奇数行向右偏移半个格子
  private gridToPixel(gx: number, gy: number): { x: number; y: number } {
    const offsetX = (gy % 2) * (BALANCE.cellSize / 2);
    const x = this.gridX + gx * BALANCE.cellSize + BALANCE.cellSize / 2 + offsetX;
    const y = this.gridY + gy * BALANCE.cellSize + BALANCE.cellSize / 2;
    return { x, y };
  }

  private pixelToGrid(x: number, y: number): { gx: number; gy: number } | null {
    const gy = Math.floor((y - this.gridY) / BALANCE.cellSize);
    if (gy < 0 || gy >= BALANCE.gridRows) return null;
    const offsetX = (gy % 2) * (BALANCE.cellSize / 2);
    const gx = Math.floor((x - this.gridX - offsetX - BALANCE.cellSize / 2) / BALANCE.cellSize);
    const maxCol = (gy % 2 === 1) ? BALANCE.gridCols - 1 : BALANCE.gridCols;
    if (gx < 0 || gx >= maxCol) return null;
    return { gx, gy };
  }

  private placeholderKey(gx: number, gy: number): string {
    return `${gx},${gy}`;
  }

  constructor() {
    super('Game');
  }

  create() {
    // 先计算布局参数（gridX/gridY/settleY），再创建元素，最后 applyLayout 统一定位
    this.computeLayout();

    // 章节背景图（最底层）+ 30% 变暗 tint（0xB2 = 70% 亮度）
    this.bgImage = this.add.image(DESIGN_W / 2, DESIGN_H / 2, `bg_ch${GameState.chapterId}`).setDepth(-100);
    this.bgImage.setTint(0xb2b2b2);

    // 上下渐变透明遮罩：顶部/底部融入场景背景色（#050709），中间透明
    this.bgGradient = this.add.graphics().setDepth(-99);
    this.bgGradient.fillGradientStyle(0x050709, 0x050709, 0x050709, 0x050709, 1, 1, 0, 0);
    this.bgGradient.fillRect(0, 0, DESIGN_W, DESIGN_H * 0.35);
    this.bgGradient.fillGradientStyle(0x050709, 0x050709, 0x050709, 0x050709, 0, 0, 1, 1);
    this.bgGradient.fillRect(0, DESIGN_H * 0.65, DESIGN_W, DESIGN_H * 0.35);

    this.gridBg = this.add.graphics();
    this.gridBgRect = this.add.rectangle(0, 0, 0, 0, 0x000000, 0.2).setStrokeStyle(1, 0x30363d).setDepth(-1);

    // 结算槽容器（空壳，repositionSettleSlots 在 applyLayout 中定位）
    this.settleSlots = [];
    this.settleTexts = [];
    for (let i = 0; i < BALANCE.bottomSlots; i++) {
      const isCenter = i === Math.floor(BALANCE.bottomSlots / 2);
      const color = isCenter ? 0xf0b429 : 0x2db7a3;
      const rect = this.add.rectangle(0, 0, 0, 0, color, 0.15).setStrokeStyle(2, color, 0.8);
      this.settleSlots.push(rect);
      const txt = this.add.text(0, 0, isCenter ? '×2' : '×1', {
        fontFamily: '"Z Labs RoundPix 12px M CN", sans-serif', fontSize: '14px', color: isCenter ? '#f0b429' : '#2db7a3',
      }).setOrigin(0.5);
      this.settleTexts.push(txt);
    }

    // 墙体视觉容器（空壳，rebuildWalls 在 applyLayout 中定位）
    this.wallVisuals = [
      this.add.rectangle(0, 0, 0, 0, 0x30363d).setStrokeStyle(1, 0x484f58),
      this.add.rectangle(0, 0, 0, 0, 0x30363d).setStrokeStyle(1, 0x484f58),
    ];

    // Matter 物理：调整重力
    const gravityMul = 1 + (GameState.getSkillLevel('gravity') || 0) * 0.1;
    this.matter.world.setGravity(0, gravityMul);

    // 统一应用布局：绘制网格背景、定位结算槽、重建墙体物理体、设置 Matter 边界
    this.applyLayout();

    // 连击显示 & 狂热 overlay（基于设计坐标系，applyLayout 会跟随重定位）
    this.comboDisplay = this.add.text(DESIGN_W - 20, 80, '', {
      fontFamily: '"Z Labs RoundPix 12px M CN", sans-serif', fontSize: '16px', color: '#f0b429',
    }).setOrigin(1, 0).setAlpha(0);
    this.frenzyOverlay = this.add.rectangle(0, 0, DESIGN_W, DESIGN_H, 0xf0b429, 0).setOrigin(0).setDepth(99);

    // 加载钉子（真实）
    const occupied = new Set<string>();
    for (const peg of GameState.pegs) {
      this.renderPeg(peg);
      occupied.add(this.placeholderKey(peg.x, peg.y));
    }

    // 初始化占位钉子（显示 0，可被替换）
    this.initPlaceholders(occupied);

    // Matter 碰撞事件：使用 collisionStart
    this.matter.world.on('collisionstart', (event: MatterJS.IEventCollision<MatterJS.Engine>) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        this.handleCollision(bodyA, bodyB);
      }
    });

    // 输入事件：点击网格区域内任意位置放球；放置模式下则放置钉子
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const wx = pointer.worldX, wy = pointer.worldY;
      if (wy > this.settleY + 40) return;
      if (this.placementMode.typeId) {
        const grid = this.pixelToGrid(wx, wy);
        if (grid) {
          const peg = GameState.placePeg(this.placementMode.typeId, grid.gx, grid.gy);
          if (peg) {
            this.removePlaceholder(grid.gx, grid.gy);
            this.renderPeg(peg);
            this.updatePlacementCursor();
            // 教程：首次放钉 → 推进到等待投弹
            if (this.tutorialStage === 'await_peg') {
              this.tutorialStage = 'await_drop';
              this.tryPlayDialogue('ch1_first_peg');
              this.hud.showToast('点击上方投放区，让弹珠落下', 'ball');
              this.notifyTaskHint();
            }
          }
        }
        return;
      }
      // 非放置模式：点击放球
      this.dropBallManual(wx);
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

    // 对话系统
    this.dialogue = new DialogueSystem();
    this.dialogue.mount();

    // Boss 对话触发器（场景内战斗逻辑由本场景直接处理）
    this.bossDialogue = new BossDialogueTrigger();
    this.bossDialogue.mount(this.dialogue);

    // Dev 模式：从 localStorage 恢复金币倍率
    if (localStorage.getItem('pa_setting_dev') === '1') {
      const mul = parseInt(localStorage.getItem('pa_setting_dev_mul') || '100', 10);
      GameState.setDevGoldMul(mul > 0 ? mul : 0);
    }

    // 事件监听：用 onBus 绑定，shutdown 时统一 off，防止场景重启后残留监听引用旧场景导致卡死
    this.onBus(EVT.ACTIVE_TRIGGERED, (payload: unknown) => {
      const p = payload as { skillId: string; duration: number };
      if (p.skillId === 'frenzy' || p.skillId === 'rhythm') {
        this.tweens.add({ targets: this.frenzyOverlay, alpha: 0.12, duration: 200 });
      } else if (p.skillId === 'slowdown') {
        this.matter.world.engine.timing.timeScale = 0.5;
      } else if (p.skillId === 'blast') {
        this.executeBlast();
      }
    });
    this.onBus(EVT.ACTIVE_EXPIRED, (skillId: unknown) => {
      const id = String(skillId);
      if (id === 'frenzy' || id === 'rhythm') {
        this.tweens.add({ targets: this.frenzyOverlay, alpha: 0, duration: 200 });
      } else if (id === 'slowdown') {
        this.matter.world.engine.timing.timeScale = 1;
      }
    });
    this.onBus(EVT.MARBLE_SELECTED, () => this.hud.refreshMarbleCodex?.());
    this.onBus(EVT.MARBLE_BOUGHT, () => {
      this.hud.refreshMarbleCodex?.();
      // 教程：首次购买弹珠后完成弹珠教程
      if (this.tutorialStage === 'marbles') {
        this.tutorialStage = 'done';
        this.notifyTaskHint();
      }
    });
    this.onBus(EVT.MARBLE_UPGRADED, () => this.hud.refreshMarbleCodex?.());
    this.onBus(EVT.PRESTIGE_AVAILABLE, () => {
      // 各章首次达到归零条件时，播放对应归零剧情对话；对话结束后通知 HUD 弹归零确认窗
      const dlgId = chapterPrestigeReadyId(GameState.chapterId);
      if (!DIALOGUE_MAP[dlgId]) {
        // 没有对话（理论上不会发生）：直接通知 HUD
        bus.emit(EVT.PRESTIGE_DIALOGUE_DONE);
        return;
      }
      if (GameState.hasSeenDialogue(dlgId)) {
        // 已看过：跳过对话，直接弹窗
        bus.emit(EVT.PRESTIGE_DIALOGUE_DONE);
        return;
      }
      this.time.delayedCall(600, () => {
        this.dialogue.start(DIALOGUE_MAP[dlgId], () => {
          bus.emit(EVT.PRESTIGE_DIALOGUE_DONE);
        });
      });
    });
    this.onBus(EVT.BOSS_DEFEATED, () => {
      // Boss 击败后重新检查章节进度，可能立即触发归零就绪
      GameState.saveGame();
      this.hud.showToast('Boss 已击败！归零之路已开', 'prestige');
      GameState.recheckChapterGoal();
    });
    // 场景内 Boss 战：BOSS_TRIGGER 触发时启动场景战斗
    this.onBus(EVT.BOSS_TRIGGER, (id: unknown) => {
      const bossId = id as BossId;
      if (!bossId || GameState.isBossDefeated()) return;
      if (this.bossActive) return;
      this.startSceneBoss(bossId);
    });
    this.onBus(EVT.MILESTONE_REACHED, (payload: unknown) => {
      const p = payload as { type: string; chapter: number };
      if (p.type === 'midpoint') {
        this.tryPlayDialogue(chapterMidpointId(p.chapter));
      } else if (p.type === 'revelation') {
        this.tryPlayDialogue('ch4_revelation');
      }
    });
    this.onBus(EVT.CHAPTER_CHANGED, () => {
      // 切换章节背景（重新应用 30% 变暗 tint 以防被清除）
      this.bgImage.setTexture(`bg_ch${GameState.chapterId}`);
      this.bgImage.setTint(0xb2b2b2);
    });

    // 定时器
    this.time.addEvent({ delay: 100, loop: true, callback: this.tickAuto, callbackScope: this });
    this.time.addEvent({ delay: 250, loop: true, callback: this.tickActives, callbackScope: this });
    // 自动保存间隔由设置控制（默认 30s，0=关闭）
    {
      const interval = parseInt(localStorage.getItem('pa_setting_autosave') || '30', 10);
      if (interval > 0) this.time.addEvent({ delay: interval * 1000, loop: true, callback: () => GameState.saveGame() });
    }

    // 教程引导：第 1 章首次进入时触发章节开场对话
    this.scheduleIntroDialogue();

    // 画布尺寸变化时重新布局（窗口缩放 / 设备旋转）
    this.scale.on('resize', this.onResize, this);

    this.events.on('shutdown', () => {
      GameState.saveGame();
      // 清理 bus 监听，避免场景重启后旧回调引用已销毁的场景对象导致卡死
      for (const { event, cb } of this.busCbs) bus.off(event, cb);
      this.busCbs = [];
      // 复原时间缩放，防止上一场战斗的 slowdown 残留
      this.matter.world.engine.timing.timeScale = 1;
      this.hud.unmount();
      this.dialogue?.unmount();
      this.bossDialogue?.unmount();
      this.cleanupSceneBoss();
      this.scale.off('resize', this.onResize, this);
    });
    this.events.on('pause', () => GameState.saveGame());
  }

  /** 绑定 bus 事件并记录回调，便于 shutdown 时统一注销 */
  private onBus(event: string, cb: (...args: unknown[]) => void) {
    this.busCbs.push({ event, cb });
    bus.on(event, cb);
  }

  /** 章节开场对话：未看过则播放；并初始化教程状态机 */
  private scheduleIntroDialogue() {
    const introId = chapterIntroId(GameState.chapterId);
    const intro = DIALOGUE_MAP[introId];
    if (!intro) return;
    if (GameState.hasSeenDialogue(introId)) {
      // 跳过对话，但若处于第 1 章且无钉子，则进入"等放置钉子"阶段
      if (GameState.chapterId === 1 && GameState.pegs.length === 0 && GameState.save.stats.totalBalls === 0) {
        this.tutorialStage = 'await_peg';
      } else if (GameState.chapterId === 1 && GameState.save.stats.totalBalls === 0) {
        this.tutorialStage = 'await_drop';
      } else {
        this.tutorialStage = 'done';
      }
      this.notifyTaskHint();
      return;
    }
    // 第 1 章：开场对话结束后进入"等放置钉子"
    // 第 2 章：开场后接"遇见莉莉"对话
    // 第 3 章：开场后接"遇见薇拉"对话
    // 其他章：仅播放剧情，结束后即 done
    this.time.delayedCall(400, () => {
      this.dialogue.start(intro, () => {
        if (GameState.chapterId === 1) {
          this.tutorialStage = 'await_peg';
          this.hud.showToast('在商店中选一枚 +1 钉放到网格上', 'pin');
        } else {
          this.tutorialStage = 'done';
        }
        this.notifyTaskHint();
        // 第 2/3 章开场后接角色相遇对话
        if (GameState.chapterId === 2) {
          this.time.delayedCall(600, () => this.tryPlayDialogue('ch2_meet_lily'));
        } else if (GameState.chapterId === 3) {
          this.time.delayedCall(600, () => this.tryPlayDialogue('ch3_meet_vera'));
        }
      });
    });
  }

  // 基于固定设计尺寸计算网格布局：12×16 网格水平居中，垂直留出顶部投放区与底部结算区
  private computeLayout() {
    const gridWidth = BALANCE.gridCols * BALANCE.cellSize;
    const gridH = BALANCE.gridRows * BALANCE.cellSize;
    this.gridX = (DESIGN_W - gridWidth) / 2;
    this.dropZoneH = 70;
    // 顶部投放区 + 网格 + 底部结算区，垂直居中于设计高度
    const totalContent = this.dropZoneH + gridH + 80;
    const topPad = Math.max(BALANCE.pegGridTopOffset, (DESIGN_H - totalContent) / 2 + this.dropZoneH);
    this.gridY = topPad;
    this.settleY = this.gridY + gridH + 10;
  }

  // 根据实际画布尺寸缩放 camera，使设计区域完整可见并居中
  private fitCamera() {
    const W = this.scale.width, H = this.scale.height;
    const zoom = Math.min(W / DESIGN_W, H / DESIGN_H);
    this.cameras.main.setZoom(zoom);
    // 居中：scroll 使设计区域中心对齐画布中心
    this.cameras.main.centerOn(DESIGN_W / 2, DESIGN_H / 2);
  }

  // 重新应用布局：绘制网格背景、定位结算槽、重建墙体、重定位钉子、更新 overlay
  private applyLayout() {
    this.computeLayout();
    // 背景图拉伸覆盖设计区域（背景图比例 ≈ 设计区域比例，几乎无变形）
    this.bgImage.setPosition(DESIGN_W / 2, DESIGN_H / 2).setDisplaySize(DESIGN_W, DESIGN_H);
    this.drawGridBg();
    this.repositionSettleSlots();
    this.rebuildWalls();
    this.repositionPegs();
    // Matter 世界边界基于设计坐标系（左右挡墙，顶部/底部开放）
    this.matter.world.setBounds(0, 0, DESIGN_W, DESIGN_H, 1, true, true, false, false);
    if (this.frenzyOverlay) this.frenzyOverlay.setSize(DESIGN_W, DESIGN_H);
    if (this.comboDisplay) this.comboDisplay.setPosition(DESIGN_W - 20, 80);
    // 根据画布尺寸缩放 camera，使设计区域完整可见
    this.fitCamera();
  }

  // 绘制六边形蜂窝点阵 + 定位半透明底板
  private drawGridBg() {
    this.gridBg.clear();
    this.gridBg.fillStyle(0xffffff, 0.04);
    for (let gy = 0; gy < BALANCE.gridRows; gy++) {
      const maxCol = (gy % 2 === 1) ? BALANCE.gridCols - 1 : BALANCE.gridCols;
      for (let gx = 0; gx < maxCol; gx++) {
        const { x, y } = this.gridToPixel(gx, gy);
        this.gridBg.fillCircle(x, y, 3);
      }
    }
    const cx = this.gridX + BALANCE.gridCols * BALANCE.cellSize / 2;
    const cy = this.gridY + BALANCE.gridRows * BALANCE.cellSize / 2;
    this.gridBgRect.setPosition(cx, cy);
    this.gridBgRect.setSize(BALANCE.gridCols * BALANCE.cellSize, BALANCE.gridRows * BALANCE.cellSize);
  }

  // 结算槽与文字跟随网格左右对齐
  private repositionSettleSlots() {
    const gridW = BALANCE.gridCols * BALANCE.cellSize;
    const slotW = gridW / BALANCE.bottomSlots;
    for (let i = 0; i < BALANCE.bottomSlots; i++) {
      const x = this.gridX + slotW * (i + 0.5);
      this.settleSlots[i].setPosition(x, this.settleY + 20).setSize(slotW - 8, 40);
      this.settleTexts[i].setPosition(x, this.settleY + 20);
    }
  }

  // 重建墙体：销毁旧物理体并按新布局创建（静态体尺寸无法直接改，需重建）
  private rebuildWalls() {
    for (const b of this.wallBodies) {
      this.matter.world.remove(b);
    }
    this.wallBodies = [];
    this.wallLabels = new WeakSet<MatterJS.Body>();

    const wallRestitution = 0.7 + GameState.getSkillLevel('wallBounce') * 0.08;
    const gridLeftX = this.gridX;
    const gridRightX = this.gridX + BALANCE.gridCols * BALANCE.cellSize;
    const wallTopY = 0;
    const wallBottomY = this.settleY + 30;
    const wallH = wallBottomY - wallTopY;
    const wallMidY = (wallTopY + wallBottomY) / 2;

    // 视觉矩形重定位
    this.wallVisuals[0].setPosition(gridLeftX - this.wallW / 2, wallMidY).setSize(this.wallW, wallH);
    this.wallVisuals[1].setPosition(gridRightX + this.wallW / 2, wallMidY).setSize(this.wallW, wallH);

    // 物理体重建
    const leftWall = this.matter.add.rectangle(gridLeftX - this.wallW / 2, wallMidY, this.wallW, wallH, {
      isStatic: true, restitution: wallRestitution, friction: 0.005, label: 'wall',
    });
    const rightWall = this.matter.add.rectangle(gridRightX + this.wallW / 2, wallMidY, this.wallW, wallH, {
      isStatic: true, restitution: wallRestitution, friction: 0.005, label: 'wall',
    });
    if (leftWall) { this.wallBodies.push(leftWall as MatterJS.Body); this.wallLabels.add(leftWall as MatterJS.Body); }
    if (rightWall) { this.wallBodies.push(rightWall as MatterJS.Body); this.wallLabels.add(rightWall as MatterJS.Body); }
  }

  // 所有钉子（真实 + 占位）按新布局重定位到对应网格坐标
  private repositionPegs() {
    for (const ps of this.pegSprites.values()) {
      const { x, y } = this.gridToPixel(ps.gridX, ps.gridY);
      ps.sprite.setPosition(x, y);
      ps.text?.setPosition(x, y);
    }
    for (const ps of this.placeholderPegs.values()) {
      const { x, y } = this.gridToPixel(ps.gridX, ps.gridY);
      ps.sprite.setPosition(x, y);
    }
  }

  private onResize(_gameSize: Phaser.Structs.Size) {
    // 球的位置不调整，让其按物理自然下落；仅重布局静态元素
    this.applyLayout();
  }

  // Matter 碰撞处理：球碰钉子或墙时触发
  // 性能优化：用 sprite 引用直接查找，避免遍历数组
  private handleCollision(bodyA: MatterJS.Body, bodyB: MatterJS.Body) {
    const aIsBall = this.ballLabels.has(bodyA);
    const bIsBall = this.ballLabels.has(bodyB);
    const aIsPeg = this.pegLabels.has(bodyA);
    const bIsPeg = this.pegLabels.has(bodyB);

    // 球 vs 钉子
    if (aIsBall && bIsPeg) {
      this.fireBallPeg(bodyA, bodyB);
      return;
    }
    if (bIsBall && aIsPeg) {
      this.fireBallPeg(bodyB, bodyA);
      return;
    }

    // 球 vs 球（玩家球与 boss 球抵消数值）
    if (aIsBall && bIsBall) {
      this.fireBallBall(bodyA, bodyB);
      return;
    }

    // 球 vs 墙
    if (aIsBall && this.wallLabels.has(bodyB)) {
      this.fireBallWall(bodyA);
      return;
    }
    if (bIsBall && this.wallLabels.has(bodyA)) {
      this.fireBallWall(bodyB);
      return;
    }
  }

  /** 球与球碰撞：玩家球抵消 boss 球数值 */
  private fireBallBall(bodyA: MatterJS.Body, bodyB: MatterJS.Body) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sa = (bodyA as any).gameObject as Phaser.Physics.Matter.Image | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = (bodyB as any).gameObject as Phaser.Physics.Matter.Image | undefined;
    if (!sa || !sb) return;
    const ba = this.ballBySprite.get(sa);
    const bb = this.ballBySprite.get(sb);
    if (!ba || !bb) return;
    // 只处理玩家球 vs boss 球
    const playerBall = ba.source === 'boss' ? (bb.source === 'boss' ? null : bb) : (bb.source === 'boss' ? ba : null);
    const bossBall = ba.source === 'boss' ? ba : (bb.source === 'boss' ? bb : null);
    if (!playerBall || !bossBall) return;

    // 数值抵消：较小者销毁，较大者减去较小者继续
    if (playerBall.value === bossBall.value) {
      this.spawnFloatText(bossBall.sprite.x, bossBall.sprite.y, `抵消 ${formatNum(bossBall.value)}`, 0x56d4dd);
      this.destroyBallByRef(playerBall);
      this.destroyBallByRef(bossBall);
    } else if (playerBall.value > bossBall.value) {
      playerBall.value -= bossBall.value;
      playerBall.text.setText(formatNum(playerBall.value));
      this.spawnFloatText(bossBall.sprite.x, bossBall.sprite.y, `抵消 ${formatNum(bossBall.value)}`, 0x56d4dd);
      this.destroyBallByRef(bossBall);
    } else {
      bossBall.value -= playerBall.value;
      bossBall.text.setText(formatNum(bossBall.value));
      this.spawnFloatText(playerBall.sprite.x, playerBall.sprite.y, `抵消 ${formatNum(playerBall.value)}`, 0x56d4dd);
      this.destroyBallByRef(playerBall);
    }
  }

  /** 按 Ball 引用销毁（球间碰撞抵消时使用，不依赖数组下标） */
  private destroyBallByRef(ball: Ball) {
    const idx = this.balls.indexOf(ball);
    if (idx < 0) return;
    this.destroyBall(idx);
  }

  /** 玩家球命中 boss 本体：接入技能机制（盾/相位/变色）后结算伤害 */
  private fireBallBossBody(ball: Ball) {
    if (ball.source === 'boss') return;   // boss 球不伤害本体
    // 幻影 boss：相位偏移期间无法被命中
    if (this.bossId === 'boss_ghost' && Date.now() < this.bossPhaseUntil) {
      this.spawnFloatText(ball.sprite.x, ball.sprite.y - 20, '相位 miss', 0xbc8cff);
      this.destroyBallByRef(ball);
      return;
    }
    // 幻彩 boss：仅弱点元素弹珠可造成伤害
    if (this.bossId === 'boss_chameleon' && this.bossWeakness) {
      const el = ball.marble?.element;
      if (el !== this.bossWeakness) {
        this.spawnFloatText(ball.sprite.x, ball.sprite.y - 20, `弱点 ${this.weaknessLabel(this.bossWeakness)} miss`, 0x999999);
        this.destroyBallByRef(ball);
        return;
      }
    }
    // 命中本体 → 造成伤害 = 下落后最终结算数值（含槽位/贤者副本/元素弹珠/连击等直接加成）
    let dmg = this.computeSettledGold(ball, GameState.currentComboMul());
    if (dmg <= 0n) return;

    // 骷髅 boss：骨盾优先吸收伤害
    if (this.bossId === 'boss_skull' && this.bossShield > 0n) {
      if (this.bossShield >= dmg) {
        // 盾吸收全部
        this.bossShield -= dmg;
        this.spawnFloatText(ball.sprite.x, ball.sprite.y - 20, `盾 -${formatNum(dmg)}`, 0xeeeeee);
        this.destroyBallByRef(ball);
        // 盾耗尽 → 销毁盾环
        if (this.bossShield <= 0n) {
          this.bossShield = 0n;
          this.bossShieldRing?.destroy();
          this.bossShieldRing = null;
          this.spawnFloatText(this.bossCx, this.bossCy - 40, '骨盾碎裂！', 0xff6b6b);
        }
        return;
      } else {
        // 盾不足，溢出伤害打血条
        dmg -= this.bossShield;
        this.bossShield = 0n;
        this.bossShieldRing?.destroy();
        this.bossShieldRing = null;
        this.spawnFloatText(this.bossCx, this.bossCy - 40, '骨盾碎裂！', 0xff6b6b);
      }
    }

    this.bossHp = this.bossHp > dmg ? this.bossHp - dmg : 0n;
    this.spawnFloatText(ball.sprite.x, ball.sprite.y - 20, `命中 -${formatNum(dmg)}`, 0xff6b6b);
    this.updateBossHpDisplay();
    this.destroyBallByRef(ball);
    if (this.bossHp <= 0n) this.winSceneBoss();
  }

  private fireBallPeg(ballBody: MatterJS.Body, pegBody: MatterJS.Body) {
    // 用 body.gameObject 直接取 sprite，再用 Map O(1) 查找
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ballSprite = (ballBody as any).gameObject as Phaser.Physics.Matter.Image | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pegSprite = (pegBody as any).gameObject as Phaser.Physics.Matter.Image | undefined;
    if (!ballSprite || !pegSprite) return;
    const ball = this.ballBySprite.get(ballSprite);
    const ps = this.pegBySprite.get(pegSprite);
    if (ball && ps) this.onBallPeg(ball, ps);
  }
  private fireBallWall(ballBody: MatterJS.Body) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ballSprite = (ballBody as any).gameObject as Phaser.Physics.Matter.Image | undefined;
    if (!ballSprite) return;
    const ball = this.ballBySprite.get(ballSprite);
    if (ball) this.onBallWall(ball);
  }

  // 球撞墙：根据"墙体金币"技能结算额外金币（带 1 秒冷却防刷屏）
  private onBallWall(ball: Ball) {
    if (ball.source === 'boss') return;   // boss 球不触发墙体金币
    const now = Date.now();
    const last = this.ballWallCooldown.get(ball) || 0;
    if (now - last < 1000) return;
    this.ballWallCooldown.set(ball, now);

    const wallBonusLvl = GameState.getSkillLevel('wallBonus');
    if (wallBonusLvl <= 0) return;

    const bonus = bigMulNum(ball.value, wallBonusLvl * 0.04);
    if (bonus <= 0n) return;
    GameState.addGold(bonus);
    this.spawnFloatText(ball.sprite.x, ball.sprite.y - 14, `+${formatNum(bonus)}`, 0x56d4dd);
  }

  update() {
    // 对话进行时游戏放慢 10 倍（Phaser 时钟 + Matter.js 物理同步降速），确保玩家看完剧情
    const slow = this.dialogue?.isPlaying() ? 0.1 : 1;
    this.time.timeScale = slow;
    this.matter.world.engine.timing.timeScale = slow;
    // 同步球上数字文字到球的位置 + 检测停滞球
    for (const ball of this.balls) {
      ball.text.setPosition(ball.sprite.x, ball.sprite.y - 14);
    }
    // boss 战：玩家球与 boss 本体的距离命中检测（不依赖 Matter 物理体）
    if (this.bossActive && this.bossSprite) {
      const r = this.bossRadius + BALL_RADIUS;
      const frozen = Date.now() < this.bossFrostUntil;
      for (let i = this.balls.length - 1; i >= 0; i--) {
        const b = this.balls[i];
        if (b.source === 'boss') continue;
        // 霜卫冰冻：玩家球持续减速（仅向下重力方向）
        if (frozen) {
          const v = b.sprite.body?.velocity;
          if (v && v.y > 0) b.sprite.setVelocityY(v.y * 0.92);
        }
        const dx = b.sprite.x - this.bossCx;
        const dy = b.sprite.y - this.bossCy;
        if (dx * dx + dy * dy < r * r) {
          this.fireBallBossBody(b);
        }
      }
    }
    // 清理落底弹珠 + 停滞球（速度过低且存在时间过长）
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      // boss 球：每帧持续向上加速（负重力效果），到达顶部扣金币，超时消散
      if (ball.source === 'boss') {
        const force = ball.bossForce ?? 0.5;
        const v = ball.sprite.body?.velocity;
        if (v) {
          // 向上加速，上限 -8 防止过快
          const newVy = Math.max(v.y - force * 0.15, -8);
          ball.sprite.setVelocityY(newVy);
        }
        if (ball.sprite.y < 0) {
          this.bossBallReachedTop(ball);
          this.destroyBall(i);
        } else if (ball.bossSpawnTime && Date.now() - ball.bossSpawnTime > 20000) {
          this.spawnFloatText(ball.sprite.x, ball.sprite.y, '消散', 0x888888);
          this.destroyBall(i);
        }
        continue;
      }
      // 落底结算
      if (ball.sprite.y > this.settleY + 50) {
        this.settleBall(ball);
        this.destroyBall(i);
        continue;
      }
      // 防止球卡住：检测长时间停滞的球（速度过低），强制结算
      const v = ball.sprite.body?.velocity;
      if (v && Math.abs(v.x) < 0.3 && Math.abs(v.y) < 0.3) {
        if (!ball.stuckSince) ball.stuckSince = Date.now();
        else if (Date.now() - ball.stuckSince > 3000) {
          this.settleBall(ball);
          this.destroyBall(i);
        }
      } else {
        ball.stuckSince = undefined;
      }
    }
  }

  // ===== 投弹 =====
  private dropBallManual(x: number) {
    const lvl = GameState.getSkillLevel('chargeThrow');
    const init = GameState.ballInitialValue;
    let value = init;
    if (lvl > 0) value = bigMulNum(init, 1 + lvl * 0.1);

    // 元素弹珠：永久拥有，手动投放使用当前选中弹珠（不消耗次数）
    const marble = GameState.getSelectedMarbleConfig();
    if (marble) {
      const mLevel = GameState.getMarbleLevel(marble.id);
      // 圣光弹珠：按下落时数值立即按等级倍率翻倍
      if (marble.element === 'holy') {
        value = bigMulNum(value, marble.getValue(mLevel));
      }
    }

    const multiThrow = GameState.getSkillLevel('multiThrow');
    const count = 1 + multiThrow;
    for (let i = 0; i < count; i++) {
      const offsetX = x + (i - count / 2) * 16;
      this.spawnBall(offsetX, 10, value, 'manual', marble);
    }
    GameState.onBallDropped('manual');

    // 教程：首次投弹 → 播放对话
    if (this.tutorialStage === 'await_drop') {
      this.tutorialStage = 'marbles';
      this.tryPlayDialogue('ch1_first_drop');
      this.notifyTaskHint();
      // 间隔后引导玩家使用元素弹珠
      this.time.delayedCall(4000, () => {
        if (this.tutorialStage === 'marbles' && !GameState.hasSeenDialogue('ch1_marbles')) {
          this.tryPlayDialogue('ch1_marbles');
        }
      });
    }
  }

  private spawnBall(x: number, y: number, value: bigint, source: 'manual' | 'auto', marble?: MarbleConfig | null) {
    if (this.balls.length >= BALANCE.maxBallsBase + GameState.getSkillLevel('capacity') * 5) return;
    const golden = GameState.isSkillActive('goldenRain');
    const texture = marble ? `ball_${marble.element}` : this.ballTextureFor(value, golden);

    // Matter 圆形弹珠：restitution 控制弹力，friction 较低避免粘附
    const sprite = this.matter.add.image(x, y, texture, undefined, {
      shape: { type: 'circle', radius: BALL_RADIUS },
      restitution: RESTITUTION,
      friction: 0.005,
      frictionAir: 0.001,
      density: 0.002,
      label: 'ball',
    });
    sprite.setDisplaySize(BALL_RADIUS * 2, BALL_RADIUS * 2);

    // 给球一个初始下落速度和微量水平随机
    const vx = Phaser.Math.Between(-3, 3);
    sprite.setVelocity(vx, 3);

    if (GameState.isSkillActive('slowdown')) {
      sprite.setVelocity(vx * 0.5, 1.5);
    }

    // 标记 body 为球，用于碰撞过滤
    if (sprite.body) {
      this.ballLabels.add(sprite.body as MatterJS.Body);
    }

    const text = this.add.text(x, y - 14, formatNum(value), {
      fontFamily: '"Z Labs RoundPix 12px M CN", sans-serif', fontSize: '11px',
      color: golden ? '#ffd700' : (marble ? '#' + marble.color.toString(16).padStart(6, '0') : '#ffffff'),
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);

    const ball: Ball = {
      sprite, text, value, source, golden, sageCopy: 0n,
      marble: marble ?? null,
      // 雷霆链击次数：等级决定（基础 2 + (level-1)）
      thunderCharges: marble?.element === 'thunder' ? (2 + (GameState.getMarbleLevel(marble.id) - 1)) : 0,
      poisonedPegs: marble?.element === 'poison' ? new Set() : undefined,
    };
    this.balls.push(ball);
    this.ballBySprite.set(sprite, ball);
  }

  private ballTextureFor(value: bigint, golden: boolean): string {
    if (golden) return 'ball_golden';
    // 比较阈值用 bigint（缩放值 = 原值 × 100）
    if (value >= 100000000000n) return 'ball_rainbow'; // 原 1e9
    if (value >= 100000000n) return 'ball_purple';   // 原 1e6
    if (value >= 100000n) return 'ball_gold';        // 原 1e3
    if (value >= 10000n) return 'ball_green';   // 原 100
    if (value >= 1000n) return 'ball_blue';     // 原 10
    return 'ball_gray';
  }

  /** 播放对话（若未看过） */
  private tryPlayDialogue(id: string) {
    if (!DIALOGUE_MAP[id]) return;
    if (GameState.hasSeenDialogue(id)) return;
    this.time.delayedCall(600, () => {
      this.dialogue.start(DIALOGUE_MAP[id]);
    });
  }

  private onBallPeg(ball: Ball, ps: PegSprite) {
    // boss 球：不被钉子运算（仅与玩家球抵消），但仍参与物理反弹
    if (ball.source === 'boss') return;
    if (ball.lastPegId === ps.pegId) return;
    ball.lastPegId = ps.pegId;

    // 占位钉子：纯碰撞反弹，无文字、无 +0 提示、无动画
    if (ps.placeholder || ps.typeId === 'placeholder') {
      return;
    }

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
    ball.text.setColor(crit ? '#ff6b6b' : (newVal > 100000000n ? '#f0b429' : '#ffffff'));

    const opLabel = t.operator === '+' ? `+${Math.floor(t.operand + (peg.level - 1) * t.growth)}`
      : t.operator === '*' ? `×${(t.operand + (peg.level - 1) * t.growth).toFixed(1)}`
      : t.operator === '/' ? `÷${t.operand}`
      : t.operator === '^' ? `^${(t.operand + (peg.level - 1) * t.growth).toFixed(2)}`
      : t.operator === 'addPercent' ? `+${Math.floor((t.operand + (peg.level - 1) * t.growth) * 100)}%`
      : t.operator === 'maxMul' ? '×2+' : '';
    this.spawnFloatText(ball.sprite.x, ball.sprite.y - 14, opLabel, t.color);

    // ===== 元素弹珠效果 =====
    if (ball.marble) {
      this.applyMarbleOnPeg(ball, ps);
    }

    // 防冻结：先完成旧 tween（恢复目标 scale 到 1），再重置后启动新 tween
    // 高频碰撞下若直接 add 会让目标卡在放大状态
    this.tweens.killTweensOf(ps.sprite);
    ps.sprite.setScale(1);
    this.tweens.add({ targets: ps.sprite, scaleX: 1.3, scaleY: 1.3, duration: 80, yoyo: true });
    if (ps.text) {
      this.tweens.killTweensOf(ps.text);
      ps.text.setScale(1);
      this.tweens.add({ targets: ps.text, scaleX: 1.4, scaleY: 1.4, duration: 80, yoyo: true });
    }

    if (!ball.marble && ball.sprite.texture.key !== this.ballTextureFor(ball.value, ball.golden)) {
      ball.sprite.setTexture(this.ballTextureFor(ball.value, ball.golden));
    }
  }

  /** 弹珠与钉子碰撞时触发的元素效果 */
  private applyMarbleOnPeg(ball: Ball, ps: PegSprite) {
    if (!ball.marble) return;
    const mLevel = GameState.getMarbleLevel(ball.marble.id);
    switch (ball.marble.element) {
      case 'fire': {
        // 每次碰撞按等级倍率加成
        const mul = ball.marble.getValue(mLevel);
        ball.value = bigMulNum(ball.value, mul);
        ball.text.setText(formatNum(ball.value));
        this.spawnFloatText(ball.sprite.x + 14, ball.sprite.y - 4, `×${mul.toFixed(2)}`, ball.marble.color);
        break;
      }
      case 'poison': {
        // 标记该钉子，下次结算按等级倍率加成
        if (!ball.poisonedPegs) ball.poisonedPegs = new Set();
        if (!ball.poisonedPegs.has(ps.pegId)) {
          ball.poisonedPegs.add(ps.pegId);
          this.poisonedPegBuffs.set(ps.pegId, Date.now() + 8000);
          this.spawnFloatText(ps.sprite.x, ps.sprite.y - 12, '毒', ball.marble.color);
          // 视觉染绿
          ps.sprite.setTint(ball.marble.color);
          this.time.delayedCall(8000, () => {
            if (this.pegSprites.get(ps.pegId)) ps.sprite.clearTint();
            this.poisonedPegBuffs.delete(ps.pegId);
          });
        }
        break;
      }
      case 'thunder': {
        // 雷霆链击：等级决定链击次数
        if ((ball.thunderCharges ?? 0) > 0) {
          ball.thunderCharges = (ball.thunderCharges ?? 0) - 1;
          const neighbors: PegSprite[] = [];
          for (const ps2 of this.pegSprites.values()) {
            if (ps2.pegId === ps.pegId || ps2.placeholder) continue;
            const dx = ps2.sprite.x - ps.sprite.x;
            const dy = ps2.sprite.y - ps.sprite.y;
            if (dx * dx + dy * dy < 100 * 100) neighbors.push(ps2);
          }
          if (neighbors.length > 0) {
            const target = neighbors[Math.floor(Math.random() * neighbors.length)];
            const peg2 = GameState.pegs.find((p) => p.id === target.pegId);
            if (peg2) {
              const t2 = PEG_MAP[peg2.typeId];
              if (t2 && t2.operator !== '%') {
                const { value: v2 } = GameState.computePeg(peg2, ball.value, 1);
                ball.value = v2;
                ball.text.setText(formatNum(v2));
                this.spawnFloatText(target.sprite.x, target.sprite.y - 14, '⚡', ball.marble.color);
                this.tweens.killTweensOf(target.sprite);
                target.sprite.setScale(1);
                this.tweens.add({ targets: target.sprite, scaleX: 1.4, scaleY: 1.4, duration: 80, yoyo: true });
              }
            }
          }
        }
        break;
      }
      // ice / holy / dark 在 settleBall 中触发
      default:
        break;
    }
  }

  private settleBall(ball: Ball) {
    // boss 战时未命中本体的玩家球落底后正常加金币（命中本体的球已在碰撞中销毁）
    const combo = GameState.addCombo();
    const comboMul = 1 + Math.min(2, combo * 0.05);
    const gold = this.computeSettledGold(ball, comboMul);
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

  /**
   * 计算球落底的最终结算数值（与加金币结算一致）：
   * 槽位倍率（中央 ×2）→ 贤者副本 → 元素弹珠（冰翻倍/暗复制）→ 连击倍率。
   * 元素弹珠效果会生成对应浮动文字。纯计算，不修改金币/连击状态。
   * 用于：① settleBall 加金币；② fireBallBossBody 计算对 Boss 伤害（伤害=最终结算数值）。
   */
  private computeSettledGold(ball: Ball, comboMul: number): bigint {
    // 判定边界与结算槽绘制保持一致：从 gridX 开始，宽度为网格宽度
    const gridW = BALANCE.gridCols * BALANCE.cellSize;
    const slotW = gridW / BALANCE.bottomSlots;
    const slotIdx = Math.min(BALANCE.bottomSlots - 1, Math.max(0, Math.floor((ball.sprite.x - this.gridX) / slotW)));
    const isCenter = slotIdx === Math.floor(BALANCE.bottomSlots / 2);
    const multiplier = isCenter ? 2 : 1;
    let gold = bigMulNum(ball.value, multiplier);

    if (ball.sageCopy > 0n) {
      gold = gold + bigMulNum(ball.sageCopy, multiplier);
    }

    // ===== 元素弹珠结算效果 =====
    if (ball.marble) {
      const mLevel = GameState.getMarbleLevel(ball.marble.id);
      switch (ball.marble.element) {
        case 'ice': {
          // 落底翻倍（按等级倍率）
          const mul = ball.marble.getValue(mLevel);
          gold = bigMulNum(gold, mul);
          this.spawnFloatText(ball.sprite.x, ball.sprite.y - 36, `冰花 ×${mul.toFixed(2)}`, ball.marble.color);
          break;
        }
        case 'dark': {
          // 暗影：按等级倍率复制数值
          const copies = ball.marble.getValue(mLevel);
          const extra = bigMulNum(ball.value, multiplier * (copies - 1));
          gold = gold + extra;
          this.spawnFloatText(ball.sprite.x, ball.sprite.y - 36, `暗影 ×${copies.toFixed(2)}`, ball.marble.color);
          break;
        }
        default:
          break;
      }
    }

    gold = bigMulNum(gold, comboMul);
    return gold;
  }

  private destroyBall(index: number) {
    const ball = this.balls[index];
    this.ballBySprite.delete(ball.sprite);
    ball.sprite.destroy();
    ball.text.destroy();
    this.balls.splice(index, 1);
  }

  // ===== 钉子 =====
  private makePegSprite(x: number, y: number, texKey: string, label: string): Phaser.Physics.Matter.Image {
    // Matter 静态圆形钉子：isStatic=true 不受重力，restitution 弹力
    const sprite = this.matter.add.image(x, y, texKey, undefined, {
      shape: { type: 'circle', radius: PEG_RADIUS },
      isStatic: true,
      restitution: RESTITUTION,
      friction: 0.01,
      label,
    });
    sprite.setDisplaySize(PEG_RADIUS * 2, PEG_RADIUS * 2);
    // 标记 body 为钉子，用于碰撞过滤
    if (sprite.body) {
      this.pegLabels.add(sprite.body as MatterJS.Body);
    }
    return sprite;
  }

  private renderPeg(peg: PegSave) {
    const cfg = PEG_MAP[peg.typeId];
    if (!cfg) return;
    const { x, y } = this.gridToPixel(peg.x, peg.y);

    let texKey = 'peg_plus';
    if (cfg.operator === '*') texKey = 'peg_mul';
    else if (cfg.operator === '/') texKey = 'peg_div';
    else if (cfg.operator === '^') texKey = 'peg_power';
    else if (cfg.operator === '%') texKey = 'peg_sage';
    else if (cfg.operator === 'addPercent') texKey = 'peg_chart';
    else if (cfg.operator === 'maxMul') texKey = 'peg_double';

    const sprite = this.makePegSprite(x, y, texKey, `peg:${peg.id}`);

    const label = this.pegLabel(cfg, peg);
    const text = this.add.text(x, y, label, {
      fontFamily: '"Z Labs RoundPix 12px M CN", sans-serif', fontSize: '10px',
      color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    const ps: PegSprite = { sprite, pegId: peg.id, typeId: peg.typeId, text, gridX: peg.x, gridY: peg.y };
    this.pegSprites.set(peg.id, ps);
    this.pegBySprite.set(sprite, ps);

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

  // ===== 占位钉子（显示 0，可被替换，小碰撞体） =====
  // 性能权衡：占位钉子仍需碰撞反弹，但缩小半径减少碰撞计算量
  private initPlaceholders(occupied: Set<string>) {
    for (let gy = 0; gy < BALANCE.gridRows; gy++) {
      const maxCol = (gy % 2 === 1) ? BALANCE.gridCols - 1 : BALANCE.gridCols;
      for (let gx = 0; gx < maxCol; gx++) {
        const key = this.placeholderKey(gx, gy);
        if (occupied.has(key)) continue;
        this.renderPlaceholder(gx, gy);
      }
    }
  }

  private renderPlaceholder(gx: number, gy: number) {
    const { x, y } = this.gridToPixel(gx, gy);
    // 占位钉子：Matter 静态圆形，半径缩小到 PLACEHOLDER_RADIUS
    const sprite = this.matter.add.image(x, y, 'peg_placeholder', undefined, {
      shape: { type: 'circle', radius: PLACEHOLDER_RADIUS },
      isStatic: true,
      restitution: RESTITUTION,
      friction: 0.01,
      label: 'peg:placeholder',
    });
    sprite.setDisplaySize(PLACEHOLDER_RADIUS * 2, PLACEHOLDER_RADIUS * 2);
    sprite.setAlpha(0.5);
    // 标记为钉子
    if (sprite.body) {
      this.pegLabels.add(sprite.body as MatterJS.Body);
    }

    // 占位钉子不显示文字（纯视觉占位）
    const ps: PegSprite = {
      sprite, pegId: `ph_${gx}_${gy}`, typeId: 'placeholder',
      text: null, gridX: gx, gridY: gy, placeholder: true,
    };
    this.placeholderPegs.set(this.placeholderKey(gx, gy), ps);
    this.pegBySprite.set(sprite, ps);
  }

  private removePlaceholder(gx: number, gy: number) {
    const ps = this.placeholderPegs.get(this.placeholderKey(gx, gy));
    if (!ps) return;
    this.pegBySprite.delete(ps.sprite);
    ps.sprite.destroy();
    ps.text?.destroy();
    this.placeholderPegs.delete(this.placeholderKey(gx, gy));
  }

  private pegLabel(cfg: typeof PEG_MAP[string], peg: PegSave): string {
    if (cfg.operator === '+') return `+${Math.floor(cfg.operand + (peg.level - 1) * cfg.growth)}`;
    if (cfg.operator === '*') return `×${(cfg.operand + (peg.level - 1) * cfg.growth).toFixed(1)}`;
    if (cfg.operator === '/') return '÷2';
    if (cfg.operator === '^') return `^${(cfg.operand + (peg.level - 1) * cfg.growth).toFixed(2)}`;
    if (cfg.operator === 'addPercent') return '%';
    if (cfg.operator === 'maxMul') return '×2+';
    return '贤';
  }

  private removePegSprite(pegId: string) {
    const ps = this.pegSprites.get(pegId);
    if (!ps) return;
    const gx = ps.gridX, gy = ps.gridY;
    this.pegBySprite.delete(ps.sprite);
    ps.sprite.destroy();
    ps.text?.destroy();
    this.pegSprites.delete(pegId);
    // 卖出后恢复该位置的占位钉子
    if (!this.placeholderPegs.has(this.placeholderKey(gx, gy))) {
      this.renderPlaceholder(gx, gy);
    }
  }

  private updatePegLabel(ps: PegSprite, peg: PegSave) {
    const cfg = PEG_MAP[peg.typeId];
    if (!cfg) return;
    ps.text?.setText(this.pegLabel(cfg, peg));
  }

  private updatePlacementCursor(pointer?: Phaser.Input.Pointer) {
    if (!this.placementCursor || !this.placementMode.typeId) return;
    const p = pointer ?? this.input.activePointer;
    this.placementCursor.setPosition(p.worldX, p.worldY);
  }

  // ===== 自动器 =====
  private tickAuto() {
    const rate = GameState.getAutoDropRate();
    if (rate <= 0) return;
    const rhythmMul = GameState.isSkillActive('rhythm') ? 2 : 1;
    this.autoAccumulator += 0.1 * rate * rhythmMul;
    while (this.autoAccumulator >= 1) {
      this.autoAccumulator -= 1;
      const x = GameState.getSkillLevel('smartDrop') > 0 ? DESIGN_W / 2 : (0.2 + Math.random() * 0.6) * DESIGN_W;
      // 自动投放：按权重抽取已拥有的元素弹珠（无则普通弹珠）
      const marble = GameState.pickAutoMarble();
      let value = GameState.ballInitialValue;
      if (marble && marble.element === 'holy') {
        const mLevel = GameState.getMarbleLevel(marble.id);
        value = bigMulNum(value, marble.getValue(mLevel));
      }
      this.spawnBall(x, 30, value, 'auto', marble);
      GameState.onBallDropped('auto');
    }
  }

  private tickActives() {
    GameState.tickActives(Date.now());
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
      fontFamily: '"Z Labs RoundPix 12px M CN", sans-serif', fontSize: '12px',
      color: '#' + color.toString(16).padStart(6, '0'), stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({
      targets: t, y: y - 40, alpha: 0, duration: 600,
      onComplete: () => t.destroy(),
    });
  }

  // ===== 场景内 Boss 战 =====
  /** 启动场景内 Boss 战 */
  private startSceneBoss(id: BossId) {
    const info = BOSS_INFO[id];
    if (!info) return;
    this.bossActive = true;
    this.bossId = id;
    // HP = 当前 boss 阈值的 50%（章节模式 = targetGold/2，无尽模式 = 当前 tier 阈值/2）
    this.bossMaxHp = GameState.bossMaxHpForCurrent;
    this.bossHp = this.bossMaxHp;
    // 重置技能状态
    this.bossShield = 0n;
    this.bossPhaseUntil = 0;
    this.bossFrostUntil = 0;
    this.bossWeakness = null;

    // boss 球纹理：按 boss 选色
    const bossTexMap: Record<BossId, string> = {
      boss_frost: 'ball_blue', boss_skull: 'ball_gray', boss_ghost: 'ball_purple',
      boss_chameleon: 'ball_green', boss_entropy: 'ball_purple',
    };
    this.bossBallTexture = bossTexMap[id];

    const gridW = BALANCE.gridCols * BALANCE.cellSize;
    const cx = this.gridX + gridW / 2;
    // boss 本体放大到 132，位于底部结算区上方
    const bossSize = 132;
    const by = this.settleY - 86; // 悬于结算区上方，避免遮挡结算槽
    this.bossCx = cx;
    this.bossCy = by;

    // Boss 本体（立绘优先）—— 纯显示对象，不创建 Matter 物理体
    // 命中判定用距离检测，避免 staticImage/sensor 的渲染与重力问题
    // 必须使用立绘图片；若立绘纹理未加载则用程序化纹理兜底，并打印警告便于排查
    const portraitKey = 'portrait_' + id;
    const hasPortrait = this.textures.exists(portraitKey);
    const texKey = hasPortrait ? portraitKey : info.tex;
    if (!hasPortrait) {
      console.warn(`[Boss] portrait "${portraitKey}" 未加载，使用 fallback "${info.tex}"`);
    }

    // 背景圆盘（视觉锚点，确保 boss 位置可见）+ 发光描边环
    const bgColors: Record<BossId, number> = {
      boss_skull: 0x4a4f57, boss_frost: 0x6ec5ff, boss_ghost: 0x6b3fa0,
      boss_chameleon: 0x3fb950, boss_entropy: 0x2a1530,
    };
    const glowColors: Record<BossId, number> = {
      boss_skull: 0xff5555, boss_frost: 0xc8eeff, boss_ghost: 0xbc8cff,
      boss_chameleon: 0x56d364, boss_entropy: 0xff6bff,
    };
    this.bossBgDisk = this.add.circle(cx, by, bossSize / 2 + 8, bgColors[id], 0.55).setDepth(5);
    this.bossGlowRing = this.add.circle(cx, by, bossSize / 2 + 12, 0xffffff, 0)
      .setStrokeStyle(4, glowColors[id], 0.95).setDepth(5);
    // 发光环呼吸动画
    this.tweens.add({
      targets: this.bossGlowRing, alpha: { from: 0.6, to: 1 }, duration: 600, yoyo: true, repeat: -1,
    });

    // 立绘本体（depth 6 在圆盘之上）
    this.bossSprite = this.add.image(cx, by, texKey)
      .setDisplaySize(bossSize, bossSize).setOrigin(0.5).setDepth(6).setAlpha(1);

    // 入场动画：从下方弹入 + 闪一下确认可见
    this.bossSprite.setAlpha(0).setScale(0.4);
    this.bossBgDisk.setAlpha(0).setScale(0.4);
    this.bossGlowRing.setAlpha(0).setScale(0.4);
    this.tweens.add({
      targets: [this.bossSprite, this.bossBgDisk, this.bossGlowRing],
      alpha: 1, scale: 1, duration: 500, ease: 'Back.out',
    });

    // Boss 左右移动（章节越高移动越快、范围越大）
    const moveRange = Math.min(gridW / 2 - bossSize / 2, 130);
    const moveDur = id === 'boss_entropy' ? 1800 : id === 'boss_chameleon' ? 2200 : 2800;
    this.bossMoveTween = this.tweens.add({
      targets: this.bossSprite,
      x: { from: cx - moveRange, to: cx + moveRange },
      duration: moveDur,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
      onUpdate: () => {
        if (this.bossSprite) {
          this.bossCx = this.bossSprite.x;
          // 同步背景圆盘/发光环/骨盾/弱点标记位置
          if (this.bossBgDisk) this.bossBgDisk.setPosition(this.bossCx, this.bossCy);
          if (this.bossGlowRing) this.bossGlowRing.setPosition(this.bossCx, this.bossCy);
          if (this.bossShieldRing) this.bossShieldRing.setPosition(this.bossCx, this.bossCy);
          if (this.bossWeaknessText) this.bossWeaknessText.setPosition(this.bossCx, this.bossCy + 50);
          // 重绘弧形血环到新位置
          this.drawBossHpArc();
        }
      },
    });

    // HP 数值文字（弧形血环在圆环外侧绘制，无名字标签）
    // 弧形血环 Graphics（融合于圆环外侧）
    this.bossHpArc = this.add.graphics().setDepth(8);
    this.bossHpText = this.add.text(cx, by + 64, '', {
      fontFamily: '"Z Labs RoundPix 12px M CN", sans-serif', fontSize: '10px',
      color: '#ffcc66', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(8);
    this.updateBossHpDisplay();

    // 血量文字跟随 boss 移动（血环 Graphics 在 onUpdate 中整体重绘定位）
    this.tweens.add({
      targets: [this.bossHpText],
      x: { from: cx - moveRange, to: cx + moveRange },
      duration: moveDur, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });

    // 幻彩 boss：开局设定初始弱点
    if (id === 'boss_chameleon') this.setBossWeakness(this.randomWeakness());

    // 定时生成 boss 球：章节越高频率越快
    const interval = id === 'boss_frost' ? 3200 : id === 'boss_entropy' ? 1500 : 2200;
    this.bossBallTimer = this.time.addEvent({ delay: interval, loop: true, callback: this.spawnBossBall, callbackScope: this });
    // 立即先投一个
    this.spawnBossBall();

    // 技能定时器：每隔一段时间释放专属技能（章节越高越频繁）
    const skillInterval = id === 'boss_entropy' ? 8000 : id === 'boss_chameleon' ? 10000 : 12000;
    this.bossSkillTimer = this.time.addEvent({ delay: skillInterval, loop: true, callback: this.bossSkill, callbackScope: this });

    this.hud.showToast(`${info.name} 现身！技能：${info.skillName}（${info.skillDesc}）`, 'prestige');
  }

  /** boss 释放专属技能：按 bossId 分派 */
  private bossSkill() {
    if (!this.bossActive || !this.bossId) return;
    switch (this.bossId) {
      case 'boss_skull':      this.bossSkillSkull(); break;
      case 'boss_frost':      this.bossSkillFrost(); break;
      case 'boss_ghost':      this.bossSkillGhost(); break;
      case 'boss_chameleon':   this.bossSkillChameleon(); break;
      case 'boss_entropy':    this.bossSkillEntropy(); break;
    }
  }

  /** 骷髅守卫：骨盾 —— 召唤一层骨盾吸收下次伤害，需击碎才能继续扣血 */
  private bossSkillSkull() {
    if (!this.bossSprite) return;
    // 骨盾吸收量 = boss 最大 HP 的 5%
    this.bossShield = this.bossMaxHp / 20n || 1n;
    if (this.bossShieldRing) this.bossShieldRing.destroy();
    this.bossShieldRing = this.add.circle(this.bossCx, this.bossCy, 50, 0xffffff, 0)
      .setStrokeStyle(4, 0xeeeeee, 0.9).setDepth(5);
    this.tweens.add({ targets: this.bossShieldRing, alpha: 0.6, duration: 300, yoyo: true, repeat: -1 });
    this.hud.showToast('骷髅守卫召唤【骨盾】！先击碎骨盾', 'prestige');
  }

  /** 霜卫：冰霜新星 —— 冰封全场玩家弹珠，3 秒内下落减速 */
  private bossSkillFrost() {
    if (!this.bossSprite) return;
    this.bossFrostUntil = Date.now() + 3000;
    // 全场冰冻视觉：蓝色脉冲波
    const wave = this.add.circle(this.bossCx, this.bossCy, 30, 0x6ec5ff, 0)
      .setStrokeStyle(3, 0xc8eeff, 0.9).setDepth(5);
    this.tweens.add({ targets: wave, radius: 500, alpha: 0, duration: 700, onComplete: () => wave.destroy() });
    // 玩家球施加向上减速
    for (const b of this.balls) {
      if (b.source === 'boss') continue;
      const v = b.sprite.body?.velocity;
      if (v) b.sprite.setVelocity(v.x * 0.3, v.y * 0.3);
    }
    this.hud.showToast('霜卫释放【冰霜新星】！弹珠减速 3 秒', 'prestige');
  }

  /** 熵之幻影：相位偏移 —— 进入虚影 4 秒，期间无法被命中 */
  private bossSkillGhost() {
    if (!this.bossSprite) return;
    this.bossPhaseUntil = Date.now() + 4000;
    this.bossSprite.setAlpha(0.3);
    this.tweens.add({ targets: this.bossSprite, alpha: { from: 0.3, to: 0.6 }, duration: 400, yoyo: true, repeat: 9 });
    this.time.delayedCall(4000, () => { this.bossSprite?.setAlpha(1); });
    this.hud.showToast('熵之幻影进入【相位偏移】！4 秒内无法命中', 'prestige');
  }

  /** 幻彩守卫：变色伪装 —— 切换弱点元素 */
  private bossSkillChameleon() {
    this.setBossWeakness(this.randomWeakness());
    this.hud.showToast(`幻彩守卫变色！当前弱点：${this.weaknessLabel(this.bossWeakness)}`, 'prestige');
  }

  /** 熵核：熵之爆发 —— 瞬移到新位置并连发多枚高速球 */
  private bossSkillEntropy() {
    if (!this.bossSprite) return;
    const gridW = BALANCE.gridCols * BALANCE.cellSize;
    const cx = this.gridX + gridW / 2;
    const moveRange = Math.min(gridW / 2 - 80, 130);
    // 瞬移到反方向位置
    const newX = this.bossCx < cx ? cx + moveRange : cx - moveRange;
    this.bossSprite.setPosition(newX, this.bossCy);
    this.bossCx = newX;
    // 残影特效
    const ghost = this.add.image(this.bossCx, this.bossCy, BOSS_INFO.boss_entropy.tex)
      .setDisplaySize(132, 132).setAlpha(0.5).setDepth(5);
    this.tweens.add({ targets: ghost, alpha: 0, scale: 1.3, duration: 400, onComplete: () => ghost.destroy() });
    // 连发 4 个 boss 球
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 180, () => this.spawnBossBall());
    }
    this.hud.showToast('熵核释放【熵之爆发】！瞬移并连发混沌球', 'prestige');
  }

  /** 设置幻彩 boss 的弱点元素 + 视觉标记 */
  private setBossWeakness(el: 'fire' | 'ice' | 'thunder' | 'poison' | 'holy' | 'dark') {
    this.bossWeakness = el;
    if (this.bossWeaknessText) this.bossWeaknessText.destroy();
    const colorMap: Record<string, string> = {
      fire: '#ff6b3d', ice: '#6ec5ff', thunder: '#ffd166',
      poison: '#4ade80', holy: '#fff5b3', dark: '#a371f7',
    };
    this.bossWeaknessText = this.add.text(this.bossCx, this.bossCy + 50, `弱点:${this.weaknessLabel(el)}`, {
      fontFamily: '"Z Labs RoundPix 12px M CN", sans-serif', fontSize: '12px',
      color: colorMap[el], stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8);
  }

  private randomWeakness(): 'fire' | 'ice' | 'thunder' | 'poison' | 'holy' | 'dark' {
    const els: Array<'fire' | 'ice' | 'thunder' | 'poison' | 'holy' | 'dark'> = ['fire', 'ice', 'thunder', 'poison', 'holy', 'dark'];
    return els[Phaser.Math.Between(0, els.length - 1)];
  }

  private weaknessLabel(el: string | null): string {
    const map: Record<string, string> = { fire: '火', ice: '冰', thunder: '雷', poison: '毒', holy: '圣', dark: '暗' };
    return el ? (map[el] || el) : '无';
  }

  /** 按 boss 强度返回弹珠参数：越靠后章节，球越大、越快、数值越高、向上加速越强（大幅强化） */
  private bossBallConfig(): { valDivisor: bigint; speed: number; force: number; radius: number } {
    const ch = GameState.chapterId;
    switch (ch) {
      case 1:  return { valDivisor: 12n, speed: 3.8, force: 0.8, radius: 11 };
      case 2:  return { valDivisor: 9n,  speed: 4.2, force: 0.95, radius: 12 };
      case 3:  return { valDivisor: 7n,  speed: 4.8, force: 1.1, radius: 13 };
      case 4:  return { valDivisor: 5n,  speed: 5.4, force: 1.3, radius: 14 };
      case 5:  return { valDivisor: 4n,  speed: 6.2, force: 1.5, radius: 15 };
      default: return { valDivisor: 9n,  speed: 4.2, force: 0.95, radius: 12 };
    }
  }

  /** 生成一个 boss 球：从底部向上飞，每帧施加向上力（负重力），value 随章节递增 */
  private spawnBossBall() {
    if (!this.bossActive) return;
    const cfg = this.bossBallConfig();
    // boss 球 value = 章节目标 / valDivisor（章节越高比例越大）
    const val = this.bossMaxHp / cfg.valDivisor || 1n;
    const gridW = BALANCE.gridCols * BALANCE.cellSize;
    const cx = this.gridX + gridW / 2;
    // 从 boss 本体两侧发射，避免与 boss sensor 本体重叠
    const side = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    const spawnX = cx + side * Phaser.Math.Between(70, gridW / 3);
    const spawnY = this.settleY + 70;

    const sprite = this.matter.add.image(spawnX, spawnY, this.bossBallTexture, undefined, {
      shape: { type: 'circle', radius: cfg.radius },
      restitution: 0.5, friction: 0.01, frictionAir: 0.001, density: 0.004,
      label: 'ball',
    });
    sprite.setDisplaySize(cfg.radius * 2, cfg.radius * 2);
    sprite.setIgnoreGravity(true);   // 关闭世界重力，由 update 每帧施加向上力
    sprite.setVelocity(Phaser.Math.Between(-1, 1), -cfg.speed);
    if (sprite.body) this.ballLabels.add(sprite.body as MatterJS.Body);

    const text = this.add.text(spawnX, spawnY - 14, formatNum(val), {
      fontFamily: '"Z Labs RoundPix 12px M CN", sans-serif', fontSize: '11px',
      color: '#ff6b6b', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5);

    const ball: Ball = {
      sprite, text, value: val, source: 'boss', golden: false, sageCopy: 0n,
      marble: null, poisonedPegs: undefined, thunderCharges: 0,
      bossSpawnTime: Date.now(),
      bossForce: cfg.force,
    };
    this.balls.push(ball);
    this.ballBySprite.set(sprite, ball);
  }

  /** 更新 Boss HP 显示：重绘弧形血环 + 数值文字 */
  private updateBossHpDisplay() {
    if (!this.bossHpText || this.bossMaxHp <= 0n) return;
    this.bossHpText.setText(`${formatNum(this.bossHp)} / ${formatNum(this.bossMaxHp)}`);
    this.drawBossHpArc();
  }

  /** 绘制弧形血环：以 boss 圆心为圆心，半径略大于发光环，从顶部顺时针扫过 ratio*270°
   *  背景整圈淡色 + 前景红色弧线，与圆环视觉融合 */
  private drawBossHpArc() {
    const g = this.bossHpArc;
    if (!g) return;
    g.clear();
    const cx = this.bossCx, cy = this.bossCy;
    // 弧形半径：略大于发光环（bossSize/2 + 12），让血环贴在发光环外侧
    const r = 132 / 2 + 18; // = 84
    // 扫描角度范围：270° 留出底部缺口，避免与名字/血量文字重叠
    const SPAN = Math.PI * 1.5; // 270°
    const startA = -Math.PI / 2 - SPAN / 2; // 从顶部偏左开始
    // ratio
    let ratio = 0;
    if (this.bossMaxHp > 0n) {
      ratio = Math.max(0, Math.min(1, Number(Number(this.bossHp * 10000n / this.bossMaxHp) / 10000)));
    }
    const endA = startA + SPAN * ratio;

    // 背景整圈淡色描边（缺口段用更暗的色）
    g.lineStyle(5, 0x000000, 0.45);
    g.beginPath();
    g.arc(cx, cy, r, startA, startA + SPAN, false);
    g.strokePath();
    // 前景血量弧（红色，满血亮，低血偏暗）
    const hpColor = ratio > 0.5 ? 0xff6b6b : ratio > 0.25 ? 0xff8b3d : 0xff4444;
    g.lineStyle(5, hpColor, 1);
    g.beginPath();
    g.arc(cx, cy, r, startA, endA, false);
    g.strokePath();
    // 起止端点小圆点，让血环更"封口"
    const ex = cx + Math.cos(endA) * r;
    const ey = cy + Math.sin(endA) * r;
    g.fillStyle(hpColor, 1);
    g.fillCircle(ex, ey, 3.5);
    const sx = cx + Math.cos(startA) * r;
    const sy = cy + Math.sin(startA) * r;
    g.fillStyle(0x000000, 0.6);
    g.fillCircle(sx, sy, 3);
  }

  /** boss 球到达顶部：扣除等量金币，金币为 0 则失败 */
  private bossBallReachedTop(ball: Ball) {
    const loss = ball.value;
    GameState.spendGold(loss);
    this.spawnFloatText(ball.sprite.x, 20, `-${formatNum(loss)} 金币`, 0xff4444);
    if (GameState.gold <= 0n) {
      // 金币耗尽 → boss 战失败（撤退，可重试）
      this.failSceneBoss();
    }
  }

  /** 胜利：击败 boss */
  private winSceneBoss() {
    if (!this.bossActive) return;
    const name = this.bossId ? BOSS_INFO[this.bossId].name : 'Boss';
    this.hud.showToast(`击败 ${name}！归零之路已开`, 'prestige');
    GameState.markBossDefeated();   // 会 emit BOSS_DEFEATED，触发既有的存档/重检逻辑
    this.cleanupSceneBoss();
  }

  /** 失败：金币耗尽，boss 撤退，可重试 */
  private failSceneBoss() {
    if (!this.bossActive) return;
    this.hud.showToast('金币耗尽！Boss 暂时撤退，积累金币后再次挑战', 'prestige');
    this.cleanupSceneBoss();
  }

  /** 清理 boss 战状态与 UI */
  private cleanupSceneBoss() {
    this.bossActive = false;
    this.bossId = null;
    this.bossHp = 0n;
    this.bossMaxHp = 0n;
    if (this.bossBallTimer) { this.bossBallTimer.remove(); this.bossBallTimer = null; }
    if (this.bossSkillTimer) { this.bossSkillTimer.remove(); this.bossSkillTimer = null; }
    if (this.bossMoveTween) { this.bossMoveTween.stop(); this.bossMoveTween = null; }
    // 清除所有 boss 球
    for (let i = this.balls.length - 1; i >= 0; i--) {
      if (this.balls[i].source === 'boss') this.destroyBall(i);
    }
    this.bossSprite?.destroy(); this.bossSprite = null;
    this.bossNameText?.destroy(); this.bossNameText = null;
    this.bossHpArc?.destroy(); this.bossHpArc = null;
    this.bossHpText?.destroy(); this.bossHpText = null;
    this.bossBgDisk?.destroy(); this.bossBgDisk = null;
    this.bossGlowRing?.destroy(); this.bossGlowRing = null;
    this.bossShieldRing?.destroy(); this.bossShieldRing = null;
    this.bossWeaknessText?.destroy(); this.bossWeaknessText = null;
  }
}
