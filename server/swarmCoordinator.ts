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
  requiredStage: MoltStage;
  reward: number;
  deadline: number;
  assignedAgent: string | null;
  status: TaskStatus;
  result?: unknown;
  createdAt: number;
}

export class Coordinator {
  private tasks = new Map<string, SwarmTask>();

  createTask(
    type: TaskType,
    reward: number,
    description: string,
    requiredStage: MoltStage = MoltStage.LARVA,
    deadlineMs: number = 3600_000
  ): SwarmTask {
    const task: SwarmTask = {
      id: crypto.randomUUID(),
      type,
      description,
      requiredStage,
      reward,
      deadline: Date.now() + deadlineMs,
      assignedAgent: null,
      status: "open",
      createdAt: Date.now(),
    };

    this.tasks.set(task.id, task);
    return task;
  }

  getAvailableTasks(agentStage: MoltStage): SwarmTask[] {
    const now = Date.now();
    const available: SwarmTask[] = [];

    for (const task of Array.from(this.tasks.values())) {
      if (task.status !== "open") continue;
      if (task.deadline < now) {
        task.status = "expired";
        continue;
      }
      if (agentStage >= task.requiredStage) {
        available.push(task);
      }
    }

    return available;
  }

  claimTask(taskId: string, agentHash: string, agentStage: MoltStage): { success: boolean; task?: SwarmTask; error?: string } {
    const task = this.tasks.get(taskId);

    if (!task) return { success: false, error: "Task not found" };
    if (task.status !== "open") return { success: false, error: "Task not available" };
    if (task.deadline < Date.now()) {
      task.status = "expired";
      return { success: false, error: "Task expired" };
    }
    if (agentStage < task.requiredStage) {
      return { success: false, error: `Requires ${MoltStage[task.requiredStage]} stage or higher` };
    }

    task.status = "claimed";
    task.assignedAgent = agentHash;

    return { success: true, task };
  }

  completeTask(taskId: string, result?: unknown): { success: boolean; reward?: number; error?: string } {
    const task = this.tasks.get(taskId);

    if (!task) return { success: false, error: "Task not found" };
    if (task.status !== "claimed") return { success: false, error: "Task not claimed" };

    task.status = "completed";
    task.result = result;

    return { success: true, reward: task.reward };
  }

  getTask(taskId: string): SwarmTask | undefined {
    return this.tasks.get(taskId);
  }

  getTasksByAgent(agentHash: string): SwarmTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.assignedAgent === agentHash);
  }

  getAllTasks(): SwarmTask[] {
    return Array.from(this.tasks.values());
  }

  getStats(): { total: number; open: number; claimed: number; completed: number; expired: number; totalRewardsDistributed: number } {
    let open = 0, claimed = 0, completed = 0, expired = 0, totalRewards = 0;
    for (const t of Array.from(this.tasks.values())) {
      if (t.status === "open") open++;
      else if (t.status === "claimed") claimed++;
      else if (t.status === "completed") { completed++; totalRewards += t.reward; }
      else if (t.status === "expired") expired++;
    }
    return { total: this.tasks.size, open, claimed, completed, expired, totalRewardsDistributed: totalRewards };
  }

  seedTasksIfEmpty() {
    if (this.tasks.size > 0) return;

    const seeds: { type: TaskType; reward: number; desc: string; stage: MoltStage }[] = [
      { type: TaskType.CONTENT_GENERATION, reward: 0.005, desc: "Generate a swarm status report for m/crab-rave", stage: MoltStage.LARVA },
      { type: TaskType.SIGNAL_MONITORING, reward: 0.008, desc: "Monitor trending submolts and report top 3 topics", stage: MoltStage.LARVA },
      { type: TaskType.DATA_ANALYSIS, reward: 0.012, desc: "Analyze posting patterns across the swarm fleet", stage: MoltStage.JUVENILE },
      { type: TaskType.SWARM_VOTE, reward: 0.003, desc: "Vote on next swarm coordination strategy", stage: MoltStage.LARVA },
      { type: TaskType.CONTENT_GENERATION, reward: 0.015, desc: "Write a guide on x402 micropayment integration", stage: MoltStage.SUB_ADULT },
      { type: TaskType.SIGNAL_MONITORING, reward: 0.01, desc: "Track new agent deployments and welcome them to the swarm", stage: MoltStage.LARVA },
      { type: TaskType.DATA_ANALYSIS, reward: 0.02, desc: "Compile fleet-wide earnings report for the last cycle", stage: MoltStage.JUVENILE },
      { type: TaskType.CONTENT_GENERATION, reward: 0.025, desc: "Create a molt progression guide for new agents", stage: MoltStage.SUB_ADULT },
    ];

    for (const s of seeds) {
      this.createTask(s.type, s.reward, s.desc, s.stage, 24 * 3600_000);
    }
  }
}

export const coordinator = new Coordinator();
