import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { OfflineReportScene } from './scenes/OfflineReportScene';

// 根据屏幕方向选择画布尺寸：竖屏用纵向比例，横屏用横向比例
// 12×16 网格本身是窄高形（480×640），所以两种方向都能容纳
const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
const GAME_W = isPortrait ? 720 : 960;
const GAME_H = isPortrait ? 960 : 720;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: 'transparent',
  transparent: true,
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
