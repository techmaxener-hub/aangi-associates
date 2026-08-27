# Aangi Associates — Project Brief for Claude Code

This file is read automatically by Claude Code at the start of every session in this repo. It orients any session (yours in Windsurf, or a fresh one later) without needing the original planning conversation.

Full detail (sitemap, page-by-page copy, calculator formulas, CRM architecture) lives in `docs/BLUEPRINT.md` in this same repo — read that before building any specific page or feature. This file is the fast-orientation summary + the decisions that are already locked.

## What this is

Executive advisory portal + internal CRM for **Jainik Shah**, Chief Business Associate Leader with TATA AIA Life Insurance, brand name **Aangi Associates**. Client-first funnel (insurance/wealth clients) with a secondary funnel for recruiting and mentoring new advisors (CBA Mentorship Wing).

- Founder: Jainik Shah, 17+ years experience, 1,400+ client families, MDRT-recognised practice
- Office: 615, Krupal Pathshala, Shivaranjani Cross Road, Ahmedabad · +91 90331 32791
- GSTIN: 24ACBFA747OP1Z2
- Brand line: "Protecting What Matters. Securing What You Build."
- IRDAI/corporate-agent license number: not yet available — footer disclaimer ships with a visible `[IRDAI Registration / Corporate Agent Code — to be inserted]` placeholder, never a fabricated number.
- MDRT tier: unknown — use generic "MDRT-Recognised" language only, never a specific tier or year count.
- Testimonials: no real client quotes on file yet — ship clearly-marked placeholder cards, never fabricated quotes.

## Locked decisions (do not re-litigate without asking the user)

- Dual funnel, **client-first**: protection/wealth solutions primary, "Become an Associate" secondary but always present in nav.
- **Multi-page site**, not single-page scroll.
- **Elevated executive palette**: navy/charcoal base, crimson + gold accents (see tokens below) — not the logo's bold flat red/blue.
- **Lead capture v1 = WhatsApp click-to-chat** (format form inputs into a pre-filled `wa.me` link to +91 90331 32791). No backend needed for this specific flow.
- Website and CRM are built **in parallel**, sharing one design-token set (`packages/ui`) for visual consistency.
- CRM stack: **React + TypeScript + Tailwind + shadcn/ui + Supabase** (same pattern as the existing `yourdigipartners-crm` project — reuse conventions, e.g. migrations are additive-only, never edit an applied migration).
- Roles: **Admin / Staff / Associate / Client** (4-tier). Only Admin creates Staff/Admin accounts.
- Client gets a **self-service portal** (phone+OTP login), account created by Admin/Staff at policy issuance, not public self-registration.
- **Supabase plan**: build on the developer's free-tier project first (test accounts only — no real client data). After ~5 days, migrate schema + real data to a **new, dedicated Supabase project created under Jainik/Aangi Associates' own Supabase account** (client owns their own infra/billing going forward). Only the database migrates — the codebase in this repo does not change, just its `SUPABASE_URL` / key env vars get re-pointed.
- Hosting: static build output (both `apps/website` and the compiled `apps/crm` bundle) deploys to the client's existing **Hostinger Business hosting**, on the subdomain **`aa.tmarinternational.com`** (created under the `tmarinternational.com` domain already on that hosting account). No WordPress, no drag-drop builder.

## Design tokens

```css
/* light (default) */
--bg:#f7f4ee; --surface:#ffffff; --surface-2:#efe8d8;
--text:#1b2333; --text-soft:#5b6272;
--line:#e1d9c3; --line-strong:#cdc2a3;
--navy:#0f2a4a; --on-navy:#f6f3ea;
--crimson:#9c1c30; --gold:#8f6f26;

/* dark */
--bg:#0b1526; --surface:#10192c; --surface-2:#172542;
--text:#ece8dc; --text-soft:#a7aec2;
--line:#253355; --line-strong:#34467a;
--navy:#14294a; --on-navy:#f2eee0;
--crimson:#e2687a; --gold:#d9b96a;
```

Fonts (Google Fonts): **Fraunces** (headings/display), **Public Sans** (body), **IBM Plex Mono** (formulas, data, code-like UI).

## Repo structure

```
aangi-associates/
├── CLAUDE.md                  ← this file
├── docs/
│   └── BLUEPRINT.md            ← full sitemap, page copy, calculator specs, CRM architecture
├── apps/
│   ├── website/                ← public site (static HTML/Tailwind CLI-compiled/vanilla JS)
│   │   ├── index.html, solutions.html, claims.html, about.html,
│   │   │   calculators.html, associate.html, testimonials.html, contact.html
│   │   └── assets/ (Lucide icons, calculators.js, whatsapp-cta.js)
│   └── crm/                    ← internal platform (React + Vite + TS)
│       ├── src/
│       │   ├── portals/admin/  portals/staff/  portals/associate/  portals/client/
│       │   ├── modules/clients/  modules/onboarding/  modules/tasks/  modules/settings/
│       │   └── auth/ (Supabase auth + RLS-based role checks)
│       └── supabase/ (schema, RLS policies, migrations — additive only)
└── packages/
    └── ui/                      ← shared design tokens + component primitives used by both apps
```

## Build order (locked — two-pass website build)

1. Scaffold the repo structure above; init git; first commit.
2. `packages/ui` — design tokens (CSS variables above), Fraunces/Public Sans/IBM Plex Mono setup, base component primitives (buttons, cards, badges, nav, footer) shared by both apps.
3. **Pass 1 — Structural scaffold, all 8 pages at once.** Create all 8 `apps/website` HTML files (Home, Solutions, Claim Assistance, About Jainik, Calculators, Become an Associate, Testimonials, Contact) with: shared header/footer wired in from `packages/ui`, correct section order per `docs/BLUEPRINT.md` §02's wireframe blocks for each page, and placeholder copy (`[Hero headline placeholder]` etc.) — no final copy, no interactivity yet. Goal: the full site is click-through-able and structurally complete end to end before any single page is "finished."
4. **Pass 2 — Copy + interactivity, all pages.** Go page by page filling in the real drafted copy from `docs/BLUEPRINT.md` §02, then wire interactivity: WhatsApp-prefilled-message CTAs everywhere, the modal lead-capture form, the 4 calculators (§03 formulas) on the Calculators page, glassmorphism/animation polish per the brief.
5. `apps/crm` scaffold — Supabase project (developer's free tier for now), auth, 4-tier roles/RLS, base layout per portal.
6. CRM modules — Client CRM (§06A) → Associate/Staff onboarding tracks (§06B) → task allotment engine → Admin settings (Meta API, email automation, calculator config) (§06E).
7. Deployment — Tailwind CLI production build for `apps/website`; Vite production build for `apps/crm`; both uploaded to Hostinger Business hosting.
8. At the 5-day mark: create the client-owned Supabase project, replay migrations, dump/restore any real data, re-point env vars, recreate real logins.

## Compliance footer (use verbatim until a real IRDAI number is supplied)

> Aangi Associates is an insurance and financial advisory practice led by Jainik Shah, associated with TATA AIA Life Insurance Company Ltd. as a Chief Business Associate (CBA). Insurance is the subject matter of solicitation. For more details on risk factors, terms and conditions, and exclusions, please read the sales brochure and policy wording carefully before concluding a sale. [IRDAI Registration / Corporate Agent Code — to be inserted]. Mutual Fund investments referenced on this site are subject to market risks; please read all scheme-related documents carefully before investing. Tax benefits mentioned, if any, are subject to changes in applicable tax laws. This website is for general informational purposes only and does not constitute financial, legal, or tax advice — please consult directly with Jainik Shah / Aangi Associates for advice specific to your situation. GSTIN: 24ACBFA747OP1Z2. Registered Office: 615, Krupal Pathshala, Shivaranjani Cross Road, Ahmedabad.

## Guardrails

- Never fabricate testimonials, review counts, an IRDAI license number, or an MDRT tier — use the placeholders above until real values are supplied.
- Never commit real Supabase/Meta/email credentials to the repo — settings pages write to Supabase's secrets storage, not `.env` files checked into git.
- Calculator results always ship with: "Illustrative estimate, not financial advice."
