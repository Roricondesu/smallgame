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
}
