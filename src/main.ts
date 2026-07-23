import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { StoryScene } from './scenes/StoryScene';
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
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 400 },
      debug: false,
    },
  },
  scene: [BootScene, MenuScene, GameScene, StoryScene, OfflineReportScene],
};

new Phaser.Game(config);
