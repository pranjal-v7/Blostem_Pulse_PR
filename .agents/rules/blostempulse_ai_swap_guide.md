# AI API Swap Guide — Gemini Now → Claude Before Demo

## The Pattern: One Adapter File

All 5 Edge Functions call a single `_shared/ai.ts` helper.
To switch from Gemini → Claude: **change one env var + one line in the adapter.**

---

## Step 1 — Create the shared AI adapter

**File: `supabase/functions/_shared/ai.ts`**

```typescript
// ============================================================
// SWAP CONTROL: change AI_PROVIDER env var to switch APIs
// "gemini" → uses Google Gemini API
// "claude" → uses Anthropic Claude API
// ============================================================

const AI_PROVIDER = Deno.env.get("AI_PROVIDER") ?? "gemini"; // ← change this to "claude" on demo day

interface AIResponse {
  text: string;
}

interface StreamChunk {
  text: string;
  done: boolean;
}

// ─────────────────────────────────────────
// NON-STREAMING call (used by: score-intent, check-compliance, auto-fix-compliance)
// ─────────────────────────────────────────
export async function callAI(
  systemPrompt: string,
  userPrompt: string
): Promise<AIResponse> {
  if (AI_PROVIDER === "claude") {
    return callClaude(systemPrompt, userPrompt);
  }
  return callGemini(systemPrompt, userPrompt);
}

// ─────────────────────────────────────────
// STREAMING call (used by: generate-email)
// ─────────────────────────────────────────
export async function callAIStream(
  systemPrompt: string,
  userPrompt: string
): Promise<ReadableStream> {
  if (AI_PROVIDER === "claude") {
    return callClaudeStream(systemPrompt, userPrompt);
  }
  return callGeminiStream(systemPrompt, userPrompt);
}

// ─────────────────────────────────────────
// GEMINI IMPLEMENTATIONS
// ─────────────────────────────────────────
async function callGemini(systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
    }),
  });

  const data = await res.json();
  
  if (!res.ok) throw new Error(`Gemini error: ${JSON.stringify(data)}`);
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { text };
}

async function callGeminiStream(systemPrompt: string, userPrompt: string): Promise<ReadableStream> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 1000 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini stream error: ${res.status}`);

  // Normalize Gemini SSE → same format frontend expects
  // Frontend reads: data: {"type":"content_block_delta","delta":{"text":"..."}}
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      const raw = decoder.decode(value);
      const lines = raw.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (text) {
            // Emit in Claude SSE format so frontend code never changes
            const normalized = `data: ${JSON.stringify({
              type: "content_block_delta",
              delta: { text },
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(normalized));
          }
        } catch (_) {
          // skip malformed chunks
        }
      }
    },
  });
}

// ─────────────────────────────────────────
// CLAUDE IMPLEMENTATIONS (uncomment on demo day — already written)
// ─────────────────────────────────────────
async function callClaude(systemPrompt: string, userPrompt: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Claude error: ${JSON.stringify(data)}`);
  
  const text = data.content?.[0]?.text ?? "";
  return { text };
}

async function callClaudeStream(systemPrompt: string, userPrompt: string): Promise<ReadableStream> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude stream error: ${res.status}`);
  
  // Claude SSE format is already what the frontend expects — pass through directly
  return res.body!;
}
```

---

## Step 2 — Update all Edge Functions to use the adapter

Every Edge Function now imports from `_shared/ai.ts`. No direct API calls anywhere else.

**score-intent/index.ts** (replace the fetch block):
```typescript
import { callAI } from "../_shared/ai.ts";

// ... build systemPrompt and userPrompt strings ...

const { text } = await callAI(systemPrompt, userPrompt);

// Strip markdown fences if Gemini adds them
const clean = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
const result = JSON.parse(clean);
// result.score, result.reason, result.signal_weights
```

**check-compliance/index.ts**:
```typescript
import { callAI } from "../_shared/ai.ts";

const { text } = await callAI(systemPrompt, userPrompt);
const clean = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
const result = JSON.parse(clean); // { passed, flags[] }
```

**auto-fix-compliance/index.ts**:
```typescript
import { callAI } from "../_shared/ai.ts";

const { text } = await callAI(systemPrompt, userPrompt);
return new Response(JSON.stringify({ fixed_email_body: text.trim() }), { ... });
```

**generate-email/index.ts**:
```typescript
import { callAIStream } from "../_shared/ai.ts";

const stream = await callAIStream(systemPrompt, userPrompt);
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Transfer-Encoding": "chunked",
    ...corsHeaders,
  },
});
```

**deep-scan/index.ts** (calls score-intent internally — no direct AI call needed):
```typescript
// No AI call here — deep-scan just fetches SerpApi results,
// inserts signals, then calls score-intent Edge Function internally
const scoreRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/score-intent`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
  body: JSON.stringify({ company_id }),
});
```

---

## Step 3 — Supabase secrets

**Now (Gemini):**
```bash
supabase secrets set AI_PROVIDER=gemini
supabase secrets set GEMINI_API_KEY=AIza...
supabase secrets set SERPAPI_KEY=...
```

**On demo day (switch to Claude) — 2 commands:**
```bash
supabase secrets set AI_PROVIDER=claude
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```
That's it. No code changes. Redeploy all functions:
```bash
supabase functions deploy --all
```

---

## Gemini model to use

| Use case | Model | Why |
|---|---|---|
| score-intent, compliance | `gemini-2.0-flash` | Fast, cheap, good at JSON |
| generate-email | `gemini-2.0-flash` | Streaming works well |
| deep-scan (via score-intent) | `gemini-2.0-flash` | Same |

Free tier: **1,500 requests/day** on Flash. More than enough for dev + demo.
Get key: https://aistudio.google.com/apikey

---

## JSON parsing safety (important for Gemini)

Gemini sometimes wraps JSON in markdown fences. Always strip before parsing:

```typescript
function parseJSON(text: string) {
  const clean = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(clean);
}
```

Add this util to `_shared/utils.ts` and import everywhere.

---

## Prompt differences: Gemini vs Claude

Gemini is slightly more verbose in outputs. Add this to all JSON prompts:
```
Return ONLY valid JSON. No explanation. No markdown. No preamble. Start with { and end with }.
```

Claude understands this naturally. Gemini needs the explicit "Start with {" instruction.

---

## Demo day checklist

- [ ] `supabase secrets set AI_PROVIDER=claude`
- [ ] `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
- [ ] `supabase functions deploy --all`
- [ ] Test score-intent on one company
- [ ] Test generate-email streaming
- [ ] Test compliance check
- [ ] Done — no frontend changes needed
