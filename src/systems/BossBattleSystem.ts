// Boss 战斗系统：DOM 覆盖层弹窗式 Boss 战
// 每章 75% 进度后弹出 Boss 战；击败 Boss 才能进入归零试炼
// 三种 Boss 机制：
//   - boss_skull     (骷髅守卫)：召唤护盾，需先击破护盾才能造成伤害
//   - boss_ghost     (熵之幻影)：周期性虚化，仅在显形时承受伤害
//   - boss_chameleon (幻彩守卫)：变色弱点，需点击对应元素按钮才能造成伤害
//
// 所有 Boss 共用一套数值：
//   - HP = 章节目标金币 × 0.5（在 bigint 域上做整数除法）
//   - 玩家每次"冲击"消耗 5% 当前金币，按一定公式转化为伤害
//   - 击败 Boss 触发 BOSS_DEFEATED 事件，关闭后回到游戏，可点击归零

import { GameState, toBig, fromBig, bigMulNum, formatNum } from './GameState';
import { bus, EVT } from './EventBus';
import { DIALOGUE_MAP, chapterBossId } from '../data/dialogues';
import { DialogueSystem } from './DialogueSystem';

type BossId = 'boss_skull' | 'boss_ghost' | 'boss_chameleon';
type ChameleonColor = 'fire' | 'ice' | 'thunder' | 'holy';

interface BossState {
  id: BossId;
  name: string;
  hp: bigint;
  maxHp: bigint;
  // 机制相关运行时状态
  shield?: number;        // skull：当前护盾值（0=无护盾可直接打本体）
  shieldMax?: number;
  visible?: boolean;      // ghost：是否处于显形（true=可承受伤害）
  color?: ChameleonColor; // chameleon：当前弱点颜色
  // 计时器
  phaseTimer: number;      // 距下次机制切换的秒数
  // 战斗是否已结束
  finished?: 'win' | 'flee';
}

const BOSS_INFO: Record<BossId, { name: string; desc: string; portrait: string }> = {
  boss_skull: {
    name: '骷髅守卫',
    desc: '会召唤骨盾，需先击破护盾才能造成伤害。点击【击破护盾】清除护盾。',
    portrait: '/portraits/boss_skull.png',
  },
  boss_ghost: {
    name: '熵之幻影',
    desc: '会周期性虚化，虚化时无法造成伤害。等待显形时再冲击！',
    portrait: '/portraits/boss_ghost.png',
  },
  boss_chameleon: {
    name: '幻彩守卫',
    desc: '弱点不停变色，只有点击对应元素的【冲击】才能造成伤害。',
    portrait: '/portraits/boss_chameleon.png',
  },
};

const CHAMELEON_COLORS: Array<{ key: ChameleonColor; name: string; hex: string }> = [
  { key: 'fire', name: '火', hex: '#ff6b3d' },
  { key: 'ice', name: '冰', hex: '#6ec5ff' },
  { key: 'thunder', name: '雷', hex: '#ffd166' },
  { key: 'holy', name: '圣', hex: '#fff5b3' },
];

export class BossBattleSystem {
  private root: HTMLElement | null = null;
  private state: BossState | null = null;
  private dialogue: DialogueSystem | null = null;
  private tickHandle: number | null = null;
  private bound = false;
  private triggerCb?: (...args: unknown[]) => void;

  /** 挂载到 GameScene，监听 BOSS_TRIGGER */
  mount(dialogue: DialogueSystem) {
    if (this.bound) return;
    this.bound = true;
    this.dialogue = dialogue;
    this.triggerCb = () => {
      const id = GameState.currentBossId;
      if (!id) return;
      if (GameState.isBossDefeated()) return;
      this.start(id);
    };
    bus.on(EVT.BOSS_TRIGGER, this.triggerCb);
  }

  unmount() {
    if (this.triggerCb) {
      bus.off(EVT.BOSS_TRIGGER, this.triggerCb);
      this.triggerCb = undefined;
    }
    this.stopTick();
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.state = null;
    this.bound = false;
  }

  /** 启动 Boss 战 */
  private start(id: BossId) {
    // 计算 HP：章节目标金币 × 0.5（在原值域）
    const targetNum = fromBig(GameState.chapter.targetGold);
    const hpNum = Math.max(1, Math.floor(targetNum * 0.5));
    const hp = toBig(hpNum);

    let shield: number | undefined;
    let shieldMax: number | undefined;
    let visible: boolean | undefined;
    let color: ChameleonColor | undefined;

    if (id === 'boss_skull') {
      shieldMax = 5;
      shield = shieldMax;
    } else if (id === 'boss_ghost') {
      visible = true;
    } else if (id === 'boss_chameleon') {
      color = CHAMELEON_COLORS[Math.floor(Math.random() * CHAMELEON_COLORS.length)].key;
    }

    this.state = {
      id, name: BOSS_INFO[id].name, hp, maxHp: hp,
      shield, shieldMax, visible, color,
      phaseTimer: id === 'boss_skull' ? 8 : (id === 'boss_ghost' ? 4 : 3),
    };

    this.ensureRoot();
    this.render();
    this.startTick();

    // 播放 Boss 开场对话
    const bossDlgId = chapterBossId(GameState.chapterId);
    const dlg = DIALOGUE_MAP[bossDlgId];
    if (dlg) this.dialogue?.start(dlg);
  }

  private ensureRoot(): HTMLElement {
    if (this.root) return this.root;
    const el = document.createElement('div');
    el.id = 'boss-battle-overlay';
    el.className = 'modal-overlay';
    el.innerHTML = `
      <div class="modal" style="width:min(560px,94vw); padding:0; overflow:hidden;">
        <div id="boss-head" style="display:flex; gap:14px; padding:16px; border-bottom:1px solid var(--border); background:rgba(0,0,0,0.3);">
          <div id="boss-portrait" style="width:88px; height:88px; flex-shrink:0; background-size:cover; background-position:center top; border-radius:var(--radius-sm); border:1px solid var(--border-strong); image-rendering:pixelated;"></div>
          <div style="flex:1; min-width:0;">
            <div id="boss-name" style="font-size:18px; font-weight:600; color:var(--bad); margin-bottom:4px;"></div>
            <div id="boss-desc" style="font-size:12px; color:var(--muted); line-height:1.5; margin-bottom:10px;"></div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:11px; color:var(--muted);">HP</span>
              <div style="flex:1; height:14px; background:rgba(255,255,255,0.06); border:1px solid var(--border); border-radius:8px; overflow:hidden;">
                <div id="boss-hp-fill" style="height:100%; background:linear-gradient(90deg, #ff6b6b, #ff9966); width:100%; transition:width 0.2s;"></div>
              </div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:10px; color:var(--muted);">
              <span id="boss-hp-text"></span>
              <span id="boss-phase-text"></span>
            </div>
          </div>
        </div>
        <div id="boss-body" style="padding:16px;"></div>
        <div style="padding:0 16px 16px; display:flex; gap:8px; justify-content:space-between; border-top:1px solid var(--border); padding-top:12px;">
          <button id="boss-flee" class="btn">撤退</button>
          <div id="boss-gold-info" style="font-size:11px; color:var(--muted); align-self:center;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      if (e.target === el) this.flee();
    });
    el.querySelector('#boss-flee')?.addEventListener('click', () => this.flee());
    this.root = el;
    return el;
  }

  private render() {
    if (!this.root || !this.state) return;
    const info = BOSS_INFO[this.state.id];
    this.root.querySelector<HTMLElement>('#boss-portrait')!.style.backgroundImage = `url(${info.portrait})`;
    this.root.querySelector<HTMLElement>('#boss-name')!.textContent = info.name;
    this.root.querySelector<HTMLElement>('#boss-desc')!.textContent = info.desc;

    // HP 显示
    const hpRatio = Number(Number(this.state.hp * 10000n / this.state.maxHp) / 10000);
    this.root.querySelector<HTMLElement>('#boss-hp-fill')!.style.width = `${Math.max(0, Math.min(100, hpRatio * 100))}%`;
    this.root.querySelector<HTMLElement>('#boss-hp-text')!.textContent = `${formatNum(this.state.hp)} / ${formatNum(this.state.maxHp)}`;

    // 阶段提示
    let phaseText = '';
    if (this.state.id === 'boss_skull') {
      phaseText = this.state.shield && this.state.shield > 0
        ? `护盾 ×${this.state.shield}（需击破）· ${this.state.phaseTimer}s 后补盾`
        : `本体暴露！${this.state.phaseTimer}s 后召唤新护盾`;
    } else if (this.state.id === 'boss_ghost') {
      phaseText = this.state.visible ? `显形中！${this.state.phaseTimer}s 后虚化` : `虚化中…${this.state.phaseTimer}s 后显形`;
    } else if (this.state.id === 'boss_chameleon') {
      const c = CHAMELEON_COLORS.find(x => x.key === this.state!.color)!;
      phaseText = `弱点：<span style="color:${c.hex}; font-weight:600;">${c.name}</span> · ${this.state.phaseTimer}s 后切换`;
    }
    this.root.querySelector<HTMLElement>('#boss-phase-text')!.innerHTML = phaseText;

    // 金币提示
    this.root.querySelector<HTMLElement>('#boss-gold-info')!.innerHTML = `当前金币：<span style="color:var(--gold); font-weight:600;">${formatNum(GameState.gold)}</span>`;

    // 操作区
    const body = this.root.querySelector<HTMLElement>('#boss-body')!;
    body.innerHTML = '';

    if (this.state.id === 'boss_skull') {
      // 骷髅：护盾存在时只能"击破护盾"，护盾消失后才能"冲击本体"
      const hasShield = this.state.shield && this.state.shield > 0;
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.style.cssText = 'width:100%; min-height:48px; font-size:14px;';
      if (hasShield) {
        const cost = this.attackCost();
        const afford = GameState.gold >= cost;
        btn.textContent = `击破护盾（消耗 5% 金币 = ${formatNum(cost)}）`;
        btn.classList.toggle('danger', !afford);
        if (!afford) btn.setAttribute('disabled', 'true');
        btn.addEventListener('click', () => this.breakShield());
      } else {
        const cost = this.attackCost();
        const afford = GameState.gold >= cost;
        btn.textContent = `冲击本体！消耗 ${formatNum(cost)} 金币`;
        if (!afford) btn.setAttribute('disabled', 'true');
        btn.addEventListener('click', () => this.attack(1));
      }
      body.appendChild(btn);
    } else if (this.state.id === 'boss_ghost') {
      // 幻影：显形时可冲击
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.style.cssText = 'width:100%; min-height:48px; font-size:14px;';
      const cost = this.attackCost();
      const afford = GameState.gold >= cost;
      if (this.state.visible) {
        btn.textContent = `冲击幻影核心！消耗 ${formatNum(cost)} 金币`;
        if (!afford) btn.setAttribute('disabled', 'true');
        btn.addEventListener('click', () => this.attack(1.5));
      } else {
        btn.textContent = '幻影虚化中，无法攻击…';
        btn.setAttribute('disabled', 'true');
      }
      body.appendChild(btn);
    } else if (this.state.id === 'boss_chameleon') {
      // 变色守卫：4 个元素按钮，只有匹配颜色的造成伤害
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:8px;';
      for (const c of CHAMELEON_COLORS) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.cssText = `min-height:48px; font-size:14px; border-color:${c.hex}; color:${c.hex};`;
        btn.textContent = `${c.name} 系冲击`;
        const cost = this.attackCost();
        const afford = GameState.gold >= cost;
        if (!afford) btn.setAttribute('disabled', 'true');
        btn.addEventListener('click', () => {
          if (this.state!.color === c.key) {
            this.attack(2); // 命中弱点，2 倍伤害
          } else {
            this.attack(0.2); // 错误元素，几乎无伤害
          }
        });
        wrap.appendChild(btn);
      }
      body.appendChild(wrap);
    }
  }

  /** 一次攻击消耗 5% 当前金币 */
  private attackCost(): bigint {
    return bigMulNum(GameState.gold, 0.05);
  }

  /** 通用攻击：按消耗金币量 × 倍率转化为伤害 */
  private attack(dmgMul: number) {
    if (!this.state) return;
    const cost = this.attackCost();
    if (GameState.gold < cost) return;
    GameState.spendGold(cost);
    // 伤害 = cost × dmgMul（cost 已是 bigint 域）
    const dmg = bigMulNum(cost, dmgMul);
    this.state.hp = this.state.hp > dmg ? this.state.hp - dmg : 0n;
    this.render();
    if (this.state.hp <= 0n) this.win();
  }

  private breakShield() {
    if (!this.state || this.state.id !== 'boss_skull') return;
    const cost = this.attackCost();
    if (GameState.gold < cost) return;
    GameState.spendGold(cost);
    if (this.state.shield && this.state.shield > 0) {
      this.state.shield = Math.max(0, this.state.shield - 1);
    }
    this.render();
  }

  private startTick() {
    this.stopTick();
    this.tickHandle = window.setInterval(() => this.tick(), 1000);
  }

  private stopTick() {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private tick() {
    if (!this.state || this.state.finished) return;
    this.state.phaseTimer--;
    if (this.state.phaseTimer <= 0) {
      this.nextPhase();
    }
    this.render();
  }

  private nextPhase() {
    if (!this.state) return;
    if (this.state.id === 'boss_skull') {
      // 每隔 8 秒重新召唤护盾
      this.state.shield = this.state.shieldMax ?? 5;
      this.state.phaseTimer = 8;
    } else if (this.state.id === 'boss_ghost') {
      // 切换显形/虚化（显形 4s，虚化 3s）
      this.state.visible = !this.state.visible;
      this.state.phaseTimer = this.state.visible ? 4 : 3;
    } else if (this.state.id === 'boss_chameleon') {
      // 每 3 秒切换弱点
      const others = CHAMELEON_COLORS.filter(c => c.key !== this.state!.color);
      this.state.color = others[Math.floor(Math.random() * others.length)].key;
      this.state.phaseTimer = 3;
    }
  }

  private win() {
    if (!this.state) return;
    this.state.finished = 'win';
    this.stopTick();
    GameState.markBossDefeated();

    const body = this.root!.querySelector<HTMLElement>('#boss-body')!;
    body.innerHTML = `
      <div style="text-align:center; padding:20px 0;">
        <div style="font-size:22px; color:var(--good); font-weight:600; margin-bottom:10px;">击败 ${this.state.name}！</div>
        <div style="font-size:13px; color:var(--muted); line-height:1.6;">Boss 已被击碎，归零之路已开。可点击右上【归零】按钮进入下一周目。</div>
        <button id="boss-close-win" class="btn primary" style="margin-top:16px; min-width:160px;">返回游戏</button>
      </div>
    `;
    body.querySelector('#boss-close-win')?.addEventListener('click', () => this.close());
  }

  private flee() {
    if (!this.state) return;
    this.state.finished = 'flee';
    this.close();
  }

  private close() {
    this.stopTick();
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.state = null;
  }
}
