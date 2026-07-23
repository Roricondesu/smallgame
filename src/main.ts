import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { OfflineReportScene } from './scenes/OfflineReportScene';

// 画布尺寸完全跟随容器：RESIZE 模式下 Phaser 用 #game-root 实际尺寸作为画布尺寸
// 窗口/设备尺寸变化时，画布内部坐标系实时调整，GameScene 在 resize 时重新布局

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: '100%',
  height: '100%',
  backgroundColor: 'transparent',
  transparent: true,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    // RESIZE 模式下画布就是容器大小，无需居中
  },
  // Matter.js 物理引擎：真正的刚体物理，能完美处理圆形钉子+弹珠碰撞反弹
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      debug: false,
      // 边界由 GameScene 在 applyLayout 中根据画布尺寸动态设置
      setBounds: false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, OfflineReportScene],
};

new Phaser.Game(config);
