// 全局事件总线，用于解耦系统与场景

export const EVT = {
  GOLD_CHANGED: 'gold_changed',
  CRYSTAL_CHANGED: 'crystal_changed',
  BALL_VALUE_CHANGED: 'ball_value_changed',
  PEG_PLACED: 'peg_placed',
  PEG_UPGRADED: 'peg_upgraded',
  PEG_SOLD: 'peg_sold',
  SKILL_BOUGHT: 'skill_bought',
  AUTO_BOUGHT: 'auto_bought',
  ACTIVE_TRIGGERED: 'active_triggered',
  ACTIVE_EXPIRED: 'active_expired',
  CHAPTER_CHANGED: 'chapter_changed',
  PRESTIGE_AVAILABLE: 'prestige_available',
  /** 归零剧情对话已结束，HUD 可弹出归零确认弹窗 */
  PRESTIGE_DIALOGUE_DONE: 'prestige_dialogue_done',
  TOAST: 'toast',
  SAVE_DONE: 'save_done',
  MARBLE_SELECTED: 'marble_selected',
  MARBLE_BOUGHT: 'marble_bought',
  MARBLE_UPGRADED: 'marble_upgraded',
  DIALOGUE_TRIGGER: 'dialogue_trigger',
  MILESTONE_REACHED: 'milestone_reached',
  BOSS_TRIGGER: 'boss_trigger',
  BOSS_DEFEATED: 'boss_defeated',
} as const;

type EventCallback = (...args: unknown[]) => void;

class EventBus {
  private listeners: Map<string, EventCallback[]> = new Map();

  on(event: string, cb: EventCallback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(cb);
  }

  off(event: string, cb: EventCallback) {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(cb);
    if (idx >= 0) list.splice(idx, 1);
  }

  emit(event: string, ...args: unknown[]) {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const cb of list) {
      try { cb(...args); } catch (e) { console.error(e); }
    }
  }

  once(event: string, cb: EventCallback) {
    const wrap = (...args: unknown[]) => {
      this.off(event, wrap);
      cb(...args);
    };
    this.on(event, wrap);
  }
}

export const bus = new EventBus();
