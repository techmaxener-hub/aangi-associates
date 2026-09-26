# Aangi Associates CRM — Detailed Build & Demo Guide

*Written 26 September 2026. Source document for a NotebookLM audio/video overview. It explains every feature of the CRM: what it is, why it is useful, and exactly how to try it with the demo data.*

---

## 1. What this system is

Aangi Associates is an insurance and wealth-advisory practice in Ahmedabad led by Jainik Shah, a Chief Business Associate with TATA AIA Life Insurance. The practice has 17+ years of experience and serves 1,400+ client families.

The platform has two halves:

1. **The public website** (`aa.tmarinternational.com`). Visitors read about solutions, use financial calculators, and contact the practice through WhatsApp click-to-chat.
2. **The internal CRM** (`aa.tmarinternational.com/app/`). A private, login-protected workspace where the team manages leads, clients, policies, claims, tasks, recruitment and performance targets.

**The problem it solves.** Before a system like this, a practice keeps leads in WhatsApp chats, client policies in spreadsheets, and renewal dates in someone's memory. Follow-ups get missed and renewals lapse. Nobody can say how much business each advisor produced this month. This CRM puts one connected record behind every lead and client, tells each person what to do today, and shows the owner how the whole team is performing.

### How it is built (plain language)
- **Front end:** a React web app (TypeScript) with a consistent navy, crimson and gold design. It works on phones as well as desktops.
- **Back end:** plain PHP with a MySQL database on the same Hostinger hosting as the website. There is no third-party database service.
- **Security model:** four roles, and every screen and every data request checks the role on the server. Users are signed out automatically after 20 minutes of inactivity, because the system holds real client financial data.

---

## 2. The four roles

| Role | Who they are | What they can see and do |
|---|---|---|
| **Admin** | The owner (Jainik) | Everything: all leads, clients, claims, candidates, tasks, business plans, telephony, settings and the audit log. Only Admin can create Staff and Admin accounts. |
| **Staff** | Back-office team | Leads Desk, all Clients, Claim Desk, Tasks. No settings, business planning, or audit log. |
| **Associate** | Field advisors | Only their own leads, clients, tasks and business plan. Cannot see other advisors' data. |
| **Client** | Policyholders | A self-service portal showing their own policies, claim status, renewals and documents. |

**Why this matters.** An advisor should not see another advisor's clients, and a client must never see anyone else's data. Each role sees only what it needs.

---

## 3. The demo dataset (for testing and demonstration)

A large, realistic, clearly fake dataset was loaded on 26 September 2026 so every screen has something to show. It is tagged so it can be removed with one command when testing ends (see section 12).

| Item | Count | Notes |
|---|---|---|
| **Leads** | 921 | 300 New, 240 Contacted, 170 Qualified, 101 Converted, 110 Dropped. 244 are unassigned, so assignment can be tested. Spread across 12 lead sources (Meta, Google Ads, Justdial, WhatsApp, IndiaMART and others) and 5 lead types (Term, Mediclaim, Mutual Funds, Keyman, Agent Recruitment). |
| **Clients** | 522 | Primary segments: Life 178, Health 136, General 104, Mutual Funds 104. Each has 1–3 policies. 35 clients have no owner, to test assignment. |
| **Policies** | 840 | 789 active, 44 lapsed, 7 matured. 56 active policies renew within the next 60 days. |
| **Staff logins** | 5 | Full back-office access. |
| **Associate logins** | 50 | Each owns roughly 9–10 clients. |
| **Opportunities** | 210 | Spread across the five sales-pipeline stages. |
| **Claims** | 26 | Across all four claim stages. |
| **Communications** | 410 | Logged calls, WhatsApp messages and emails. |
| **Candidates** | 44 | 32 associate recruits, 12 staff hires, at various onboarding stages. |
| **Tasks** | 170 | Overdue, due today, upcoming and done. |
| **Call logs** | 64 | For the Telephony call-log screen. |
| **Business plans** | 14 | Monthly and quarterly targets for 14 associates. |

**Safety design.**
- All demo phone numbers start with the digit 5, which is not a valid Indian mobile range, so no real person can be messaged by a WhatsApp button or reminder fired from demo data. To test messaging end to end, edit one client's phone to your own number.
- Demo emails use reserved test domains (`example.com` and `aangi-demo.test`), so nothing can reach a real inbox.
- The real records that already existed (the admin account, 2 clients, 1 lead) were not touched.

**Demo logins.** Sign in at `/app/login` with email and password:
- Staff: `demo.staff01@aangi-demo.test` through `demo.staff05@aangi-demo.test`
- Associates: `demo.associate01@aangi-demo.test` through `demo.associate50@aangi-demo.test`
- Passwords are individually generated and stored only in a private local file (`apps/crm-api/demo/DEMO_CREDENTIALS.csv`). They are deliberately not written in this document.

---

## 4. Signing in

### 4.1 Staff, Associate and Admin sign-in (email + password)
**What it is.** A sign-in page for the internal team.
**Why it is useful.** Only authorised people reach client data. After signing in, each person lands on the dashboard for their role.
**Try it.** Open `/app/login`, enter a demo staff email and its password, and you land on the Staff dashboard. Sign out from the sidebar, then sign in as an associate to compare what each role sees.
**Worth knowing.** Leave the tab idle for 20 minutes and you are signed out automatically.

### 4.2 Client portal sign-in (mobile number + one-time code)
**What it is.** Clients sign in with their mobile number and a 6-digit code. There is no password to remember.
**Why it is useful.** Clients can check their policies without calling the office.
**Try it.** Open `/app/client-login`, enter a client's phone number, and request a code.
**Worth knowing (important).** No SMS gateway is connected yet, so the code is generated and stored but not texted. During testing the code is written to the server's PHP error log. When a real SMS provider is added, delivery becomes automatic. The first successful login for a phone number creates the portal account and links it to the matching client record. Demo phone numbers start with 5 and could not receive real SMS anyway.

---

## 5. The workspace shell (common to every internal role)

### 5.1 Sidebar navigation and collapse
Each role sees only the menu items for its own work. On desktop the sidebar can shrink to icons to give data-heavy pages more room, and the browser remembers the choice. On phones it becomes a slide-in drawer.

### 5.2 Global search (Ctrl/Cmd + K)
**What it is.** One search bar that finds clients, leads, tasks and (for admin and staff) recruitment candidates.
**Why it is useful.** A client phones in and you find them in seconds, without browsing menus.
**Try it.** Press Ctrl+K anywhere in the app and type part of a name or phone number. Try it as an associate too: results are limited to that associate's own records.

### 5.3 Notification strip
A strip at the top shows your own numbers: tasks due today, your leads, and renewals due this week. It is a quick "what needs me now" check that cannot be missed.

### 5.4 Error handling
If a screen crashes, an error boundary shows a friendly message instead of a blank page, and the error is logged for the admin.

---

## 6. Dashboards

### 6.1 Admin dashboard
**What it is.** The owner's morning overview:
- A **Today** panel: overdue tasks, renewals due this week, and leads nobody has contacted yet.
- Headline tiles: **Total Clients, Active Policies, Open Claims, New Leads (30 days)**.
- **Business Plan — This Month:** target versus achieved.
- **Leads by Source:** shows which channels bring leads, so marketing spend can be judged.
- **Leads Pipeline:** how many leads sit at each stage.
- **Renewals Due (60 days):** the list to chase.
- **Task Board:** work in progress across the team.

**Why it is useful.** The owner sees the health of the whole practice on one page, without opening any report.
**Try it.** Sign in as the admin (the real admin account; demo data appears in every figure). Check that "Leads by Source" shows Meta, Google Ads, Justdial and the others in different proportions, and that Renewals Due lists roughly 56 policies.

### 6.2 Staff dashboard
The back-office landing page. Its menu leads to Leads Desk, Clients, Claim Desk and My Tasks.

### 6.3 Associate dashboard
Shows an advisor only their own leads, clients, tasks and business-plan progress. It motivates without exposing colleagues' numbers.
**Try it.** Sign in as `demo.associate01@aangi-demo.test`. You see about 9 clients and only the leads assigned to that person.

---

## 7. Leads

### 7.1 Leads Desk
**What it is.** A pipeline board with columns New, Contacted, Qualified and Converted, plus an optional Dropped column. Each card shows name, phone, city, lead type and source, and who it is assigned to.
**Why it is useful.** A lead is a potential client. The board shows where each one stands and makes sure each is worked, not forgotten.
**Design rule worth explaining.** Status cannot be changed with a free dropdown. Each move needs a real action with a note:
- **Log First Contact** (New → Contacted)
- **Mark Qualified** (Contacted → Qualified)
- **Convert to Client** (Qualified → Converted). This creates a genuine client record, so "Converted" always means a client actually exists.
- **Drop** (from any open stage), with a reason.
Every action stamps a dated note onto the lead.
**Assignment.** Admin and Staff can assign a lead to an associate or staff member. Associates see only leads assigned to them.
**Try it.**
1. As staff, open **Leads Desk**. Find a card in the **Unassigned** group and assign it to an associate.
2. On a New lead click **Log First Contact**, type a note and Confirm. The card jumps to Contacted.
3. Take a Qualified lead and click **Convert to Client**. A new client appears under **Clients**, owned by the same associate.
4. Sign in as that associate and confirm the lead appears under **My Leads**.

### 7.2 Manual lead entry (Admin → Settings → Lead Ingestion Hub)
**What it is.** A form to add a single lead: name, phone, email, city, lead type (Term, Mediclaim, Keyman, Mutual Funds, Agent Recruitment), owner and notes.
**Why it is useful.** For leads that arrive by phone, referral or at an event.
**Try it.** Add a lead with your own phone number, then find it in the Leads Desk under New.

### 7.3 Bulk lead upload (CSV or Excel)
**What it is.** Drag and drop a CSV or Excel file (columns: `full_name, phone, email, city, lead_type`). A preview shows each row before import and flags rows that are duplicates or missing a name or phone. The server also checks against leads already in the database, and after import a message states how many were added and how many were skipped as duplicates.
**Why it is useful.** Import hundreds of leads from an event, an ad export or an old spreadsheet in one step, without creating duplicates.
**Try it.** Make a small CSV of three rows, one duplicating a demo lead's phone number. Upload it and see the duplicate skipped.

### 7.4 Lead Ingestion & Integration Hub
**What it is.** A settings area with cards for 15 lead sources and tools: Meta Lead Ads, Google Ads Forms, IndiaMART, Justdial, TradeIndia, WhatsApp Cloud API, LinkedIn Lead Gen, Sulekha, Policybazaar, Investwell, RedVision/Mint Pro, Calendly, Zapier/Make, Exotel telephony and a BNI referral bridge. Each card stores that platform's credentials securely.
**Why it is useful.** It is the single place where the owner connects every lead channel.
**Honest status.** Credential storage is real. The receivers that automatically pull leads from those platforms are not built yet. Today leads enter through manual entry, bulk upload, or the website's WhatsApp path.

### 7.5 Web forms & calculator defaults
- **Web forms.** Provides copy-paste embed code (a plain HTML link and a script tag). Honest status: visitors are sent to the website calculators and use the WhatsApp button, and there is not yet a direct feed into the leads table.
- **Calculator defaults.** Admin sets the assumptions behind the public calculators: expected inflation, returns, retirement age and so on. Saved values are read live by the public website, so one change updates the calculators everywhere.
**Try it.** Change "SIP return %" and save, then open the public Calculators page and see the result move.

---

## 8. Clients

### 8.1 Clients list
**What it is.** A searchable table of clients with name, phone, household and last contact date. Admin and Staff can add a client (name and phone required, plus email, city, household name such as "Patel Family", and an owning associate). The list can be exported to CSV.
**Why it is useful.** The full book of business in one place, grouped by household so family members are seen together.
**Try it.** Search "Shah". Add a new client. Click Export CSV. As an associate, confirm you see only your own clients.

### 8.2 Client detail (six tabs)
Opening a client shows their contact details, a portal-access indicator, and a **cross-sell signal**: a highlighted note listing product categories in which the client has no active cover. This is a ready-made sales prompt.

1. **Overview.** Summary of the client and household.
2. **Policies.** Every policy with product, insurer, policy number, sum assured, premium, renewal date and status. Admin and Staff can add a policy (start date, renewal date, product type, and a Business Planning category so the sale counts towards associate targets). Each row has a renewal reminder message ready to send by WhatsApp.
3. **Pipeline.** Sales opportunities for this client (Inquiry → Quote → Application → Underwriting → Bind/Issue). Create an opportunity and advance its stage.
4. **Claims.** File a claim (optionally against a specific policy) and advance it through Notified → Documentation → Insurer Liaison → Settled.
5. **Communications.** A timeline of WhatsApp, calls, emails and other contacts, each with a note. A form logs new ones. Nothing said to a client gets forgotten when staff change.
6. **Documents.** Upload policy PDFs, ID proofs and similar files (10 MB maximum each), download them, and delete them. Clients can download their own documents from the portal.

**Why it is useful.** Everything about a family is on one page. Whoever picks up the phone has the full history.
**Try it.** Open a client with three policies. Note the cross-sell banner. In Policies, add a policy and choose a category. In Pipeline, create an opportunity and advance it. In Claims, file a claim and move it forward. In Communications, log a call. In Documents, upload a small PDF.

---

## 9. Claim Desk

**What it is.** A queue of every claim across all clients, with a stage selector on each. A filter switches between Active claims (not yet settled) and All. Moving a claim to Settled stamps the settlement date automatically.
**Why it is useful.** Claims are the moment of truth for an insurance advisor. The desk shows every open claim, so none stalls waiting for documents.
**Try it.** As staff open **Claim Desk**. Of the 26 demo claims, most are active. Advance one stage, then switch the filter to All. Then sign in as the linked client (if a portal account exists) to see the same status.

---

## 10. Tasks

**What it is.** A task board with To Do, In Progress and Done. Admin and Staff can create a task with a title, description, assignee, due date, and an optional link to a client or a recruitment candidate. Associates and staff see and update their own tasks. Tasks can be exported to CSV.
**Why it is useful.** It turns intentions such as "collect KYC documents" or "call about renewal" into owned, dated work. Overdue items surface on the dashboard.
**Try it.** As staff create a task linked to a client and assign it to an associate. Sign in as that associate and find it under **My Tasks**. Move it to In Progress, then Done.

---

## 11. Onboarding (recruitment) — Admin

**What it is.** The second funnel: recruiting and onboarding new people.
- **Associate track (field advisors), 9 stages:** Application → Documentation → Training → Exam → Code Issued → Days 1–30 → Days 31–60 → Days 61–90 → Active Associate.
- **Staff track (back office), 5 stages:** Offer → Documentation → System Access → Week 1 Training → Active Staff.
A progress bar on each candidate shows how far they have come, and each candidate has a detail page with notes and linked tasks.
**Why it is useful.** Growing a team of advisors is a business in itself. This shows who is stuck at which stage, so nobody drops out unnoticed.
**Try it.** Open **Onboarding**. Of 44 demo candidates, 32 are on the associate track. Change a candidate's stage, open the detail page, save a note, and create a linked task for them.

---

## 12. Business Planning

### 12.1 Admin view
**What it is.** The owner sets targets for each associate for a period (day, date range, month, quarter or year). For each product category (Life, General, Health, Mutual Funds, plus any the admin adds) the plan holds an expected premium, expected number of policies, and a commission rule (a percentage, or a flat amount per policy).
- **Achievement is never typed in.** It is calculated live from the policies actually sold in the client records, using each policy's Business Planning category.
- **Leaderboard** of associates by target versus achieved, plus commission earned.
- **Achievement by category** shows which lines are strong or weak.
- Plans can be **copied** to a new period, and the same targets can be **bulk-created** for many associates at once.
- Admin can **email a plan** to an associate as a formatted HTML summary, with notes.
- The system records when an associate has opened their plan.
**Why it is useful.** Targets become concrete and are measured automatically from real sales. Commission is worked out for each associate without spreadsheets.
**Try it.** Open **Business Planning** as admin. Fourteen demo plans exist (September 2026 and Q3). About 30% of demo policies started in the last 90 days, so achievement bars have real values. Open a plan, copy it to a new month, and view the leaderboard. (The email needs the associate to have an email address, which demo associates have, but delivery to the reserved test domain will not arrive by design.)

### 12.2 Associate view
**My Business Plan** is read-only. An associate sees their own targets, achievement and commission, but cannot edit them.
**Try it.** Sign in as `demo.associate01@aangi-demo.test` and open **My Business Plan**. Plans are seeded for associates 1–14; the others show an empty state.

---

## 13. Telephony & AI Calling — Admin

**What it is.** Three parts:
1. **Provider settings.** Secure storage for telephony and AI-calling provider credentials.
2. **Auto-dialer & fallback rules.** How long to wait after a lead arrives (seconds), the maximum number of retries, and a post-call WhatsApp message template, for example "Hi {{name}}, thanks for speaking with Aangi Associates."
3. **Live call logs.** A table of calls: lead name, number, source channel, language (Gujarati, Hindi, English), direction, duration, intent score (high, medium or low), recording, and a Re-queue action. Calls can be logged manually.
**Why it is useful.** Speed-to-lead wins business. The design lets a lead be called within a minute, retried automatically, and given a follow-up message.
**Honest status (the screen states this itself).** Storing credentials and logging calls are real. **Actually placing or answering calls is not connected**, because it needs a real provider account (Exotel, Sarvam or similar) and a deployed webhook receiver. The "Test" buttons simulate a result. The call log will fill automatically once that receiver ships.
**Try it.** Open the call logs (64 demo calls). Log a manual call. Re-queue a missed call. Edit and save the dialer rules.

---

## 14. Audit Log — Admin

**What it is.** A history of important changes: who changed what and when, with before and after values. It covers users, policies, opportunities and claims. It can be filtered by record type.
**Why it is useful.** Accountability. If a policy figure changes, the owner can see who changed it. That matters for regulated financial data.
**Try it.** Add a policy to a client or advance a claim, then open **Audit Log**. Your action appears at the top, with old and new values side by side.

---

## 15. Client portal (what the policyholder sees)

- **My Policies.** Their policies, plus **My Documents** they can download.
- **Claim Status.** Where each of their claims stands.
- **Renewals.** Upcoming renewal dates.
**Why it is useful.** Clients serve themselves, and calls to the office about "when is my premium due?" drop.
**Try it.** See the note in section 4.2 about receiving the sign-in code. Once a client is linked to a portal account, sign in and confirm they see only their own data.

---

## 16. Background automation: renewal reminders

**What it is.** A daily scheduled job finds policies whose renewal is 60, 30 or 14 days away and creates a reminder for each milestone. It sends them by WhatsApp when WhatsApp credentials are configured.
**Why it is useful.** Renewals are the practice's most reliable income. Automatic reminders stop policies lapsing through forgetfulness.
**Honest status.** With no WhatsApp credentials, each reminder is logged as "skipped, no credentials" instead of pretending to send. The daily schedule must also be set up once in Hostinger's cron settings. Because demo phone numbers are not real mobiles, turning this on during testing cannot message a real person.

---

## 17. The public website (brief)

Seven main pages: Home, Solutions, Claim Assistance, Calculators, Become an Associate, Testimonials and Contact, plus an FAQ. The **About** section sits directly under the homepage hero and includes the founder's profile, credentials and the awards gallery.
- **Calculators** use the admin-set defaults from section 7.5 and always show "Illustrative estimate, not financial advice."
- **WhatsApp click-to-chat** fills a message and opens WhatsApp to the practice's number, which is the primary way visitors become leads.
- The compliance footer carries a visible placeholder for the IRDAI registration number until a real one is supplied.
- Testimonials are clearly marked placeholders until real quotes exist.

---

## 18. What is real and what is not connected yet

| Area | Status |
|---|---|
| Login, roles, permissions, idle sign-out | **Working** |
| Leads Desk, assignment, conversion to clients | **Working** |
| Manual and bulk lead entry, de-duplication | **Working** |
| Clients, policies, pipeline, claims, communications, documents | **Working** |
| Tasks, onboarding, business planning and leaderboard, audit log | **Working** |
| Admin calculators feeding the public site | **Working** |
| Client portal login | **Working**, but the SMS code is not delivered until a provider is added (section 4.2) |
| WhatsApp renewal reminders | **Built**, waiting on WhatsApp credentials |
| Business-plan email | **Built**, uses the server's own mail, deliverability not guaranteed until the domain's mail authentication is set up |
| Automatic lead pull from Meta, Google, Justdial and the others | **Credentials stored; receivers not built** |
| AI/automatic calling | **Not connected**, needs a provider account and webhook |
| IRDAI number, real testimonials | **Placeholders** until real values exist |

---

## 19. Suggested 20-minute demo walkthrough

1. **Admin dashboard (2 min).** Point out the tiles, Leads by Source and Renewals Due.
2. **Leads Desk as staff (4 min).** Assign an unassigned lead, log contact, qualify, then convert to a client.
3. **Client detail (4 min).** Open the converted or any demo client: cross-sell banner, add a policy, log a call, upload a document.
4. **Claim Desk (2 min).** Advance a claim stage.
5. **As an associate (3 min).** Sign in as `demo.associate01`, show that only their own data is visible, then My Business Plan.
6. **Business Planning as admin (3 min).** Leaderboard and achievement by category.
7. **Audit Log (1 min).** Show that the earlier actions were recorded.
8. **Close (1 min).** Section 18: what is live and what is next.

---

## 20. When testing is finished: removing the demo data

All demo rows carry a recognisable ID prefix, so one command removes exactly the demo data and nothing else:
- Preview counts: `php apps/crm-api/demo/flush_demo.php`
- Delete: `php apps/crm-api/demo/flush_demo.php --yes`
It also removes any portal accounts or one-time codes created for demo clients, and it detaches (never deletes) any real record that was connected to a demo user during testing. The real admin account and the real records are never touched.

---

## 21. Suggested prompts for NotebookLM

**Audio Overview (customise):** "Explain this CRM to a non-technical insurance-practice owner. For each feature, say what problem it solves, then give the click path to try it. Flag clearly which features are live and which are not yet connected."

**Video Overview (customise):** "Walk through the 20-minute demo in section 19 as a step-by-step product tour with one scene per role: Admin, Staff, Associate and Client. Show what each role sees and why that matters."

**Follow-up questions to ask the notebook:** "What is the difference between Leads Desk and Clients?", "How is associate achievement calculated?", "Which features need external accounts before they work?", "What happens to a lead when it is converted?"
