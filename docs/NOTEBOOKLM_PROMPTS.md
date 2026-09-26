# NotebookLM Prompts — Aangi Associates Platform

*Companion to CRM_BUILD_REPORT.md. Upload both files as sources, then paste the prompts below.*

## How to use

1. Create a new notebook in NotebookLM and add two sources: **CRM_BUILD_REPORT.md** and this file.
2. **Audio Overview:** open Studio, choose Audio Overview, press **Customize**, paste one of the audio prompts (A, B, C or D), then Generate.
3. **Video Overview:** open Studio, choose Video Overview, press **Customize**, paste one of the video prompts (E, F or G), then Generate.
4. If the customize box rejects a long prompt, use the **Short version** given under each one. I have not confirmed the box's exact limit.
5. Ask the follow-up questions in section 4 in the chat panel for written answers with citations.

**Keep the overviews honest.** Every prompt below tells NotebookLM to say what is live and what is not connected. If a generated overview claims AI calling, SMS codes, WhatsApp reminders, automatic lead feeds or public-calculator defaults work today, regenerate it. Section 18 of the report is the source of truth.

---

## 1. Audio Overview prompts

### A. Deep Dive for the practice owner (recommended first)

**Format:** Deep Dive. **Length:** Long.

> Explain this platform to the owner of an insurance and wealth-advisory practice who is not technical. Cover both halves: the public website and the internal CRM. Walk through every feature in the report: sign-in and the four roles (Admin, Staff, Associate, Client), the dashboards, Leads Desk, bulk lead upload, clients and the six client tabs, Claim Desk, tasks, onboarding, Business Planning, telephony, the audit log, the client portal, renewal reminders and the website's MDRT certificate row. For each one, say what problem it solves in the practice's daily work, then give the exact click path to try it using the demo data. Use concrete examples from the report, such as converting a Qualified lead into a client or comparing what an associate sees with what the admin sees. Be honest: clearly separate what works today from what is built but not yet connected (AI calling, SMS sign-in codes, WhatsApp reminders, automatic lead feeds, calculator defaults on the public site). Never read out passwords. Refer to Vaishali Jainikkumar Shah as a business partner in the practice, never as anyone's spouse.

**Short version:** Explain this insurance-advisory platform (website + CRM) to a non-technical practice owner. For each feature say what problem it solves and how to try it with the demo data. Separate what works today from what is not yet connected. No passwords.

### B. Brief (about two minutes)

**Format:** Brief.

> In under two minutes, tell an insurance-practice owner what this platform does, who uses it (Admin, Staff, Associate, Client), the three features that will save the most time, and the honest list of what is not yet connected. Plain language, no jargon.

### C. Critique / reality check (for the decision-maker)

**Format:** Critique.

> Review this platform as a sceptical advisor would. Which features are genuinely finished and useful, which are stored but not live, and what should the owner do before going live? Use section 18 of the report as the source of truth. Be fair and specific, and say what to fix first.

### D. Training audio for new associates and staff

**Format:** Deep Dive. **Length:** Default.

> Teach a new associate or staff member how to use the CRM in their first week. Focus on what an Associate sees (My Leads, My Clients, My Tasks, My Business Plan) and what Staff add (all clients, Claim Desk). Explain in order: signing in, finding a client with Ctrl+K, working a lead from New to Converted, logging a call, adding a policy, filing a claim, and reading the business plan. Use a friendly, encouraging tone and short practical steps.

---

## 2. Video Overview prompts

### E. Full product tour (recommended first)

**Format:** Explainer. **Visual style:** Clean and professional. Navy, gold and crimson would suit the brand.

> Make a step-by-step product tour of this platform for a practice owner, organised by role. Scene 1: what the platform is and the four roles. Scene 2: Admin dashboard (today panel, leads by source, renewals due in 60 days). Scene 3: Leads Desk with the New, Contacted, Qualified and Converted stages and why status changes need a real action and a note. Scene 4: a client page with its six tabs and the cross-sell signal. Scene 5: Claim Desk. Scene 6: what an Associate sees compared with Admin. Scene 7: Business Planning, the leaderboard, and how achievement is calculated from real policies rather than typed in. Scene 8: Audit Log. Scene 9: the client portal and renewal reminders. Scene 10: an honest closing slide listing what is live and what is not yet connected. For each scene state the benefit first, then the click path. Never show or read passwords.

**Short version:** Product tour of this insurance-advisory CRM by role (Admin, Staff, Associate, Client): dashboards, leads, clients, claims, business planning, audit log. Benefit first, then the click path. End with what is live versus not yet connected.

### F. Website and recognition (client-facing, about three minutes)

**Format:** Brief or Explainer.

> Present the public website of Aangi Associates, an Ahmedabad insurance and wealth-advisory practice led by Jainik Shah. Show the pages (Home, Solutions, Claim Assistance, Calculators, Become an Associate, Testimonials, Contact, FAQ), the calculators, and how a visitor reaches the team through WhatsApp. Feature the "Proven Excellence. Independently Validated." area: the four official MDRT Qualifying Member certificates for 2021, 2022, 2024 and 2025, and the trophy gallery of 26 awards. State the MDRT years exactly as written in the report. There is no 2023 certificate and no higher MDRT tier, so do not imply either. Describe Vaishali Jainikkumar Shah as a business partner in the practice. Keep the tone confident but factual. Say that testimonials are placeholders until real ones exist.

### G. One-minute teaser

**Format:** Brief.

> A one-minute overview of this platform for a busy insurance-practice owner: one place for leads, clients, claims and renewals; each advisor sees only their own clients; targets and achievement are measured from real policies; every important change is recorded. End with one line saying which parts are live and which are still being connected.

---

## 3. One prompt per feature (for short focused overviews)

Use these as the customize text when you want a short overview of one feature. Pair each with the matching section of the report.

| Feature | Prompt |
|---|---|
| **Sign-in and roles** (sections 2, 4) | Explain the four roles, what each can see, why an associate cannot see other advisors' clients, the 20-minute automatic sign-out, and how the client portal sign-in with a mobile number and code works (and why the code is not yet texted). |
| **Global search and notifications** (section 5) | Show how Ctrl+K search finds clients, leads and tasks in seconds, and how the notification strip tells each person what needs attention today. |
| **Dashboards** (section 6) | Explain each dashboard tile and panel and what decision it supports, for Admin and for an Associate. |
| **Leads Desk** (section 7) | Walk through moving a lead from New to Converted. Explain why each move needs a real action and a note, and what "Converted" guarantees. Include assignment and the Unassigned group. |
| **Bulk lead upload** (section 7.3) | Explain CSV/Excel import, the preview, and how duplicates are detected and skipped, with a small example. |
| **Clients and client detail** (section 8) | Tour the six tabs (Overview, Policies, Pipeline, Claims, Communications, Documents) and the cross-sell signal. Say why one page per family helps whoever answers the phone. |
| **Claim Desk** (section 9) | Explain the four claim stages, the Active versus All filter, and why a visible claims queue matters for an insurance advisor. |
| **Tasks** (section 10) | Explain creating a task linked to a client, assigning it, and how an associate works it through To Do, In Progress and Done. |
| **Onboarding** (section 11) | Explain the two recruitment tracks, their stages, and how the progress bar shows who is stuck. |
| **Business Planning** (section 12) | Explain setting a target and commission rule, why achievement is calculated from real policies, the leaderboard, and what an associate sees in read-only mode. |
| **Telephony** (section 13) | Explain the provider settings, dialer rules and call logs, and be clear that placing or answering calls is not connected yet. |
| **Audit Log** (section 14) | Explain what is recorded, how to filter it, and why it matters for regulated financial data. |
| **Renewal reminders** (section 16) | Explain the 60, 30 and 14-day milestones, why renewals matter to the practice, and why nothing is sent until WhatsApp credentials are added. |
| **Website recognition area** (section 17) | Describe the four MDRT certificates (2021, 2022, 2024, 2025), the gold-framed row, the trophy gallery and the viewer. State the years exactly. |

---

## 4. Follow-up questions for the chat panel

**Understanding**
- What is the difference between the Leads Desk and the Clients list?
- What actually happens to a lead when I click "Convert to Client"?
- How is an associate's achievement calculated, and where does the number come from?
- Why can an associate not change their own business plan?
- Which roles can see the Audit Log, and what does it record?

**Trial and demo**
- Give me a 20-minute demo script for the practice owner, with the exact clicks and which demo login to use at each step.
- Give me a 10-minute demo script for a prospective associate, focused on what they will see day to day.
- What should I try first if I only have five minutes?
- Which features can I not demonstrate live yet, and what should I say about them?

**Honesty and readiness**
- List every feature that is built but not yet connected, and what each one needs to go live.
- What must be done before real client data goes into this system?
- What happens when the demo data is flushed, and what is kept?

---

## 5. Hands-on trial checklist (for testers)

Sign in with the demo emails listed in the report (passwords are supplied separately, never inside these documents).

- [ ] Sign in as Staff (`demo.staff01@aangi-demo.test`). Confirm you land on the Staff dashboard.
- [ ] Press Ctrl+K and search a surname. Open a client.
- [ ] On the client page, read the cross-sell signal. Add a policy and choose a category.
- [ ] Log a call under Communications. Upload a small PDF under Documents.
- [ ] Open Leads Desk. Assign an Unassigned lead to an associate.
- [ ] Log first contact on a New lead, then mark a Contacted lead Qualified, then Convert a Qualified lead.
- [ ] Find the newly created client in Clients.
- [ ] Open Claim Desk. Move one claim forward, then switch the filter to All.
- [ ] Create a task linked to a client and assign it to an associate.
- [ ] Sign out. Sign in as an associate (`demo.associate01@aangi-demo.test`). Confirm you see only your own clients and the task you just assigned.
- [ ] Open My Business Plan and confirm it is read-only.
- [ ] As Admin, open Business Planning and the leaderboard, then the Audit Log to find your earlier changes.
- [ ] On the public website, open the 2022 certificate, use the arrows, then press Esc.
- [ ] On a phone, open the menu and find the LOGIN button.
- [ ] When finished, ask the owner to run the flush (section 20 of the report).

Note anything that surprises you. Surprises are what this trial is for.
