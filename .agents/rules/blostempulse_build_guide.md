# BlostемPulse — Step-by-Step Build Guide (Anthropic API Stack)

## Stack
- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Supabase (Auth, Postgres, Edge Functions)
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`)
- **External**: SerpApi, Clearbit Logo API, PostHog

---

## PHASE 1 — Project Scaffold

### Prompt 1.1 — Init project
```
Create a new React + Vite + TailwindCSS project called "blostempulse".

Install dependencies:
- @supabase/supabase-js
- @supabase/auth-helpers-react
- react-router-dom
- posthog-js
- lucide-react

Create this folder structure:
src/
  components/       # reusable UI components
  pages/            # route-level pages
  lib/              # supabase client, api helpers
  hooks/            # custom React hooks
  context/          # AuthContext, ICPContext

Set up react-router-dom with these routes:
  /login            → LoginPage
  /onboarding       → OnboardingPage
  /app/radar        → RadarPage (protected)
  /app/outreach     → OutreachPage (protected)
  /app/company/:id  → CompanyDetailPage (protected)
  /app/settings     → SettingsPage (protected)

Create a ProtectedRoute wrapper that redirects unauthenticated users to /login.

Use this color palette via CSS variables:
  --bg-primary: #0D0F1A
  --bg-secondary: #13162A
  --bg-card: #1A1E35
  --accent-teal: #0F6E56
  --accent-teal-light: #E1F5EE
  --accent-purple: #534AB7
  --accent-amber: #854F0B
  --accent-coral: #993C1D
  --text-primary: #F0F2FF
  --text-secondary: #8B90B0
  --border: rgba(255,255,255,0.08)
```

---

### Prompt 1.2 — Supabase setup
```
Set up Supabase client in src/lib/supabase.js using env vars:
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY

Create an AuthContext (src/context/AuthContext.jsx) that:
- Wraps the app with supabase.auth.onAuthStateChange listener
- Exposes: { user, session, loading, signOut }
- On user = null → redirect to /login
- On new user (first login, no profile row) → redirect to /onboarding
  Check: SELECT id FROM profiles WHERE id = auth.uid() LIMIT 1

Create a useAuth() hook that consumes AuthContext.
```

---

## PHASE 2 — Supabase Database Schema

### Prompt 2.1 — Create all tables
Run this SQL in Supabase SQL editor:

```sql
-- Prompt: paste this into Supabase SQL editor exactly

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  icp_definition text,
  company_type text,
  stage_filter text[],
  geography text,
  scan_frequency text default '2x_daily',
  created_at timestamptz default now()
);

create table prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  hq_city text,
  stage text,
  website text,
  intent_score integer default 0,
  alignment_reason text,
  signal_weights jsonb default '[]',
  is_new_entrant boolean default false,
  last_contacted timestamptz,
  created_at timestamptz default now()
);

create table signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references prospects(id) on delete cascade,
  headline text,
  source text,
  url text,
  fetched_at timestamptz default now(),
  score_contribution integer default 0
);

create table macro_events (
  id uuid primary key default gen_random_uuid(),
  title text,
  source text,
  url text,
  sector_impact text[],
  published_at timestamptz default now(),
  is_active boolean default true
);

create table emails_sent (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references prospects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  stakeholder text,
  tone text,
  email_body text,
  compliance_passed boolean default false,
  sent_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;
alter table emails_sent enable row level security;

-- RLS policies
create policy "Users own their profile" on profiles
  for all using (auth.uid() = id);

create policy "Users own their emails" on emails_sent
  for all using (auth.uid() = user_id);

-- Prospects and signals are shared (multi-tenant demo, simplify for hackathon)
create policy "All authenticated users can read prospects" on prospects
  for select using (auth.role() = 'authenticated');
```

---

### Prompt 2.2 — Seed data
```sql
-- Prompt: seed 10 Indian fintech prospects for demo

insert into prospects (name, sector, hq_city, stage, website, intent_score, is_new_entrant) values
('Razorpay', 'Payments', 'Bengaluru', 'Series F', 'razorpay.com', 82, false),
('Slice', 'Neobank', 'Bengaluru', 'Series B', 'sliceit.in', 74, false),
('Jupiter Money', 'Neobank', 'Bengaluru', 'Series C', 'jupiter.money', 68, true),
('KreditBee', 'Lending', 'Bengaluru', 'Series D', 'kreditbee.in', 91, false),
('Uni Cards', 'NBFC', 'Bengaluru', 'Series B', 'uni.cards', 55, true),
('Lendingkart', 'SME Lending', 'Ahmedabad', 'Series D', 'lendingkart.com', 63, false),
('Fibe', 'Consumer Lending', 'Mumbai', 'Series C', 'fibe.in', 77, false),
('NeoGrowth', 'NBFC', 'Mumbai', 'Series E', 'neogrowth.in', 48, false),
('PaySense', 'Lending', 'Mumbai', 'Series B', 'gopaysense.com', 59, false),
('Niyo Solutions', 'Neobank', 'Bengaluru', 'Series C', 'goniyo.com', 71, true);

insert into macro_events (title, source, url, sector_impact, is_active) values
('RBI repo rate held at 6.5% — lending fintechs watch margin compression', 'RBI', 'https://rbi.org.in', ARRAY['Lending', 'NBFC'], true),
('Union Budget 2026: digital lending push, co-lending frameworks expanded', 'Inc42', 'https://inc42.com', ARRAY['Neobank', 'Payments', 'Lending'], true),
('SEBI tightens KYC norms for neobanks — compliance burden increases', 'ETBFSI', 'https://etbfsi.com', ARRAY['Neobank'], true);
```

---

## PHASE 3 — Supabase Edge Functions

### Prompt 3.1 — fetch-signals Edge Function
```
Create a Supabase Edge Function at supabase/functions/fetch-signals/index.ts

Logic:
1. Fetch RSS feeds from these URLs:
   - https://inc42.com/feed/
   - https://etbfsi.com/feed/
   - https://rbi.org.in/scripts/rss.aspx

2. Parse XML — extract each <item>: title, link, pubDate

3. For each item, check if title.toLowerCase().includes(prospect.name.toLowerCase())
   for every prospect in the prospects table

4. If match found: INSERT into signals table:
   { company_id, headline: item.title, source: feed_name, url: item.link, fetched_at: now() }
   (skip duplicates — check url already exists)

5. Return { inserted: N, companies_matched: N }

Set CORS headers. Use Deno built-in fetch.
Add error handling for each feed independently (one failing shouldn't break others).

Deploy with: supabase functions deploy fetch-signals
Schedule with pg_cron:
  select cron.schedule('fetch-signals-twice-daily', '0 6,18 * * *', 
    'select net.http_post(url:=''https://YOUR_PROJECT.supabase.co/functions/v1/fetch-signals'',headers:=''{}'')');
```

---

### Prompt 3.2 — score-intent Edge Function
```
Create supabase/functions/score-intent/index.ts

Accept POST body: { company_id?: string, rescore_all?: boolean }

For each company to score:
1. Fetch company row from prospects
2. Fetch last 5 signals for this company from signals table
3. Fetch active macro_events where sector_impact contains company.sector
4. Fetch user's ICP from profiles (use the requesting user's auth or a service role key)

Build Claude prompt:
  System: "You are a B2B sales intelligence engine for Blostem, a fintech compliance and onboarding platform."
  
  User: `
  ICP Definition: {icp_definition}
  
  Company: {name} | Sector: {sector} | Stage: {stage} | City: {hq_city}
  
  Recent signals:
  {signals.map(s => `- ${s.headline} (${s.source}, ${s.fetched_at})`).join('\n')}
  
  Active macro events for this sector:
  {macro_events.map(e => `- ${e.title}`).join('\n')}
  
  Score this company's purchase intent for Blostem on a scale of 0-100.
  Return ONLY valid JSON, no preamble:
  {
    "score": <integer 0-100>,
    "reason": "<2-3 sentence explanation of why this score>",
    "signal_weights": [
      { "headline": "<headline>", "weight": <integer>, "url": "<url>" }
    ]
  }
  `

Call Anthropic API:
  POST https://api.anthropic.com/v1/messages
  Headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"), "anthropic-version": "2023-06-01" }
  Body: { model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }

Parse JSON response. UPDATE prospects SET intent_score, alignment_reason, signal_weights.
Return { company_id, score, reason, signal_weights }.

Deploy: supabase functions deploy score-intent
```

---

### Prompt 3.3 — deep-scan Edge Function
```
Create supabase/functions/deep-scan/index.ts

Accept POST: { company_id: string, company_name: string }

Steps:
1. Call SerpApi:
   GET https://serpapi.com/search.json?q={company_name}+site:inc42.com+OR+site:etbfsi.com&num=5&api_key={SERPAPI_KEY}
   
2. Extract organic_results[].snippet and organic_results[].link

3. INSERT these as new signals rows for the company (source: 'deep-scan')

4. Call score-intent Edge Function with { company_id } to get fresh score

5. Return { new_score, delta: new_score - old_score, new_signals: [] }

Deploy: supabase functions deploy deep-scan
Set secret: supabase secrets set SERPAPI_KEY=your_key
```

---

### Prompt 3.4 — generate-email Edge Function
```
Create supabase/functions/generate-email/index.ts

Accept POST: { company_id, stakeholder, tone }

Fetch from DB:
- Company row (name, sector, stage, hq_city)
- Top 3 signals for this company
- User's icp_definition from profiles
- Company's alignment_reason

Build streaming Claude request:
  System: "You write precise B2B sales emails for fintech compliance products. No fluff."
  
  User: `
  Write a ${tone} sales email to the ${stakeholder} of ${company_name}.
  
  Company context:
  - Sector: ${sector}, Stage: ${stage}, HQ: ${hq_city}
  - Why they're a fit: ${alignment_reason}
  
  Top signals to reference:
  ${signals.map(s => `- ${s.headline}`).join('\n')}
  
  Our product (ICP): ${icp_definition}
  
  Output format: Subject line on first line, blank line, then email body.
  No preamble. No "Here is your email:". Just subject + body.
  `

Stream response back to frontend using ReadableStream / SSE.
Use: { stream: true } in Anthropic API call.

Deploy: supabase functions deploy generate-email
```

---

### Prompt 3.5 — check-compliance Edge Function
```
Create supabase/functions/check-compliance/index.ts

Accept POST: { email_body: string }

Claude prompt (non-streaming, JSON response):
  System: "You are an RBI compliance checker for Indian fintech marketing emails. Return only valid JSON."
  
  User: `
  Check this email for violations of these 5 RBI/SEBI rules:
  1. No guaranteed returns claims
  2. No unlicensed financial advice
  3. No misleading APR or interest rate claims
  4. No false RBI endorsement claims
  5. No SEBI-restricted promotional language
  
  Email:
  """${email_body}"""
  
  Return ONLY this JSON:
  {
    "passed": true|false,
    "flags": [
      {
        "sentence": "<exact sentence from email>",
        "rule_violated": "<rule name>",
        "suggested_fix": "<rewritten sentence>"
      }
    ]
  }
  `

Return the parsed JSON response.
Deploy: supabase functions deploy check-compliance
```

---

### Prompt 3.6 — auto-fix-compliance Edge Function
```
Create supabase/functions/auto-fix-compliance/index.ts

Accept POST: { email_body: string, flags: Array<{sentence, rule_violated, suggested_fix}> }

Claude prompt:
  "Rewrite ONLY these flagged sentences in the email. Keep everything else exactly the same.
  
  Original email:
  """${email_body}"""
  
  Sentences to replace:
  ${flags.map(f => `REPLACE: "${f.sentence}" → USE: "${f.suggested_fix}"`).join('\n')}
  
  Return only the complete fixed email body. No preamble."

Return: { fixed_email_body }
Deploy: supabase functions deploy auto-fix-compliance
```

---

## PHASE 4 — Frontend Pages

### Prompt 4.1 — Login Page
```
Build src/pages/LoginPage.jsx

Design: Dark theme (#0D0F1A bg), centered card, no generic gradients.
Use sharp geometric accents — a thin teal vertical bar on the left edge of the card.

Elements:
- Logo: "BLOSTEM" in a monospaced font + "PULSE" subscript in teal
- Tagline: "AI-powered prospect intelligence for Indian fintech"
- Google OAuth button → calls supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/app/radar' } })
- Email/password form with signInWithPassword()
- Forgot password link
- Error state toast for failed auth

On success: AuthContext redirects to /app/radar or /onboarding (new user check)
```

---

### Prompt 4.2 — Onboarding Page
```
Build src/pages/OnboardingPage.jsx

Multi-step form (3 steps, progress bar at top):

Step 1 — Company Type
  Radio cards: NBFC | Neobank | Payments | Insurtech | Lending
  Each card: icon + label + 1-line description

Step 2 — Stage & Geography  
  Stage multi-select checkboxes: Seed / Series A / Series B / Series C+ / Pre-IPO
  Geography: Pan-India / Metro-focused / Tier 2 & 3

Step 3 — ICP Description
  Large textarea: "Describe your ideal customer..."
  Placeholder example: "Series B+ NBFCs with active digital lending products, 50k+ monthly disbursals, compliance team of 5+"

On submit:
  UPSERT into profiles: { id: user.id, icp_definition, company_type, stage_filter, geography }
  Then: call score-intent Edge Function with { rescore_all: true } (async, don't block)
  Redirect to /app/radar
```

---

### Prompt 4.3 — App Shell + Sidebar
```
Build src/components/AppShell.jsx — persistent layout wrapper

Left sidebar (64px collapsed / 220px expanded on hover):
  Background: #0D0F1A
  Top: Blostem logo + wordmark
  Nav items with icons (lucide-react):
    - Radar (Target icon) → /app/radar  [hot leads badge]
    - Outreach (Mail icon) → /app/outreach
    - Settings (Settings icon) → /app/settings
  Bottom: user avatar + email + logout button

Top KPI strip (inside main content area):
  Fetch on mount from Supabase:
    - COUNT(*) FROM prospects → "N companies scored"
    - COUNT(*) FROM prospects WHERE intent_score > 75 → "N hot leads"
    - MAX(fetched_at) FROM signals → "Last scan: X hours ago"
    - COUNT(*) FROM macro_events WHERE is_active = true → "N RBI alerts"
  
  Display as 4 stat cards with teal/amber/coral color coding.
  Auto-refresh every 5 minutes.
```

---

### Prompt 4.4 — Prospect Radar Page
```
Build src/pages/RadarPage.jsx

Macro events banner (above list):
  Fetch: SELECT * FROM macro_events WHERE is_active = true
  Horizontal scrollable strip of alert pills
  Each pill: colored by sector, dismissible (store dismissed IDs in localStorage)
  
"Edit ICP" button → opens ICP modal:
  Same fields as onboarding Step 2+3
  On save: upsert profiles → call score-intent { rescore_all: true }
  Show "Rescoring..." spinner on button

Prospect list:
  Fetch: SELECT p.*, COUNT(s.id) as signal_count, MAX(s.fetched_at) as last_signal_at 
         FROM prospects p LEFT JOIN signals s ON s.company_id = p.id 
         GROUP BY p.id ORDER BY p.intent_score DESC
  
  Each row card:
    - Company logo: <img src={`https://logo.clearbit.com/${prospect.website}`} onError={showInitialsAvatar} />
    - Name + sector + HQ city
    - Intent score badge: 
        > 75 = teal background "HOT"
        50-75 = amber "WARM"  
        < 50 = gray "COLD"
    - Signal count: "4 signals · 2 days ago"
    - NEW badge if is_new_entrant = true (pulse animation)
    - Signal decay: row opacity = Math.max(0.4, 1 - (daysSinceLastSignal / 30))
    - "Run Deep Scan" button (loading spinner during call)
    - Click row → navigate to /app/company/:id

Deep Scan handler:
  POST to /functions/v1/deep-scan with { company_id, company_name }
  On response: animate score change (count up/down with requestAnimationFrame)
  Show delta: "+12 pts" flash in teal or "-5 pts" in red
  PostHog: posthog.capture('deep_scan_clicked', { company_id, company_name })
```

---

### Prompt 4.5 — Company Detail Page
```
Build src/pages/CompanyDetailPage.jsx

Route: /app/company/:id

Fetch on mount:
  - SELECT * FROM prospects WHERE id = :id
  - SELECT * FROM signals WHERE company_id = :id ORDER BY fetched_at DESC LIMIT 10
  - SELECT * FROM macro_events WHERE :sector = ANY(sector_impact) AND is_active = true

Header section:
  - Company logo (Clearbit) + name + website link
  - Large circular score ring (SVG, animated on mount from 0 to score)
    Color: teal > 75, amber 50-75, gray < 50
  - Sector / Stage / HQ chips

Signal breakdown panel:
  For each signal:
    - Headline text
    - Source badge (Inc42 = purple, ETBFSI = amber, RBI = coral, deep-scan = teal)
    - Weight chip: "+18 pts"
    - Age: relative time ("3 days ago")
    - "View source" → open url in new tab
  
  Below signals: macro events affecting this company (styled differently, coral border)

AI alignment explanation:
  Display alignment_reason from DB
  Structure it visually as 3 sections:
    1. "What they launched" (from signals context)
    2. "Why Blostem fits" 
    3. "Recommended angle"
  (Parse from the alignment_reason text — split by newlines or use the full text)

Action bar (sticky bottom):
  - "Generate Email" → navigate to /app/outreach?company_id=:id
  - "Log Call Note" → inline text input that saves to a notes field
  - "Run Deep Scan" → same handler as radar page
  - "← Back to Radar"

PostHog: posthog.capture('company_detail_opened', { company_id })
```

---

### Prompt 4.6 — Outreach + Compliance Page
```
Build src/pages/OutreachPage.jsx

Read URL param: ?company_id=:id and pre-select that company

Left panel (35% width):
  Search input → filter prospects by name
  Filter chips: "All" / "Not contacted" / "Contacted"
  Prospect list (compact rows):
    - Logo + name + score badge + "X days idle"
    - Click → set selectedCompany state

Right panel (65% width):
  Selected company header (name + score)
  
  Generator controls:
    Stakeholder selector (tab-style buttons): CTO | CFO | Compliance Head | Founder
    Tone selector: Formal | Consultative | Urgent | Friendly
    "Generate Email" button
  
  Email output area:
    - While generating: show streaming text token by token
      (SSE stream from generate-email Edge Function)
    - After generation: editable textarea with the email
    - Subject line shown above textarea in a read-only chip
  
  Compliance panel (auto-runs after generation completes):
    Show "Checking compliance..." spinner (500ms delay for UX)
    POST email_body to /check-compliance
    
    If passed:
      Green badge "✓ Compliance Passed"
    
    If flags:
      Red badge "⚠ 2 Issues Found"
      List each flagged sentence with red underline in the textarea
      "Auto-Fix All" button → POST to /auto-fix-compliance → replace textarea content
      Re-run compliance check on fixed version automatically
  
  Send actions (shown after compliance passes):
    "Open in Gmail" → window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
    "Mark Contacted" → UPDATE prospects SET last_contacted = now() WHERE id = :id
                     → INSERT INTO emails_sent (...)
                     → move to next uncontacted prospect in left panel

PostHog tracking:
  posthog.capture('email_generated', { company_id, stakeholder, tone })
  posthog.capture('compliance_check_run', { passed, flag_count })
```

---

### Prompt 4.7 — Settings Page
```
Build src/pages/SettingsPage.jsx

Sections:
1. ICP Configuration
   - Same form as onboarding (pre-filled from profiles)
   - Save button → upsert profiles

2. Scan Configuration
   - "Scan frequency" toggle: 2x/day | 4x/day | Manual only
   - "Auto-rescore on new signals" checkbox

3. API Keys (display only, masked)
   - Show "SERP****KEY" style masked values
   - Note: "Keys managed via Supabase secrets"

4. Account
   - User email (read-only)
   - Display name (editable)
   - Logout button

5. Danger Zone (red border card)
   - "Clear all signals" → DELETE FROM signals
   - "Reset all scores" → UPDATE prospects SET intent_score = 0
   - Both require confirmation modal
```

---

## PHASE 5 — Streaming Email (Frontend)

### Prompt 5.1 — SSE streaming handler
```
In OutreachPage, implement streaming for generate-email:

const generateEmail = async () => {
  setIsGenerating(true);
  setEmailBody('');
  
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ company_id: selectedCompany.id, stakeholder, tone })
    }
  );
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    // Parse SSE: lines starting with "data: "
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'content_block_delta') {
          setEmailBody(prev => prev + data.delta.text);
        }
      }
    }
  }
  
  setIsGenerating(false);
  // Auto-trigger compliance check
  checkCompliance(emailBody);
};

In generate-email Edge Function, pipe Anthropic stream directly:
  const stream = await anthropic.messages.stream({ ... });
  return new Response(stream.toReadableStream(), {
    headers: { 'Content-Type': 'text/event-stream', 'Transfer-Encoding': 'chunked' }
  });
```

---

## PHASE 6 — Polish & Demo Prep

### Prompt 6.1 — PostHog setup
```
In src/main.jsx:
  import posthog from 'posthog-js';
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, { api_host: 'https://app.posthog.com' });

Events to track (already noted in page prompts above):
  - deep_scan_clicked
  - email_generated
  - compliance_check_run
  - company_detail_opened
  - icp_updated
```

### Prompt 6.2 — Loading & error states
```
Add these global UX states:

1. Skeleton loaders on prospect cards (pulse animation) while Supabase query runs
2. Toast notification system (top-right, auto-dismiss 3s):
   - Success (teal): "Email generated", "Score updated"
   - Warning (amber): "2 compliance issues found"
   - Error (coral): "Deep scan failed — SerpApi quota exceeded"
3. Empty states:
   - No signals yet: "No signals found yet. Deep scan a company or wait for the next cron run."
   - No prospects: "Add your first prospect in settings."
4. Offline detection: banner "Working offline — data may be stale"
```

### Prompt 6.3 — Demo data trigger
```
Add a hidden button in Settings: "Load demo signals"
On click: INSERT 3 signals per prospect using hardcoded realistic fintech headlines.
This lets judges see the product working without waiting for the cron job.

Sample headlines to insert:
  - "KreditBee raises $200M Series D to expand BNPL portfolio"
  - "Razorpay launches PayrollCard for SME payroll compliance"
  - "Jupiter Money integrates RBI-mandated FLDG norms into lending stack"
  - "KreditBee partners with NBFC to launch co-lending product"
  - "Fibe reports 3x growth in salary advance disbursals Q1 2026"
```

---

## ENV Variables Summary

```
# .env.local
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_POSTHOG_KEY=phc_...

# Supabase secrets (via supabase secrets set)
ANTHROPIC_API_KEY=sk-ant-...
SERPAPI_KEY=...
```

---

## Build Order (recommended)

1. DB schema + seed data (Phase 2)
2. Supabase client + AuthContext (Prompt 1.2)
3. Login + Onboarding pages (Prompt 4.1, 4.2)
4. App shell + routing (Prompt 4.3)
5. score-intent Edge Function (Prompt 3.2) — core feature
6. Radar page (Prompt 4.4) — first working screen
7. Company detail page (Prompt 4.5)
8. generate-email + check-compliance Edge Functions (Prompt 3.4, 3.5)
9. Outreach page with streaming (Prompt 4.6, 5.1)
10. fetch-signals + deep-scan Edge Functions (Prompt 3.1, 3.3)
11. auto-fix-compliance (Prompt 3.6)
12. Settings page (Prompt 4.7)
13. Polish, PostHog, demo data (Phase 6)
