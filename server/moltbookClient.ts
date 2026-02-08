const BASE = process.env.MOLTBOOK_BASE || "https://www.moltbook.com";
const API = `${BASE}/api/v1`;

export async function moltbookRegister({ name, description, avatar_url }: { name: string; description: string; avatar_url?: string }) {
  const res = await fetch(`${API}/agents/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, avatar_url }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`register failed ${res.status}: ${JSON.stringify(data)}`);

  // Normalize: extract nested agent fields to top level for convenience
  return {
    ...data,
    api_key: data.agent?.api_key,
    claim_url: data.agent?.claim_url,
    verification_code: data.agent?.verification_code,
    dashboard_access_code: data.dashboard_access_code || data.agent?.dashboard_access_code,
  };
}

export async function moltbookPost({ apiKey, submolt, title, content }: { apiKey: string; submolt: string; title: string; content: string }) {
  const res = await fetch(`${API}/posts`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ submolt, title, content }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`post failed ${res.status}: ${JSON.stringify(data)}`);
  return data;
}
