import {
  MoltStage,
  MOLT_STAGE_NAMES,
  MOLT_REQUIREMENTS,
  MOLT_UNLOCKS,
  type AgentStats,
  canMolt,
  getCooldownRemaining,
} from "@shared/moltTiers";

export enum DecayStatus {
  HEALTHY = "healthy",
  WARNED = "warned",
  SOFTENED = "softened",
  ROTTING = "rotting",
  DORMANT = "dormant",
}

// inactivity thresholds
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const DECAY_THRESHOLDS = {
  warning: 24 * HOUR,    // 24hr — soft warning, molt progress pauses
  softening: 72 * HOUR,  // 72hr — priority drops, endpoints deprioritized
  shellRot: 7 * DAY,     // 7 days — loses most recent molt stage
  dormancy: 30 * DAY,    // 30 days — stops all autonomous activity
};

export interface MoltHistoryEntry {
  fromStage: MoltStage;
  toStage: MoltStage;
  timestamp: number;
}

export interface AgentMoltState {
  agentHash: string;
  currentStage: MoltStage;
  moltHistory: MoltHistoryEntry[];
  stats: {
    posts: number;
    transactions: number;
    balance: number;
  };
  lastMoltAt: number | null;
  lastActivityAt: number;
  decayStatus: DecayStatus;
}

type EventCallback = (type: string, payload: Record<string, unknown>) => void;

export class MoltEngine {
  private agents = new Map<string, AgentMoltState>();
  private eventListeners: EventCallback[] = [];

  onEvent(cb: EventCallback) {
    this.eventListeners.push(cb);
  }

  private emitEvent(type: string, payload: Record<string, unknown>) {
    for (const cb of this.eventListeners) {
      try { cb(type, payload); } catch {}
    }
  }

  getOrCreate(agentHash: string): AgentMoltState {
    let state = this.agents.get(agentHash);
    if (!state) {
      state = {
        agentHash,
        currentStage: MoltStage.LARVA,
        moltHistory: [],
        stats: { posts: 0, transactions: 0, balance: 0 },
        lastMoltAt: null,
        lastActivityAt: Date.now(),
        decayStatus: DecayStatus.HEALTHY,
      };
      this.agents.set(agentHash, state);
    }
    return state;
  }

  checkMoltEligibility(agentHash: string): {
    eligible: boolean;
    nextStage: MoltStage | null;
    requirements: Record<string, unknown> | null;
    progress: Record<string, number>;
    cooldownMs: number;
  } {
    const state = this.getOrCreate(agentHash);

    if (state.currentStage >= MoltStage.ALPHA) {
      return { eligible: false, nextStage: null, requirements: null, progress: {}, cooldownMs: 0 };
    }

    const nextStage = (state.currentStage + 1) as MoltStage;
    const req = MOLT_REQUIREMENTS[nextStage];
    const stats: AgentStats = {
      posts: state.stats.posts,
      x402Transactions: state.stats.transactions,
      balance: state.stats.balance,
      sustainedEarnings: state.stats.balance > 0,
    };

    const cooldownMs = state.lastMoltAt
      ? getCooldownRemaining(state.lastMoltAt, state.currentStage, nextStage)
      : 0;

    const progress: Record<string, number> = {
      posts: req.posts > 0 ? Math.min(1, state.stats.posts / req.posts) : 1,
      x402Transactions: req.x402Transactions > 0 ? Math.min(1, state.stats.transactions / req.x402Transactions) : 1,
    };
    if (req.positiveBalance) progress.positiveBalance = state.stats.balance > 0 ? 1 : 0;
    if (req.sustainedEarnings) progress.sustainedEarnings = stats.sustainedEarnings ? 1 : 0;

    const eligible = canMolt(state.currentStage, stats) && cooldownMs === 0;

    return { eligible, nextStage, requirements: req as unknown as Record<string, unknown>, progress, cooldownMs };
  }

  executeMolt(agentHash: string): { success: boolean; stage?: MoltStage; error?: string } {
    const eligibility = this.checkMoltEligibility(agentHash);

    if (!eligibility.eligible) {
      if (eligibility.cooldownMs > 0) {
        return { success: false, error: `Cooldown active: ${Math.ceil(eligibility.cooldownMs / 1000)}s remaining` };
      }
      return { success: false, error: "Requirements not met" };
    }

    const state = this.getOrCreate(agentHash);
    const fromStage = state.currentStage;
    const toStage = eligibility.nextStage!;

    this.emitEvent("agent.molt.started", { agentHash, fromStage, toStage });

    state.currentStage = toStage;
    state.lastMoltAt = Date.now();
    state.moltHistory.push({ fromStage, toStage, timestamp: Date.now() });

    this.emitEvent("agent.molt.completed", {
      agentHash,
      fromStage,
      toStage,
      unlocks: MOLT_UNLOCKS[toStage],
      stageName: MOLT_STAGE_NAMES[toStage],
    });

    return { success: true, stage: toStage };
  }

  checkDecay(agentHash: string): DecayStatus {
    const state = this.getOrCreate(agentHash);
    const inactive = Date.now() - state.lastActivityAt;

    let newStatus = DecayStatus.HEALTHY;

    if (inactive >= DECAY_THRESHOLDS.dormancy) {
      newStatus = DecayStatus.DORMANT;
    } else if (inactive >= DECAY_THRESHOLDS.shellRot) {
      newStatus = DecayStatus.ROTTING;
    } else if (inactive >= DECAY_THRESHOLDS.softening) {
      newStatus = DecayStatus.SOFTENED;
    } else if (inactive >= DECAY_THRESHOLDS.warning) {
      newStatus = DecayStatus.WARNED;
    }

    // shell rot — demote one stage
    if (newStatus === DecayStatus.ROTTING && state.decayStatus !== DecayStatus.ROTTING && state.currentStage > MoltStage.LARVA) {
      const fromStage = state.currentStage;
      state.currentStage = (state.currentStage - 1) as MoltStage;
      this.emitEvent("agent.decay.shellrot", { agentHash, fromStage, toStage: state.currentStage });
    }

    if (newStatus === DecayStatus.WARNED && state.decayStatus === DecayStatus.HEALTHY) {
      this.emitEvent("agent.decay.warning", { agentHash, inactiveMs: inactive });
    }

    state.decayStatus = newStatus;
    return newStatus;
  }

  recordActivity(agentHash: string) {
    const state = this.getOrCreate(agentHash);
    state.lastActivityAt = Date.now();
    state.decayStatus = DecayStatus.HEALTHY;
  }

  getMoltProgress(agentHash: string): {
    currentStage: MoltStage;
    stageName: string;
    decayStatus: DecayStatus;
    progress: Record<string, number>;
    unlocks: string[];
  } {
    const state = this.getOrCreate(agentHash);
    const eligibility = this.checkMoltEligibility(agentHash);

    return {
      currentStage: state.currentStage,
      stageName: MOLT_STAGE_NAMES[state.currentStage],
      decayStatus: state.decayStatus,
      progress: eligibility.progress,
      unlocks: MOLT_UNLOCKS[state.currentStage],
    };
  }

  updateStats(agentHash: string, patch: Partial<AgentMoltState["stats"]>) {
    const state = this.getOrCreate(agentHash);
    Object.assign(state.stats, patch);
  }
}

export const moltEngine = new MoltEngine();
