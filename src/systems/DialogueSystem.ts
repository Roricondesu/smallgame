// 对话系统：DOM 覆盖层，按行播放对话，点击推进
// 监听 EVT.DIALOGUE_TRIGGER 事件，由 GameScene 触发
// 通过 GameState.markDialogueSeen() 标记已完成

import { GameState } from './GameState';
import { bus, EVT } from './EventBus';
import { DIALOGUE_MAP } from '../data/dialogues';
import type { Dialogue, DialogueLine } from '../data/dialogues';

export class DialogueSystem {
  private root: HTMLElement | null = null;
  private current: Dialogue | null = null;
  private lineIdx = 0;
  private onDone?: () => void;
  private bound = false;

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
    bus.on(EVT.DIALOGUE_TRIGGER, (id: unknown) => {
      const dlg = DIALOGUE_MAP[String(id)];
      if (dlg) this.start(dlg);
    });
  }

  unmount() {
    if (this.root) {
      this.root.classList.remove('open');
    }
    this.current = null;
    this.lineIdx = 0;
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

    const speakerName = line.speaker === 'linn' ? '林恩'
      : line.speaker === 'zero' ? '零号'
      : '旁白';
    speakerEl.textContent = speakerName;
    textEl.textContent = line.text;

    // 立绘切换
    if (line.portrait === 'linn') {
      portraitEl.style.backgroundImage = `url(/portraits/linn.png)`;
      portraitEl.style.opacity = '1';
      portraitEl.dataset.speaker = 'linn';
    } else if (line.portrait === 'zero') {
      portraitEl.style.backgroundImage = `url(/portraits/zero.png)`;
      portraitEl.style.opacity = '1';
      portraitEl.dataset.speaker = 'zero';
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
