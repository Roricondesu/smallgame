// 纹理工厂：程序化生成所有游戏纹理（球、钉子、粒子、元素弹珠、Boss）
// 提取为独立模块，供 BootScene 首次生成 + GameScene 场景重启时检查补生成
// 防止 HMR 或场景切换后纹理丢失导致 Matter Image 渲染为空（物理体正常但不可见）

import Phaser from 'phaser';

/** 检查并生成所有缺失的纹理，已存在的跳过 */
export function ensureTextures(scene: Phaser.Scene) {
  // 球纹理
  const ballDefs: Array<[key: string, color: number, glow: number]> = [
    ['ball_gray', 0x8b949e, 0xffffff],
    ['ball_blue', 0x58a6ff, 0x79c0ff],
    ['ball_green', 0x3fb950, 0x56d364],
    ['ball_gold', 0xf0b429, 0xffe166],
    ['ball_purple', 0xbc8cff, 0xd2a8ff],
    ['ball_rainbow', 0xff7b72, 0xffffff],
    ['ball_golden', 0xffd700, 0xfff5b3],
  ];
  for (const [key, color, glow] of ballDefs) {
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics();
      g.fillStyle(color, 1);
      g.fillCircle(8, 8, 7);
      g.lineStyle(2, glow, 1);
      g.strokeCircle(8, 8, 7);
      g.generateTexture(key, 16, 16);
      g.destroy();
    }
  }

  // 钉子纹理
  const pegDefs: Array<[key: string, color: number]> = [
    ['peg_plus', 0x3fb950],
    ['peg_mul', 0xf0b429],
    ['peg_div', 0xf85149],
    ['peg_power', 0x8b949e],
    ['peg_sage', 0xffffff],
    ['peg_chart', 0x79c0ff],
    ['peg_double', 0xffa198],
    ['peg_placeholder', 0x2a323d],
  ];
  for (const [key, color] of pegDefs) {
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics();
      g.fillStyle(color, 1);
      g.fillCircle(10, 10, 9);
      g.lineStyle(2, 0xffffff, 0.5);
      g.strokeCircle(10, 10, 9);
      g.generateTexture(key, 20, 20);
      g.destroy();
    }
  }

  // 粒子纹理
  if (!scene.textures.exists('particle')) {
    const g = scene.make.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
    g.generateTexture('particle', 4, 4);
    g.destroy();
  }

  // 元素弹珠纹理
  const elementDefs: Array<[key: string, color: number, glow: number]> = [
    ['ball_fire', 0xff6b3d, 0xffe9a0],
    ['ball_ice', 0x6ec5ff, 0xc8eeff],
    ['ball_thunder', 0xffd166, 0xfff5b3],
    ['ball_poison', 0x4ade80, 0xc6f9d0],
    ['ball_holy', 0xfff5b3, 0xffffff],
    ['ball_dark', 0xa371f7, 0xe0c8ff],
  ];
  for (const [key, color, glow] of elementDefs) {
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics();
      g.fillStyle(color, 1);
      g.fillCircle(9, 9, 7);
      g.lineStyle(2, glow, 0.9);
      g.strokeCircle(9, 9, 7);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(6, 6, 2);
      g.lineStyle(1, glow, 0.6);
      g.lineBetween(2, 9, 16, 9);
      g.lineBetween(9, 2, 9, 16);
      g.generateTexture(key, 18, 18);
      g.destroy();
    }
  }

  // Boss 纹理
  const bossDefs = ['boss_tex_skull', 'boss_tex_frost', 'boss_tex_ghost', 'boss_tex_chameleon', 'boss_tex_entropy'];
  for (const key of bossDefs) {
    if (!scene.textures.exists(key)) {
      generateBossTexture(scene, key);
    }
  }
}

/** 生成单个 Boss 纹理（仅在缺失时调用） */
function generateBossTexture(scene: Phaser.Scene, key: string) {
  const SIZE = 128;
  const C = SIZE / 2;
  const R = 56;

  const drawBody = (g: Phaser.GameObjects.Graphics, color: number, glow: number) => {
    g.fillStyle(glow, 0.25);
    g.fillCircle(C, C, R + 8);
    g.fillStyle(color, 1);
    g.fillCircle(C, C, R);
    g.lineStyle(4, glow, 1);
    g.strokeCircle(C, C, R);
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(C - 14, C - 16, 18);
  };

  const g = scene.make.graphics();

  switch (key) {
    case 'boss_tex_skull': {
      drawBody(g, 0x4a4f57, 0x8b949e);
      g.fillStyle(0x000000, 0.9);
      g.fillCircle(C - 16, C - 4, 11);
      g.fillCircle(C + 16, C - 4, 11);
      g.fillStyle(0xff5555, 1);
      g.fillCircle(C - 16, C - 4, 4);
      g.fillCircle(C + 16, C - 4, 4);
      g.fillStyle(0xffffff, 0.85);
      for (let i = -2; i <= 2; i++) {
        g.fillRect(C + i * 10 - 3, C + 14, 6, 12);
      }
      break;
    }
    case 'boss_tex_frost': {
      drawBody(g, 0x6ec5ff, 0xc8eeff);
      g.fillStyle(0xffffff, 0.9);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x1 = C + Math.cos(a) * (R - 6);
        const y1 = C + Math.sin(a) * (R - 6);
        const x2 = C + Math.cos(a) * (R + 14);
        const y2 = C + Math.sin(a) * (R + 14);
        g.lineStyle(5, 0xeaf6ff, 1);
        g.lineBetween(x1, y1, x2, y2);
      }
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(C, C + 2, 12);
      break;
    }
    case 'boss_tex_ghost': {
      drawBody(g, 0x6b3fa0, 0xbc8cff);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(C - 14, C - 6, 7);
      g.fillCircle(C + 14, C - 6, 7);
      g.fillStyle(0x000000, 0.8);
      g.fillCircle(C - 14, C - 6, 3);
      g.fillCircle(C + 14, C - 6, 3);
      g.lineStyle(3, 0xe0c8ff, 0.8);
      for (let i = 0; i < 5; i++) {
        const sx = C - 24 + i * 12;
        g.lineBetween(sx, C + 22, sx + 6, C + 30);
        g.lineBetween(sx + 6, C + 30, sx + 12, C + 22);
      }
      break;
    }
    case 'boss_tex_chameleon': {
      drawBody(g, 0x3fb950, 0x56d364);
      const colors = [0xff6b6b, 0xf0b429, 0x56d364, 0x58a6ff, 0xbc8cff, 0xff7b72];
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
        g.lineStyle(6, colors[i], 1);
        g.beginPath();
        g.arc(C, C, R - 10, a0, a1, false);
        g.strokePath();
      }
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(C, C, 10);
      g.fillStyle(0x000000, 0.9);
      g.fillCircle(C, C, 5);
      break;
    }
    case 'boss_tex_entropy': {
      drawBody(g, 0x2a1530, 0xa371f7);
      g.lineStyle(3, 0xff6bff, 0.9);
      g.beginPath();
      for (let t = 0; t < Math.PI * 6; t += 0.1) {
        const rr = 2 + t * 4;
        const px = C + Math.cos(t) * rr;
        const py = C + Math.sin(t) * rr;
        if (t === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(C, C, 8);
      g.fillStyle(0xff6bff, 1);
      g.fillCircle(C, C, 4);
      break;
    }
  }

  g.generateTexture(key, SIZE, SIZE);
  g.destroy();
}
