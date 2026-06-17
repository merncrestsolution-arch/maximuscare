export type AppEventType =
  | "task.assigned"
  | "attendance.reminder"
  | "salary.approved"
  | "fine.created"
  | "visit.created"
  | "patient.registered"
  | "notification.delivered";

export interface AppEvent<T = unknown> {
  type: AppEventType;
  payload: T;
  timestamp: Date;
  userId?: string;
}

type EventHandler = (event: AppEvent) => void | Promise<void>;

const handlers = new Map<AppEventType, EventHandler[]>();
const wildcardHandlers: EventHandler[] = [];

export function onEvent(type: AppEventType, handler: EventHandler) {
  const list = handlers.get(type) ?? [];
  list.push(handler);
  handlers.set(type, list);
}

export function onAnyEvent(handler: EventHandler) {
  wildcardHandlers.push(handler);
}

export async function emitEvent<T>(type: AppEventType, payload: T, userId?: string) {
  const event: AppEvent<T> = { type, payload, timestamp: new Date(), userId };
  const typeHandlers = handlers.get(type) ?? [];
  for (const h of [...typeHandlers, ...wildcardHandlers]) {
    try {
      await h(event);
    } catch (err) {
      console.error(`[EVENT] Handler failed for ${type}:`, err);
    }
  }
}
