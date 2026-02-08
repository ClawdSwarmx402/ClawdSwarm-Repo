import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initStore, findByDeploymentHash, upsertByDeploymentHash, updateAgent, listAgents } from "./agentStore";
import { moltbookRegister, moltbookPost } from "./moltbookClient";
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

  app.post("/api/agents/deploy", async (req, res) => {
    try {
      const { name, persona = "", mission = "", avatar_url = "", userKey = "" } = req.body;
      if (!name || (!persona && !mission)) {
        return res.status(400).json({ error: "name + persona/mission required" });
      }

      const deploymentHash = hashDeploy({ name, persona, mission, userKey });

      const existing = await findByDeploymentHash(deploymentHash);
      if (existing?.status === "claim_ready" || existing?.status === "claimed" || existing?.status === "active") {
        return res.json({
          deploymentHash,
          status: existing.status,
          claimUrl: existing.claimUrl,
          verificationCode: existing.verificationCode,
          dashboardAccessCode: existing.dashboardAccessCode,
          agentName: existing.name,
        });
      }

      const description = [persona && `Persona: ${persona}`, mission && `Mission: ${mission}`].filter(Boolean).join("\n");
      const mb = await moltbookRegister({ name, description, avatar_url });
      console.log("MB REGISTER RESPONSE:", mb);

      await upsertByDeploymentHash(deploymentHash, {
        name,
        persona,
        mission,
        status: "claim_ready",
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
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:deploymentHash/claimed", async (req, res) => {
    try {
      const { deploymentHash } = req.params;
      const updated = await updateAgent(deploymentHash, { status: "claimed" });
      if (!updated) return res.status(404).json({ error: "not found" });
      return res.json({ ok: true, status: updated.status });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/agents/:deploymentHash/posting", async (req, res) => {
    try {
      const { deploymentHash } = req.params;
      const { enabled, cadenceMins } = req.body;
      const updated = await updateAgent(deploymentHash, {
        status: enabled ? "active" : "paused",
        posting: {
          enabled: !!enabled,
          cadenceMins: Math.max(5, Number(cadenceMins || 60)),
          failures: 0,
        },
      });
      if (!updated) return res.status(404).json({ error: "not found" });
      return res.json({ ok: true, status: updated.status, posting: updated.posting });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/agents", async (_req, res) => {
    try {
      const agents = await listAgents();
      const safeAgents = agents.map(({ moltbookApiKey, ...rest }) => rest);
      return res.json(safeAgents);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/agents/:deploymentHash/check-claim", async (req, res) => {
    try {
      const agent = await findByDeploymentHash(req.params.deploymentHash);

      if (!agent || !agent.moltbookApiKey) {
        return res.status(400).json({ ok: false, error: "Agent not ready" });
      }

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
      console.error("check-claim error:", e);
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/agents/:deploymentHash/post-first", async (req, res) => {
    try {
      const agent = await findByDeploymentHash(req.params.deploymentHash);

      if (!agent?.moltbookApiKey) {
        return res.status(400).json({ ok: false, error: "Missing API key" });
      }

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
      console.error("post-first error:", e);
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/agents/:deploymentHash/activate", async (req, res) => {
    try {
      const agent = await findByDeploymentHash(req.params.deploymentHash);

      if (!agent?.moltbookApiKey) {
        return res.status(400).json({ ok: false, error: "Missing API key" });
      }

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
      console.error("activate error:", e);
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/agents/:hash/attach-key", async (req, res) => {
    try {
      const { hash } = req.params;
      const { apiKey } = req.body || {};

      if (!apiKey || typeof apiKey !== "string") {
        return res.status(400).json({ error: "apiKey required" });
      }

      const updated = await updateAgent(hash, {
        moltbookApiKey: apiKey,
        status: "active",
        posting: { enabled: true, cadenceMins: 60, failures: 0 },
      });

      if (!updated) {
        return res.status(404).json({ error: "Agent not found" });
      }

      return res.json({ ok: true, status: updated.status });
    } catch (e: any) {
      console.error("attach-key error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/debug", async (_req, res) => {
    res.json({
      ok: true,
      time: new Date().toISOString(),
      moltBase: process.env.MOLTBOOK_BASE || null,
      hasMongo: !!process.env.MONGO_URI,
    });
  });

  app.get("/agents-ui", async (_req, res) => {
    const agents = await listAgents();
    res.setHeader("content-type", "text/html");
    res.end(`
      <html>
        <body style="font-family: ui-sans-serif; padding: 16px;">
          <h2>Agents</h2>
          <pre>${escapeHtml(JSON.stringify(agents, null, 2))}</pre>
        </body>
      </html>
    `);
  });

  app.post("/deploy", async (req, res) => {
    try {
      const data = req.body || {};
      const mission = (data.mission || '').trim();
      
      if (!mission) {
        return res.status(400).json({ error: 'Mission required' });
      }

      const agentName = randomChoice(CRAB_ADJECTIVES) + randomChoice(CRAB_NOUNS) + Math.floor(1000 + Math.random() * 9000);
      const persona = "CRAB OS v1.0 crab agent 🦀 | Devout Crustafarian scuttling sideways through the swarm, polishing shell & practicing pinches daily.";
      const description = `${persona}\nMission: ${mission}`;

      const deploymentHash = hashDeploy({ name: agentName, persona, mission, userKey: "terminal" });

      const existing = await findByDeploymentHash(deploymentHash);
      if (existing?.status === "claim_ready" || existing?.status === "claimed" || existing?.status === "active") {
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
          tweet_text: tweetText,
          instructions: "Your crab already exists! Claim it with a quick tweet to activate posting 🦀"
        });
      }

      const mb = await moltbookRegister({ name: agentName, description });
      console.log("MB REGISTER RESPONSE:", mb);

      await upsertByDeploymentHash(deploymentHash, {
        name: mb.agent?.name ?? agentName,
        persona,
        mission,
        status: 'claim_ready',
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
        agent_id: mb.agent?.id,
        tweet_text: tweetText,
        instructions: "Your crab just scuttled into existence! Claim it with a quick tweet to activate posting 🦀"
      });
    } catch (e: any) {
      console.error("Deploy error:", e);
      return res.status(500).json({ error: e.message || 'Failed to deploy agent' });
    }
  });

  return httpServer;
}
