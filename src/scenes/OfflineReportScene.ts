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

    // 简约白线悬停按钮
    const btnW = 200, btnH = 46;
    const btn = this.add.rectangle(W / 2, H * 0.68, btnW, btnH, 0x000000, 0)
      .setStrokeStyle(1, 0xffffff, 0.25).setInteractive({ useHandCursor: true });
    this.add.text(W / 2, H * 0.68, '进入游戏', {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: '15px',
      color: '#ffffff',
    }).setOrigin(0.5);

    btn.on('pointerover', () => { btn.setStrokeStyle(1, 0xffffff, 0.8); });
    btn.on('pointerout', () => { btn.setStrokeStyle(1, 0xffffff, 0.25); });
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
