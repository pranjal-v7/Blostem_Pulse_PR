// ============================================================
// AI ADAPTER — swap between Gemini and Claude with one env var
// AI_PROVIDER = "gemini" (default, free) or "claude"
// ============================================================

const AI_PROVIDER = Deno.env.get("AI_PROVIDER") ?? "gemini";

interface AIResponse {
  text: string;
}

// Non-streaming call (score-intent, check-compliance, auto-fix)
export async function callAI(
  systemPrompt: string,
  userPrompt: string
): Promise<AIResponse> {
  if (AI_PROVIDER === "claude") {
    return callClaude(systemPrompt, userPrompt);
  }
  return callGemini(systemPrompt, userPrompt);
}

// Streaming call (generate-email)
export async function callAIStream(
  systemPrompt: string,
  userPrompt: string
): Promise<ReadableStream> {
  if (AI_PROVIDER === "claude") {
    return callClaudeStream(systemPrompt, userPrompt);
  }
  return callGeminiStream(systemPrompt, userPrompt);
}

// ─── GEMINI ───
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

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) { controller.close(); return; }
      const raw = decoder.decode(value);
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (text) {
            const normalized = `data: ${JSON.stringify({
              type: "content_block_delta",
              delta: { text },
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(normalized));
          }
        } catch (_) { /* skip malformed */ }
      }
    },
  });
}

// ─── CLAUDE ───
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
  return { text: data.content?.[0]?.text ?? "" };
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
  return res.body!;
}
