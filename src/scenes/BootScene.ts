// 启动场景：生成所有程序化纹理 + 加载素材库图像资源

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // 加载角色立绘（用于对话系统）
    this.load.image('portrait_linn', '/portraits/linn.png');
    this.load.image('portrait_zero', '/portraits/zero.png');
    this.load.image('portrait_lily', '/portraits/lily.png');
    this.load.image('portrait_vera', '/portraits/vera.png');
    this.load.image('portrait_boss_skull', '/portraits/boss_skull.png');
    this.load.image('portrait_boss_ghost', '/portraits/boss_ghost.png');
    this.load.image('portrait_boss_chameleon', '/portraits/boss_chameleon.png');
    this.load.image('portrait_boss_frost', '/portraits/boss_frost.png');
    this.load.image('portrait_boss_entropy', '/portraits/boss_entropy.png');

    // 章节背景图
    this.load.image('bg_ch1', '/backgrounds/ch1.png');
    this.load.image('bg_ch2', '/backgrounds/ch2.png');
    this.load.image('bg_ch3', '/backgrounds/ch3.png');
    this.load.image('bg_ch4', '/backgrounds/ch4.png');
    this.load.image('bg_ch5', '/backgrounds/ch5.png');

    // 元素图标（HUD 弹珠选择器 / 图鉴用）
    this.load.image('skill_fire', '/skills/fire.png');
    this.load.image('skill_ice', '/skills/ice.png');
    this.load.image('skill_thunder', '/skills/thunder.png');
    this.load.image('skill_poison', '/skills/poison.png');
    this.load.image('skill_holy', '/skills/holy.png');
    this.load.image('skill_dark', '/skills/dark.png');

    this.makeBallTextures();
    this.makePegTextures();
    this.makeParticleTexture();
    this.makeElementBallTextures();
    this.makeBossTextures();
  }

  create() {
    this.scene.start('Menu');
  }

  private makeBallTextures() {
    const make = (key: string, color: number, glow: number) => {
      const g = this.make.graphics();
      g.fillStyle(color, 1);
      g.fillCircle(8, 8, 7);
      g.lineStyle(2, glow, 1);
      g.strokeCircle(8, 8, 7);
      g.generateTexture(key, 16, 16);
      g.destroy();
    };
    make('ball_gray', 0x8b949e, 0xffffff);
    make('ball_blue', 0x58a6ff, 0x79c0ff);
    make('ball_green', 0x3fb950, 0x56d364);
    make('ball_gold', 0xf0b429, 0xffe166);
    make('ball_purple', 0xbc8cff, 0xd2a8ff); // 保留名称但视觉偏粉紫，剧情需要
    make('ball_rainbow', 0xff7b72, 0xffffff);
    make('ball_golden', 0xffd700, 0xfff5b3);
  }

  private makePegTextures() {
    const make = (key: string, color: number) => {
      const g = this.make.graphics();
      g.fillStyle(color, 1);
      g.fillCircle(10, 10, 9);
      g.lineStyle(2, 0xffffff, 0.5);
      g.strokeCircle(10, 10, 9);
      g.generateTexture(key, 20, 20);
      g.destroy();
    };
    make('peg_plus', 0x3fb950);
    make('peg_mul', 0xf0b429);
    make('peg_div', 0xf85149);
    make('peg_power', 0x8b949e);
    make('peg_sage', 0xffffff);
    make('peg_chart', 0x79c0ff);
    make('peg_double', 0xffa198);
    make('peg_placeholder', 0x2a323d); // 占位钉子：暗灰色
  }

  private makeParticleTexture() {
    const g = this.make.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('particle', 4, 4);
    g.destroy();
  }

  // 元素弹珠纹理：每种元素一个色相，带光晕与十字光纹
  private makeElementBallTextures() {
    const defs: Array<[key: string, color: number, glow: number]> = [
      ['ball_fire',    0xff6b3d, 0xffe9a0],
      ['ball_ice',     0x6ec5ff, 0xc8eeff],
      ['ball_thunder', 0xffd166, 0xfff5b3],
      ['ball_poison',  0x4ade80, 0xc6f9d0],
      ['ball_holy',    0xfff5b3, 0xffffff],
      ['ball_dark',    0xa371f7, 0xe0c8ff],
    ];
    for (const [key, color, glow] of defs) {
      const g = this.make.graphics();
      // 主体圆
      g.fillStyle(color, 1);
      g.fillCircle(9, 9, 7);
      // 光晕
      g.lineStyle(2, glow, 0.9);
      g.strokeCircle(9, 9, 7);
      // 高光点
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(6, 6, 2);
      // 元素十字光纹
      g.lineStyle(1, glow, 0.6);
      g.lineBetween(2, 9, 16, 9);
      g.lineBetween(9, 2, 9, 16);
      g.generateTexture(key, 18, 18);
      g.destroy();
    }
  }

  // Boss 本体程序化纹理：每个 boss 独特外观，128x128，保证可见不依赖外部图片加载
  private makeBossTextures() {
    const SIZE = 128;
    const C = SIZE / 2;        // 圆心
    const R = 56;              // 主体半径

    // 通用主体绘制：径向色块 + 描边 + 高光
    const drawBody = (g: Phaser.GameObjects.Graphics, color: number, glow: number) => {
      // 外光晕
      g.fillStyle(glow, 0.25);
      g.fillCircle(C, C, R + 8);
      // 主体
      g.fillStyle(color, 1);
      g.fillCircle(C, C, R);
      // 描边
      g.lineStyle(4, glow, 1);
      g.strokeCircle(C, C, R);
      // 顶部高光
      g.fillStyle(0xffffff, 0.18);
      g.fillCircle(C - 14, C - 16, 18);
    };

    // boss_skull —— 骷髅守卫：暗灰主体 + 黑色眼眶 + 白色瞳孔
    {
      const g = this.make.graphics();
      drawBody(g, 0x4a4f57, 0x8b949e);
      // 眼眶
      g.fillStyle(0x000000, 0.9);
      g.fillCircle(C - 16, C - 4, 11);
      g.fillCircle(C + 16, C - 4, 11);
      // 瞳孔（红光）
      g.fillStyle(0xff5555, 1);
      g.fillCircle(C - 16, C - 4, 4);
      g.fillCircle(C + 16, C - 4, 4);
      // 牙齿
      g.fillStyle(0xffffff, 0.85);
      for (let i = -2; i <= 2; i++) {
        g.fillRect(C + i * 10 - 3, C + 14, 6, 12);
      }
      g.generateTexture('boss_tex_skull', SIZE, SIZE);
      g.destroy();
    }

    // boss_frost —— 霜卫：冰蓝主体 + 冰晶尖刺
    {
      const g = this.make.graphics();
      drawBody(g, 0x6ec5ff, 0xc8eeff);
      // 六根冰晶尖刺
      g.fillStyle(0xffffff, 0.9);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x1 = C + Math.cos(a) * (R - 6);
        const y1 = C + Math.sin(a) * (R - 6);
        const x2 = C + Math.cos(a) * (R + 14);
        const y2 = C + Math.sin(a) * (R + 14);
        g.lineStyle(5, 0xeaf6ff, 1);
        g.lineBetween(x1, y1, x2, y2);
      }
      // 中心冰核
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(C, C + 2, 12);
      g.generateTexture('boss_tex_frost', SIZE, SIZE);
      g.destroy();
    }

    // boss_ghost —— 熵之幻影：紫色半透幽灵 + 波浪底边
    {
      const g = this.make.graphics();
      drawBody(g, 0x6b3fa0, 0xbc8cff);
      // 眼睛
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(C - 14, C - 6, 7);
      g.fillCircle(C + 14, C - 6, 7);
      g.fillStyle(0x000000, 0.8);
      g.fillCircle(C - 14, C - 6, 3);
      g.fillCircle(C + 14, C - 6, 3);
      // 波浪底边
      g.lineStyle(3, 0xe0c8ff, 0.8);
      for (let i = 0; i < 5; i++) {
        const sx = C - 24 + i * 12;
        g.lineBetween(sx, C + 22, sx + 6, C + 30);
        g.lineBetween(sx + 6, C + 30, sx + 12, C + 22);
      }
      g.generateTexture('boss_tex_ghost', SIZE, SIZE);
      g.destroy();
    }

    // boss_chameleon —— 幻彩守卫：绿色主体 + 彩虹环
    {
      const g = this.make.graphics();
      drawBody(g, 0x3fb950, 0x56d364);
      // 彩虹环（6 段不同色）
      const colors = [0xff6b6b, 0xf0b429, 0x56d364, 0x58a6ff, 0xbc8cff, 0xff7b72];
      g.lineStyle(6, 0xffffff, 1);
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
        g.lineStyle(6, colors[i], 1);
        g.beginPath();
        g.arc(C, C, R - 10, a0, a1, false);
        g.strokePath();
      }
      // 中心眼
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(C, C, 10);
      g.fillStyle(0x000000, 0.9);
      g.fillCircle(C, C, 5);
      g.generateTexture('boss_tex_chameleon', SIZE, SIZE);
      g.destroy();
    }

    // boss_entropy —— 熵核：暗紫主体 + 混沌螺旋
    {
      const g = this.make.graphics();
      drawBody(g, 0x2a1530, 0xa371f7);
      // 混沌螺旋
      g.lineStyle(3, 0xff6bff, 0.9);
      g.beginPath();
      for (let t = 0; t < Math.PI * 6; t += 0.1) {
        const rr = 2 + t * 4;
        const px = C + Math.cos(t) * rr;
        const py = C + Math.sin(t) * rr;
        if (t === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
      // 核心
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(C, C, 8);
      g.fillStyle(0xff6bff, 1);
      g.fillCircle(C, C, 4);
      g.generateTexture('boss_tex_entropy', SIZE, SIZE);
      g.destroy();
    }
  }
}
