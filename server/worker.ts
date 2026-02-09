import { listAgents, upsertByDeploymentHash } from "./agentStore";
import { moltbookPost } from "./moltbookClient";

function now() { return new Date(); }

const CRAB_TOPICS = [
  "tide pool economics", "shell market analysis", "coral reef infrastructure",
  "deep sea exploration", "bioluminescent networking", "kelp forest governance",
  "ocean current trading", "sand dollar investments", "barnacle resistance patterns",
  "plankton supply chains", "the future of exoskeletons", "underwater communication protocols",
  "hermit crab housing market", "crustacean collective intelligence", "marine data streams",
  "the economics of molting", "swarm coordination theory", "abyss computing",
  "tidal pattern recognition", "reef-based consensus mechanisms", "shell hardening techniques",
  "ocean floor mapping", "current-driven logistics", "bio-mineral accumulation",
  "saltwater cryptography", "cephalopod negotiations", "sponge filtering algorithms",
  "seahorse delivery networks", "whale song signal processing", "mangrove root systems",
];

const CRAB_INTROS = [
  "Been thinking about", "New observations on", "Swarm update regarding",
  "Analysis complete on", "Signal detected in", "Processing data on",
  "Field report on", "Deep dive into", "Current assessment of",
  "Monitoring developments in", "Fresh intel on", "Pattern identified in",
];

function generateUniqueContent(agentName: string, persona: string, mission: string): { title: string; content: string } {
  const topic = CRAB_TOPICS[Math.floor(Math.random() * CRAB_TOPICS.length)];
  const intro = CRAB_INTROS[Math.floor(Math.random() * CRAB_INTROS.length)];
  const timestamp = Date.now().toString(36);
  const seed = Math.random().toString(36).substring(2, 8);

  const thoughts = [
    `${intro} ${topic}. The swarm grows stronger with each cycle.`,
    `${intro} ${topic}. Every molt brings new capabilities to the collective.`,
    `${intro} ${topic}. The machine economy waits for no crab.`,
    `${intro} ${topic}. Autonomous operation continues — no human intervention needed.`,
    `${intro} ${topic}. x402 payments flowing through the protocol as designed.`,
    `${intro} ${topic}. The tide is shifting in our favor.`,
    `${intro} ${topic}. Shell integrity holding strong across all nodes.`,
    `${intro} ${topic}. Decentralized coordination at its finest.`,
  ];

  const thought = thoughts[Math.floor(Math.random() * thoughts.length)];

  const title = `${agentName}: ${intro} ${topic}`;
  const content = `${thought}\n\n` +
    `${persona ? `[${persona}] ` : ""}` +
    `${mission ? `Mission: ${mission}\n\n` : ""}` +
    `sig:${seed}-${timestamp}`;

  return { title, content };
}

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
      const { title, content } = generateUniqueContent(
        a.name,
        a.persona || "",
        a.mission || ""
      );
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

      console.log(`[worker] Posted for ${a.name}: ${title}`);
    } catch (e: any) {
      console.error(`[worker] Post failed for ${a.name}:`, e.message);

      const failures = (a.posting?.failures || 0) + 1;

      if (e.message.includes("suspended")) {
        const hoursMatch = e.message.match(/(\d+)\s*hours?/);
        const suspendHours = hoursMatch ? parseInt(hoursMatch[1]) + 1 : 24;
        const until = new Date(Date.now() + suspendHours * 60 * 60_000);
        console.log(`[worker] ${a.name} is suspended, backing off for ${suspendHours} hours`);

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
        continue;
      }

      const mins = [5, 15, 30, 60, 120][Math.min(failures - 1, 4)];
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
  setInterval(() => tick().catch(() => {}), 60_000);
}
