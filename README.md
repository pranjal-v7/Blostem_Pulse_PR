# BlostemPulse 🔍

> **AI-powered autonomous B2B prospect intelligence for Indian fintech sales teams.**

[![Deployed on Vercel](https://img.shields.io/badge/Live%20Demo-Vercel-black?logo=vercel)](https://blostem-pulse-pr.vercel.app)
[![Built with Supabase](https://img.shields.io/badge/Backend-Supabase-3ecf8e?logo=supabase)](https://supabase.com)
[![React 18](https://img.shields.io/badge/Frontend-React%2018-61dafb?logo=react)](https://react.dev)

---

## 🧩 Problem

Selling compliance and infrastructure software to Indian fintech companies — NBFCs, neobanks, lending platforms — is **brutally manual**. Sales reps waste hours every week:

- **Manually scanning** Inc42, ETBFSI, YourStory, Entrackr, and Moneycontrol for buying signals: funding rounds, product launches, regulatory pressure.
- **Guessing** which prospects are ready to buy — no data-driven prioritisation, no AI reasoning.
- **Writing cold outreach** from scratch for every prospect with no guardrails against RBI/SEBI compliance violations in email copy.
- **Missing macro events** — an RBI circular or a sector-wide regulatory change can shift an entire vertical's urgency overnight.
- **Zero pipeline automation** — every step requires a human to initiate, monitor, and act.

The result: low conversion rates, wasted pipeline, and deals lost because the timing window passed unnoticed.

---

## 💡 Solution

BlostemPulse is a **zero-touch, real-time sales intelligence platform** that automates the entire top-of-funnel workflow — from discovering companies to scoring intent to generating compliant outreach — with no manual input required.

### Core Features

| Feature | Description |
|---|---|
| 🛰️ **Autonomous Prospect Radar** | Live dashboard of all tracked fintech companies ranked by AI-computed intent score (0–100), segmented into Hot / Warm / Cold leads with animated KPI counters and real-time Supabase Realtime updates. |
| ✨ **Freshly Discovered** | Auto-discovered companies found in the last 7 days are surfaced in a dedicated "Freshly Discovered" horizontal carousel at the top of Radar — always kept deduplicated and clickable to full detail. |
| 🤖 **Autonomous Discovery Engine** | Supabase Edge Function (`discover-prospects`) autonomously scans 7 Indian fintech RSS feeds (Inc42, ETBFSI, YourStory, Entrackr, LiveMint, Moneycontrol, Economic Times), extracts company entities via Gemini AI, validates each via SerpAPI, extracts metadata, inserts, and scores — zero human input. |
| ⏱️ **Scheduled Auto-Scans** | Configurable scan frequency (Manual / 2× daily / 4× daily) in IST, managed via `update-cron` Edge Function. A real-time toast notification fires after each automated scan reporting new prospects found. |
| 🔬 **Deep Scan** | One-click per-company or batch "Scan All" that hits the `deep-scan` Edge Function to re-fetch signals and re-score intent in real time. Score delta is animated inline on the card. |
| 🏢 **Company Detail** | Drill-down view with real contact info (CTO email, LinkedIn, company website), signal timeline grouped by recency, AI-generated alignment analysis with regulatory triggers and buy-window estimate, and a signal-weight breakdown showing exactly why the score is what it is. |
| ✍️ **Outreach Engine** | Select a prospect → pick stakeholder (CTO / CFO / Compliance Head / Founder) and tone → stream a personalised email via Gemini AI → auto-check 7 RBI/SEBI/DPDPA compliance rules → one-click auto-fix flagged violations → open directly in Gmail. |
| 🚨 **Macro Alerts** | Dismissible banner alerts for sector-wide regulatory events (RBI repo rate changes, new lending guidelines) that affect scoring across the pipeline. |
| ⚙️ **Settings & ICP Editor** | Define your Ideal Customer Profile (company type, geography, free-text description). Saving triggers AI-powered rescoring of every prospect against the updated ICP. Scan frequency and schedule are also managed here. |
| 🔐 **Auth & Onboarding** | Full sign-up / sign-in (email + Google OAuth) with a guided onboarding wizard capturing user role, company type, geography, and ICP. |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BLOSTEM PULSE ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────┐
  │     React 18 SPA (Vite)      │  ← Vercel CDN (Static)
  │                              │
  │  Pages:                      │
  │  ├── LoginPage               │
  │  ├── OnboardingPage          │
  │  ├── RadarPage               │◄──── useRealtimeProspects (hook)
  │  ├── CompanyDetailPage       │          │ Supabase Realtime WS
  │  ├── OutreachPage            │          │ prospects + signals tables
  │  ├── SettingsPage            │
  │  └── NotFoundPage            │
  │                              │
  │  Components:                 │
  │  ├── AppShell (sidebar)      │
  │  ├── Toast notifications     │
  │  └── AnimatedKPIs            │
  └──────────┬───────────────────┘
             │ HTTPS / REST + Realtime WS
             ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                    SUPABASE (Backend-as-a-Service)                │
  │                                                                    │
  │  ┌─────────────────┐    ┌──────────────────────────────────────┐ │
  │  │   Auth (GoTrue) │    │          PostgreSQL Database           │ │
  │  │  ─ Email/OAuth  │    │                                        │ │
  │  │  ─ RLS policies │    │  Tables:                               │ │
  │  └─────────────────┘    │  ├── prospects      (core entity)      │ │
  │                         │  ├── signals        (news events)      │ │
  │  ┌─────────────────┐    │  ├── macro_events   (RBI/SEBI alerts)  │ │
  │  │    Realtime     │    │  ├── profiles       (user ICP config)  │ │
  │  │  WebSocket sub  │    │  ├── emails_sent    (outreach log)     │ │
  │  │  on prospects   │    │  └── scan_logs      (auto-scan audit)  │ │
  │  │  + signals      │    └──────────────────────────────────────┘ │
  │  └─────────────────┘                                              │
  │                                                                    │
  │  ┌─────────────────────────────────────────────────────────────┐  │
  │  │               Edge Functions (Deno Runtime)                  │  │
  │  │                                                              │  │
  │  │  discover-prospects  ─ RSS scrape → AI entity extract →      │  │
  │  │                        SerpAPI validate → insert → score     │  │
  │  │                                                              │  │
  │  │  fetch-contact-info  ─ SerpAPI + Gemini → CTO email,         │  │
  │  │                        LinkedIn, website for any company     │  │
  │  │                                                              │  │
  │  │  deep-scan           ─ Fetch latest signals → re-score       │  │
  │  │                        intent for a single company           │  │
  │  │                                                              │  │
  │  │  score-intent        ─ Gemini AI scores 0–100 with           │  │
  │  │                        reasoning, signal weights, buy window │  │
  │  │                                                              │  │
  │  │  fetch-signals       ─ Pull new headlines for a company      │  │
  │  │                        from fintech RSS and news sources     │  │
  │  │                                                              │  │
  │  │  generate-email      ─ Stream personalised B2B email via     │  │
  │  │                        Gemini (stakeholder + tone aware)     │  │
  │  │                                                              │  │
  │  │  check-compliance    ─ 7-rule RBI/SEBI/DPDPA email checker   │  │
  │  │                                                              │  │
  │  │  auto-fix-compliance ─ Rewrite flagged sentences to be       │  │
  │  │                        compliant without changing intent     │  │
  │  │                                                              │  │
  │  │  update-cron         ─ Update auto-scan schedule (2×/4×      │  │
  │  │                        daily IST) via pg_cron                │  │
  │  └─────────────────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────┐
  │     External AI & Data APIs  │
  │  ├── Google Gemini 2.0 Flash │  ← AI reasoning & generation
  │  ├── SerpAPI                 │  ← Company validation & contact lookup
  │  └── 7× Indian Fintech RSS   │  ← Inc42, ETBFSI, YourStory,
  │       Feeds                  │    Entrackr, LiveMint, Moneycontrol, ET
  └──────────────────────────────┘
```

### Data Flow — Autonomous Discovery

```
Scheduled Cron (pg_cron, IST)
        │
        ▼
discover-prospects Edge Function
        │
        ├─ 1. Fetch headlines from 7 RSS feeds
        ├─ 2. Gemini AI: extract company entity names
        ├─ 3. SerpAPI: validate each entity (≥2 results = real company)
        ├─ 4. Gemini AI: extract sector / stage / city metadata
        ├─ 5. INSERT into prospects (is_new_entrant = true)
        ├─ 6. INSERT first signal into signals table
        └─ 7. score-intent: compute intent_score + AI analysis + signal_weights
                  │
                  └─ UPDATE prospects.intent_score, alignment_reason,
                         signal_weights, ai_analysis
        │
        └─ INSERT scan_log → triggers real-time toast to all connected users (IST)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Framer Motion, Lucide React |
| Styling | Custom CSS design system — dark mode, glassmorphism, CSS custom properties (Inter + JetBrains Mono) |
| Build Tool | Vite 6 |
| Backend | Supabase (Auth, PostgreSQL, Realtime, Edge Functions) |
| Edge Runtime | Deno (Supabase Edge Functions) |
| AI | Google Gemini 2.0 Flash (via Gemini API) |
| Search & Validation | SerpAPI |
| Deployment | Vercel (frontend) + Supabase Cloud (backend) |
| Scheduling | Supabase pg_cron |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A [**Supabase**](https://supabase.com) project (free tier works)
- A [**Google Gemini API**](https://aistudio.google.com/app/apikey) key
- A [**SerpAPI**](https://serpapi.com) key *(optional — falls back to AI validation if absent)*

---

### 1. Clone the Repository

```bash
git clone https://github.com/pranjal-v7/Blostem_Pulse_PR.git
cd Blostem_Pulse_PR
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

> Both values are found in your Supabase Dashboard → Project Settings → API.

### 4. Set Up the Supabase Database

Run the following SQL in your Supabase SQL Editor to create all required tables:

```sql
-- Prospects (core entity table)
CREATE TABLE prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sector TEXT,
  stage TEXT,
  hq_city TEXT,
  website TEXT DEFAULT '',
  intent_score INTEGER,
  alignment_reason TEXT,
  signal_weights JSONB,
  ai_analysis JSONB,
  is_new_entrant BOOLEAN DEFAULT false,
  needs_validation BOOLEAN DEFAULT false,
  discovery_source TEXT,
  discovery_headline TEXT,
  last_contacted TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Signals (news/funding events)
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
  headline TEXT,
  source TEXT,
  url TEXT,
  score_contribution INTEGER DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Macro events (RBI/SEBI alerts)
CREATE TABLE macro_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  source TEXT,
  sector_impact TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User profiles (ICP config)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company TEXT,
  role TEXT,
  company_type TEXT,
  geography TEXT,
  icp_definition TEXT,
  scan_frequency TEXT DEFAULT 'manual',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Emails sent (outreach log)
CREATE TABLE emails_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES prospects(id),
  user_id UUID REFERENCES auth.users(id),
  stakeholder TEXT,
  tone TEXT,
  email_body TEXT,
  compliance_passed BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Scan logs (auto-scan audit trail)
CREATE TABLE scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospects_found INTEGER DEFAULT 0,
  headlines_processed INTEGER DEFAULT 0,
  triggered_by TEXT DEFAULT 'cron',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Enable **Row Level Security** on `prospects`, `signals`, and `profiles` as needed, and enable **Realtime** for the `prospects` and `signals` tables in your Supabase Dashboard → Database → Replication.

### 5. Deploy Edge Functions

Install the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

Set the required Edge Function secrets:

```bash
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
supabase secrets set SERPAPI_KEY=<your-serpapi-key>      # optional
```

Deploy all functions:

```bash
supabase functions deploy discover-prospects
supabase functions deploy fetch-contact-info
supabase functions deploy deep-scan
supabase functions deploy score-intent
supabase functions deploy fetch-signals
supabase functions deploy generate-email
supabase functions deploy check-compliance
supabase functions deploy auto-fix-compliance
supabase functions deploy update-cron
```

### 6. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 7. Production Build

```bash
npm run build     # outputs to /dist
npm run preview   # preview locally before deploying
```

The project includes a `vercel.json` with SPA rewrites — deploy by connecting your GitHub repo to [Vercel](https://vercel.com) and adding `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel project settings.

---

## 📁 Project Structure

```
Blostem_Pulse_PR/
├── src/
│   ├── pages/
│   │   ├── LoginPage.jsx           ← Email + Google OAuth auth
│   │   ├── OnboardingPage.jsx      ← New user ICP wizard
│   │   ├── RadarPage.jsx           ← Main prospect dashboard + discovery
│   │   ├── CompanyDetailPage.jsx   ← Per-company drill-down + contact info
│   │   ├── OutreachPage.jsx        ← Email generation + compliance check
│   │   ├── SettingsPage.jsx        ← ICP editor + scan frequency
│   │   ├── ResetPasswordPage.jsx
│   │   └── NotFoundPage.jsx
│   ├── components/
│   │   ├── AppShell.jsx            ← Sidebar layout wrapper
│   │   └── Toast.jsx               ← Notification system
│   ├── hooks/
│   │   └── useRealtimeProspects.js ← Supabase Realtime data hook (with dedup)
│   ├── context/
│   │   └── AuthContext.jsx         ← Auth state provider
│   ├── lib/
│   │   └── supabase.js             ← Supabase client init
│   ├── App.jsx                     ← Routes + seed hook
│   └── index.css                   ← Global design system (dark mode, glassmorphism)
│
├── supabase/
│   └── functions/
│       ├── _shared/
│       │   ├── ai.ts               ← Gemini API wrapper
│       │   ├── prompts.ts          ← All LLM prompt templates
│       │   └── utils.ts            ← CORS headers, JSON parser
│       ├── discover-prospects/     ← Autonomous RSS discovery pipeline
│       ├── fetch-contact-info/     ← CTO email + LinkedIn + website lookup
│       ├── deep-scan/              ← Re-fetch signals + re-score single company
│       ├── score-intent/           ← AI intent scoring (0-100) with reasoning
│       ├── fetch-signals/          ← Pull fresh headlines per company
│       ├── generate-email/         ← Streamed personalised outreach email
│       ├── check-compliance/       ← RBI/SEBI/DPDPA 7-rule email checker
│       ├── auto-fix-compliance/    ← Rewrite non-compliant sentences
│       └── update-cron/            ← Update pg_cron scan schedule
│
├── index.html
├── vite.config.js
├── vercel.json                     ← SPA catch-all rewrite
├── package.json
└── .env.local                      ← (not committed) — your Supabase keys
```

---

## 🔑 Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous (public) key |

**Supabase Edge Function Secrets** (set via `supabase secrets set`):

| Secret | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key for all AI operations |
| `SERPAPI_KEY` | ⚠️ Optional | SerpAPI key — falls back to AI validation if absent |

---

## 📡 Edge Functions Reference

| Function | Trigger | What it does |
|---|---|---|
| `discover-prospects` | Cron / "Discover Now" button | RSS scrape → AI entity extract → SerpAPI validate → metadata → insert → score |
| `fetch-contact-info` | Company Detail page load | SerpAPI + Gemini → CTO/CFO email, LinkedIn URL, company website |
| `deep-scan` | "Scan" button per company | Fetch latest signals → re-score intent → update DB |
| `score-intent` | Post-insert, post-ICP-save | Gemini: score 0–100 with reason, signal_weights, ai_analysis |
| `fetch-signals` | deep-scan sub-call | Pull fresh fintech headlines for a company |
| `generate-email` | Outreach page | Stream personalised email (stakeholder + tone) via Gemini |
| `check-compliance` | Post email generation | 7-rule RBI/SEBI/DPDPA checker — returns flagged sentences + fixes |
| `auto-fix-compliance` | "Auto-Fix" button | Rewrite flagged sentences in-place to be regulation-safe |
| `update-cron` | Settings page save | Update pg_cron job for scan frequency (manual / 2× / 4× daily IST) |

---

## 🔒 Compliance Guardrails

All outreach emails are automatically checked against 7 Indian financial regulation rules before sending:

| Code | Rule | Source |
|---|---|---|
| V1 | Named investment product recommendation | SEBI / RBI |
| V2 | Unqualified interest rate or APR claim | RBI Master Direction |
| V3 | PAN / Aadhaar / account number exposure | DPDPA 2023 / KYC Norms |
| V4 | Guaranteed returns language | SEBI MF Regulations |
| V5 | Past performance without disclaimer | SEBI |
| V6 | Legal / tax-filing advice | RBI Guidelines |
| V7 | Urgency / pressure tactics | ASCI / RBI Circular |

---

## 🌐 Live Demo

**[https://blostem-pulse-pr.vercel.app](https://blostem-pulse-pr.vercel.app)**

---

> Built for the **Blostem × Hack to the Future Hackathon** — turning raw Indian fintech signal noise into zero-touch, RBI/SEBI-compliant sales intelligence.
