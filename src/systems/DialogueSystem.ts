// 对话系统：DOM 覆盖层，按行播放对话，点击推进
// 监听 EVT.DIALOGUE_TRIGGER 事件，由 GameScene 触发
// 通过 GameState.markDialogueSeen() 标记已完成

import { GameState } from './GameState';
import { bus, EVT } from './EventBus';
import { DIALOGUE_MAP } from '../data/dialogues';
import type { Dialogue, DialogueLine } from '../data/dialogues';

/** 角色名映射 */
const SPEAKER_NAMES: Record<string, string> = {
  linn: '林恩',
  zero: '零号',
  lily: '莉莉',
  vera: '薇拉',
  boss_skull: '骷髅守卫',
  boss_ghost: '熵之幻影',
  boss_chameleon: '幻彩守卫',
};

/** 立绘文件映射 */
const PORTRAIT_FILES: Record<string, string> = {
  linn: 'linn.png',
  zero: 'zero.png',
  lily: 'lily.png',
  vera: 'vera.png',
  boss_skull: 'boss_skull.png',
  boss_ghost: 'boss_ghost.png',
  boss_chameleon: 'boss_chameleon.png',
};

export class DialogueSystem {
  private root: HTMLElement | null = null;
  private current: Dialogue | null = null;
  private lineIdx = 0;
  private onDone?: () => void;
  private bound = false;
  private triggerCb?: (...args: unknown[]) => void;

  /** 挂载 DOM 节点（首次创建） */
  private ensureRoot() {
    if (this.root) return this.root;
    const existing = document.getElementById('dialogue-overlay');
    if (existing) {
      this.root = existing;
      return this.root;
    }
    const el = document.createElement('div');
    el.id = 'dialogue-overlay';
    el.className = 'dialogue-overlay';
    el.innerHTML = `
      <div class="dialogue-box">
        <div class="dialogue-portrait" id="dialogue-portrait"></div>
        <div class="dialogue-content">
          <div class="dialogue-speaker" id="dialogue-speaker"></div>
          <div class="dialogue-text" id="dialogue-text"></div>
          <div class="dialogue-hint">点击继续 ▸</div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.addEventListener('click', () => this.advance());
    this.root = el;
    return this.root;
  }

  /** 绑定全局事件（HUD 初始化时调用一次） */
  mount() {
    if (this.bound) return;
    this.bound = true;
    this.ensureRoot();
    this.triggerCb = (id: unknown) => {
      const dlg = DIALOGUE_MAP[String(id)];
      if (dlg) this.start(dlg);
    };
    bus.on(EVT.DIALOGUE_TRIGGER, this.triggerCb);
  }

  unmount() {
    if (this.triggerCb) {
      bus.off(EVT.DIALOGUE_TRIGGER, this.triggerCb);
      this.triggerCb = undefined;
    }
    if (this.root) {
      this.root.classList.remove('open');
      this.root.remove();
      this.root = null;
    }
    this.current = null;
    this.lineIdx = 0;
    this.bound = false;
  }

  /** 启动一段对话 */
  start(dlg: Dialogue, onDone?: () => void) {
    this.current = dlg;
    this.lineIdx = 0;
    this.onDone = onDone;
    const root = this.ensureRoot();
    root.classList.add('open');
    this.renderLine();
  }

  /** 推进到下一行，最后一行结束则关闭 */
  private advance() {
    if (!this.current) return;
    this.lineIdx++;
    if (this.lineIdx >= this.current.lines.length) {
      this.end();
      return;
    }
    this.renderLine();
  }

  private end() {
    if (!this.current) return;
    const id = this.current.id;
    GameState.markDialogueSeen(id);
    this.current = null;
    this.lineIdx = 0;
    this.root?.classList.remove('open');
    const cb = this.onDone;
    this.onDone = undefined;
    cb?.();
  }

  private renderLine() {
    if (!this.current || !this.root) return;
    const line: DialogueLine = this.current.lines[this.lineIdx];
    const speakerEl = this.root.querySelector('#dialogue-speaker') as HTMLElement;
    const textEl = this.root.querySelector('#dialogue-text') as HTMLElement;
    const portraitEl = this.root.querySelector('#dialogue-portrait') as HTMLElement;

    speakerEl.textContent = SPEAKER_NAMES[line.speaker] ?? '旁白';
    textEl.textContent = line.text;

    // 立绘切换
    const portraitFile = line.portrait ? PORTRAIT_FILES[line.portrait] : undefined;
    if (portraitFile) {
      portraitEl.style.backgroundImage = `url(/portraits/${portraitFile})`;
      portraitEl.style.opacity = '1';
      portraitEl.dataset.speaker = line.portrait;
    } else {
      portraitEl.style.backgroundImage = '';
      portraitEl.style.opacity = '0.2';
      delete portraitEl.dataset.speaker;
    }

    // 旁白样式
    speakerEl.classList.toggle('narrator', line.speaker === 'narrator');
    textEl.classList.toggle('narrator', line.speaker === 'narrator');
  }

  /** 当前是否正在播放对话 */
  isPlaying(): boolean {
    return this.current !== null;
  }
}
