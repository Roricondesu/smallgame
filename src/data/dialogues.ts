// 对话数据：章节开场、里程碑事件、教程引导、Boss 战前对话
// 角色：
//   linn  — 林恩（学徒，主角）
//   zero  — 零号（神秘机器导师）
//   lily  — 莉莉（萝莉，能看见"数值"的神秘少女，第2章加入）
//   vera  — 薇拉（御姐，金辉城的精英炼金术师，第3章加入）
//   boss_skull / boss_ghost / boss_chameleon — 各章 Boss

export type SpeakerId = 'linn' | 'zero' | 'lily' | 'vera' | 'narrator' | 'boss_skull' | 'boss_ghost' | 'boss_chameleon';
export type PortraitId = 'linn' | 'zero' | 'lily' | 'vera' | 'boss_skull' | 'boss_ghost' | 'boss_chameleon';

export interface DialogueLine {
  speaker: SpeakerId;
  portrait?: PortraitId;
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
  // ===== 第 1 章：学徒之始 =====
  {
    id: 'ch1_intro',
    chapter: 1,
    trigger: 'ch1_intro',
    lines: [
      { speaker: 'narrator', text: '零号镇 · 北境小村 · 雪夜' },
      { speaker: 'zero', portrait: 'zero', text: '……终于醒了吗，小家伙。' },
      { speaker: 'zero', portrait: 'zero', text: '你被暴雪掩埋在贤者遗迹外，是我把你刨出来的。' },
      { speaker: 'linn', portrait: 'linn', text: '这里……是哪里？你又是谁？' },
      { speaker: 'zero', portrait: 'zero', text: '我叫零号，是这片遗迹里仅存的"会动的机器"。' },
      { speaker: 'zero', portrait: 'zero', text: '看你眼神懵懂——记忆也丢了大半吧？无妨。' },
      { speaker: 'zero', portrait: 'zero', text: '这台弹珠机是我修好的。要活下去，你得学会"运算"。' },
      { speaker: 'linn', portrait: 'linn', text: '弹珠……运算？' },
      { speaker: 'zero', portrait: 'zero', text: '弹珠穿过钉子，数值会被钉子的运算符改写。' },
      { speaker: 'zero', portrait: 'zero', text: '加、乘、除、指数——选对路径，金币就会滚落下来。' },
      { speaker: 'zero', portrait: 'zero', text: '金币是这个世界运转的燃料。没有它，连暖气都点不着。' },
      { speaker: 'linn', portrait: 'linn', text: '我……似乎记得一点。好像小时候学过这些。' },
      { speaker: 'linn', portrait: 'linn', text: '请让我试试！我不想一直被你照顾。' },
      { speaker: 'zero', portrait: 'zero', text: '好。先在商店里选一枚 +1 钉，放到网格上。' },
      { speaker: 'zero', portrait: 'zero', text: '然后点击顶部投放区，让弹珠落下。看着它怎样被运算。' },
      { speaker: 'zero', portrait: 'zero', text: '别怕犯错——弹珠会落下，数值会增长，一切都会好起来的。' },
    ],
  },
  {
    id: 'ch1_first_peg',
    chapter: 1,
    lines: [
      { speaker: 'zero', portrait: 'zero', text: '不错。钉子已就位，弹珠会从这里经过。' },
      { speaker: 'zero', portrait: 'zero', text: '点击网格上方的投放区，投放你的第一颗弹珠吧。' },
      { speaker: 'linn', portrait: 'linn', text: '就是现在……让我看看会发生什么！' },
    ],
  },
  {
    id: 'ch1_first_drop',
    chapter: 1,
    lines: [
      { speaker: 'linn', portrait: 'linn', text: '哇……弹珠穿过钉子，数值真的变大了！' },
      { speaker: 'zero', portrait: 'zero', text: '数值越大，落底结算的金币就越多。' },
      { speaker: 'zero', portrait: 'zero', text: '用金币继续买钉子、升级它们，构建你的运算链。' },
      { speaker: 'zero', portrait: 'zero', text: '左侧面板里还有自动器、技能与全局加成，慢慢解锁。' },
      { speaker: 'zero', portrait: 'zero', text: '记住：弹珠的路径决定了它的命运。布局，就是策略。' },
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
      { speaker: 'zero', portrait: 'zero', text: '它们是贤者遗迹的遗物——据说每一颗都封印着古老的元素之力。' },
      { speaker: 'linn', portrait: 'linn', text: '好厉害的样子！我什么时候能用？' },
      { speaker: 'zero', portrait: 'zero', text: '现在。点击屏幕左下的弹珠选择器，挑一颗试试。' },
    ],
  },
  {
    id: 'ch1_midpoint',
    chapter: 1,
    lines: [
      { speaker: 'zero', portrait: 'zero', text: '你的运算链越来越精密了，林恩。' },
      { speaker: 'zero', portrait: 'zero', text: '但我感应到——遗迹深处有什么东西在苏醒。' },
      { speaker: 'linn', portrait: 'linn', text: '苏醒？你是说……有危险？' },
      { speaker: 'zero', portrait: 'zero', text: '不一定是危险。但贤者遗迹从来不只有钉子和弹珠。' },
      { speaker: 'zero', portrait: 'zero', text: '继续积累金币。当你的力量足够时，遗迹的门会为你打开。' },
      { speaker: 'linn', portrait: 'linn', text: '遗迹的门……那后面会有什么？' },
      { speaker: 'zero', portrait: 'zero', text: '答案。关于这个世界，关于你，也关于我。' },
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
      { speaker: 'zero', portrait: 'zero', text: '这是循环的炼金——放弃，才能获得更多。' },
      { speaker: 'linn', portrait: 'linn', text: '我明白了——这是循环的炼金。我准备好了！' },
    ],
  },

  // ===== 第 2 章：符文觉醒 =====
  {
    id: 'ch2_intro',
    chapter: 2,
    trigger: 'ch2_intro',
    lines: [
      { speaker: 'narrator', text: '贤者遗迹 · 古老弹珠机废墟 · 深处' },
      { speaker: 'linn', portrait: 'linn', text: '这里的钉子排列……像是某种古代符文。' },
      { speaker: 'zero', portrait: 'zero', text: '没错。每一道符文都是一段被遗忘的运算式。' },
      { speaker: 'zero', portrait: 'zero', text: '解锁更多钉子类型，符文才会真正苏醒。' },
      { speaker: 'linn', portrait: 'linn', text: '等等……你听到了吗？好像有哭声。' },
      { speaker: 'zero', portrait: 'zero', text: '……生命反应。来自遗迹的封印区。' },
      { speaker: 'linn', portrait: 'linn', text: '有人被困在这里？我得去看看！' },
    ],
  },
  {
    id: 'ch2_meet_lily',
    chapter: 2,
    lines: [
      { speaker: 'narrator', text: '遗迹封印区 · 一座巨大的水晶棺前' },
      { speaker: 'lily', portrait: 'lily', text: '呜呜……谁来……救救我……' },
      { speaker: 'linn', portrait: 'linn', text: '这里！水晶棺里有个小女孩！' },
      { speaker: 'zero', portrait: 'zero', text: '封印……贤者时代的强制冬眠舱。' },
      { speaker: 'linn', portrait: 'linn', text: '能打开吗？' },
      { speaker: 'zero', portrait: 'zero', text: '需要运算力。把弹珠机对准封印核心，注入足够的数值。' },
      { speaker: 'lily', portrait: 'lily', text: '外面……有人吗？好暗……我好害怕……' },
      { speaker: 'linn', portrait: 'linn', text: '别怕！我马上就救你出来！' },
      { speaker: 'narrator', text: '——随着弹珠数值不断涌入，水晶棺的封印缓缓裂开——' },
      { speaker: 'lily', portrait: 'lily', text: '光……好亮！' },
      { speaker: 'lily', portrait: 'lily', text: '哇！你是谁呀？你身上有好多好多数字在飞！' },
      { speaker: 'linn', portrait: 'linn', text: '数字？你在说什么？' },
      { speaker: 'lily', portrait: 'lily', text: '我能看见哦——所有人的"数值"。' },
      { speaker: 'lily', portrait: 'lily', text: '你的数值好温暖……像太阳一样。我叫莉莉！' },
      { speaker: 'linn', portrait: 'linn', text: '我叫林恩。莉莉，你为什么会被封印在这里？' },
      { speaker: 'lily', portrait: 'lily', text: '我不记得了……醒来就在这个黑黑的盒子里。' },
      { speaker: 'lily', portrait: 'lily', text: '但是我知道——我一直在等一个人来救我。就是你！' },
      { speaker: 'zero', portrait: 'zero', text: '……她的体内有贤者级的运算核心。这孩子不是普通人。' },
      { speaker: 'lily', portrait: 'lily', text: '那个会说话的箱子也是朋友吗？' },
      { speaker: 'zero', portrait: 'zero', text: '我叫零号。不是箱子。' },
      { speaker: 'lily', portrait: 'lily', text: '嘻嘻，零号先生好有趣！我们走吧！' },
    ],
  },
  {
    id: 'ch2_midpoint',
    chapter: 2,
    lines: [
      { speaker: 'lily', portrait: 'lily', text: '林恩哥哥，前面有好多好多数字在扭来扭去……' },
      { speaker: 'linn', portrait: 'linn', text: '扭来扭去？什么意思？' },
      { speaker: 'lily', portrait: 'lily', text: '有一个很大很大的数字……很凶，很想冲出来！' },
      { speaker: 'zero', portrait: 'zero', text: '遗迹的守护者。它在感应到封印被解除后苏醒了。' },
      { speaker: 'linn', portrait: 'linn', text: '守护者？是敌人吗？' },
      { speaker: 'zero', portrait: 'zero', text: '它会阻止任何试图带走遗迹秘密的人。' },
      { speaker: 'lily', portrait: 'lily', text: '它身上有好多骨头……好可怕……' },
      { speaker: 'zero', portrait: 'zero', text: '骷髅守卫。贤者用来看守核心区域的构装体。' },
      { speaker: 'zero', portrait: 'zero', text: '林恩，提升你的运算力。我们必须正面突破它。' },
      { speaker: 'linn', portrait: 'linn', text: '明白了。莉莉，躲到我身后去。' },
      { speaker: 'lily', portrait: 'lily', text: '不要！莉莉也能帮忙！莉莉可以看见它的弱点在哪里！' },
      { speaker: 'linn', portrait: 'linn', text: '……好吧，那我们并肩作战。' },
    ],
  },
  {
    id: 'ch2_boss',
    chapter: 2,
    lines: [
      { speaker: 'boss_skull', portrait: 'boss_skull', text: '……入侵者……停止……你们的运算……' },
      { speaker: 'linn', portrait: 'linn', text: '它说话了！' },
      { speaker: 'boss_skull', portrait: 'boss_skull', text: '遗迹的秘密……不可带走……归零……' },
      { speaker: 'lily', portrait: 'lily', text: '它的核心数字在跳！就是现在，林恩哥哥！' },
      { speaker: 'zero', portrait: 'zero', text: '用你的弹珠冲击它的运算核心！这是唯一的办法！' },
      { speaker: 'linn', portrait: 'linn', text: '来吧——让我的弹珠粉碎你的守卫！' },
    ],
  },
  {
    id: 'ch2_prestige_ready',
    chapter: 2,
    lines: [
      { speaker: 'lily', portrait: 'lily', text: '赢了！那个大骨头散架了！' },
      { speaker: 'zero', portrait: 'zero', text: '骷髅守卫的核心里藏着一枚数晶。拿上它。' },
      { speaker: 'zero', portrait: 'zero', text: '遗迹深处还有更大的秘密。但你的运算力已经到达瓶颈。' },
      { speaker: 'zero', portrait: 'zero', text: '需要再次"归零"，带着数晶前往下一站。' },
      { speaker: 'lily', portrait: 'lily', text: '归零？林恩哥哥会变弱吗？' },
      { speaker: 'zero', portrait: 'zero', text: '暂时变弱，但数晶的加成会让他永远更强。' },
      { speaker: 'lily', portrait: 'lily', text: '那莉莉也要归零！莉莉要和林恩哥哥一起去！' },
      { speaker: 'linn', portrait: 'linn', text: '一起走吧，莉莉。下一站是哪里？' },
      { speaker: 'zero', portrait: 'zero', text: '金辉城。这个世界最繁华的地方——也是熵增最先出现的地方。' },
    ],
  },

  // ===== 第 3 章：熵的预兆 =====
  {
    id: 'ch3_intro',
    chapter: 3,
    trigger: 'ch3_intro',
    lines: [
      { speaker: 'narrator', text: '金辉城 · 繁华都市 · 中央钟楼之下' },
      { speaker: 'linn', portrait: 'linn', text: '好热闹……我从没见过这么多人！' },
      { speaker: 'lily', portrait: 'lily', text: '哇——好多好多数字在飞！大家的数字都好亮！' },
      { speaker: 'zero', portrait: 'zero', text: '繁华之下，是更精密的运算在运转。' },
      { speaker: 'zero', portrait: 'zero', text: '这里的"熵"在缓慢增长，必须加速积累金币以对抗它。' },
      { speaker: 'linn', portrait: 'linn', text: '熵？那是什么？' },
      { speaker: 'zero', portrait: 'zero', text: '世界的运算在衰退。如果不持续注入新的数值，一切都会归零——不是你选择的那种归零，而是永远的消失。' },
      { speaker: 'lily', portrait: 'lily', text: '永远消失？那大家都会……' },
      { speaker: 'zero', portrait: 'zero', text: '所以我们才要战斗。来，先去找金辉城的炼金术师协会。' },
      { speaker: 'narrator', text: '——钟楼上方，一道身影正俯瞰着广场——' },
      { speaker: 'vera', portrait: 'vera', text: '……来了吗，零号的继承者。' },
    ],
  },
  {
    id: 'ch3_meet_vera',
    chapter: 3,
    lines: [
      { speaker: 'narrator', text: '金辉城 · 炼金术师协会 · 顶层' },
      { speaker: 'vera', portrait: 'vera', text: '比我想象的年轻呢——贤者的"学徒"。' },
      { speaker: 'linn', portrait: 'linn', text: '你是？' },
      { speaker: 'vera', portrait: 'vera', text: '薇拉，金辉城首席炼金术师。零号的老朋友——如果机器也能有朋友的话。' },
      { speaker: 'zero', portrait: 'zero', text: '……我们只是合作关系，薇拉。' },
      { speaker: 'vera', portrait: 'vera', text: '呵，还是那么无趣。' },
      { speaker: 'vera', portrait: 'vera', text: '你们来对地方了。熵增正在加速——比任何时候都快。' },
      { speaker: 'vera', portrait: 'vera', text: '金辉城的弹珠机每运转一次，熵就增长一分。' },
      { speaker: 'linn', portrait: 'linn', text: '那怎么办？停止运转吗？' },
      { speaker: 'vera', portrait: 'vera', text: '恰恰相反。你需要更强大的运算力来对冲熵增。' },
      { speaker: 'vera', portrait: 'vera', text: '用更大的数值覆盖衰退的运算——这就是炼金的本质。' },
      { speaker: 'lily', portrait: 'lily', text: '这个姐姐身上的数字好漂亮……像火焰一样在燃烧！' },
      { speaker: 'vera', portrait: 'vera', text: '哦？这孩子能看见数值？有意思……' },
      { speaker: 'vera', portrait: 'vera', text: '你叫什么？' },
      { speaker: 'lily', portrait: 'lily', text: '莉莉！姐姐好漂亮！' },
      { speaker: 'vera', portrait: 'vera', text: '嘴真甜。好吧，我会协助你们。' },
      { speaker: 'vera', portrait: 'vera', text: '但别误会——我不是为了你们，是为了这座城市。' },
      { speaker: 'zero', portrait: 'zero', text: '她嘴上这么说，但她一直在等我们。' },
      { speaker: 'vera', portrait: 'vera', text: '……闭嘴，机器。' },
    ],
  },
  {
    id: 'ch3_midpoint',
    chapter: 3,
    lines: [
      { speaker: 'vera', portrait: 'vera', text: '不对劲……熵的增长速度远超预期。' },
      { speaker: 'lily', portrait: 'lily', text: '薇拉姐姐，空气里好多灰灰的数字……它们在吃掉其他数字！' },
      { speaker: 'vera', portrait: 'vera', text: '那就是熵的具象化。它正在吞噬城市的运算。' },
      { speaker: 'linn', portrait: 'linn', text: '我们得阻止它！' },
      { speaker: 'vera', portrait: 'vera', text: '它有一个核心——熵之幻影。只要击碎核心，就能暂时遏制熵增。' },
      { speaker: 'zero', portrait: 'zero', text: '但它不是实体。你需要用弹珠的数值冲击它的频率。' },
      { speaker: 'vera', portrait: 'vera', text: '我来为你们开路。林恩，准备好你的弹珠机。' },
      { speaker: 'vera', portrait: 'vera', text: '这一次，可不是打打小骷髅那么简单了。' },
      { speaker: 'linn', portrait: 'linn', text: '我不怕。有莉莉和薇拉在，我们一定能赢。' },
      { speaker: 'lily', portrait: 'lily', text: '嗯！莉莉会帮林恩哥哥看见它的弱点！' },
    ],
  },
  {
    id: 'ch3_boss',
    chapter: 3,
    lines: [
      { speaker: 'boss_ghost', portrait: 'boss_ghost', text: '……虚无……是一切的归宿……' },
      { speaker: 'boss_ghost', portrait: 'boss_ghost', text: '你们的运算……毫无意义……终将归零……' },
      { speaker: 'vera', portrait: 'vera', text: '闭嘴。金辉城不会因你而倒下。' },
      { speaker: 'lily', portrait: 'lily', text: '它的核心在中间！但它在不停地移动！' },
      { speaker: 'boss_ghost', portrait: 'boss_ghost', text: '熵增不可逆……你们……也在熵增之中……' },
      { speaker: 'linn', portrait: 'linn', text: '也许吧——但正因如此，我们才更要运算到底！' },
      { speaker: 'zero', portrait: 'zero', text: '集中火力。它的核心在频率最低点暴露！' },
      { speaker: 'vera', portrait: 'vera', text: '让你们见识一下金辉城炼金术师的全力——' },
    ],
  },
  {
    id: 'ch3_prestige_ready',
    chapter: 3,
    lines: [
      { speaker: 'vera', portrait: 'vera', text: '幻影消散了。但这是暂时的——熵不会真正消失。' },
      { speaker: 'vera', portrait: 'vera', text: '你们需要更深入。去零之圣殿——那里有"归零"的根源。' },
      { speaker: 'zero', portrait: 'zero', text: '……那是我诞生的地方。' },
      { speaker: 'lily', portrait: 'lily', text: '零号先生诞生的地方？那里一定很冷吧……' },
      { speaker: 'vera', portrait: 'vera', text: '冷到足以冻结时间。但只有那里才能找到永久的答案。' },
      { speaker: 'vera', portrait: 'vera', text: '在去之前，你们需要归零——积蓄更多的数晶。' },
      { speaker: 'vera', portrait: 'vera', text: '这是金辉城的数晶储备，拿去吧。' },
      { speaker: 'linn', portrait: 'linn', text: '薇拉……你不和我们一起去吗？' },
      { speaker: 'vera', portrait: 'vera', text: '我得留下来守着城市。但……' },
      { speaker: 'vera', portrait: 'vera', text: '如果你到了圣殿，替我看看——那里是否还有贤者留下的记录。' },
      { speaker: 'vera', portrait: 'vera', text: '关于……我母亲的。' },
      { speaker: 'linn', portrait: 'linn', text: '你的母亲？' },
      { speaker: 'vera', portrait: 'vera', text: '……去吧。路上小心。' },
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
      { speaker: 'lily', portrait: 'lily', text: '呜……莉莉好冷……这里什么数字都没有……' },
      { speaker: 'zero', portrait: 'zero', text: '这里是"归零"的源头。所有运算的最终归宿。' },
      { speaker: 'zero', portrait: 'zero', text: '圣殿深处有一个核心——它是这个世界所有弹珠机的"母机"。' },
      { speaker: 'zero', portrait: 'zero', text: '我们离真相只剩最后一步了。' },
      { speaker: 'lily', portrait: 'lily', text: '零号先生……你的声音在发抖。你害怕吗？' },
      { speaker: 'zero', portrait: 'zero', text: '……机器不会害怕。' },
      { speaker: 'linn', portrait: 'linn', text: '你在撒谎。零号，你到底在隐瞒什么？' },
      { speaker: 'zero', portrait: 'zero', text: '……走进去之后你就会知道了。' },
    ],
  },
  {
    id: 'ch4_midpoint',
    chapter: 4,
    lines: [
      { speaker: 'lily', portrait: 'lily', text: '前面有个好大好大的数字……它在变色！' },
      { speaker: 'zero', portrait: 'zero', text: '幻彩守卫。圣殿最后的防线。' },
      { speaker: 'zero', portrait: 'zero', text: '它能模仿弹珠的运算——你的乘法会被它乘回来，你的指数会被它反弹。' },
      { speaker: 'linn', portrait: 'linn', text: '那怎么打？' },
      { speaker: 'lily', portrait: 'lily', text: '莉莉看见了！它变色的时候，就是在切换运算！' },
      { speaker: 'lily', portrait: 'lily', text: '红色的时候用加法，蓝色的时候用乘法……反着来就行！' },
      { speaker: 'zero', portrait: 'zero', text: '这孩子的"数值视觉"……竟然能解析幻彩守卫的运算模式。' },
      { speaker: 'linn', portrait: 'linn', text: '莉莉，你太厉害了！' },
      { speaker: 'lily', portrait: 'lily', text: '嘿嘿！莉莉可是很有用的！' },
      { speaker: 'zero', portrait: 'zero', text: '别得意。它还有最后的变体——全力突破吧。' },
    ],
  },
  {
    id: 'ch4_boss',
    chapter: 4,
    lines: [
      { speaker: 'boss_chameleon', portrait: 'boss_chameleon', text: '……来者……何人……' },
      { speaker: 'boss_chameleon', portrait: 'boss_chameleon', text: '吾为圣殿之镜……映照……你们的运算……' },
      { speaker: 'linn', portrait: 'linn', text: '它复制了我的弹珠！' },
      { speaker: 'boss_chameleon', portrait: 'boss_chameleon', text: '一切运算……皆为虚妄……唯有归零……永恒……' },
      { speaker: 'lily', portrait: 'lily', text: '它变成紫色了！林恩哥哥，用乘法！' },
      { speaker: 'vera', portrait: 'vera', text: '——我赶到了。以为你们会需要援军。' },
      { speaker: 'linn', portrait: 'linn', text: '薇拉！你怎么来的？' },
      { speaker: 'vera', portrait: 'vera', text: '金辉城暂时稳住了。我不能让你们独自面对圣殿的核心。' },
      { speaker: 'vera', portrait: 'vera', text: '而且……我要亲眼看看贤者的记录。' },
      { speaker: 'boss_chameleon', portrait: 'boss_chameleon', text: '幻影……虚妄……来吧……' },
      { speaker: 'linn', portrait: 'linn', text: '大家——一起上！' },
    ],
  },
  {
    id: 'ch4_revelation',
    chapter: 4,
    lines: [
      { speaker: 'narrator', text: '圣殿核心 · 母机之前 · 记忆的洪流' },
      { speaker: 'zero', portrait: 'zero', text: '……到了。' },
      { speaker: 'zero', portrait: 'zero', text: '薇拉，你要找的记录在那边。贤者档案库。' },
      { speaker: 'vera', portrait: 'vera', text: '……找到了。母亲的实验日志。' },
      { speaker: 'vera', portrait: 'vera', text: '原来如此……她把运算核心分成了三份，分别封进了三个容器。' },
      { speaker: 'vera', portrait: 'vera', text: '一份给了零号，一份给了……莉莉。' },
      { speaker: 'lily', portrait: 'lily', text: '莉莉……也是贤者的容器吗？' },
      { speaker: 'zero', portrait: 'zero', text: '是的。第三份……原本应该在林恩体内。' },
      { speaker: 'linn', portrait: 'linn', text: '什么？我体内也有贤者的核心？' },
      { speaker: 'zero', portrait: 'zero', text: '我当初从雪堆里刨出你——不是偶然。' },
      { speaker: 'zero', portrait: 'zero', text: '是贤者核心引导我找到你的。你，就是最后的钥匙。' },
      { speaker: 'vera', portrait: 'vera', text: '所以……母亲她……从一开始就计划好了一切。' },
      { speaker: 'zero', portrait: 'zero', text: '三份核心合一，就能永久封印熵增。但代价是——' },
      { speaker: 'linn', portrait: 'linn', text: '代价是什么？' },
      { speaker: 'zero', portrait: 'zero', text: '……之后再说。先归零，去最后一站。' },
      { speaker: 'vera', portrait: 'vera', text: '零号，你一直知道的。你一直在等这一天。' },
      { speaker: 'zero', portrait: 'zero', text: '……是的。这是我的使命，也是我的赎罪。' },
    ],
  },
  {
    id: 'ch4_prestige_ready',
    chapter: 4,
    lines: [
      { speaker: 'zero', portrait: 'zero', text: '最后的归零。之后，就没有回头路了。' },
      { speaker: 'lily', portrait: 'lily', text: '零号先生……你要去哪里？' },
      { speaker: 'zero', portrait: 'zero', text: '哪里也不去。只是……有些事必须在最后做。' },
      { speaker: 'vera', portrait: 'vera', text: '林恩，归零吧。所有的答案都在无限回廊等你。' },
      { speaker: 'linn', portrait: 'linn', text: '……好。这一次，我们所有人一起走到终点。' },
    ],
  },

  // ===== 第 5 章：贤者归来 =====
  {
    id: 'ch5_intro',
    chapter: 5,
    trigger: 'ch5_intro',
    lines: [
      { speaker: 'narrator', text: '无限回廊 · 贤者机器核心 · 终点' },
      { speaker: 'zero', portrait: 'zero', text: '……我记起来了。全部。' },
      { speaker: 'zero', portrait: 'zero', text: '我曾是一台"贤者机器"——为了对抗熵增而被创造出来的终极运算体。' },
      { speaker: 'zero', portrait: 'zero', text: '但熵增太强了。我一个人无法持续运算。' },
      { speaker: 'zero', portrait: 'zero', text: '于是我把自己的意识拆分——一份留在这具机器里，一份封进了水晶棺，一份注入了你的身体。' },
      { speaker: 'linn', portrait: 'linn', text: '所以莉莉……和我……都是你的一部分？' },
      { speaker: 'lily', portrait: 'lily', text: '莉莉……是零号先生的一部分？' },
      { speaker: 'zero', portrait: 'zero', text: '是的。三份核心合一，就能重启贤者机器——永久对冲熵增。' },
      { speaker: 'vera', portrait: 'vera', text: '但代价……是三份意识必须融合。你、莉莉、零号——将不再是三个独立的人。' },
      { speaker: 'linn', portrait: 'linn', text: '什么意思？我们要……消失吗？' },
      { speaker: 'zero', portrait: 'zero', text: '不会消失。会变成一个全新的存在。' },
      { speaker: 'zero', portrait: 'zero', text: '林恩的勇气、莉莉的感知、我的记忆——三者合一，就是新的贤者。' },
      { speaker: 'lily', portrait: 'lily', text: '那……莉莉还是莉莉吗？' },
      { speaker: 'linn', portrait: 'linn', text: '不……我不要。一定还有别的办法。' },
      { speaker: 'zero', portrait: 'zero', text: '……其实还有一个选择。' },
    ],
  },
  {
    id: 'ch5_midpoint',
    chapter: 5,
    lines: [
      { speaker: 'zero', portrait: 'zero', text: '另一个选择：不融合。用弹珠机的运算力持续对抗熵增。' },
      { speaker: 'zero', portrait: 'zero', text: '只要弹珠永无止境地循环下去，数值就会不断增长，熵就会被对冲。' },
      { speaker: 'zero', portrait: 'zero', text: '代价是——永远不能停下。你们必须永远留在回廊里，让弹珠机运转。' },
      { speaker: 'vera', portrait: 'vera', text: '永远？那和被囚禁有什么区别？' },
      { speaker: 'zero', portrait: 'zero', text: '但你们可以在一起。作为独立的个体。' },
      { speaker: 'lily', portrait: 'lily', text: '莉莉不想和林恩哥哥分开……但也不想失去零号先生……' },
      { speaker: 'linn', portrait: 'linn', text: '……我选择不融合。' },
      { speaker: 'linn', portrait: 'linn', text: '我们会永远在这里运转弹珠机。但不是囚禁——是我们自己的选择。' },
      { speaker: 'vera', portrait: 'vera', text: '……真是个笨蛋。但你笑得很开心。' },
      { speaker: 'zero', portrait: 'zero', text: '……谢谢你，林恩。谢谢你选择了让我继续做"我自己"。' },
      { speaker: 'lily', portrait: 'lily', text: '那莉莉也要留下来！和大家一起！永远！' },
      { speaker: 'vera', portrait: 'vera', text: '看来我也走不了了。算了——谁让我是你们的"老朋友"呢。' },
    ],
  },
  {
    id: 'ch5_prestige_ready',
    chapter: 5,
    lines: [
      { speaker: 'zero', portrait: 'zero', text: '弹珠永无止境地循环——这就是"炼金"的真谛。' },
      { speaker: 'linn', portrait: 'linn', text: '每一次归零，都是为了新的开始。' },
      { speaker: 'lily', portrait: 'lily', text: '莉莉会一直看着数字飞来飞去！' },
      { speaker: 'vera', portrait: 'vera', text: '而我会确保这些数字不会失控。' },
      { speaker: 'zero', portrait: 'zero', text: '我们……是一个整体。但又各自独立。' },
      { speaker: 'zero', portrait: 'zero', text: '这就是贤者最终的答案——不是融合，而是羁绊。' },
      { speaker: 'linn', portrait: 'linn', text: '走吧，大家。让弹珠继续落下去。' },
      { speaker: 'narrator', text: '——弹珠落下的声音，永远不会停止。——' },
      { speaker: 'narrator', text: '【终章·贤者归来】' },
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

/** 章节中点对话 ID（50% 进度时触发） */
export function chapterMidpointId(chapterId: number): string {
  return `ch${chapterId}_midpoint`;
}

/** 章节归零前对话 ID */
export function chapterPrestigeReadyId(chapterId: number): string {
  return `ch${chapterId}_prestige_ready`;
}

/** 章节 Boss 战对话 ID */
export function chapterBossId(chapterId: number): string {
  return `ch${chapterId}_boss`;
}
