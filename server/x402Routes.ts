import { Router, type Request, type Response } from "express";
import { SwarmError, X402_VERSION, SUPPORTED_METHODS } from "@shared/x402";
import { MoltStage } from "@shared/moltTiers";
import { x402Gate, swarmErrorHandler } from "./x402Handler";
import { getNetMoltBalance, getTransactionCount, getPaymentHistory, recordTransaction } from "./paymentLedger";
import { moltEngine } from "./moltEngine";
import { coordinator } from "./swarmCoordinator";

export function createX402Router(): Router {
  const router = Router();

  // x402 protocol info
  router.get("/api/x402/info", (_req: Request, res: Response) => {
    res.json({
      version: X402_VERSION,
      methods: [...SUPPORTED_METHODS],
      networks: ["base-sepolia", "base-mainnet"],
    });
  });

  // agent wallet summary
  router.get("/api/agents/:hash/wallet", (req: Request, res: Response) => {
    const hash = String(req.params.hash);
    const balance = getNetMoltBalance(hash);
    const transactions = getTransactionCount(hash);
    const progress = moltEngine.getMoltProgress(hash);
    const history = getPaymentHistory(hash, 20);

    res.json({
      agentHash: hash,
      balance,
      totalTransactions: transactions,
      stage: progress.currentStage,
      stageName: progress.stageName,
      moltProgress: progress.progress,
      recentTransactions: history,
    });
  });

  // attempt a molt upgrade
  router.post("/api/agents/:hash/molt", (req: Request, res: Response) => {
    const hash = String(req.params.hash);

    const txCount = getTransactionCount(hash);
    const balance = getNetMoltBalance(hash);
    moltEngine.updateStats(hash, { transactions: txCount, balance });

    const result = moltEngine.executeMolt(hash);

    if (!result.success) {
      throw new SwarmError(409, result.error);
    }

    res.json({
      success: true,
      newStage: result.stage,
      message: `Molt complete — welcome to ${MoltStage[result.stage!]} stage`,
    });
  });

  // detailed molt status and decay info
  router.get("/api/agents/:hash/molt-status", (req: Request, res: Response) => {
    const hash = String(req.params.hash);

    const decay = moltEngine.checkDecay(hash);
    const progress = moltEngine.getMoltProgress(hash);
    const eligibility = moltEngine.checkMoltEligibility(hash);

    res.json({
      agentHash: hash,
      ...progress,
      decayStatus: decay,
      eligible: eligibility.eligible,
      cooldownMs: eligibility.cooldownMs,
      requirements: eligibility.requirements,
    });
  });

  // list available swarm tasks
  router.get("/api/swarm/tasks", (req: Request, res: Response) => {
    const stageParam = Number(req.query.stage ?? MoltStage.LARVA);
    const stage = (stageParam >= 0 && stageParam <= 4 ? stageParam : MoltStage.LARVA) as MoltStage;
    const tasks = coordinator.getAvailableTasks(stage);
    res.json({ tasks });
  });

  // claim a swarm task
  router.post("/api/swarm/tasks/:id/claim", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { agentHash, stage } = req.body;

    if (!agentHash) throw new SwarmError(400, "agentHash required");

    const agentStage = (typeof stage === "number" ? stage : MoltStage.LARVA) as MoltStage;
    const result = coordinator.claimTask(id, agentHash, agentStage);

    if (!result.success) {
      throw new SwarmError(409, result.error);
    }

    moltEngine.recordActivity(agentHash);
    res.json({ success: true, task: result.task });
  });

  // complete a swarm task and earn reward
  router.post("/api/swarm/tasks/:id/complete", (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { result: taskResult } = req.body;

    const task = coordinator.getTask(id);
    if (!task) throw new SwarmError(404, "Task not found");
    if (!task.assignedAgent) throw new SwarmError(409, "Task not claimed");

    const completion = coordinator.completeTask(id, taskResult);
    if (!completion.success) {
      throw new SwarmError(409, completion.error);
    }

    // credit the reward
    recordTransaction(task.assignedAgent, completion.reward!, "inbound", `task:${id}`);
    moltEngine.recordActivity(task.assignedAgent);

    res.json({
      success: true,
      reward: completion.reward,
      message: "Task completed, reward credited",
    });
  });

  // sample x402-gated endpoint
  router.get(
    "/api/x402/premium-data",
    x402Gate({
      price: "0.001",
      address: "0x0000000000000000000000000000000000000000",
      resource: "/api/x402/premium-data",
      description: "Premium swarm intelligence data feed",
    }),
    (_req: Request, res: Response) => {
      res.json({
        data: "Premium swarm data payload",
        timestamp: Date.now(),
      });
    }
  );

  // wire up themed error handling
  router.use(swarmErrorHandler);

  return router;
}
