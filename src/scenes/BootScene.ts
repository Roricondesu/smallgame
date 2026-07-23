// 启动场景：生成所有程序化纹理，避免外部资源依赖

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.makeBallTextures();
    this.makePegTextures();
    this.makeParticleTexture();
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
}
