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

  // TODO: build out full stats aggregation — need to include reward distribution totals
  // and per-type breakdowns for the fleet analytics panel
  getStats(): { total: number; open: number; claimed: number; completed: number } {
    let open = 0, claimed = 0, completed = 0;
    for (const t of Array.from(this.tasks.values())) {
      if (t.status === "open") open++;
      else if (t.status === "claimed") claimed++;
      else if (t.status === "completed") completed++;
    }
    return { total: this.tasks.size, open, claimed, completed };
  }

  // TODO: seed initial tasks on startup — content generation, signal monitoring,
  // data analysis, swarm votes with appropriate stage gates and reward tiers
}

export const coordinator = new Coordinator();
