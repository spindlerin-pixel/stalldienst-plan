import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "stalldienst", consistency: "strong" });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS = ["morgens", "abends", "sonstiges"];
const MAX = { morgens: 60, abends: 60, sonstiges: 300 };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const url = new URL(req.url);
  const s = store();

  // GET /api/week?days=2026-12-01,2026-12-02,...
  if (req.method === "GET") {
    const days = (url.searchParams.get("days") || "").split(",").filter((d) => DATE.test(d)).slice(0, 7);
    const out = {};
    await Promise.all(
      days.flatMap((d) =>
        FIELDS.map(async (f) => {
          const v = await s.get(`${d}/${f}`, { type: "json" });
          if (v && v.text) (out[d] ||= {})[f] = v.text;
        })
      )
    );
    return json({ entries: out });
  }

  // POST /api/entry  {day, field, text}
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const { day, field } = body || {};
    if (!DATE.test(day || "") || !FIELDS.includes(field)) return json({ error: "bad field" }, 400);
    if (day < "2026-11-02") return json({ error: "before start" }, 400);
    const text = String(body.text || "").trim().slice(0, MAX[field]);
    const key = `${day}/${field}`;
    if (!text) await s.delete(key);
    else await s.setJSON(key, { text, at: Date.now() });
    return json({ ok: true, text });
  }

  return json({ error: "method" }, 405);
};

export const config = { path: ["/api/week", "/api/entry"] };
