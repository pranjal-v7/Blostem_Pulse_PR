import { callAI } from "../_shared/ai.ts";
import { corsHeaders } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email_body, flags } = await req.json();

    const flagText = flags
      .map((f: any) => `REPLACE: "${f.sentence}" → USE: "${f.suggested_fix}"`)
      .join("\n");

    const systemPrompt = "You rewrite emails to fix compliance issues. Return ONLY the complete fixed email body. No preamble. No explanation.";

    const userPrompt = `Rewrite ONLY these flagged sentences in the email. Keep everything else exactly the same.

Original email:
"""${email_body}"""

Sentences to replace:
${flagText}

Return only the complete fixed email body.`;

    const { text } = await callAI(systemPrompt, userPrompt);

    return new Response(
      JSON.stringify({ fixed_email_body: text.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
