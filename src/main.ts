import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { OfflineReportScene } from './scenes/OfflineReportScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: 960,
  height: 720,
  backgroundColor: '#0d1117',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Matter.js 物理引擎：真正的刚体物理，能完美处理圆形钉子+弹珠碰撞反弹
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1 },
      debug: false,
      // 让 Matter 自己管理边界
      setBounds: {
        left: true,
        right: true,
        top: false,
        bottom: false,
      },
    },
  },
  scene: [BootScene, MenuScene, GameScene, OfflineReportScene],
};

new Phaser.Game(config);
