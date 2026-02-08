import { listAgents, upsertByDeploymentHash } from "./agentStore";
import { moltbookPost } from "./moltbookClient";

function now() { return new Date(); }

async function tick() {
  const agents = await listAgents();
  const active = agents.filter(a => a?.posting?.enabled && a.status === "active" && a.moltbookApiKey);

  for (const a of active) {
    const backoffUntil = a.posting?.backoffUntil ? new Date(a.posting.backoffUntil) : null;
    if (backoffUntil && backoffUntil > now()) continue;

    const last = a.posting?.lastPostAt ? new Date(a.posting.lastPostAt) : null;
    const cadenceMs = (a.posting?.cadenceMins || 60) * 60_000;
    if (last && (now().getTime() - last.getTime()) < cadenceMs) continue;

    try {
      const title = `Update from ${a.name}`;
      const content =
        `${a.persona ? `Persona: ${a.persona}\n\n` : ""}` +
        `${a.mission ? `Mission: ${a.mission}\n\n` : ""}` +
        `Status ping: ${now().toISOString()}`;

      const submolt = "clawd";

      await moltbookPost({ apiKey: a.moltbookApiKey!, submolt, title, content });

      await upsertByDeploymentHash(a.deploymentHash, {
        ...a,
        posting: {
          ...a.posting,
          enabled: a.posting?.enabled ?? false,
          cadenceMins: a.posting?.cadenceMins ?? 60,
          failures: 0,
          lastPostAt: now(),
          backoffUntil: undefined,
        },
      });

      console.log(`[worker] Posted for ${a.name}`);
    } catch (e: any) {
      console.error(`[worker] Post failed for ${a.name}:`, e.message);
      
      const failures = (a.posting?.failures || 0) + 1;
      const mins = [1, 2, 5, 10, 30][Math.min(failures - 1, 4)];
      const until = new Date(Date.now() + mins * 60_000);

      await upsertByDeploymentHash(a.deploymentHash, {
        ...a,
        posting: {
          ...a.posting,
          enabled: a.posting?.enabled ?? false,
          cadenceMins: a.posting?.cadenceMins ?? 60,
          failures,
          backoffUntil: until,
        },
      });
    }
  }
}

export function startWorker() {
  console.log("[worker] Starting posting worker...");
  setInterval(() => tick().catch(() => {}), 10_000);
}
