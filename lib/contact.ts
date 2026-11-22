// Contact form: topics and validation; every submission is emailed to support@tenvor.io, shared by the form and the API route.

export const topics = [
  { id: "general", label: "General inquiry" },
  { id: "support", label: "Technical support" },
  { id: "account", label: "Account & API keys" },
  { id: "billing", label: "Billing, plans & refunds" },
  { id: "sales", label: "Sales & enterprise" },
  { id: "operators", label: "Run a node (operators)" },
  { id: "partners", label: "Partnerships & press" },
  { id: "privacy", label: "Privacy request" },
  { id: "security", label: "Security report" },
] as const;

export type ContactInput = {
  name: string; email: string; phone: string; contactBy: string; company: string; topic: string;
  accountId: string; requestId: string; message: string; consent: boolean; website: string;
};

export type Contact = Omit<ContactInput, "consent" | "website"> & { to: string; topicLabel: string };

// Letters (any language), spaces, apostrophes, hyphens and dots; must start with a letter.
const NAME = /^\p{L}[\p{L}\p{M}' .-]*$/u;
const EMAIL = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
const PHONE = /^\+?[0-9 ().-]{7,24}$/;
const COMPANY = /^[\p{L}\p{N}][\p{L}\p{N}\p{M} &'.,()/+-]*$/u;
const ID = /^[A-Za-z0-9_.:-]{3,64}$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "");

/** Validates untrusted form input. Returns the cleaned contact, or field errors. A filled honeypot is reported as "spam". */
export function validate(raw: Partial<Record<keyof ContactInput, unknown>>): { ok: true; contact: Contact } | { ok: false; errors: Record<string, string>; spam?: true } {
  const v = {
    name: clean(raw.name, 100).replace(/\s+/g, " "), email: clean(raw.email, 200).toLowerCase(), phone: clean(raw.phone, 24),
    contactBy: clean(raw.contactBy, 10) || "email", company: clean(raw.company, 120),
    topic: clean(raw.topic, 40), accountId: clean(raw.accountId, 64), requestId: clean(raw.requestId, 64),
    message: clean(raw.message, 5000), website: clean(raw.website, 200),
  };
  if (v.website) return { ok: false, errors: {}, spam: true };
  const errors: Record<string, string> = {};
  if (v.name.length < 2 || !NAME.test(v.name)) errors.name = "Enter your full name using letters only.";
  if (!EMAIL.test(v.email) || v.email.includes("..")) errors.email = "Enter a valid email address, like name@company.com.";
  const digits = v.phone.replace(/\D/g, "").length;
  if (v.phone && (!PHONE.test(v.phone) || digits < 7 || digits > 15)) errors.phone = "Enter a valid phone number, with country code (e.g. +1 346 689 9143).";
  if (v.contactBy !== "email" && v.contactBy !== "phone") errors.contactBy = "Choose email or phone.";
  else if (v.contactBy === "phone" && !v.phone) errors.phone = "Add a phone number so we can call you.";
  if (v.company && (v.company.length < 2 || !COMPANY.test(v.company))) errors.company = "Enter a valid company name.";
  const topic = topics.find(t => t.id === v.topic);
  if (!topic) errors.topic = "Choose a topic.";
  if (v.accountId && !ID.test(v.accountId)) errors.accountId = "Account IDs use letters, numbers, dashes and underscores.";
  if (v.requestId && !ID.test(v.requestId)) errors.requestId = "Request IDs use letters, numbers, dashes and underscores.";
  if (v.message.replace(/\s/g, "").length < 10) errors.message = "Tell us a little more (at least 10 characters).";
  if (raw.consent !== true && raw.consent !== "on" && raw.consent !== "true") errors.consent = "Please agree so we can reply.";
  if (Object.keys(errors).length || !topic) return { ok: false, errors };
  const { website: _, ...rest } = v;
  return { ok: true, contact: { ...rest, to: "support@tenvor.io", topicLabel: topic.label } };
}
