import { callAI } from "../_shared/ai.ts";
import { corsHeaders, parseJSON } from "../_shared/utils.ts";
import { complianceSystemPrompt, complianceUserPrompt } from "../_shared/prompts.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email_body } = await req.json();

    const { text } = await callAI(
      complianceSystemPrompt(),
      complianceUserPrompt({ email_body })
    );

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
