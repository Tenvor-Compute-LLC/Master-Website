// Live status from a self-hosted Uptime Kuma public status page.
// Set UPTIME_KUMA_URL (e.g. https://uptime.tenvor.io) and UPTIME_KUMA_SLUG (the status page slug) in Vercel.
import { cacheLife } from "next/cache";

// Uses Kuma's public, unauthenticated endpoints: /api/status-page/<slug> and /api/status-page/heartbeat/<slug>.

export type Beat = { s: number; t: string; p: number | null }; // s: 0 down, 1 up, 2 pending, 3 maintenance
export type Monitor = { id: number; name: string; status: number; uptime: number | null; beats: Beat[] };
export type Group = { name: string; monitors: Monitor[] };
export type Status =
  | { state: "unconfigured" }
  | { state: "error" }
  | { state: "ok"; groups: Group[]; incident: { title: string; content: string } | null; checkedAt: string };

const BEATS = 60;
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function get(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${r.status} from status source`);
  return r.json();
}

/** Reads and validates Kuma's JSON: it comes from another server, so nothing is trusted as-is. */
export async function getStatus(): Promise<Status> {
  "use cache";
  cacheLife("minutes"); // refetched about once a minute, shared by every visitor
  const base = process.env.UPTIME_KUMA_URL?.replace(/\/+$/, ""), slug = process.env.UPTIME_KUMA_SLUG;
  if (!base || !slug) return { state: "unconfigured" };
  try {
    const s = encodeURIComponent(slug.toLowerCase());
    const [page, hb] = (await Promise.all([get(`${base}/api/status-page/${s}`), get(`${base}/api/status-page/heartbeat/${s}`)])) as [
      { publicGroupList?: unknown; incident?: unknown }, { heartbeatList?: Record<string, unknown>; uptimeList?: Record<string, unknown> }];
    const groups: Group[] = (Array.isArray(page.publicGroupList) ? page.publicGroupList : []).map((g: { name?: unknown; monitorList?: unknown }) => ({
      name: str(g.name, 80),
      monitors: (Array.isArray(g.monitorList) ? g.monitorList : []).flatMap((m: { id?: unknown; name?: unknown }) => {
        const id = num(m.id);
        if (id === null) return [];
        const raw = hb.heartbeatList?.[String(id)];
        const beats: Beat[] = (Array.isArray(raw) ? raw : []).slice(-BEATS).map((b: { status?: unknown; time?: unknown; ping?: unknown }) => ({ s: num(b.status) ?? 2, t: str(b.time, 40), p: num(b.ping) }));
        return [{ id, name: str(m.name, 80), status: beats.at(-1)?.s ?? 2, uptime: num(hb.uptimeList?.[`${id}_24`]), beats }];
      }),
    })).filter(g => g.monitors.length);
    const inc = page.incident as { title?: unknown; content?: unknown } | null | undefined;
    return { state: "ok", groups, incident: inc && str(inc.title) ? { title: str(inc.title), content: str(inc.content, 1000) } : null, checkedAt: new Date().toISOString() };
  } catch {
    return { state: "error" };
  }
}
