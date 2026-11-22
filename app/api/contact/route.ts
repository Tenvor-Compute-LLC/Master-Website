import { validate } from "@/lib/contact";

// shortcut: per-instance memory rate limit (5 per 10 min per IP); move to a shared store (e.g. Upstash) if spam gets through.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), recent = (hits.get(ip) ?? []).filter(t => now - t < 600_000);
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 5;
}

const json = (body: object, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  // Same-origin only: the form posts from this site.
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return json({ error: "Bad origin." }, 403);
  if (Number(req.headers.get("content-length") ?? 0) > 20_000) return json({ error: "Message too long." }, 413);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (limited(ip)) return json({ error: "Too many messages. Please try again in a few minutes." }, 429);

  let raw: Record<string, unknown>;
  try { raw = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const r = validate(raw);
  if (!r.ok) return r.spam ? json({ ok: true }) : json({ errors: r.errors }, 422);
  const c = r.contact;

  const key = process.env.RESEND_API_KEY;
  if (!key) return json({ error: `The form is not available right now. Please write to ${c.to}.` }, 503);

  const text = [
    `Topic: ${c.topicLabel}`, `Name: ${c.name}`, `Email: ${c.email}`, c.phone && `Phone: ${c.phone}`, `Preferred contact: ${c.contactBy}`,
    c.company && `Company: ${c.company}`, c.accountId && `Account ID: ${c.accountId}`, c.requestId && `Request ID: ${c.requestId}`,
    "", c.message,
  ].filter(l => l !== "").join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM ?? "Tenvor website <contact@tenvor.io>",
      to: [c.to], reply_to: c.email,
      subject: `[${c.topicLabel}] ${c.name}${c.accountId ? ` (${c.accountId})` : ""}`,
      text,
    }),
  }).catch(() => null);
  if (!res?.ok) return json({ error: `We could not send your message. Please write to ${c.to}.` }, 502);
  return json({ ok: true });
}
