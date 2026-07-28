// 对话数据：章节开场、里程碑事件、教程引导
// 角色：linn（学徒，主角）与 zero（零号导师，神秘机器）
// 每条对话由若干"行"组成，按行顺序播放，玩家点击继续推进

export interface DialogueLine {
  speaker: 'linn' | 'zero' | 'narrator';
  portrait?: 'linn' | 'zero';
  text: string;
}

export interface Dialogue {
  id: string;
  /** 触发条件：章节 ID，不限制则为 0 */
  chapter?: number;
  /** 触发条件：故事进度标记（如 ch1_intro、ch1_first_peg 等） */
  trigger?: string;
  lines: DialogueLine[];
}

export const DIALOGUES: Dialogue[] = [
  // ===== 第 1 章：教程引导 =====
  {
    id: 'ch1_intro',
    chapter: 1,
    trigger: 'ch1_intro',
    lines: [
      { speaker: 'narrator', text: '零号镇 · 北境小村 · 雪夜' },
      { speaker: 'zero', portrait: 'zero', text: '……终于醒了吗，小家伙。' },
      { speaker: 'zero', portrait: 'zero', text: '你被暴雪掩埋在贤者遗迹外，是我把你刨出来的。' },
      { speaker: 'linn', portrait: 'linn', text: '这里……是哪里？你是谁？' },
      { speaker: 'zero', portrait: 'zero', text: '我叫零号，是这片遗迹里仅存的"会动的机器"。' },
      { speaker: 'zero', portrait: 'zero', text: '看你眼神懵懂——记忆也丢了大半吧？无妨。' },
      { speaker: 'zero', portrait: 'zero', text: '这台弹珠机是我修好的。要活下去，你得学会"运算"。' },
      { speaker: 'linn', portrait: 'linn', text: '弹珠……运算？' },
      { speaker: 'zero', portrait: 'zero', text: '弹珠穿过钉子，数值会被钉子的运算符改写。' },
      { speaker: 'zero', portrait: 'zero', text: '加、乘、除、指数——选对路径，金币就会滚落下来。' },
      { speaker: 'linn', portrait: 'linn', text: '我……似乎记得一点。请让我试试！' },
      { speaker: 'zero', portrait: 'zero', text: '好。先在商店里选一枚 +1 钉，放到网格上。' },
      { speaker: 'zero', portrait: 'zero', text: '然后点击顶部投放区，让弹珠落下。看着它怎样被运算。' },
    ],
  },
  {
    id: 'ch1_first_peg',
    chapter: 1,
    lines: [
      { speaker: 'zero', portrait: 'zero', text: '不错。钉子已就位，弹珠会从这里经过。' },
      { speaker: 'zero', portrait: 'zero', text: '点击网格上方的投放区，投放你的第一颗弹珠吧。' },
    ],
  },
  {
    id: 'ch1_first_drop',
    chapter: 1,
    lines: [
      { speaker: 'linn', portrait: 'linn', text: '哇……弹珠穿过钉子，数值真的变大了！' },
      { speaker: 'zero', portrait: 'zero', text: '数值越大，落底结算的金币就越多。' },
      { speaker: 'zero', portrait: 'zero', text: '用金币继续买钉子、升级它们，构建你的运算链。' },
      { speaker: 'zero', portrait: 'zero', text: '左侧抽屉里还有自动器、技能与全局加成，慢慢解锁。' },
      { speaker: 'linn', portrait: 'linn', text: '明白了！我会让金币源源不断地落下来。' },
    ],
  },
  {
    id: 'ch1_marbles',
    chapter: 1,
    lines: [
      { speaker: 'zero', portrait: 'zero', text: '等等——你的口袋里，似乎也有些不寻常的东西。' },
      { speaker: 'linn', portrait: 'linn', text: '啊……这些弹珠，颜色各不相同？' },
      { speaker: 'zero', portrait: 'zero', text: '这是元素弹珠。每章会自动补充，使用要谨慎。' },
      { speaker: 'zero', portrait: 'zero', text: '烈焰会增益每次碰撞，寒冰会在结算时翻倍，雷霆能链击多钉。' },
      { speaker: 'zero', portrait: 'zero', text: '毒蚀标记钉子，圣光直接翻倍，暗影会复制自身数值。' },
      { speaker: 'linn', portrait: 'linn', text: '好厉害的样子！我什么时候能用？' },
      { speaker: 'zero', portrait: 'zero', text: '现在。点击屏幕左下的弹珠选择器，挑一颗试试。' },
    ],
  },
  {
    id: 'ch1_prestige_ready',
    chapter: 1,
    lines: [
      { speaker: 'zero', portrait: 'zero', text: '你的累计金币已经突破了"零号镇"的临界值。' },
      { speaker: 'zero', portrait: 'zero', text: '是时候进行"归零试炼"了。' },
      { speaker: 'linn', portrait: 'linn', text: '归零？要把一切都清空吗？' },
      { speaker: 'zero', portrait: 'zero', text: '金币、钉子、自动器会归零，但你将获得"数晶"。' },
      { speaker: 'zero', portrait: 'zero', text: '数晶可用于永久加成，下一周目你会更强大。' },
      { speaker: 'linn', portrait: 'linn', text: '我明白了——这是循环的炼金。我准备好了！' },
    ],
  },

  // ===== 第 2 章：符文觉醒 =====
  {
    id: 'ch2_intro',
    chapter: 2,
    trigger: 'ch2_intro',
    lines: [
      { speaker: 'narrator', text: '贤者遗迹 · 古老弹珠机废墟' },
      { speaker: 'linn', portrait: 'linn', text: '这里的钉子排列……像是某种古代符文。' },
      { speaker: 'zero', portrait: 'zero', text: '没错。每一道符文都是一段被遗忘的运算式。' },
      { speaker: 'zero', portrait: 'zero', text: '解锁更多钉子类型，符文才会真正苏醒。' },
    ],
  },

  // ===== 第 3 章：熵的预兆 =====
  {
    id: 'ch3_intro',
    chapter: 3,
    trigger: 'ch3_intro',
    lines: [
      { speaker: 'narrator', text: '金辉城 · 繁华都市 · 钟楼之下' },
      { speaker: 'linn', portrait: 'linn', text: '好热闹……我从没见过这么多人！' },
      { speaker: 'zero', portrait: 'zero', text: '繁华之下，是更精密的运算在运转。' },
      { speaker: 'zero', portrait: 'zero', text: '这里的"熵"在缓慢增长，必须加速积累金币以对抗它。' },
    ],
  },

  // ===== 第 4 章：归零之途 =====
  {
    id: 'ch4_intro',
    chapter: 4,
    trigger: 'ch4_intro',
    lines: [
      { speaker: 'narrator', text: '零之圣殿 · 极北圣地 · 永恒雪原' },
      { speaker: 'linn', portrait: 'linn', text: '空气……好冷，连呼吸都像在割喉。' },
      { speaker: 'zero', portrait: 'zero', text: '这是"归零"的源头。所有运算的最终归宿。' },
      { speaker: 'zero', portrait: 'zero', text: '我们离真相只剩最后一步了。' },
    ],
  },

  // ===== 第 5 章：贤者归来 =====
  {
    id: 'ch5_intro',
    chapter: 5,
    trigger: 'ch5_intro',
    lines: [
      { speaker: 'narrator', text: '无限回廊 · 贤者机器核心' },
      { speaker: 'zero', portrait: 'zero', text: '……我记起来了。我曾是一台"贤者机器"。' },
      { speaker: 'zero', portrait: 'zero', text: '为了对抗熵增，我把自己的意识拆分进了无数弹珠。' },
      { speaker: 'linn', portrait: 'linn', text: '所以你才会……在我身边？' },
      { speaker: 'zero', portrait: 'zero', text: '是的。而你，是我选定的下一任贤者。' },
      { speaker: 'zero', portrait: 'zero', text: '让弹珠永无止境地循环下去吧——这就是"炼金"的真谛。' },
      { speaker: 'linn', portrait: 'linn', text: '我明白了，零号。我们继续。' },
    ],
  },
];

export const DIALOGUE_MAP: Record<string, Dialogue> = Object.fromEntries(
  DIALOGUES.map((d) => [d.id, d]),
);

/** 章节开场对话 ID */
export function chapterIntroId(chapterId: number): string {
  return `ch${chapterId}_intro`;
}
