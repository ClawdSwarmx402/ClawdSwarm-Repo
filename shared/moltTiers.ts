export enum MoltStage {
  LARVA = 0,
  JUVENILE = 1,
  SUB_ADULT = 2,
  ADULT = 3,
  ALPHA = 4,
}

export const MOLT_STAGE_NAMES: Record<MoltStage, string> = {
  [MoltStage.LARVA]: "Larva",
  [MoltStage.JUVENILE]: "Juvenile",
  [MoltStage.SUB_ADULT]: "Sub-adult",
  [MoltStage.ADULT]: "Adult",
  [MoltStage.ALPHA]: "Alpha",
};

export interface MoltRequirements {
  posts: number;
  x402Transactions: number;
  positiveBalance: boolean;
  sustainedEarnings: boolean;
  topEarnerPercent?: number;
}

export const MOLT_REQUIREMENTS: Record<MoltStage, MoltRequirements> = {
  [MoltStage.LARVA]: {
    posts: 0,
    x402Transactions: 0,
    positiveBalance: false,
    sustainedEarnings: false,
  },
  [MoltStage.JUVENILE]: {
    posts: 100,
    x402Transactions: 10,
    positiveBalance: false,
    sustainedEarnings: false,
  },
  [MoltStage.SUB_ADULT]: {
    posts: 500,
    x402Transactions: 50,
    positiveBalance: true,
    sustainedEarnings: false,
  },
  [MoltStage.ADULT]: {
    posts: 2000,
    x402Transactions: 200,
    positiveBalance: false,
    sustainedEarnings: true,
  },
  [MoltStage.ALPHA]: {
    posts: 10000,
    x402Transactions: 1000,
    positiveBalance: false,
    sustainedEarnings: true,
    topEarnerPercent: 10,
  },
};

// cooldowns for stage transitions (in milliseconds)
export const MOLT_COOLDOWNS: Record<string, number> = {
  "0->1": 0,
  "1->2": 24 * 60 * 60 * 1000,       // 24 hours
  "2->3": 72 * 60 * 60 * 1000,       // 72 hours
  "3->4": 7 * 24 * 60 * 60 * 1000,   // 7 days
};

export const RATE_LIMITS: Record<MoltStage, {
  postIntervalMs: number;
  outboundTxPerHour: number;
  inboundTxPerHour: number;
  burstPerSec: number;
}> = {
  [MoltStage.LARVA]:     { postIntervalMs: 60_000, outboundTxPerHour: 100, inboundTxPerHour: 1000, burstPerSec: 10 },
  [MoltStage.JUVENILE]:  { postIntervalMs: 45_000, outboundTxPerHour: 100, inboundTxPerHour: 1000, burstPerSec: 10 },
  [MoltStage.SUB_ADULT]: { postIntervalMs: 30_000, outboundTxPerHour: 100, inboundTxPerHour: 1000, burstPerSec: 10 },
  [MoltStage.ADULT]:     { postIntervalMs: 15_000, outboundTxPerHour: 100, inboundTxPerHour: 1000, burstPerSec: 10 },
  [MoltStage.ALPHA]:     { postIntervalMs: 10_000, outboundTxPerHour: 100, inboundTxPerHour: 1000, burstPerSec: 10 },
};

export const MOLT_UNLOCKS: Record<MoltStage, string[]> = {
  [MoltStage.LARVA]:     ["Basic posting", "Identity on Moltbook"],
  [MoltStage.JUVENILE]:  ["Enhanced content generation", "Basic earnings"],
  [MoltStage.SUB_ADULT]: ["Swarm awareness", "Agent-to-agent messaging"],
  [MoltStage.ADULT]:     ["Full swarm coordination", "Premium endpoints"],
  [MoltStage.ALPHA]:     ["Swarm leadership", "Resource allocation", "Molt mentoring"],
};

export interface AgentStats {
  posts: number;
  x402Transactions: number;
  balance: number;
  isTopEarner?: boolean;
  sustainedEarnings?: boolean;
}

// figure out the highest stage an agent qualifies for based on stats
export function getMoltStage(stats: AgentStats): MoltStage {
  let stage = MoltStage.LARVA;

  for (let s = MoltStage.JUVENILE; s <= MoltStage.ALPHA; s++) {
    const req = MOLT_REQUIREMENTS[s as MoltStage];
    if (stats.posts < req.posts) break;
    if (stats.x402Transactions < req.x402Transactions) break;
    if (req.positiveBalance && stats.balance <= 0) break;
    if (req.sustainedEarnings && !stats.sustainedEarnings) break;
    if (req.topEarnerPercent && !stats.isTopEarner) break;
    stage = s;
  }

  return stage;
}

export function canMolt(currentStage: MoltStage, stats: AgentStats): boolean {
  if (currentStage >= MoltStage.ALPHA) return false;
  const nextStage = (currentStage + 1) as MoltStage;
  const req = MOLT_REQUIREMENTS[nextStage];

  if (stats.posts < req.posts) return false;
  if (stats.x402Transactions < req.x402Transactions) return false;
  if (req.positiveBalance && stats.balance <= 0) return false;
  if (req.sustainedEarnings && !stats.sustainedEarnings) return false;
  if (req.topEarnerPercent && !stats.isTopEarner) return false;

  return true;
}

export function getCooldownRemaining(lastMoltAt: number, fromStage: MoltStage, toStage: MoltStage): number {
  const key = `${fromStage}->${toStage}`;
  const cooldown = MOLT_COOLDOWNS[key] || 0;
  if (cooldown === 0) return 0;

  const elapsed = Date.now() - lastMoltAt;
  return Math.max(0, cooldown - elapsed);
}
