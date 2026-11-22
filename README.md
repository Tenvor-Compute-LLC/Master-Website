# Tenvor Compute website

The marketing site, docs and legal pages for Tenvor, the open-model GPU cloud, served at **https://tenvor.io**. Built with Next.js 16 (App Router), React 19 and TypeScript. No other runtime dependencies.

## Run locally
```bash
npm install
npm run dev      # http://localhost:3000 (any port: npm run dev -- -p 3107)
npm run build    # production build (type check included)
npm run start    # serve the build
npm run lint
```
Fonts come from Google Fonts (Funnel Display, Funnel Sans, Geist Mono).

## Deploy
- Hosted on **Vercel**: team `tenvor`, project `tenvor-compute-website` (https://vercel.com/tenvor/tenvor-compute-website). The domain `tenvor.io` sits behind Cloudflare.
- Every push to `main` deploys to production automatically. Other branches get preview deployments.
- Environment variables are read only when a deployment is built. After adding or changing one, redeploy (Vercel: Deployments → ⋯ → Redeploy, or push a commit).

## Environment variables
| Name | Needed for | Default |
|---|---|---|
| `RESEND_API_KEY` | Sending contact form messages through [Resend](https://resend.com). Without it the form replies "not available right now" and points people to support@tenvor.io. | none |
| `CONTACT_FROM` | The sender of contact form emails. The domain must be verified in Resend. | `Tenvor website <contact@tenvor.io>` |
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs in metadata and Open Graph images. | `https://tenvor.io` |

Set them in Vercel (Settings → Environment Variables, tick **Production**). For local testing put them in `.env.local`, which git ignores. Never commit a key.

## Contact form (`/contact`)
- Fields: full name, email, phone (required when "Phone" is the preferred contact), preferred contact, company, Tenvor account ID, topic, request ID (support and billing topics), message, consent.
- Validation lives in `lib/contact.ts` and runs twice: live in the browser (`components/ContactForm.tsx`) and again on the server (`app/api/contact/route.ts`).
- The server also checks the request comes from this site, caps the size at 20 KB, limits each IP to 5 messages per 10 minutes, and silently drops bots that fill the hidden honeypot field.
- Every submission is emailed to **support@tenvor.io** with the subject `Website form submission: <topic> from <name> (<account ID>)`. Reply-To is the sender, so replying from the inbox answers them.
- The rate limit is kept in memory per server instance. Move it to a shared store (for example Upstash Redis) if spam gets through.

### Resend setup
1. In Resend, add the domain `tenvor.io` and add the DNS records it shows. Wait for **Verified**.
2. Create an API key with sending access.
3. Add it to Vercel as `RESEND_API_KEY` (Production), then redeploy.
4. Test the form on tenvor.io. "We could not send your message" means Resend refused the email, usually because the domain is not verified yet.

## Email addresses used on the site
| Address | Used for |
|---|---|
| support@tenvor.io | General help, contact form destination |
| security@tenvor.io | Security reports |
| privacy@tenvor.io | Privacy requests and abuse reports |
| billing@tenvor.io | Billing, plans and refunds |
| legal@tenvor.io | Legal notices |
| operators@tenvor.io | Node operators |
| contact@tenvor.io | Sender address for contact form emails only (no inbox needed) |

## SEO
- `lib/seo.ts`: `SITE`, `pageMeta(title, path, intro)` for per-page title, description, canonical URL and Open Graph, and `ld()` for JSON-LD.
- `app/layout.tsx`: site-wide metadata plus Organization and WebSite JSON-LD. `app/page.tsx` adds Service and FAQPage JSON-LD; `/trust` adds FAQPage.
- `app/sitemap.ts` and `app/robots.ts` generate `/sitemap.xml` and `/robots.txt` (`/checkout` is not indexed).
- `public/llms.txt`: a plain summary of the site for AI search tools.

## Layout
- `app/layout.tsx`: metadata, Google Fonts, and a small boot script that sets classes on `<html>` before paint.
- `app/page.tsx`: composes the home page sections.
- `app/(site)/**`: product, pricing, trust, contact, legal and other content pages. `app/docs/**`: documentation.
- `app/api/contact/route.ts`: the contact form endpoint.
- `app/globals.css`: all styles.
- `components/`: one component per section (`Nav`, `Hero`, `HeroFlow`, `LogoMarquee`, `Projects`, `Process`, `Integrations`, `Services`, `Stats`, `About`, `Testimonials`, `Pricing`, `FAQ`, `Journal`, `Footer`, `ContactForm`), plus shared pieces: `ui.tsx`, `Head.tsx`, `Sprite.tsx` (inline SVG icons), `CardArt.tsx` (card illustrations), `PageEffects.tsx` (scroll reveal and intro animation), `DocShell.tsx`, `SitePage.tsx`.
- `content/`: typed text and data for every section, doc and page, so copy can be edited without touching components. `content/pages/` holds the legal documents with their version history.
- `lib/contact.ts`: contact topics and validation. `lib/seo.ts`: metadata helpers. `lib/swarm-build.js`: the intro animation engine (excluded from ESLint on purpose).
- `public/`: images, team photos, logos (`public/logos/eco/` holds the Integrations and Ecosystem logos), payment badges, `llms.txt` and setup scripts.

## Site facts worth knowing
- Card payments are processed by **Stripe**. Tenvor never sees or stores card numbers.
- The **Login** button in the nav opens the console at https://tenvor.io/console.
- Careers link: https://binary.so/tenvor.
- Integrations and the Ecosystem strip list tools that accept an OpenAI-compatible API. Only the OpenAI SDKs, curl, Pi, OpenCode and JetBrains AI Assistant have Tenvor setup guides.

## Checking changes
- Check every change at phone (390 px), tablet (820 px) and desktop (1440 px) widths.
- `prefers-reduced-motion: reduce` turns off the intro, the hero diagram cycle, the count-ups, the card art motion, the team card animation, the Integrations hover motion and the FAQ animation.

## Notes
- The intro engine changes the DOM it builds after hydration, so React never sees a mismatch.
- In `next dev`, React Strict Mode runs effects twice; production runs them once.
- The dev server allows `127.0.0.1` as an origin (`allowedDevOrigins`).
- `drafts/` is local working material and must never be committed (stage with `git add -A -- . ':!drafts'`).
