// Boss 战数据与场景内战斗控制器
// 每章 90% 进度后触发 Boss 战；击败 Boss 才能进入归零试炼
// 场景内机制：Boss 从下方投掷大数值球向上飞，玩家弹珠与其抵消数值；
//   Boss 球到达顶部扣除等量金币（金币为 0 则失败）；
//   玩家弹珠落底时对 Boss 造成等量伤害；Boss HP = 章节目标金币。

import { GameState } from './GameState';
import { bus, EVT } from './EventBus';
import { DIALOGUE_MAP, chapterBossId } from '../data/dialogues';
import { DialogueSystem } from './DialogueSystem';

export type BossId = 'boss_frost' | 'boss_skull' | 'boss_ghost' | 'boss_chameleon' | 'boss_entropy';
export type BossMechanic = 'shield' | 'phase' | 'color';

export interface BossInfo {
  name: string;
  desc: string;
  portrait: string;
  /** 程序化纹理 key（boss_tex_xxx） */
  tex: string;
  mechanic: BossMechanic;
  /** 技能名称 */
  skillName: string;
  /** 技能描述 */
  skillDesc: string;
}

export const BOSS_INFO: Record<BossId, BossInfo> = {
  boss_frost: {
    name: '霜卫',
    desc: '北境远古的冰霜构装体，从下方投掷冰球冲击顶部。',
    portrait: '/portraits/boss_frost.png',
    tex: 'boss_tex_frost',
    mechanic: 'shield',
    skillName: '冰霜新星',
    skillDesc: '冰封全场玩家弹珠，使其下落减速 3 秒',
  },
  boss_skull: {
    name: '骷髅守卫',
    desc: '遗迹守护构装体，投掷骨球向上冲击。',
    portrait: '/portraits/boss_skull.png',
    tex: 'boss_tex_skull',
    mechanic: 'shield',
    skillName: '骨盾',
    skillDesc: '召唤骨盾吸收下次伤害，需击碎才能继续扣血',
  },
  boss_ghost: {
    name: '熵之幻影',
    desc: '熵增的具象化，虚影球难以捕捉。',
    portrait: '/portraits/boss_ghost.png',
    tex: 'boss_tex_ghost',
    mechanic: 'phase',
    skillName: '相位偏移',
    skillDesc: '进入虚影相位 4 秒，期间无法被弹珠命中',
  },
  boss_chameleon: {
    name: '幻彩守卫',
    desc: '零之圣殿最终防线，幻彩球切换弱点。',
    portrait: '/portraits/boss_chameleon.png',
    tex: 'boss_tex_chameleon',
    mechanic: 'color',
    skillName: '变色伪装',
    skillDesc: '切换弱点元素，仅对应元素弹珠可造成伤害',
  },
  boss_entropy: {
    name: '熵核',
    desc: '贤者机器核心残片，混沌之球高速冲击。',
    portrait: '/portraits/boss_entropy.png',
    tex: 'boss_tex_entropy',
    mechanic: 'color',
    skillName: '熵之爆发',
    skillDesc: '瞬移到新位置并连发多枚高速混沌球',
  },
};

/**
 * 轻量 Boss 对话触发器：仅监听 BOSS_TRIGGER 播放开场对话。
 * 场景内战斗逻辑由 GameScene 直接实现。
 */
export class BossDialogueTrigger {
  private dialogue: DialogueSystem | null = null;
  private bound = false;
  private triggerCb?: (...args: unknown[]) => void;

  mount(dialogue: DialogueSystem) {
    if (this.bound) return;
    this.bound = true;
    this.dialogue = dialogue;
    this.triggerCb = () => {
      // 无尽模式：Boss 循环出现，跳过开场对话避免重复
      if (GameState.endlessMode) return;
      const dlg = DIALOGUE_MAP[chapterBossId(GameState.chapterId)];
      if (dlg) this.dialogue?.start(dlg);
    };
    bus.on(EVT.BOSS_TRIGGER, this.triggerCb);
  }

  unmount() {
    if (this.triggerCb) {
      bus.off(EVT.BOSS_TRIGGER, this.triggerCb);
      this.triggerCb = undefined;
    }
    this.bound = false;
  }
}

