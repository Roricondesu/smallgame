// 元素弹珠配置表
// 6 种元素弹珠：火/冰/雷/毒/圣/暗，每种有独立效果与每章使用次数
// 元素图标素材来自 public/skills/{element}.png

import type { MarbleConfig } from '../types';

export const MARBLES: MarbleConfig[] = [
  {
    id: 'fire',
    name: '烈焰弹珠',
    element: 'fire',
    color: 0xff6b3d,
    charges: 8,
    effect: '碰撞时数值额外 ×1.5',
    desc: '燃烧的弹珠，每次撞击钉子都获得额外加成',
  },
  {
    id: 'ice',
    name: '寒冰弹珠',
    element: 'ice',
    color: 0x6ec5ff,
    charges: 6,
    effect: '落底结算时再翻倍一次',
    desc: '凝结的弹珠，结算时如冰花绽放再翻一倍',
  },
  {
    id: 'thunder',
    name: '雷霆弹珠',
    element: 'thunder',
    color: 0xffd166,
    charges: 6,
    effect: '随机链击 2 个钉子',
    desc: '充能的弹珠，撞击时会跳跃至附近其他钉子',
  },
  {
    id: 'poison',
    name: '毒蚀弹珠',
    element: 'poison',
    color: 0x4ade80,
    charges: 8,
    effect: '撞击的钉子下次结算 ×1.3',
    desc: '腐蚀性的弹珠，被触碰的钉子会被标记',
  },
  {
    id: 'holy',
    name: '圣光弹珠',
    element: 'holy',
    color: 0xfff5b3,
    charges: 4,
    effect: '数值翻倍',
    desc: '神圣的弹珠，落下瞬间数值直接翻倍',
  },
  {
    id: 'dark',
    name: '暗影弹珠',
    element: 'dark',
    color: 0xa371f7,
    charges: 5,
    effect: '结算时复制为两颗弹珠的数值',
    desc: '分裂的弹珠，落底时会复制自身的数值',
  },
];

export const MARBLE_MAP: Record<string, MarbleConfig> = Object.fromEntries(
  MARBLES.map((m) => [m.id, m]),
);
