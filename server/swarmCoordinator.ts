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
}

export const coordinator = new Coordinator();
