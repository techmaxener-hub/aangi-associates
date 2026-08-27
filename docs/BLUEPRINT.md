# Aangi Associates — Full Blueprint

Companion to `CLAUDE.md`. Reference this when building any specific page, calculator, or CRM module. Web version (visual): the published artifact from the planning conversation — not reachable from Claude Code, so this file is the source of truth for local builds.

---

## 01 — Sitemap

Persistent header on every page: Logo · Home · Solutions ▾ · Claim Assistance · About Jainik · Calculators · Testimonials · Contact, plus a right-aligned dual CTA — primary **Talk to an Advisor** (crimson, → WhatsApp) and secondary **Become an Associate** (gold outline, → Associate page).

Pages: `01 Home` · `02 Solutions` · `03 Claim Assistance` · `04 About Jainik` · `05 Calculators` · `06 Become an Associate` · `07 Testimonials` · `08 Contact`.

Footer (every page): Solutions quick-links · Compliance & disclaimer block (see `CLAUDE.md`) · Office address & GSTIN · Phone/WhatsApp/email · social · sitemap links.

---

## 02 — Page-by-Page Wireframe & Copy

### 01 · Home
**Goal:** establish credibility in one scroll, route to Solutions or WhatsApp within the first two sections.

Section order: Hero → Trust Strip → Solutions Matrix Preview → Claim Assistance Teaser → About Preview → Associate Funnel Band → Testimonials Strip → Final CTA.

- **Hero headline:** "Protecting What Matters. Securing What You Build."
- **Hero subhead:** Jainik Shah · Chief Business Associate Leader, TATA AIA Life Insurance · 17+ Years of Advisory Experience
- **Hero body:** Committed to financial protection, stability, and long-term growth for 1,400+ client families across Ahmedabad — backed by a hassle-free claim assistance record and MDRT-recognised advisory practice.
- **CTAs:** "Talk to an Advisor →" (primary) / "Explore Solutions" (secondary)
- **Trust strip:** 17+ Years in the Industry · 1,400+ Satisfied Client Families · MDRT-Recognised Practice · Official TATA AIA CBA Partner
- **Associate funnel band headline:** "Build a career, not just a policy book."
- **Associate funnel body:** The CBA Mentorship Wing trains and onboards new advisors under Jainik Shah's direct leadership. Structured, licensed, and built on 17 years of field experience.

### 02 · Solutions
**Goal:** filterable advisory matrix, not a flat product list.

Section order: Page Header → Matrix Grid (filter tabs: Protection / Wealth / Retirement / Business / General) → Portfolio Review CTA → Advisory CTA.

- **Header headline:** "One advisory relationship. Every stage of your life."
- **Header subhead:** From your first term plan to legacy transfer — structured, reviewed, and claim-ready.
- **5 categories:**
  1. Life & Risk Protection — Pure Term Plans, Critical Illness Cover, Comprehensive Family Mediclaim
  2. Wealth & Guaranteed Solutions — Child Education Planning, Grand Wedding Corpus, Guaranteed Return/Endowment Plans, Mutual Fund Solutions
  3. Retirement & Estate Design — Lifetime Pension/Annuity Structuring, Legacy Transfer
  4. Business & Corporate Risk — Keyman Insurance, Business & Partnership Liability, Group Health Cover
  5. General Insurance — Two-Wheeler, Private Car, Commercial Asset Insurance
- **Portfolio Review CTA:** "Not sure if your existing policies still fit your life? Get a free Portfolio Review & Audit — we check coverage gaps, lapsed benefits, and better-fit alternatives, at no cost."

### 03 · Claim Assistance
**Goal:** make the claim process feel inevitable and safe.

Section order: Hero → 4-Step System (horizontal stepper) → Dedicated Claim Desk → FAQ Accordion.

- **Hero headline:** "Claims shouldn't be a second crisis."
- **Hero body:** Aangi Associates runs a dedicated claim desk so every family we insure has a direct line of support — from the first notification to final settlement.
- **The 4 steps:**
  1. **Immediate Notification** — One WhatsApp message or call to the dedicated claim desk starts the process the same day.
  2. **Documentation Support** — Our team prepares and verifies the paperwork with you, so nothing is rejected on a technicality.
  3. **Insurer Liaison** — We follow up directly with TATA AIA / the respective insurer on your behalf.
  4. **Settlement Confirmation** — We confirm the payout with the family and stay available for anything that follows.

### 04 · About Jainik
**Goal:** convert the MDRT trophy / awards / TATA AIA signage into the credibility story.

Section order: Hero (desk portrait, awards in frame) → Credentials Row → Story Block → Office Gallery.

- **Credentials row:** MDRT-Recognised Advisor · TATA AIA Chief Business Associate · Regional Champion Qualifier · 17+ Years in Financial Advisory
- **Story block:** Over 17 years, Jainik Shah has built Aangi Associates around one idea: insurance only matters if the claim actually gets paid, on time, without a fight. That focus on hassle-free claim assistance — not just policy sales — has earned the practice MDRT recognition and the trust of 1,400+ client families across Ahmedabad. Today, as Chief Business Associate Leader with TATA AIA Life Insurance, Jainik leads both a client advisory practice and a growing team of associates trained under the same standard.

### 05 · Calculators
**Goal:** 3 minutes of engagement ending in a WhatsApp-ready number.

Section order: Hero → Tool Tabs (4) → Result Panel (live output + "Discuss this result on WhatsApp", pre-filled).

- **Hero headline:** "Know your number before you decide."
- **Hero body:** Four calculators, one purpose — turn "I should probably plan for this" into an actual figure you can act on.

Full formulas: see §03 below.

### 06 · Become an Associate
**Goal:** the CBA Mentorship Wing recruitment funnel — distinct "opportunity" register, still on-brand.

Section order: Hero → Why Aangi (3 pillars) → Path Timeline → Associate Application (modal: name, phone, city, current occupation).

- **Hero headline:** "Build your own advisory practice — under a leader who's already built his."
- **Hero subhead:** The CBA Mentorship Wing at Aangi Associates
- **Hero body:** Jainik Shah didn't get to MDRT recognition alone, and you won't build a practice alone either. This is structured mentorship for people serious about a career in financial advisory — not a side gig.
- **3 pillars:**
  1. **Direct Mentorship** — trained personally under 17+ years of field experience, not a generic onboarding deck.
  2. **TATA AIA Backing** — licensed, structured, and backed by a recognised life insurer.
  3. **Built-In Support System** — the same claim desk and portfolio-review infrastructure that serves 1,400+ client families supports your clients too.
- **CTA:** "Apply to the Mentorship Wing →"

### 07 · Testimonials
**Goal:** social proof — no real quotes on file yet.

Section order: Hero ("1,400+ families, one standard of service") → Testimonial Grid (photo/initial, name, city, product, quote, rating).

Ships with 3 placeholder cards, each visibly marked `[Sample — replace with real client quote]` in code comments — nothing fabricated goes live by accident. Real quotes replace these as soon as the user supplies them.

### 08 · Contact
**Goal:** remove friction to WhatsApp and an office visit.

Section order: Hero → Contact Grid (Office card + Form card) → Map.

- **Office card:** Aangi Associates · 615, Krupal Pathshala, Shivaranjani Cross Road, Ahmedabad · +91 90331 32791
- **Form fields:** Name, Phone, Interested In (Protection/Wealth/Retirement/Business/General/Associate Program), Message → submits as a formatted WhatsApp message.

---

## 03 — Calculator Specifications

All results ship rounded, with the disclaimer: **"Illustrative estimate, not financial advice."**

### Calc 01 — Human Life Value / Term Insurance Need
**Inputs:** Current Age · Retirement Age (default 60) · Annual Income (₹) · Self-Consumption % (default 20%) · Expected Income Growth (default 5%) · Discount Rate (default 8%) · Outstanding Liabilities (₹, default 0) · Existing Life Cover (₹, default 0)

```
n  = Retirement Age − Current Age
NetIncome = Annual Income × (1 − Self-Consumption %)
r  = (1 + Discount Rate) / (1 + Income Growth) − 1

HLV = NetIncome × [ (1 − (1 + r)^−n) / r ]

Recommended Cover = HLV + Outstanding Liabilities − Existing Life Cover
```
Example: age 35, retiring 60 (n=25), income ₹18L, self-consumption 20% → net ₹14.4L/yr, growth 5%, discount 8% (r≈2.857%) → HLV ≈ ₹2.55Cr. + ₹30L loan − ₹50L existing cover → **≈ ₹2.35 Cr recommended additional cover.**

### Calc 02 — Child Education Planner
**Inputs:** Child's Current Age · Age at Goal (default 18) · Current Cost of Course (₹) · Education Inflation (default 9%) · Existing Savings Earmarked (₹, default 0) · Expected Return Rate (default 12%)

```
n = Age at Goal − Current Age
FutureCost = Current Cost × (1 + Education Inflation)^n
FV(ExistingSavings) = Existing Savings × (1 + Return Rate)^n
Shortfall = FutureCost − FV(ExistingSavings)

r_m = Return Rate / 12 ;  n_m = n × 12
Required Monthly SIP = Shortfall × r_m / [ ((1 + r_m)^n_m − 1) × (1 + r_m) ]
```
Example: child age 5, goal at 18 (n=13), current cost ₹15L, inflation 9% → future cost ≈ ₹46.0L. No existing savings, 12% return → **≈ ₹12,233/month required SIP.** *(Corrected 2026-08-28 — the previously-stated ₹44.7L/₹15,800 figures didn't follow from this formula; verified against `apps/website/assets/js/calculators.js`'s unit tests.)*

### Calc 03 — SIP Delay Cost Calculator
**Inputs:** Monthly SIP Amount (₹) · Expected Annual Return (default 12%) · Total Investment Horizon (years) · Delay Period (months/years)

```
r_m = Return Rate / 12
n_full  = Horizon × 12
n_delay = (Horizon × 12) − Delay(in months)

FV(no delay) = P × [ ((1+r_m)^n_full  − 1) / r_m ] × (1+r_m)
FV(delayed)  = P × [ ((1+r_m)^n_delay − 1) / r_m ] × (1+r_m)

Cost of Delay = FV(no delay) − FV(delayed)
```
Example: ₹10,000/mo, 12% return, 20-yr horizon vs. 3-year delay: FV(no delay) ≈ ₹99.9L, FV(delayed) ≈ ₹66.7L → **≈ ₹33.2L cost of a 3-year delay.**

### Calc 04 — Retirement Corpus Estimator
**Inputs:** Current Age · Retirement Age (default 60) · Life Expectancy (default 85) · Current Monthly Expenses (₹) · Inflation Rate (default 6%) · Pre-Retirement Return (default 12%) · Post-Retirement Return (default 7%) · Existing Retirement Savings (₹, default 0)

```
n = Retirement Age − Current Age
m = Life Expectancy − Retirement Age

ExpenseAtRetirement (annual) = CurrentMonthlyExpenses × 12 × (1+Inflation)^n
r_post = (1+PostReturn)/(1+Inflation) − 1

RequiredCorpus = ExpenseAtRetirement × [ (1 − (1+r_post)^−m) / r_post ] × (1+r_post)

FV(ExistingSavings) = ExistingSavings × (1+PreReturn)^n
NetCorpusNeeded = RequiredCorpus − FV(ExistingSavings)

r_m = PreReturn / 12 ;  n_m = n × 12
Required Monthly SIP = NetCorpusNeeded × r_m / [ ((1+r_m)^n_m − 1) × (1+r_m) ]
```
Example: age 35, retiring 60 (n=25), living to 85 (m=25), monthly expenses ₹60,000, inflation 6% → expense at retirement ≈ ₹30.9L/yr. At 7% post-return → **corpus ≈ ₹6.92 Cr.** No existing savings, 12% pre-return → **≈ ₹36,456/month required SIP.** *(Corrected 2026-08-28 — the previously-stated ₹4.9 Cr/₹32,300 figures didn't follow from this formula; verified against `apps/website/assets/js/calculators.js`'s unit tests.)*

---

## 04 — 10 Additional Robust Features (phase-2 menu, not yet scoped into v1)

1. **Protection Gap Score Quiz** *(client-side)* — 8–10 question interactive quiz scoring life/health/retirement readiness → WhatsApp CTA.
2. **Term vs Endowment vs ULIP Comparator** *(client-side)* — interactive side-by-side product table.
3. **Personalised Claim Document Checklist** *(client-side)* — pick a policy type, generate a printable checklist.
4. **Book-a-Consultation Slot Picker** *(client-side)* — date/time picker pre-fills the WhatsApp message.
5. **Financial Insights Hub** *(client-side)* — SEO articles linking back to calculators/CTAs.
6. **English / Gujarati / Hindi Toggle** *(client-side)* — language switch for hero, trust strip, key CTAs.
7. **Live Google Reviews Embed** *(needs light integration — Google Business Profile)* — real reviews once the profile exists and a real review-request campaign has run (see guardrails — never fabricate reviews).
8. **Video Testimonial / Intro Carousel** *(client-side)*.
9. **Mentorship Curriculum Timeline** *(client-side)* — expandable module-by-module syllabus for the Associate page.
10. **Dark / Light Mode Toggle** *(client-side)* — glassmorphism panels render well in the dark navy/gold theme.

---

## 05 — CRM & Team Platform Architecture

### A. New Customer CRM — built 2026-08-27
Pipeline: **Inquiry → Quote → Application → Underwriting → Bind/Issue** as `public.opportunities` (`stage` enum), one row per in-progress sale — `apps/crm/src/modules/clients/ClientDetailPage.tsx`'s Pipeline tab. **Renewal** tracked via `public.client_policies.renewal_date`, surfaced as a highlighted countdown on the Policies tab once within 60 days (a live threshold check, not a separate alerts table/cron job — the 60/30/14-day *notification* cadence from the original spec isn't built, just the visual flag).
Built modules: household & policy roster (`clients` + `client_policies`) · claims tracking mirroring the 4-step Claim Assistance system as real case records (Notified → Documentation → Insurer Liaison → Settled, `public.claims`, both a per-client tab and a cross-client Claim Desk queue) · cross-sell signals (derived client-side by checking which of the 5 solution categories have no active policy, shown as a banner on the client detail page — surfaced to Admin/Staff, never auto-messaged) · communication log (`public.communications`, WhatsApp/call/email/other + notes).
RLS: Admin/Staff full access; Associate scoped to `clients.owner_id = auth.uid()` (and child tables via a join back to `clients`); Client role scoped to `clients.portal_user_id = auth.uid()` for read-only self-view. **Client portal built 2026-08-27**: My Policies, Claim Status, and Renewals pages, all reading via this scoping. The `clients.portal_user_id` linkage itself is set automatically — `0006_client_portal_auto_link.sql` matches a client's first phone+OTP login against an existing `clients` row by phone (tolerant of formatting differences), no Admin action needed. Verified against the real project end-to-end.

### B. Associate & Staff Onboarding — built 2026-08-27 (single shared `candidates` table, `track` column distinguishes the two)

**Track 1 — Associate (Field Advisor):** `apps/crm/src/modules/onboarding/CandidatesPage.tsx` implements the stage sequence as a literal enum-like progression: application → documentation → training → exam → code_issued → days_1_30 → days_31_60 → days_61_90 → active_associate, advanced manually via a dropdown (no automated KPI tracking of modules-completed/simulations-run — that would need its own sub-schema, not built).

**Track 2 — Staff (Back-Office):** offer → documentation → system_access → week_1_training → active_staff, same page, filtered by track.

**Task allotment engine (shared, built):** `public.tasks` — title/description, `assigned_to` (any Admin/Staff/Associate profile), `due_date`, `status` (To Do/In Progress/Done, shown as a 3-column board), optional links to a client or candidate record (the create-task form exposes both as optional selects; linked clients render as a link to that client's detail page, candidates as plain text — no candidate detail route yet). Admin/Staff can create and assign; Associates see and update only tasks assigned to them (RLS-enforced, not just UI-hidden).

### C. Roles & Login (4-tier)
- **Admin** — Jainik + leadership. Full visibility. Only Admin creates Staff/Admin accounts.
- **Staff** — back-office. Client CRM + claim desk access, completes assigned tasks. Cannot create Staff/Admin or approve associate licensing.
- **Associate** — field advisors. Sees only their own clients/candidates/tasks.
- **Client** — confirmed for v1. Phone+OTP login; account created by Admin/Staff at policy issuance (not public self-registration). Dashboard: My Policies (documents/certificates), Claim Status Tracker (mapped to the 4 claim steps), renewal dates, "Message my advisor" WhatsApp deep-link. RLS scopes every query to `client_id = auth.uid()`.

### D. Repository Architecture
See `CLAUDE.md` → Repo structure. One GitHub repo, two runtimes: `apps/website` (static) + `apps/crm` (React/Vite/Supabase), sharing `packages/ui`.

### E. Admin Settings & Integrations

**Lead Ingestion & Integration Hub** (built 2026-08-27, `apps/crm/src/portals/admin/settings/`) — the real, expanded scope for this section, superseding the original single Meta/Email settings sketch below. Admin-only (`/admin/settings`), two groups in a left sub-nav:

- **API & Webhook Sources (15 channels)**: Meta Lead Ads, Google Ads Forms, IndiaMART, Justdial, TradeIndia, WhatsApp Cloud API, LinkedIn Lead Gen, Sulekha, Policybazaar POSP, Investwell, RedVision/Mint Pro, Calendly, Zapier/Make, Exotel, BNI Referral Bridge. Each has its own credential card (masked password fields with show/hide, copyable webhook URLs, per-channel status badge) backed by `apps/crm/supabase/migrations/0002_integrations_and_leads.sql`'s `integration_settings` table (one row per provider, `credentials` as JSONB, RLS restricted to `admin` via `current_role()`). This protects credentials server-side and keeps them out of the client bundle and out of `localStorage`, but it is **not** Supabase Vault-grade encryption at rest — upgrade to Vault + a service-role Edge Function before treating these as high-value production secrets.
  - **Honesty notes on what's simulated vs. real**: "Test Connection" is an explicit UI simulation (loading state → "200 OK" toast), not a live API call to each provider. Copyable webhook URLs point to the correct Supabase Edge Function URL pattern (`https://<project-ref>.supabase.co/functions/v1/leads-<provider>`) for where a receiver *would* live — no such functions are deployed yet, so these URLs aren't live. Wiring real per-provider OAuth/webhook receivers is future work, not yet scoped into a build step.
  - The WhatsApp Cloud API card here is what the original "Meta Official API (WhatsApp Business Platform)" bullet below described (Phone Number ID, WABA ID, System Access Token, Webhook Verify Token) — it's Meta Lead Ads (Facebook/Instagram lead forms) that's the newly-added, separate channel.
- **Lead Input & Ingestion**: Manual Single Lead (form → `leads` table, then opens a WhatsApp hand-off link, same pattern as the public site's forms), Bulk CSV Import (drag-and-drop, client-side parsing, phone/email duplicate detection against existing leads, real bulk insert — CSV only, `.xlsx` isn't wired up), Webforms & Calculators (copyable link-button/script snippets pointing to the real `calculators.html` on the live site — there's no chrome-less embeddable iframe widget yet, so this is a styled outbound link, not an inline form).
- Backing table: `public.leads` (full_name, phone, email, city, lead_type, source, owner, notes, status), admin-only RLS for now — Staff/Associate access lands with the full Client CRM pipeline (§05A/B) in a later migration.

Also built 2026-08-27, under Admin Settings' "Automation & Config" group:
- **Email Automation** (`automation.config.ts` + the same `IntegrationCard`/`integration_settings` machinery as the 15 lead sources) — fields: provider (SMTP/SendGrid/Postmark/Resend), API key or SMTP credentials, sender name & verified from-address. Credentials save for real; the automated sequences themselves (renewal/welcome/onboarding drip emails) are not built — this is credential storage only.
- **Calculator Configuration Panel** (`CalculatorDefaultsCard.tsx` + `public.calculator_config`, a singleton row) — editable defaults for all 4 calculators (self-consumption %, income growth, discount rate, education inflation/return, SIP return, retirement inflation, pre/post-retirement return, default retirement age, default life expectancy). **Verified live end-to-end**: `apps/website/assets/js/calculators.js` fetches this table read-only via the anon key on page load (RLS: public `select`, Admin-only `update`) and overrides the hardcoded HTML defaults — changing a value in the CRM and reloading the public calculators page picks it up immediately, confirmed by testing both sides against the real project. Falls back to the original hardcoded defaults if the fetch fails.

### F. Telephony & AI Calling Agents — built 2026-08-27 (`/admin/telephony`)

A dedicated Admin nav section, separate from the Lead Ingestion Hub, for voice/dialer infrastructure:

- **Provider credential cards** (Exotel Cloud IVR, Sarvam AI Voice Bot, TeleCRM/Agent Dialer, SquadStack On-Demand) — same `IntegrationCard`/`integration_settings` machinery as the 15 lead sources, extended with three new field types (`toggle`, `select`, `textarea`) to support Exotel's Auto-Record/Inbound-IVR switches and Sarvam's language selector + system-prompt editor. Sarvam ships with a pre-filled starter system prompt (founder facts already established elsewhere in this doc — 17+ years, 1,400+ clients, TATA AIA CBA — no fabricated MDRT tier or IRDAI number) that the Admin is expected to edit before connecting a real voice agent.
- **Auto-Dialer & Fallback Rules** (`DialerRulesCard.tsx` + `public.dialer_rules`, a singleton row like `calculator_config`) — dial-delay, max retries, and a post-call WhatsApp template. Configuration only; nothing dials yet.
- **Live Call Logs & Recordings Desk** (`CallLogsDesk.tsx` + `public.calls`) — a real table, admin/staff RLS. Empty until a real telephony webhook is deployed, but includes a working manual "Log a Call" form so it's usable immediately (Lead Name, Phone, Source, Language, Duration, Intent Score, Recording player if a URL exists, Warm Handoff / Dispatch WhatsApp / Re-queue actions).
- **Honesty boundary, stated plainly in the page itself**: none of the actual calling/voice-AI is real — no Exotel, Sarvam, TeleCRM, or SquadStack account exists. "Test" buttons simulate a result (same pattern as the Lead Hub's "Test Connection"). "Auto-Record Calls" is labeled as a plain toggle, not asserted as TRAI-compliant on its own — real compliance needs an actual consent/DND process, not a checkbox.
- **Webhook receiver — reference code, not deployed**: `apps/crm/supabase/functions/telephony-webhook/index.ts`. Written as a Supabase Edge Function (Deno), not Node/Express — this project has no Express server anywhere, so Express code would be dead weight. Parses an Exotel-shaped call-status payload, inserts into `public.calls`, and — for a completed call — looks up the already-stored WhatsApp Cloud API credentials (from the Lead Ingestion Hub's "whatsapp" provider) to send a real automated message via Meta's Graph API. Documented in the file's own header: exact Exotel field names should be verified against their current docs before deploying, and a business-initiated WhatsApp message like this generally needs a pre-approved template outside the 24-hour customer-session window, not free-form text.

### G. Infrastructure — Supabase (final)
The live Supabase project (org "CJDMS", account `cjdigital.dms@gmail.com`) is confirmed final as of 2026-08-27 — it's the agency account tied to Jainik/Aangi, not an interim developer project. The originally-planned build-then-handoff migration (free-tier project → new client-owned project after ~5 days) does not apply; all 5 migrations to date have been applied directly against this project and it stays the project of record going forward.

---

## Compliance text

See `CLAUDE.md` → "Compliance footer" for the verbatim disclaimer to use until a real IRDAI number is supplied.
