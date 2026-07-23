// 离线收益报告：上线首屏展示

import Phaser from 'phaser';
import { GameState, formatNum } from '../systems/GameState';

export class OfflineReportScene extends Phaser.Scene {
  constructor() {
    super('OfflineReport');
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.setBackgroundColor('#0d1117');

    const { gold, seconds } = GameState.applyOffline();

    this.add.text(W / 2, H * 0.35, '欢迎回来', {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: `${Math.min(32, Math.max(20, W * 0.04))}px`,
      color: '#ffffff',
    }).setOrigin(0.5);

    const timeText = seconds > 0 ? `离线 ${this.formatDuration(seconds)}` : '刚刚离线不久';
    this.add.text(W / 2, H * 0.48, timeText, {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: '14px',
      color: '#768390',
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.56, `获得金币 ${formatNum(gold)}`, {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: `${Math.min(22, Math.max(16, W * 0.026))}px`,
      color: '#4ade80',
    }).setOrigin(0.5);

    const btn = this.add.rectangle(W / 2, H * 0.68, 180, 44, 0x21262d)
      .setStrokeStyle(1, 0x484f58).setInteractive();
    this.add.text(W / 2, H * 0.68, '进入游戏', {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: '15px',
      color: '#e6edf3',
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x30363d));
    btn.on('pointerout', () => btn.setFillStyle(0x21262d));
    btn.on('pointerdown', () => {
      GameState.saveGame();
      this.scene.start('Game');
    });
  }

  private formatDuration(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h} 小时 ${m} 分钟`;
    return `${m} 分钟`;
  }
}
