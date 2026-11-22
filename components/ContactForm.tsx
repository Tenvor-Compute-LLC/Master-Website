"use client";
import { useRef, useState } from "react";
import { topics, validate } from "@/lib/contact";

type Status = { status: "idle" | "sending" | "sent" | "error"; error?: string };

const read = (f: HTMLFormElement) => {
  const d = Object.fromEntries(new FormData(f).entries()) as Record<string, unknown>;
  return { ...d, consent: d.consent === "on" };
};

export default function ContactForm() {
  const form = useRef<HTMLFormElement>(null);
  const [s, set] = useState<Status>({ status: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState("");
  const [contactBy, setContactBy] = useState("email");
  const showRequest = topic === "support" || topic === "billing";

  // Same rules as the server (lib/contact.ts), checked as the user types.
  const check = () => { const r = validate(read(form.current!)); setErrors(r.ok ? {} : r.errors); return r; };
  const touch = (e: React.FocusEvent<HTMLFormElement>) => {
    const n = (e.target as unknown as HTMLInputElement).name;
    if (n) { setTouched(t => new Set(t).add(n)); check(); }
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const r = check();
    setTouched(new Set(["name", "email", "phone", "contactBy", "company", "topic", "accountId", "requestId", "message", "consent"]));
    if (!r.ok) {
      if (r.spam) return set({ status: "sent" });
      set({ status: "error", error: "Please fix the highlighted fields." });
      form.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    set({ status: "sending" });
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(read(form.current!)) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return set({ status: "sent" });
      if (data.errors) setErrors(data.errors);
      set({ status: "error", error: data.error ?? (data.errors ? "Please fix the highlighted fields." : "Something went wrong.") });
    } catch {
      set({ status: "error", error: "Network error. Please try again, or write to support@tenvor.io." });
    }
  }

  if (s.status === "sent") return (
    <div className="cf cf--done" role="status">
      <span className="cf__tick" aria-hidden="true">✓</span>
      <h2>Thanks, we have your message.</h2>
      <p>We will reply by {contactBy === "phone" ? "phone or email" : "email"}. If you don’t see our email, check your spam folder.</p>
      <button type="button" className="cf__again" onClick={() => { set({ status: "idle" }); setTouched(new Set()); setErrors({}); }}>Send another message</button>
    </div>
  );

  const err = (k: string) => (touched.has(k) ? errors[k] : undefined);
  const field = (k: string) => ({ name: k, "aria-invalid": err(k) ? true : undefined, "aria-describedby": err(k) ? `cf-${k}-e` : undefined });
  const msg = (k: string) => err(k) && <span className="cf__err" id={`cf-${k}-e`}>{err(k)}</span>;
  const ok = (k: string) => touched.has(k) && !errors[k] ? " cf__f--ok" : "";

  return (
    <form ref={form} className="cf" onSubmit={submit} onBlur={touch} onChange={() => touched.size && check()} noValidate>
      <p className="cf__k mono">Your contact details</p>
      <div className="cf__grid">
        <label className={"cf__f" + ok("name")}><span>Full name <i>*</i></span><input {...field("name")} autoComplete="name" required maxLength={100} placeholder="Jane Smith" />{msg("name")}</label>
        <label className={"cf__f" + ok("email")}><span>Work or personal email <i>*</i></span><input {...field("email")} type="email" inputMode="email" autoComplete="email" required maxLength={200} placeholder="name@company.com" />{msg("email")}</label>
        <label className={"cf__f" + ok("phone")}><span>Phone {contactBy === "phone" ? <i>*</i> : <em>optional</em>}</span><input {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" maxLength={24} placeholder="+1 346 689 9143" />{msg("phone")}</label>
        <fieldset className="cf__f cf__pref"><legend>Preferred contact <i>*</i></legend>
          <div className="cf__seg">
            {["email", "phone"].map(v => <label key={v}><input type="radio" name="contactBy" value={v} checked={contactBy === v} onChange={() => setContactBy(v)} /><span>{v === "email" ? "Email" : "Phone"}</span></label>)}
          </div>{msg("contactBy")}
        </fieldset>
        <label className={"cf__f" + ok("company")}><span>Company <em>optional</em></span><input {...field("company")} autoComplete="organization" maxLength={120} />{msg("company")}</label>
        <label className={"cf__f" + ok("accountId")}><span>Tenvor account ID <em>if you have an account</em></span><input {...field("accountId")} maxLength={64} spellCheck={false} autoCapitalize="off" placeholder="Helps us find your account" />{msg("accountId")}</label>
      </div>
      <p className="cf__k mono">Your request</p>
      <div className="cf__grid">
        <label className={"cf__f" + ok("topic")}><span>Topic <i>*</i></span>
          <select {...field("topic")} required value={topic} onChange={e => setTopic(e.target.value)}>
            <option value="" disabled>Choose a topic</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>{msg("topic")}
        </label>
        {showRequest && <label className={"cf__f" + ok("requestId")}><span>Request ID <em>optional</em></span><input {...field("requestId")} maxLength={64} spellCheck={false} autoCapitalize="off" placeholder="From the receipt or your ledger" />{msg("requestId")}</label>}
        <label className={"cf__f cf__f--wide" + ok("message")}><span>Message <i>*</i></span><textarea {...field("message")} rows={6} required maxLength={5000} placeholder="How can we help?" />{msg("message")}</label>
      </div>
      {topic === "security" && <p className="cf__note">For a vulnerability, please read the <a href="/legal/security">Security Policy</a> first, and do not include other users’ data.</p>}
      {/* honeypot: hidden from people, filled by bots */}
      <label className="cf__hp" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <label className="cf__consent"><input type="checkbox" {...field("consent")} /><span>I agree that Tenvor may store these details and use them to reply to me, as described in the <a href="/legal/privacy">Privacy Policy</a>.</span></label>
      {msg("consent")}
      <div className="cf__foot">
        <button type="submit" className="btn btn--accent" disabled={s.status === "sending"}>
          <span className="btn__t"><span>{s.status === "sending" ? "Sending…" : "Send message"}</span></span>
        </button>
        {s.status === "error" && <p className="cf__fail" role="alert">{s.error}</p>}
      </div>
    </form>
  );
}
