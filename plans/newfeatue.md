Current state (what you have) vs Target state (what you want)
❌ CURRENT (static seed)
• 50 companies manually seeded
• Prospects table is fixed
• Deep Scan rescores existing rows
• No new companies discovered
• You are the bottleneck
✅ TARGET (zero-touch discovery)
• RSS mentions "ZeBank raises $12M"
• System extracts "ZeBank" as new entity
• Auto-INSERT into prospects table
• Auto-score + add to radar
• System is the prospector
This shifts your positioning from "intelligence tool" to "autonomous prospecting agent" — that's the actual breakthrough.
🔥 The new pipeline: Zero-touch prospect discovery
STAGE 1 Entity extraction from RSS
→
fetch-signals already pulls Inc42/ETBFSI headlines. Change: instead of matching against known companies, extract ALL entity names from headline text.
Use Claude with this prompt: "Extract company names from this headline. Return JSON array of strings. Include only Indian fintech/NBFC/bank names, skip people/places."
→
For each extracted name: SELECT * FROM prospects WHERE name ILIKE '%extracted_name%'
If exists: add signal to that row (current behaviour).
If NOT exists: proceed to Stage 2.
STAGE 2 Company validation — is this real or noise?
→
Call SerpApi with query: "[extracted_name] India fintech funding OR launch"
If 0 results: noise (e.g., "ZeBank" was a typo). Skip.
If 3+ results: real company. Proceed to Stage 3.
→
Extract metadata from top SerpApi result snippet: sector (lending/payments/insurtech), stage (seed/Series A), HQ city.
Use Claude: "From this search snippet, extract: sector, stage, hq_city. Return JSON."
STAGE 3 Auto-insert into prospects table
→
INSERT INTO prospects (name, sector, stage, hq_city, website, is_new_entrant, intent_score, signals)
is_new_entrant = TRUE (shows NEW badge in UI)
intent_score = NULL initially
signals = [original headline that triggered this]
→
Trigger score-intent immediately for this new row. Score updates in ~3 seconds.
WebSocket pushes the new company to the Radar tab instantly — it appears at the top of the list while the judge is watching.
STAGE 4 Manual scan trigger from UI
→
New button in UI: "Discover New Prospects" (replaces generic "Run Deep Scan" on the page level)
Calls Edge Function: discover-prospects which runs Stages 1-3 on-demand
→
Show live progress: "Scanning Inc42... found 'MoneyFlow' → validating... → added to prospects"
During demo: click button → 3 new companies appear in 8 seconds → WebSocket animates them in
🔨 What to build tonight (3 hours max)
Option A — MVP for demo day (2 hours)
1.
Modify fetch-signals to extract entity names with Claude before matching known companies
Add: const entities = await extractEntities(headline) before the current company matching loop
2.
For unmatched entities: batch-insert as "unvalidated prospects" with needs_validation: true
Don't call SerpApi yet — just INSERT the raw entity. Manual validation comes later.
3.
Add "Review New Prospects" button in UI → opens modal showing unvalidated rows → click "Add" or "Skip" per row
This is manual validation UI. SerpApi validation is post-hackathon.
4.
Demo narrative: "Every hour, Inc42 mentions 3-5 companies. The system extracts names and flags them for me to review. Here's 'Lendora' from yesterday — one click to add, it auto-scores, and appears on the radar."
Judge sees: you discovered a company autonomously, not from a seeded list.
Time: 2 hoursDemo-readyScales post-hackathon
Option B — Full auto-discovery (4-5 hours, risky timeline)
1.
Build full Stages 1-3 in one new Edge Function: discover-prospects
Entity extraction → SerpApi validation → metadata extraction → auto-insert → auto-score
2.
Add cron trigger: run discover-prospects every 6 hours
Zero human intervention. System auto-populates prospects table.
3.
UI shows: "3 new companies discovered in last 24h" badge at top of Radar tab
Click badge → expands list → shows: MoneyFlow (added 2h ago), Lendora (added 5h ago), CreditUp (added 8h ago)
Time: 4-5 hoursHigher failure riskIF it works: strongest demo