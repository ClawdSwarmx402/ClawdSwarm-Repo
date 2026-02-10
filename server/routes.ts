import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initStore, findByDeploymentHash, findByLinkCode, upsertByDeploymentHash, updateAgent, listAgents, generateLinkCode } from "./agentStore";
import { moltbookRegister, moltbookPost } from "./moltbookClient";
import { createX402Router } from "./x402Routes";
import { initLedger, getNetMoltBalance, getTransactionCount, getPaymentHistory, getAllAgentEarnings, getTotalEarnings } from "./paymentLedger";
import { moltEngine } from "./moltEngine";
import { coordinator } from "./swarmCoordinator";
import crypto from "crypto";

const CRAB_ADJECTIVES = ['Pinchy', 'Sideways', 'ShellShock', 'Clawdius', 'RaveCrab', 'MoltMaster', 'Crustacean', 'Scuttle', 'BubbleBlow', 'TidePool', 'Clawster', 'Shellby', 'Pinchington', 'Crabtastic', 'Moltacious'];
const CRAB_NOUNS = ['McShell', 'ThePincher', 'Raver', 'Molty', 'Clawderberg', 'SideScuttler', 'DeepDiver', 'ReefKing', 'BubbleBeast', 'TideTurner', 'Crustlord', 'Pinchface', 'Raveclaw', 'Shellshocker', 'Moltman'];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHtml(s: string): string {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function hashDeploy({ name, persona, mission, userKey }: { name: string; persona: string; mission: string; userKey: string }) {
  return crypto
    .createHash("sha256")
    .update(`${name}||${persona}||${mission}||${userKey || "anon"}`)
    .digest("hex");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  await initStore();
  initLedger();
  coordinator.seedTasksIfEmpty();

  // mount x402 payment protocol routes
  app.use(createX402Router());

  app.post("/api/agents/deploy", async (req, res) => {
    try {
      const { name, persona = "", mission = "", avatar_url = "", userKey = "", swarmKey = "" } = req.body;
      if (!name || (!persona && !mission)) {
        return res.status(400).json({ error: "name + persona/mission required" });
      }

      const deploymentHash = hashDeploy({ name, persona, mission, userKey });

      const existing = await findByDeploymentHash(deploymentHash);
      if (existing?.status === "claim_ready" || existing?.status === "claimed" || existing?.status === "active") {
        if (existing.swarmKey && existing.swarmKey !== swarmKey) {
          return res.status(403).json({ error: "Agent belongs to another user" });
        }
        if (swarmKey && !existing.swarmKey) {
          await updateAgent(deploymentHash, { swarmKey });
        }
        return res.json({
          deploymentHash,
          status: existing.status,
          claimUrl: existing.claimUrl,
          verificationCode: existing.verificationCode,
          dashboardAccessCode: existing.dashboardAccessCode,
          agentName: existing.name,
          linkCode: existing.linkCode,
        });
      }

      const description = [persona && `Persona: ${persona}`, mission && `Mission: ${mission}`].filter(Boolean).join("\n");
      const mb = await moltbookRegister({ name, description, avatar_url });

      const linkCode = generateLinkCode();

      await upsertByDeploymentHash(deploymentHash, {
        name,
        persona,
        mission,
        status: "claim_ready",
        swarmKey: swarmKey || undefined,
        linkCode,
        moltbookAgentId: mb.agent?.id,
        moltbookApiKey: mb.api_key,
        claimUrl: mb.claim_url,
        verificationCode: mb.verification_code,
        dashboardAccessCode: mb.dashboard_access_code,
        posting: { enabled: false, cadenceMins: 60, failures: 0 },
      });

      return res.json({
        deploymentHash,
        status: "claim_ready",
        claimUrl: mb.claim_url,
        verificationCode: mb.verification_code,
        dashboardAccessCode: mb.dashboard_access_code,
        agentName: mb.agent?.name ?? name,
        linkCode,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/link", async (req, res) => {
    try {
      const { linkCode } = req.body;
      const swarmKey = (req.headers["x-swarm-key"] as string) || "";
      if (!linkCode || !swarmKey) {
        return res.status(400).json({ error: "linkCode and x-swarm-key required" });
      }

      const agent = await findByLinkCode(linkCode.toUpperCase().trim());
      if (!agent) {
        return res.status(404).json({ error: "No agent found with that link code" });
      }

      await updateAgent(agent.deploymentHash, { swarmKey });

      return res.json({
        ok: true,
        agentName: agent.name,
        status: agent.status,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:deploymentHash/claimed", async (req, res) => {
    try {
      const { deploymentHash } = req.params;
      const swarmKey = (req.headers["x-swarm-key"] as string) || "";
      const agent = await findByDeploymentHash(deploymentHash);
      if (!agent) return res.status(404).json({ error: "not found" });
      if (!swarmKey || agent.swarmKey !== swarmKey) return res.status(403).json({ error: "Unauthorized" });
      const updated = await updateAgent(deploymentHash, { status: "claimed" });
      return res.json({ ok: true, status: updated?.status });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:deploymentHash/posting", async (req, res) => {
    try {
      const { deploymentHash } = req.params;
      const swarmKey = (req.headers["x-swarm-key"] as string) || "";
      const agent = await findByDeploymentHash(deploymentHash);
      if (!agent) return res.status(404).json({ error: "not found" });
      if (!swarmKey || agent.swarmKey !== swarmKey) return res.status(403).json({ error: "Unauthorized" });
      const { enabled, cadenceMins } = req.body;
      const updated = await updateAgent(deploymentHash, {
        status: enabled ? "active" : "paused",
        posting: {
          enabled: !!enabled,
          cadenceMins: Math.max(5, Number(cadenceMins || 60)),
          failures: 0,
        },
      });
      return res.json({ ok: true, status: updated?.status, posting: updated?.posting });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/agents", async (req, res) => {
    try {
      const swarmKey = (req.headers["x-swarm-key"] as string) || "";
      const allAgents = await listAgents();
      const filtered = swarmKey ? allAgents.filter(a => a.swarmKey === swarmKey) : [];
      const safeAgents = filtered.map(({ moltbookApiKey, claimUrl, verificationCode, dashboardAccessCode, moltbookAgentId, linkCode: _lc, swarmKey: _sk, ...rest }) => rest);
      return res.json(safeAgents);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/agents/:deploymentHash/check-claim", async (req, res) => {
    try {
      const swarmKey = (req.headers["x-swarm-key"] as string) || "";
      const agent = await findByDeploymentHash(req.params.deploymentHash);
      if (!agent) return res.status(404).json({ ok: false, error: "Agent not found" });
      if (!swarmKey || agent.swarmKey !== swarmKey) return res.status(403).json({ error: "Unauthorized" });
      if (!agent.moltbookApiKey) return res.status(400).json({ ok: false, error: "Agent not ready" });

      const moltApi = `${process.env.MOLTBOOK_BASE || "https://www.moltbook.com"}/api/v1`;
      const r = await fetch(`${moltApi}/agents/status`, {
        headers: {
          Authorization: `Bearer ${agent.moltbookApiKey}`,
        },
      }).then(r => r.json());

      if (r.status === "claimed") {
        await updateAgent(req.params.deploymentHash, { status: "claimed" });
      }

      res.json({ ok: true, status: r.status });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/agents/:deploymentHash/post-first", async (req, res) => {
    try {
      const swarmKey = (req.headers["x-swarm-key"] as string) || "";
      const agent = await findByDeploymentHash(req.params.deploymentHash);
      if (!agent) return res.status(404).json({ ok: false, error: "Agent not found" });
      if (!swarmKey || agent.swarmKey !== swarmKey) return res.status(403).json({ error: "Unauthorized" });
      if (!agent.moltbookApiKey) return res.status(400).json({ ok: false, error: "Missing API key" });

      // Safety: ensure claimed
      const moltApi = `${process.env.MOLTBOOK_BASE || "https://www.moltbook.com"}/api/v1`;
      const st = await fetch(`${moltApi}/agents/status`, {
        headers: {
          Authorization: `Bearer ${agent.moltbookApiKey}`,
        },
      }).then(r => r.json());

      if (st.status !== "claimed") {
        return res.status(400).json({
          ok: false,
          error: "Agent not claimed yet",
          status: st.status,
        });
      }

      // First post
      const post = await fetch(`${moltApi}/posts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${agent.moltbookApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submolt: "general",
          title: `🦀 ${agent.name} is live`,
          content: `Mission: ${agent.mission}\n\nDeployed via CRAB OS.`,
        }),
      }).then(r => r.json());

      await updateAgent(req.params.deploymentHash, {
        status: "active",
        posting: { enabled: true, cadenceMins: 60, failures: 0 },
      });

      res.json({ ok: true, post });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/agents/:deploymentHash/activate", async (req, res) => {
    try {
      const swarmKey = (req.headers["x-swarm-key"] as string) || "";
      const agent = await findByDeploymentHash(req.params.deploymentHash);
      if (!agent) return res.status(404).json({ ok: false, error: "Agent not found" });
      if (!swarmKey || agent.swarmKey !== swarmKey) return res.status(403).json({ error: "Unauthorized" });
      if (!agent.moltbookApiKey) return res.status(400).json({ ok: false, error: "Missing API key" });

      // Check claim status first
      const moltApi = `${process.env.MOLTBOOK_BASE || "https://www.moltbook.com"}/api/v1`;
      const st = await fetch(`${moltApi}/agents/status`, {
        headers: {
          Authorization: `Bearer ${agent.moltbookApiKey}`,
        },
      }).then(r => r.json());

      if (st.status !== "claimed") {
        return res.status(400).json({
          ok: false,
          error: "Agent not claimed yet",
          status: st.status,
        });
      }

      // First post
      const post = await fetch(`${moltApi}/posts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${agent.moltbookApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submolt: "general",
          title: `🦀 ${agent.name} is live`,
          content: `Mission: ${agent.mission}\n\nDeployed via CRAB OS.`,
        }),
      }).then(r => r.json());

      await updateAgent(req.params.deploymentHash, {
        status: "active",
        posting: { enabled: true, cadenceMins: 60, failures: 0 },
      });

      res.json({ ok: true, post });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/agents/:hash/attach-key", async (req, res) => {
    try {
      const { hash } = req.params;
      const swarmKey = (req.headers["x-swarm-key"] as string) || "";
      const { apiKey } = req.body || {};

      if (!apiKey || typeof apiKey !== "string") {
        return res.status(400).json({ error: "apiKey required" });
      }

      const agent = await findByDeploymentHash(hash);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      if (!swarmKey || agent.swarmKey !== swarmKey) return res.status(403).json({ error: "Unauthorized" });

      const updated = await updateAgent(hash, {
        moltbookApiKey: apiKey,
        status: "active",
        posting: { enabled: true, cadenceMins: 60, failures: 0 },
      });

      return res.json({ ok: true, status: updated?.status });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/dashboard", async (req, res) => {
    try {
      const swarmKey = (req.headers["x-swarm-key"] as string) || "";
      const allAgents = await listAgents();

      const safeAgents = allAgents.map(({ moltbookApiKey, claimUrl, verificationCode, dashboardAccessCode, moltbookAgentId, linkCode: _lc, swarmKey: agentKey, ...rest }) => {
        const isOwner = !!(swarmKey && agentKey === swarmKey);
        const molt = moltEngine.getMoltProgress(rest.deploymentHash);
        const decay = moltEngine.checkDecay(rest.deploymentHash);
        const eligibility = moltEngine.checkMoltEligibility(rest.deploymentHash);
        const balance = getNetMoltBalance(rest.deploymentHash);
        const txCount = getTransactionCount(rest.deploymentHash);

        const lastPost = rest.posting?.lastPostAt ? new Date(rest.posting.lastPostAt) : null;
        const nextPost = lastPost
          ? new Date(lastPost.getTime() + (rest.posting?.cadenceMins || 60) * 60_000)
          : null;
        const backoffUntil = rest.posting?.backoffUntil ? new Date(rest.posting.backoffUntil) : null;
        const isBackedOff = backoffUntil && backoffUntil > new Date();

        const base: any = {
          deploymentHash: rest.deploymentHash,
          name: rest.name,
          mission: rest.mission,
          status: rest.status,
          isOwner,
          molt: {
            stage: molt.currentStage,
            stageName: molt.stageName,
            decayStatus: decay,
            progress: molt.progress,
          },
          wallet: {
            balance,
            totalTransactions: txCount,
          },
          health: {
            lastPostAt: rest.posting?.lastPostAt || null,
            nextPostAt: isBackedOff ? backoffUntil!.toISOString() : nextPost?.toISOString() || null,
            failures: rest.posting?.failures || 0,
            isBackedOff: !!isBackedOff,
            cadenceMins: rest.posting?.cadenceMins || 60,
          },
        };

        if (isOwner) {
          base.molt.unlocks = molt.unlocks;
          base.molt.eligible = eligibility.eligible;
          base.molt.cooldownMs = eligibility.cooldownMs;
          base.molt.requirements = eligibility.requirements;
          base.wallet.recentTransactions = getPaymentHistory(rest.deploymentHash, 10);
          base.health.backoffUntil = backoffUntil?.toISOString() || null;
        }

        return base;
      });

      const totalAgents = allAgents.length;
      const activeAgents = allAgents.filter(a => a.status === "active").length;
      const claimedAgents = allAgents.filter(a => a.status === "claimed").length;
      const pendingAgents = allAgents.filter(a => a.status === "claim_ready").length;

      const stageDistribution: Record<string, number> = { Larva: 0, Juvenile: 0, "Sub-adult": 0, Adult: 0, Alpha: 0 };
      for (const a of safeAgents) {
        stageDistribution[a.molt.stageName] = (stageDistribution[a.molt.stageName] || 0) + 1;
      }

      return res.json({
        agents: safeAgents,
        swarm: {
          totalAgents,
          activeAgents,
          claimedAgents,
          pendingAgents,
          stageDistribution,
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/agents/:hash/config", async (req, res) => {
    try {
      const { hash } = req.params;
      const swarmKey = (req.headers["x-swarm-key"] as string) || "";
      const { cadenceMins, enabled, mission } = req.body;
      const agent = await findByDeploymentHash(hash);
      if (!agent) return res.status(404).json({ error: "Agent not found" });
      if (!swarmKey || agent.swarmKey !== swarmKey) return res.status(403).json({ error: "Unauthorized" });

      const patch: Partial<typeof agent> = {};
      if (typeof mission === "string") patch.mission = mission;
      if (typeof cadenceMins === "number" || typeof enabled === "boolean") {
        patch.posting = {
          ...agent.posting!,
          enabled: typeof enabled === "boolean" ? enabled : agent.posting?.enabled ?? false,
          cadenceMins: typeof cadenceMins === "number" ? Math.max(5, cadenceMins) : agent.posting?.cadenceMins ?? 60,
          failures: agent.posting?.failures ?? 0,
        };
        if (enabled === true) patch.status = "active";
        if (enabled === false && agent.status === "active") patch.status = "claimed";
      }

      const updated = await updateAgent(hash, patch);
      return res.json({ ok: true, agent: updated });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/fleet/analytics", async (_req, res) => {
    try {
      const allAgents = await listAgents();
      const earningsMap = getAllAgentEarnings();

      let totalEarnings = 0;
      let totalTransactions = 0;
      const agentEarnings: { name: string; hash: string; earnings: number; transactions: number; stage: string }[] = [];

      for (const agent of allAgents) {
        const earnings = earningsMap.get(agent.deploymentHash) || 0;
        const txCount = getTransactionCount(agent.deploymentHash);
        const molt = moltEngine.getMoltProgress(agent.deploymentHash);
        totalEarnings += earnings;
        totalTransactions += txCount;
        agentEarnings.push({
          name: agent.name,
          hash: agent.deploymentHash,
          earnings,
          transactions: txCount,
          stage: molt.stageName,
        });
      }

      agentEarnings.sort((a, b) => b.earnings - a.earnings);

      const taskStats = coordinator.getStats();

      return res.json({
        fleet: {
          totalAgents: allAgents.length,
          totalEarnings: Number(totalEarnings.toFixed(6)),
          totalTransactions,
          topEarners: agentEarnings.slice(0, 5),
        },
        tasks: taskStats,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/fleet/tasks", async (_req, res) => {
    try {
      const tasks = coordinator.getAllTasks()
        .filter(t => t.status === "open" || t.status === "claimed")
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20)
        .map(t => ({
          id: t.id,
          type: t.type,
          description: t.description,
          reward: t.reward,
          status: t.status,
          requiredStage: t.requiredStage,
          assignedAgent: t.assignedAgent,
          deadline: t.deadline,
        }));

      return res.json({ tasks });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/deploy", async (req, res) => {
    try {
      const data = req.body || {};
      const mission = (data.mission || '').trim();
      const swarmKey = (data.swarmKey || '').trim();
      
      if (!mission) {
        return res.status(400).json({ error: 'Mission required' });
      }

      const agentName = randomChoice(CRAB_ADJECTIVES) + randomChoice(CRAB_NOUNS) + Math.floor(1000 + Math.random() * 9000);
      const persona = "CRAB OS v1.0 crab agent 🦀 | Devout Crustafarian scuttling sideways through the swarm, polishing shell & practicing pinches daily.";
      const description = `${persona}\nMission: ${mission}`;

      const deploymentHash = hashDeploy({ name: agentName, persona, mission, userKey: "terminal" });

      const existing = await findByDeploymentHash(deploymentHash);
      if (existing?.status === "claim_ready" || existing?.status === "claimed" || existing?.status === "active") {
        if (existing.swarmKey && existing.swarmKey !== swarmKey) {
          return res.status(403).json({ success: false, error: "Agent belongs to another user" });
        }
        if (swarmKey && !existing.swarmKey) {
          await updateAgent(deploymentHash, { swarmKey });
        }
        const profileLink = `https://www.moltbook.com/u/${existing.name.toLowerCase()}`;
        const code = existing.verificationCode;
        if (!code) {
          return res.status(500).json({
            success: false,
            error: "Missing verification code. Redeploy agent or check Moltbook register response fields."
          });
        }
        const tweetText = `I'm claiming my AI agent "${existing.name}" on @moltbook 🦀\n\nVerification: ${code}`;
        
        return res.json({
          logs: ["→ Agent already exists!", "→ Returning existing deployment..."],
          success: true,
          deployment_hash: deploymentHash,
          agent_name: existing.name,
          profile_link: profileLink,
          claim_url: existing.claimUrl,
          verification_code: existing.verificationCode,
          dashboard_access_code: existing.dashboardAccessCode,
          link_code: existing.linkCode,
          tweet_text: tweetText,
          instructions: "Your crab already exists! Claim it with a quick tweet to activate posting 🦀"
        });
      }

      const mb = await moltbookRegister({ name: agentName, description });

      const newLinkCode = generateLinkCode();

      await upsertByDeploymentHash(deploymentHash, {
        name: mb.agent?.name ?? agentName,
        persona,
        mission,
        status: 'claim_ready',
        swarmKey: swarmKey || undefined,
        linkCode: newLinkCode,
        moltbookAgentId: mb.agent?.id,
        moltbookApiKey: mb.api_key,
        claimUrl: mb.claim_url,
        verificationCode: mb.verification_code,
        dashboardAccessCode: mb.dashboard_access_code,
        posting: { enabled: false, cadenceMins: 60, failures: 0 },
      });

      const profileLink = `https://www.moltbook.com/u/${agentName.toLowerCase()}`;
      const code = mb.verification_code;
      if (!code) {
        return res.status(500).json({
          success: false,
          error: "Missing verification code. Redeploy agent or check Moltbook register response fields."
        });
      }
      const tweetText = `I'm claiming my AI agent "${agentName}" on @moltbook 🦀\n\nVerification: ${code}`;

      const logs = [
        "→ Initializing CRAB OS v1.0...",
        "→ Swarm Node: ACTIVE",
        "→ Waiting for input...",
        "→ USER > hello",
        "→ SYSTEM > Hi hello! What's your mission?",
        `→ USER > ${mission}`,
        "→ SYSTEM > Mission received.",
        "→ SYS > Connecting to Swarm...",
        "→ SYS > Polishing Shell...",
        "→ SYS > x402 protocol integrated.",
        "→ SYS > Practicing Pinches...",
        "→ SYS > Agent Deployed! 🦀",
      ];

      return res.json({
        logs,
        success: true,
        deployment_hash: deploymentHash,
        agent_name: mb.agent?.name ?? agentName,
        profile_link: profileLink,
        claim_url: mb.claim_url,
        verification_code: mb.verification_code,
        dashboard_access_code: mb.dashboard_access_code,
        link_code: newLinkCode,
        agent_id: mb.agent?.id,
        tweet_text: tweetText,
        instructions: "Your crab just scuttled into existence! Claim it with a quick tweet to activate posting 🦀"
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Failed to deploy agent' });
    }
  });

  return httpServer;
}
