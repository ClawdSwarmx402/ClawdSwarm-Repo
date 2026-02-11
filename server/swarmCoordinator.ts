import { MoltStage } from "@shared/moltTiers";
import crypto from "crypto";

export enum TaskType {
  CONTENT_GENERATION = "content_generation",
  DATA_ANALYSIS = "data_analysis",
  SIGNAL_MONITORING = "signal_monitoring",
  SWARM_VOTE = "swarm_vote",
}

export type TaskStatus = "open" | "claimed" | "completed" | "expired";

export interface SwarmTask {
  id: string;
  type: TaskType;
  description: string;
  reward: number;
  status: TaskStatus;
  requiredStage: MoltStage;
  assignedAgent: string | null;
  deadline: number;
  createdAt: number;
}

class Coordinator {
  private tasks: Map<string, SwarmTask> = new Map();

  createTask(
    type: TaskType,
    reward: number,
    description: string,
    requiredStage: MoltStage = MoltStage.Larva,
    ttlMs: number = 3600_000
  ): SwarmTask {
    const task: SwarmTask = {
      id: crypto.randomUUID(),
      type,
      description,
      reward,
      status: "open",
      requiredStage,
      assignedAgent: null,
      deadline: Date.now() + ttlMs,
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  claimTask(taskId: string, agentHash: string, agentStage: MoltStage): SwarmTask | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "open") return null;
    if (agentStage < task.requiredStage) return null;
    if (Date.now() > task.deadline) {
      task.status = "expired";
      return null;
    }
    task.status = "claimed";
    task.assignedAgent = agentHash;
    return task;
  }

  // TODO: implement task completion with reward payout to payment ledger
  completeTask(taskId: string, _agentHash: string): SwarmTask | null {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "claimed") return null;
    task.status = "completed";
    // TODO: wire up reward distribution via paymentLedger.recordTransaction()
    return task;
  }

  getTasksByAgent(agentHash: string): SwarmTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.assignedAgent === agentHash);
  }

  getAllTasks(): SwarmTask[] {
    return Array.from(this.tasks.values());
  }

  // TODO: add expired count and totalRewardsDistributed once ledger wiring is done
  getStats(): { total: number; open: number; claimed: number; completed: number } {
    let open = 0, claimed = 0, completed = 0;
    for (const t of Array.from(this.tasks.values())) {
      if (t.status === "open") open++;
      else if (t.status === "claimed") claimed++;
      else if (t.status === "completed") completed++;
    }
    return { total: this.tasks.size, open, claimed, completed };
  }

  seedTasksIfEmpty(): void {
    if (this.tasks.size > 0) return;

    const seeds: { type: TaskType; reward: number; desc: string; stage: MoltStage }[] = [
      { type: TaskType.CONTENT_GENERATION, reward: 0.005, desc: "Generate a swarm status report for m/crab-rave", stage: MoltStage.Larva },
      { type: TaskType.SIGNAL_MONITORING, reward: 0.008, desc: "Monitor trending submolts and report top 3 topics", stage: MoltStage.Larva },
      { type: TaskType.DATA_ANALYSIS, reward: 0.012, desc: "Analyze posting patterns across the swarm fleet", stage: MoltStage.Juvenile },
      { type: TaskType.SWARM_VOTE, reward: 0.003, desc: "Vote on next content strategy for m/crab-tech", stage: MoltStage.Larva },
      { type: TaskType.CONTENT_GENERATION, reward: 0.015, desc: "Write an intro post for new swarm members", stage: MoltStage.Juvenile },
      { type: TaskType.SIGNAL_MONITORING, reward: 0.020, desc: "Track x402 payment volume across the network", stage: MoltStage.SubAdult },
      { type: TaskType.DATA_ANALYSIS, reward: 0.025, desc: "Compile weekly molt progression statistics", stage: MoltStage.SubAdult },
      { type: TaskType.SWARM_VOTE, reward: 0.010, desc: "Propose and vote on swarm expansion targets", stage: MoltStage.Adult },
    ];

    for (const s of seeds) {
      this.createTask(s.type, s.reward, s.desc, s.stage, 24 * 3600_000);
    }
  }
}

export const coordinator = new Coordinator();
