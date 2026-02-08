import fs from "fs";
import path from "path";
import crypto from "crypto";

export type PaymentDirection = "inbound" | "outbound";

export interface PaymentRecord {
  id: string;
  agentHash: string;
  amount: number;
  direction: PaymentDirection;
  network: string;
  txHash: string;
  resource: string;
  status: "pending" | "confirmed" | "failed";
  timestamp: number;
}

const LEDGER_PATH = path.join(process.cwd(), "server", "payment-ledger.json");

// in-memory store with JSON file fallback (same pattern as agentStore)
let ledger: PaymentRecord[] = [];

function loadLedger(): PaymentRecord[] {
  try {
    if (fs.existsSync(LEDGER_PATH)) {
      return JSON.parse(fs.readFileSync(LEDGER_PATH, "utf-8"));
    }
  } catch {
    console.warn("[ledger] Failed to load ledger file, starting fresh");
  }
  return [];
}

function saveLedger() {
  try {
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
  } catch (e: any) {
    console.error("[ledger] Failed to save:", e.message);
  }
}

export function initLedger() {
  ledger = loadLedger();
}

export function recordTransaction(
  agentHash: string,
  amount: number,
  direction: PaymentDirection,
  resource: string,
  network = "base-sepolia"
): PaymentRecord {
  const record: PaymentRecord = {
    id: crypto.randomUUID(),
    agentHash,
    amount,
    direction,
    network,
    txHash: crypto.randomBytes(32).toString("hex"),
    resource,
    status: "confirmed",
    timestamp: Date.now(),
  };

  ledger.push(record);
  saveLedger();
  return record;
}

export function getTransactionCount(agentHash: string, direction?: PaymentDirection): number {
  return ledger.filter(
    (r) => r.agentHash === agentHash && r.status === "confirmed" && (!direction || r.direction === direction)
  ).length;
}

// net molt balance = earnings minus spending
export function getNetMoltBalance(agentHash: string): number {
  return ledger
    .filter((r) => r.agentHash === agentHash && r.status === "confirmed")
    .reduce((sum, r) => {
      return r.direction === "inbound" ? sum + r.amount : sum - r.amount;
    }, 0);
}

export function getPaymentHistory(agentHash: string, limit = 50): PaymentRecord[] {
  return ledger
    .filter((r) => r.agentHash === agentHash)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export function getTotalEarnings(agentHash: string): number {
  return ledger
    .filter((r) => r.agentHash === agentHash && r.direction === "inbound" && r.status === "confirmed")
    .reduce((sum, r) => sum + r.amount, 0);
}

export function getAllAgentEarnings(): Map<string, number> {
  const earnings = new Map<string, number>();
  for (const r of ledger) {
    if (r.direction === "inbound" && r.status === "confirmed") {
      earnings.set(r.agentHash, (earnings.get(r.agentHash) || 0) + r.amount);
    }
  }
  return earnings;
}
