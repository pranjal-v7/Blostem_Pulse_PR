import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIStream } from "../_shared/ai.ts";
import { corsHeaders } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { company_id, stakeholder, tone } = await req.json();

    // Fetch company
    const { data: company } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", company_id)
      .single();

    if (!company) throw new Error("Company not found");

    // Fetch signals
    const { data: signals } = await supabase
      .from("signals")
      .select("*")
      .eq("company_id", company_id)
      .order("fetched_at", { ascending: false })
      .limit(3);

    // Fetch user ICP
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    let icpDefinition = "Fintech compliance and onboarding automation platform";
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader);
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("icp_definition").eq("id", user.id).single();
        if (profile?.icp_definition) icpDefinition = profile.icp_definition;
      }
    }

    const signalText = (signals || []).map((s: any) => `- ${s.headline}`).join("\n") || "No signals";

    const systemPrompt = "You write precise B2B sales emails for fintech compliance products. No fluff. No preamble.";

    const userPrompt = `Write a ${tone} sales email to the ${stakeholder} of ${company.name}.

Company context:
- Sector: ${company.sector}, Stage: ${company.stage}, HQ: ${company.hq_city}
- Why they're a fit: ${company.alignment_reason || "Strong ICP alignment"}

Top signals to reference:
${signalText}

Our product (ICP): ${icpDefinition}

Output format: Subject line on first line, blank line, then email body.
No preamble. No "Here is your email:". Just subject + body.`;

    const stream = await callAIStream(systemPrompt, userPrompt);

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
