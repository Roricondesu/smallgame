// 简单事件总线，用于 UI 与场景解耦

type Handler = (payload?: unknown) => void;

class EventBus {
  private handlers: Map<string, Handler[]> = new Map();

  on(event: string, handler: Handler) {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
    return () => this.off(event, handler);
  }

  off(event: string, handler: Handler) {
    const list = this.handlers.get(event) || [];
    this.handlers.set(
      event,
      list.filter((h) => h !== handler)
    );
  }

  emit(event: string, payload?: unknown) {
    const list = this.handlers.get(event) || [];
    for (const h of list) {
      try {
        h(payload);
      } catch (e) {
        console.error(`EventBus error [${event}]:`, e);
      }
    }
  }
}

export const bus = new EventBus();

export const EVT = {
  GOLD_CHANGED: 'goldChanged',
  CRYSTAL_CHANGED: 'crystalChanged',
  BALL_VALUE_CHANGED: 'ballValueChanged',
  CHAPTER_PROGRESS: 'chapterProgress',
  PEG_PLACED: 'pegPlaced',
  PEG_UPGRADED: 'pegUpgraded',
  PEG_SOLD: 'pegSold',
  AUTO_PURCHASED: 'autoPurchased',
  SKILL_PURCHASED: 'skillPurchased',
  ACTIVE_TRIGGERED: 'activeTriggered',
  ACTIVE_EXPIRED: 'activeExpired',
  TOAST: 'toast',
  PRESTIGE_READY: 'prestigeReady',
  ENDING_CHOICE: 'endingChoice',
  SAVE: 'save',
  WIPE: 'wipe',
} as const;
