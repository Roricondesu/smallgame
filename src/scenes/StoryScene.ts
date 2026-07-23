// 剧情场景：章节 intro / ending / 三个结局

import Phaser from 'phaser';
import { GameState } from '../systems/GameState';
import { CHAPTER_MAP } from '../data/chapters';

export class StoryScene extends Phaser.Scene {
  private lines: string[] = [];
  private idx = 0;
  private text!: Phaser.GameObjects.Text;
  private contHint!: Phaser.GameObjects.Text;
  private chapterId = 1;
  private type: 'intro' | 'ending' | 'prestige' | 'ending_true' | 'ending_bad' | 'ending_normal' = 'intro';

  constructor() {
    super('Story');
  }

  init(data: { type: 'intro' | 'ending' | 'prestige' | 'ending_true' | 'ending_bad' | 'ending_normal'; chapterId: number }) {
    this.type = data.type;
    this.chapterId = data.chapterId;
    this.idx = 0;
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const ch = CHAPTER_MAP[this.chapterId] ?? CHAPTER_MAP[1];
    this.cameras.main.setBackgroundColor(ch.bg);

    // 背景星点
    const bg = this.add.graphics();
    for (let i = 0; i < 80; i++) {
      bg.fillStyle(Math.random() > 0.5 ? 0xffffff : 0xf0b429, Math.random() * 0.5);
      bg.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    bg.setDepth(-1);

    this.add.text(W / 2, H * 0.16, `第 ${this.chapterId} 章 · ${ch.name}`, {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: `${Math.min(24, Math.max(16, W * 0.028))}px`,
      color: ch.accent,
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.24, ch.scene, {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: `${Math.min(15, Math.max(11, W * 0.018))}px`,
      color: '#768390',
    }).setOrigin(0.5);

    let lines: string[] = [];
    if (this.type === 'intro') lines = ch.storyIntro;
    else if (this.type === 'ending') lines = ch.storyEnding;
    else if (this.type === 'ending_true') {
      lines = [
        '林恩按下归零键。',
        '所有金币化为光点回归世界，熵减开始。',
        '村庄复苏，零号镇的天空重现星空。',
        '乌鸦“零”化作一根 +1 钉子，永远陪伴林恩。',
        '',
        '「数字的智慧，不在于无限，而在于懂得归零。」',
        '',
        '【真结局 · 归零之贤者】',
      ];
    } else if (this.type === 'ending_bad') {
      lines = [
        '金币堆积如山。',
        '世界因熵增而崩坏，村庄化为废墟。',
        '林恩坐在金币之巅，孑然一身。',
        '零叹息一声，振翅离去。',
        '',
        '【坏结局 · 无限之暴君】',
        '（金币回到 1e15，可重新选择）',
      ];
    } else if (this.type === 'ending_normal') {
      lines = [
        '林恩归零，世界部分恢复。',
        '他继续游历四方，寻找遗漏的符文。',
        '或许下一次，他能找到所有答案。',
        '',
        '【普通结局 · 平衡之匠】',
      ];
    }
    this.lines = lines.filter((l) => l.length > 0);

    this.add.rectangle(W / 2, H * 0.55, W * 0.82, 240, 0x000000, 0.55)
      .setStrokeStyle(1, 0x30363d);
    this.text = this.add.text(W / 2, H * 0.55, '', {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: '15px',
      color: '#e6edf3',
      align: 'left',
      wordWrap: { width: W * 0.74 },
      lineSpacing: 10,
    }).setOrigin(0.5);

    this.contHint = this.add.text(W / 2, H * 0.78, '点击 / 空格 继续', {
      fontFamily: '"Alimama FangYuanTi VF Thin", sans-serif',
      fontSize: '12px',
      color: '#768390',
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.on('pointerdown', () => this.advance());

    this.time.addEvent({ delay: 600, loop: true, callback: () => this.contHint.setAlpha(this.contHint.alpha > 0.5 ? 0.3 : 1) });

    this.advance();
  }

  private advance() {
    if (this.idx >= this.lines.length) {
      this.finish();
      return;
    }
    const line = this.lines[this.idx];
    this.text.setText(line);
    this.idx++;
  }

  private finish() {
    const ch = GameState.chapter;
    const sp = GameState.save.storyProgress;
    if (this.type === 'intro') {
      if (sp === `ch${ch.id}_intro`) {
        GameState.save.storyProgress = `ch${ch.id}_playing`;
        GameState.saveGame();
      }
      this.scene.start('Game');
    } else if (this.type === 'ending_true' || this.type === 'ending_normal') {
      GameState.save.storyProgress = 'completed_true';
      GameState.saveGame();
      this.scene.start('Menu');
    } else if (this.type === 'ending_bad') {
      GameState.save.gold = 1e15;
      GameState.save.storyProgress = 'ch5_choosing';
      GameState.saveGame();
      this.scene.start('Menu');
    } else if (this.type === 'ending') {
      GameState.save.storyProgress = `ch${Math.min(5, this.chapterId + 1)}_intro`;
      GameState.saveGame();
      this.scene.start('Menu');
    } else if (this.type === 'prestige') {
      this.scene.start('Story', { type: 'intro', chapterId: GameState.chapterId });
    }
  }
}
