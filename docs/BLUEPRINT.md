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

- **Office card:** Aangi Associates · 8615, Krupal Pathshala, Shivaranjani Cross Road, Ahmedabad · +91 90331 32791
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
Example: child age 5, goal at 18 (n=13), current cost ₹15L, inflation 9% → future cost ≈ ₹44.7L. No existing savings, 12% return → **≈ ₹15,800/month required SIP.**

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
Example: age 35, retiring 60 (n=25), living to 85 (m=25), monthly expenses ₹60,000, inflation 6% → expense at retirement ≈ ₹30.9L/yr. At 7% post-return → **corpus ≈ ₹4.9 Cr.** No existing savings, 12% pre-return → **≈ ₹32,300/month required SIP.**

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

### A. New Customer CRM
Pipeline: **Inquiry → Quote → Application → Underwriting → Bind/Issue → Renewal** (alerts at 60/30/14 days).
Modules: household & policy roster · renewal/churn alerts · claims tracking (mirrors the 4-step Claim Assistance system as real case records: Notified → Documentation → Insurer Liaison → Settled) · cross-sell signals (surfaced to Jainik, not auto-messaged to clients) · communication log (every WhatsApp/call/email touchpoint).

### B. Associate & Staff Onboarding (two tracks, one shared task-allotment engine)

**Track 1 — Associate (Field Advisor), regulated (IRDAI/PoSP):**
Application (via Become-an-Associate form → Candidate record) → Document collection (ID/PAN/Aadhaar, education proof min. Class 10, address proof, bank details, photo) → Mandatory pre-code IRDAI/PoSP training tracked to completion → Exam/assessment (IC-38 or insurer-specified) → Code issued (Candidate → Active Associate) → Days 1–30: mentor assigned, product training, shadowing (KPIs: modules completed, simulations run) → Days 31–60: supervised client interactions, first quotes → Days 61–90: first policy bound independently, pipeline targets, formal evaluation.

**Track 2 — Staff (Back-Office Employee), internal/HR, no licensing:**
Day 0: offer, documents, employment agreement → Day 1: system access provisioned, SOPs walkthrough → Week 1: role-specific training (claim desk / client servicing / admin ops) → Ongoing: task allotment, weekly review cadence.

**Task allotment engine (shared):** assign task → owner + due date + linked client/candidate record → status (To Do/In Progress/Done) → visible on assignee's dashboard and assigner's team view.

### C. Roles & Login (4-tier)
- **Admin** — Jainik + leadership. Full visibility. Only Admin creates Staff/Admin accounts.
- **Staff** — back-office. Client CRM + claim desk access, completes assigned tasks. Cannot create Staff/Admin or approve associate licensing.
- **Associate** — field advisors. Sees only their own clients/candidates/tasks.
- **Client** — confirmed for v1. Phone+OTP login; account created by Admin/Staff at policy issuance (not public self-registration). Dashboard: My Policies (documents/certificates), Claim Status Tracker (mapped to the 4 claim steps), renewal dates, "Message my advisor" WhatsApp deep-link. RLS scopes every query to `client_id = auth.uid()`.

### D. Repository Architecture
See `CLAUDE.md` → Repo structure. One GitHub repo, two runtimes: `apps/website` (static) + `apps/crm` (React/Vite/Supabase), sharing `packages/ui`.

### E. Admin Settings & Integrations
- **Meta Official API (WhatsApp Business Platform)** — fields: App ID, WhatsApp Business Account ID, Phone Number ID, Permanent System-User Access Token, Webhook Verify Token. Save & Test pings Meta's Graph API to verify → status flips to Connected automatically. Unlocks automated WhatsApp templates (renewal reminders, review requests, claim status updates) beyond v1's plain click-to-chat link.
- **Email Automation** — fields: provider (SMTP/SendGrid/Postmark/Resend), API key or SMTP credentials, sender name & verified from-address. Same save-and-test pattern. Ships as credential placeholders + settings UI now; automated sequences (renewal/welcome/onboarding drip emails) follow once real credentials are supplied.
- **Calculator Configuration Panel** — one page listing all 4 calculators with editable default assumptions (discount rate, income growth, education inflation, SIP return, pre/post-retirement return, default retirement age, default life expectancy). Architecture note: the website's calculators do a lightweight read-only fetch to Supabase for current defaults on page load, instead of hardcoded JS constants — the only place the "static site" touches a backend call.

### F. Infrastructure — Supabase Build-Then-Handoff Plan
See `CLAUDE.md` → Locked decisions and Build order. Build on developer's free-tier project (test accounts only) → after ~5 days, create a dedicated project under Jainik/Aangi Associates' own Supabase account → replay versioned migrations, dump/restore real data → re-point env vars (config change only) → recreate real logins on the new project (Auth credentials don't migrate cleanly across projects).

---

## Compliance text

See `CLAUDE.md` → "Compliance footer" for the verbatim disclaimer to use until a real IRDAI number is supplied.
