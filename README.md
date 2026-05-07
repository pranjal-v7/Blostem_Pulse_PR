# BlostemPulse

**AI-powered B2B prospect intelligence for Indian fintech sales teams.**

---

## Problem

Selling compliance and infrastructure software to Indian fintech companies (NBFCs, neobanks, lending platforms) is brutally manual. Sales reps waste hours every week:

- **Manually scouring** news sites like Inc42, ETBFSI, and YourStory for buying signals — funding rounds, product launches, regulatory changes.
- **Guessing** which prospects are actually ready to buy, with no data-driven prioritisation.
- **Writing cold outreach** from scratch for every prospect, with no guardrails for RBI/SEBI compliance in messaging.
- **Losing track** of macro events (RBI repo rate changes, new lending guidelines) that shift an entire sector's urgency overnight.

The result: low conversion rates, wasted pipeline, and missed timing on deals that were winnable.

## Solution

BlostemPulse is a real-time sales intelligence dashboard that automates the entire top-of-funnel workflow:

| Feature | What it does |
|---|---|
| **Prospect Radar** | Displays all tracked fintech companies ranked by a live **intent score** (0–100), segmented into Hot / Warm / Cold leads with animated KPI counters. |
| **Deep Scan** | One-click per-company (or batch "Scan All") that hits a Supabase Edge Function to fetch fresh signals from fintech news sources and re-score intent in real time. |
| **ICP Editor** | Users define their Ideal Customer Profile (company type, geography, free-text description). Saving triggers an AI-powered rescore of every prospect against the new ICP. |
| **Company Detail** | Drill-down view with contact info, signal timeline (grouped by recency), AI-generated alignment analysis, and relevant macro events. |
| **Outreach Engine** | Select a prospect → pick stakeholder (CTO/CFO/Founder) and tone → generate a personalised email via AI → auto-check RBI/SEBI compliance → one-click auto-fix flagged issues → open in Gmail. |
| **Macro Alerts** | Banner-style dismissible alerts for sector-wide regulatory or market events that affect scoring. |
| **Auth & Onboarding** | Full sign-up / sign-in flow (email + Google OAuth) with a guided onboarding wizard that captures user role, company type, geography, and ICP. |

## How to Run

### Prerequisites

- **Node.js** ≥ 18
- A **Supabase** project with the following tables: `prospects`, `signals`, `macro_events`, `profiles`, `emails_sent`
- Supabase Edge Functions deployed: `deep-scan`, `score-intent`, `fetch-signals`, `generate-email`, `check-compliance`, `auto-fix-compliance`

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/pranjal-v7/Blostem_Pulse_PR.git
cd Blostem_Pulse_PR

# 2. Install dependencies
npm install

# 3. Create a .env.local file with your Supabase credentials
#    VITE_SUPABASE_URL=https://<your-project>.supabase.co
#    VITE_SUPABASE_ANON_KEY=<your-anon-key>

# 4. Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Production Build

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build locally
```

The project is configured for **Vercel** deployment (see `vercel.json` for SPA rewrites).

## Architecture

BlostemPulse is a **React 18 SPA** built with Vite, using React Router for client-side routing and Supabase as the entire backend (auth, Postgres database, and Edge Functions). The frontend is organised into pages (`RadarPage`, `CompanyDetailPage`, `OutreachPage`, `SettingsPage`) wrapped in a protected `AppShell` layout with a sidebar, and all prospect data flows through a `useRealtimeProspects` hook that subscribes to Supabase's real-time channel for live score updates. AI-heavy operations — signal fetching, intent scoring, email generation, and compliance checking — are offloaded to **Supabase Edge Functions** (Deno), keeping the client thin and the API keys server-side. The UI uses a custom dark-mode design system (CSS custom properties + glassmorphism) with Framer Motion for animations and Lucide for icons.

## Tech Stack

- **Frontend:** React 18, React Router 6, Framer Motion, Lucide React
- **Styling:** Tailwind CSS 3 + custom CSS design system (Inter + JetBrains Mono)
- **Backend:** Supabase (Auth, Postgres, Realtime, Edge Functions)
- **Build:** Vite 6
- **Deployment:** Vercel

---

> Built for the Blostem hackathon — turning raw fintech signal noise into actionable, compliant sales outreach.
