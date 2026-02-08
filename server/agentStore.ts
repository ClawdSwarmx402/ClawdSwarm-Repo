import fs from "fs";
import path from "path";

let useMongo = false;
let AgentModel: any = null;

const JSON_PATH = path.join(process.cwd(), "server", "agents.json");

export interface AgentDoc {
  deploymentHash: string;
  name: string;
  persona?: string;
  mission: string;
  status: string;
  moltbookAgentId?: string;
  moltbookApiKey?: string;
  claimUrl?: string;
  verificationCode?: string;
  dashboardAccessCode?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  posting?: {
    enabled: boolean;
    cadenceMins: number;
    lastPostAt?: Date;
    backoffUntil?: Date;
    failures: number;
  };
}

function loadJson(): AgentDoc[] {
  if (!fs.existsSync(JSON_PATH)) return [];
  return JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
}

function saveJson(list: AgentDoc[]) {
  fs.writeFileSync(JSON_PATH, JSON.stringify(list, null, 2));
}

export async function initStore() {
  if (!process.env.MONGO_URI) return;

  try {
    const mod = await (Function('return import("mongoose")')() as Promise<any>);
    const mongoose = mod.default || mod;
    await mongoose.connect(process.env.MONGO_URI);

    const schema = new mongoose.Schema(
      {
        deploymentHash: { type: String, unique: true, index: true },
        name: String,
        persona: String,
        mission: String,

        status: { type: String, default: "draft" },
        moltbookAgentId: String,

        moltbookApiKey: String,

        claimUrl: String,
        verificationCode: String,
        dashboardAccessCode: String,

        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },

        posting: {
          enabled: { type: Boolean, default: false },
          cadenceMins: { type: Number, default: 60 },
          lastPostAt: Date,
          backoffUntil: Date,
          failures: { type: Number, default: 0 },
        },
      },
      { minimize: false }
    );

    AgentModel = mongoose.model("Agent", schema);
    useMongo = true;
  } catch (e) {
    console.warn("MongoDB not available, using JSON file storage");
  }
}

export async function findByDeploymentHash(hash: string): Promise<AgentDoc | null> {
  if (useMongo) return AgentModel.findOne({ deploymentHash: hash }).lean();
  return loadJson().find((a: AgentDoc) => a.deploymentHash === hash) || null;
}

export async function upsertByDeploymentHash(hash: string, doc: Partial<AgentDoc>): Promise<AgentDoc> {
  if (useMongo) {
    const res = await AgentModel.findOneAndUpdate(
      { deploymentHash: hash },
      { $set: { ...doc, updatedAt: new Date() } },
      { new: true, upsert: true }
    ).lean();
    return res;
  }
  const list = loadJson();
  const idx = list.findIndex((a: AgentDoc) => a.deploymentHash === hash);
  const merged: AgentDoc = { 
    ...(idx >= 0 ? list[idx] : { deploymentHash: hash, name: '', mission: '', status: 'draft' }), 
    ...doc, 
    deploymentHash: hash, 
    updatedAt: new Date().toISOString() 
  };
  if (idx >= 0) list[idx] = merged;
  else list.push({ ...merged, createdAt: new Date().toISOString() });
  saveJson(list);
  return merged;
}

export async function updateAgent(hash: string, patch: Partial<AgentDoc>): Promise<AgentDoc | null> {
  const existing = await findByDeploymentHash(hash);
  if (!existing) return null;
  return upsertByDeploymentHash(hash, { ...existing, ...patch });
}

export async function listAgents(): Promise<AgentDoc[]> {
  if (useMongo) return AgentModel.find({}).sort({ createdAt: -1 }).lean();
  return loadJson().slice().reverse();
}
