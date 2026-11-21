# Tenvor Compute website

The marketing site, docs and legal pages for Tenvor, the open-model GPU cloud. Built with Next.js 16 (App Router) and TypeScript.

## Run
```bash
npm install
npm run dev      # http://localhost:3000 (any port: npm run dev -- -p 3107)
npm run build    # production build (type check included)
npm run start    # serve the build
npm run lint
```
Set `NEXT_PUBLIC_SITE_URL` in production so the Open Graph image URL is absolute. Fonts come from Google Fonts (Funnel Display, Funnel Sans, Geist Mono).

## Layout
- `app/layout.tsx`: metadata (title, description, Open Graph image, favicon, touch icon), Google Fonts, and a small boot script that sets classes on `<html>` before paint.
- `app/page.tsx`: composes the home page sections.
- `app/docs/**`: documentation pages; `app/(site)/**`: product, trust, legal and other content pages.
- `app/globals.css`: all styles.
- `components/`: one component per section (`Nav`, `Hero`, `HeroFlow`, `LogoMarquee`, `Projects`, `Process`, `Integrations`, `Services`, `Stats`, `About`, `Testimonials`, `Pricing`, `FAQ`, `Journal`, `Footer`), plus shared pieces: `ui.tsx`, `Head.tsx`, `Sprite.tsx` (inline SVG icons), `CardArt.tsx` (isometric card illustrations), `PageEffects.tsx` (scroll reveal and intro animation), `DocShell.tsx`, `SitePage.tsx`.
- `content/`: typed text and data for every section, doc and page, so copy can be edited without touching components.
- `lib/swarm-build.js`: the intro animation engine, started from `PageEffects` and cleaned up on unmount. Excluded from ESLint on purpose.
- `public/`: images, logos, payment badges and setup scripts.

## Motion
`prefers-reduced-motion: reduce` turns off the intro, the hero diagram cycle, the count-ups, the card art motion and the FAQ animation.

## Notes
- The intro engine changes the DOM it builds after hydration, so React never sees a mismatch.
- In `next dev`, React Strict Mode runs effects twice; production runs them once.
- The dev server allows `127.0.0.1` as an origin (`allowedDevOrigins`).
