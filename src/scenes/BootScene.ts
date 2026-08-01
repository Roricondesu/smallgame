// 启动场景：生成所有程序化纹理 + 加载素材库图像资源

import Phaser from 'phaser';
import { ensureTextures } from '../systems/TextureFactory';

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

    // 实时上报加载进度给 HTML loader，驱动进度条
    this.load.on('progress', (value: number) => {
      const cb = (window as unknown as { __phaserLoadProgress?: (p: number) => void }).__phaserLoadProgress;
      if (cb) cb(value);
    });

    // 程序化纹理（同步生成，仅生成缺失的）
    ensureTextures(this);
  }

  create() {
    // 所有异步资源 + 程序化纹理均已就绪，通知 loader 可以淡出
    const cb = (window as unknown as { __phaserLoadComplete?: () => void }).__phaserLoadComplete;
    if (cb) cb();
    this.scene.start('Menu');
  }
}
