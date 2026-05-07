import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai.ts";
import { corsHeaders, parseJSON } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { company_id, rescore_all } = await req.json();

    // Get companies to score
    let companies: any[] = [];
    if (rescore_all) {
      const { data } = await supabase.from("prospects").select("*");
      companies = data || [];
    } else if (company_id) {
      const { data } = await supabase.from("prospects").select("*").eq("id", company_id).single();
      if (data) companies = [data];
    }

    // Get user ICP (from auth header or first profile)
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    let icpDefinition = "Series B+ fintechs in India needing compliance automation";
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader);
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("icp_definition").eq("id", user.id).single();
        if (profile?.icp_definition) icpDefinition = profile.icp_definition;
      }
    }

    const results = [];

    for (const company of companies) {
      // Fetch signals
      const { data: signals } = await supabase
        .from("signals")
        .select("*")
        .eq("company_id", company.id)
        .order("fetched_at", { ascending: false })
        .limit(5);

      // Fetch macro events for this sector
      const { data: macroEvents } = await supabase
        .from("macro_events")
        .select("*")
        .contains("sector_impact", [company.sector])
        .eq("is_active", true);

      const signalText = (signals || []).map(
        (s: any) => `- ${s.headline} (${s.source}, ${s.fetched_at})`
      ).join("\n") || "No signals found";

      const eventsText = (macroEvents || []).map(
        (e: any) => `- ${e.title}`
      ).join("\n") || "No macro events";

      const systemPrompt = "You are a B2B sales intelligence engine for Blostem, a fintech compliance and onboarding platform. Return ONLY valid JSON. No explanation. No markdown. Start with { and end with }.";

      const userPrompt = `
ICP Definition: ${icpDefinition}

Company: ${company.name} | Sector: ${company.sector} | Stage: ${company.stage} | City: ${company.hq_city}

Recent signals:
${signalText}

Active macro events for this sector:
${eventsText}

Score this company's purchase intent for Blostem on a scale of 0-100.
Return ONLY this JSON:
{
  "score": <integer 0-100>,
  "reason": "<2-3 sentence explanation>",
  "signal_weights": [
    { "headline": "<headline>", "weight": <integer>, "url": "<url>" }
  ]
}`;

      const { text } = await callAI(systemPrompt, userPrompt);
      const result = parseJSON(text);

      // Update prospect
      await supabase.from("prospects").update({
        intent_score: result.score,
        alignment_reason: result.reason,
        signal_weights: result.signal_weights,
      }).eq("id", company.id);

      results.push({ company_id: company.id, name: company.name, ...result });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
