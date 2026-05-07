import { callAI } from "../_shared/ai.ts";
import { corsHeaders, parseJSON } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email_body } = await req.json();

    const systemPrompt = "You are an RBI compliance checker for Indian fintech marketing emails. Return ONLY valid JSON. No explanation. No markdown. Start with { and end with }.";

    const userPrompt = `Check this email for violations of these 5 RBI/SEBI rules:
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
}`;

    const { text } = await callAI(systemPrompt, userPrompt);
    const result = parseJSON(text);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
