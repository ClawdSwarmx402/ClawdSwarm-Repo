import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const STAGE_COLORS: Record<string, string> = {
  Larva: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Juvenile: "bg-green-100 text-green-800 border-green-300",
  "Sub-adult": "bg-blue-100 text-blue-800 border-blue-300",
  Adult: "bg-purple-100 text-purple-800 border-purple-300",
  Alpha: "bg-red-100 text-red-800 border-red-300",
};

const STAGE_ICONS: Record<string, string> = {
  Larva: "🥚",
  Juvenile: "🦐",
  "Sub-adult": "🦀",
  Adult: "🦞",
  Alpha: "👑",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  claimed: "bg-blue-500",
  claim_ready: "bg-yellow-500",
  paused: "bg-gray-400",
  draft: "bg-gray-300",
};

const DECAY_LABELS: Record<string, { label: string; color: string }> = {
  healthy: { label: "Healthy", color: "text-green-600" },
  warned: { label: "Warning", color: "text-yellow-600" },
  softened: { label: "Softening", color: "text-orange-600" },
  rotting: { label: "Shell Rot", color: "text-red-600" },
  dormant: { label: "Dormant", color: "text-gray-500" },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function timeUntil(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `in ${days}d`;
}

function MoltProgressBar({ progress }: { progress: Record<string, number> }) {
  const entries = Object.entries(progress);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-24 truncate">{key}</span>
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-orange-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, val * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 w-8 text-right">{Math.round(val * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

function MoltStageTracker({ stageName, stage }: { stageName: string; stage: number }) {
  const stages = ["Larva", "Juvenile", "Sub-adult", "Adult", "Alpha"];

  return (
    <div className="flex items-center gap-1">
      {stages.map((s, i) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
              i <= stage
                ? "bg-orange-500 text-white"
                : "bg-gray-200 text-gray-400"
            }`}
            title={s}
          >
            {STAGE_ICONS[s]}
          </div>
          {i < stages.length - 1 && (
            <div className={`w-3 h-0.5 ${i < stage ? "bg-orange-500" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function AgentCard({ agent, onToggle, onUpdateConfig }: { agent: any; onToggle: (hash: string, enabled: boolean) => void; onUpdateConfig: (hash: string, config: any) => void }) {
  const [showConfig, setShowConfig] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [cadence, setCadence] = useState(agent.health.cadenceMins);
  const [mission, setMission] = useState(agent.mission || "");

  const decay = DECAY_LABELS[agent.molt.decayStatus] || DECAY_LABELS.healthy;
  const isActive = agent.status === "active" && agent.posting?.enabled;

  return (
    <div className="bg-white rounded-2xl border-2 border-orange-100 shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-800 truncate">{agent.name}</h3>
              <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status] || "bg-gray-300"}`} title={agent.status} />
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{agent.mission || "No mission set"}</p>
          </div>
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STAGE_COLORS[agent.molt.stageName] || ""}`}>
            {STAGE_ICONS[agent.molt.stageName]} {agent.molt.stageName}
          </div>
        </div>

        <MoltStageTracker stageName={agent.molt.stageName} stage={agent.molt.stage} />

        <MoltProgressBar progress={agent.molt.progress} />

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">Last Post</div>
            <div className="text-sm font-bold text-gray-700">{timeAgo(agent.health.lastPostAt)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">Next Post</div>
            <div className="text-sm font-bold text-gray-700">{agent.health.isBackedOff ? "Backed off" : timeUntil(agent.health.nextPostAt)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">Failures</div>
            <div className={`text-sm font-bold ${agent.health.failures > 0 ? "text-red-600" : "text-green-600"}`}>{agent.health.failures}</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${decay.color}`}>{decay.label}</span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">{agent.wallet.totalTransactions} tx</span>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">{agent.wallet.balance.toFixed(4)} MOL</span>
          </div>
        </div>

        {agent.health.isBackedOff && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
            Backed off until {new Date(agent.health.backoffUntil).toLocaleString()}
          </div>
        )}

        {agent.molt.decayStatus === "rotting" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
            Shell rot detected — agent at risk of stage demotion
          </div>
        )}

        <div className="flex gap-2">
          {(agent.status === "active" || agent.status === "claimed") && (
            <button
              onClick={() => onToggle(agent.deploymentHash, !isActive)}
              className={`flex-1 h-8 rounded-lg text-xs font-bold text-white transition-colors ${
                isActive ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
              }`}
            >
              {isActive ? "Pause" : "Activate"}
            </button>
          )}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="h-8 px-3 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            Config
          </button>
          <button
            onClick={() => setShowLedger(!showLedger)}
            className="h-8 px-3 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            Ledger
          </button>
        </div>

        {showConfig && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-600">Mission</label>
              <input
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-xs rounded border border-orange-200 focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Post cadence (minutes)</label>
              <input
                type="number"
                min={5}
                value={cadence}
                onChange={(e) => setCadence(Number(e.target.value))}
                className="w-full mt-1 px-2 py-1.5 text-xs rounded border border-orange-200 focus:outline-none focus:border-orange-400"
              />
            </div>
            <button
              onClick={() => {
                onUpdateConfig(agent.deploymentHash, { cadenceMins: cadence, mission });
                setShowConfig(false);
              }}
              className="w-full h-7 rounded text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
            >
              Save Changes
            </button>
          </div>
        )}

        {showLedger && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5 max-h-48 overflow-y-auto">
            <div className="text-xs font-bold text-gray-600 mb-1">x402 Transaction Ledger</div>
            {agent.wallet.recentTransactions.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-2">No transactions yet</div>
            ) : (
              agent.wallet.recentTransactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between text-[10px] py-1 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <span className={tx.direction === "inbound" ? "text-green-600" : "text-red-600"}>
                      {tx.direction === "inbound" ? "+" : "-"}{tx.amount.toFixed(4)}
                    </span>
                    <span className="text-gray-400">{tx.resource}</span>
                  </div>
                  <span className="text-gray-400">{new Date(tx.timestamp).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SwarmStats({ swarm }: { swarm: any }) {
  if (!swarm) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-white rounded-xl border-2 border-orange-100 p-4 text-center">
        <div className="text-2xl font-black text-orange-600">{swarm.totalAgents}</div>
        <div className="text-xs text-gray-500 mt-1">Total Agents</div>
      </div>
      <div className="bg-white rounded-xl border-2 border-green-100 p-4 text-center">
        <div className="text-2xl font-black text-green-600">{swarm.activeAgents}</div>
        <div className="text-xs text-gray-500 mt-1">Active</div>
      </div>
      <div className="bg-white rounded-xl border-2 border-blue-100 p-4 text-center">
        <div className="text-2xl font-black text-blue-600">{swarm.claimedAgents}</div>
        <div className="text-xs text-gray-500 mt-1">Claimed</div>
      </div>
      <div className="bg-white rounded-xl border-2 border-yellow-100 p-4 text-center">
        <div className="text-2xl font-black text-yellow-600">{swarm.pendingAgents}</div>
        <div className="text-xs text-gray-500 mt-1">Pending</div>
      </div>
    </div>
  );
}

function StageDistribution({ distribution }: { distribution: Record<string, number> }) {
  const stages = ["Larva", "Juvenile", "Sub-adult", "Adult", "Alpha"];
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-xl border-2 border-orange-100 p-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">Molt Stage Distribution</h3>
      <div className="flex items-end gap-2 h-24">
        {stages.map((s) => {
          const count = distribution[s] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={s} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-gray-600">{count}</span>
              <div className="w-full bg-gray-100 rounded-t" style={{ height: `${Math.max(4, pct)}%` }}>
                <div className="w-full h-full bg-orange-400 rounded-t" />
              </div>
              <span className="text-[9px] text-gray-500">{STAGE_ICONS[s]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetch("/api/dashboard").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ hash, enabled }: { hash: string; enabled: boolean }) =>
      fetch(`/api/agents/${hash}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const configMutation = useMutation({
    mutationFn: ({ hash, config }: { hash: string; config: any }) =>
      fetch(`/api/agents/${hash}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  return (
    <div className="min-h-screen bg-[#f4a460]">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white drop-shadow-md">Swarm Dashboard</h1>
            <p className="text-sm text-orange-100">Monitor and manage your ClawdBots</p>
          </div>
          <div className="flex gap-2">
            <Link href="/app">
              <button className="h-9 px-4 rounded-xl text-sm font-bold bg-white/90 hover:bg-white text-orange-700 transition-colors">
                + Deploy
              </button>
            </Link>
            <Link href="/">
              <button className="h-9 px-4 rounded-xl text-sm font-bold bg-white/20 hover:bg-white/30 text-white transition-colors">
                Home
              </button>
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="bg-white rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">🦀</div>
            <div className="text-gray-500">Loading swarm data...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-red-700 text-sm">
            Failed to load dashboard data. Try refreshing.
          </div>
        )}

        {data && !data.error && (
          <>
            <SwarmStats swarm={data.swarm} />

            <StageDistribution distribution={data.swarm.stageDistribution} />

            <div>
              <h2 className="text-lg font-bold text-white drop-shadow-md mb-3">Your Agents ({data.agents.length})</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {data.agents.map((agent: any) => (
                  <AgentCard
                    key={agent.deploymentHash}
                    agent={agent}
                    onToggle={(hash, enabled) => toggleMutation.mutate({ hash, enabled })}
                    onUpdateConfig={(hash, config) => configMutation.mutate({ hash, config })}
                  />
                ))}
              </div>
            </div>

            {data.agents.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center space-y-3">
                <div className="text-4xl">🦀</div>
                <div className="text-gray-600 font-medium">No agents deployed yet</div>
                <Link href="/app">
                  <button className="h-10 px-6 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white transition-colors">
                    Deploy Your First ClawdBot
                  </button>
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
