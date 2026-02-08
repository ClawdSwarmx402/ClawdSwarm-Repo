export type EventType =
  | "agent.deployed"
  | "agent.claimed"
  | "agent.activated"
  | "agent.posted"
  | "agent.molt.started"
  | "agent.molt.completed"
  | "agent.decay.warning"
  | "agent.decay.shellrot";

export const EVENT_TYPES: EventType[] = [
  "agent.deployed",
  "agent.claimed",
  "agent.activated",
  "agent.posted",
  "agent.molt.started",
  "agent.molt.completed",
  "agent.decay.warning",
  "agent.decay.shellrot",
];

export interface WebhookPayload {
  event: EventType;
  agentHash: string;
  timestamp: number;
  data: Record<string, unknown>;
}

interface WebhookRegistration {
  url: string;
  events: EventType[];
}

// in-memory webhook registry
const webhooks: WebhookRegistration[] = [];

export function registerWebhook(url: string, events: EventType[]): void {
  const valid = events.filter((e) => EVENT_TYPES.includes(e));
  if (valid.length === 0) return;

  webhooks.push({ url, events: valid });
}

export function unregisterWebhook(url: string): void {
  const idx = webhooks.findIndex((w) => w.url === url);
  if (idx >= 0) webhooks.splice(idx, 1);
}

export async function emitEvent(
  event: EventType,
  agentHash: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    agentHash,
    timestamp: Date.now(),
    data,
  };

  const targets = webhooks.filter((w) => w.events.includes(event));

  // fire-and-forget to all registered endpoints
  const deliveries = targets.map((w) =>
    fetch(w.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }).catch((err) => {
      console.warn(`[webhooks] Failed to deliver ${event} to ${w.url}:`, err.message);
    })
  );

  await Promise.allSettled(deliveries);
}

export function getRegisteredWebhooks(): WebhookRegistration[] {
  return [...webhooks];
}
