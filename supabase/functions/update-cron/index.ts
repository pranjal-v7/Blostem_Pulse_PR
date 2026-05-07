import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { frequency } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Translate the UI frequency selection to a UTC cron schedule
    // IST is UTC+5:30
    // "2x": 9:00 AM IST and 9:00 PM IST -> 3:30 AM UTC and 3:30 PM UTC -> '30 3,15 * * *'
    // "4x": 3AM, 9AM, 3PM, 9PM IST -> 9:30PM(prev day), 3:30AM, 9:30AM, 3:30PM UTC -> '30 3,9,15,21 * * *'
    let cronExpr = "";
    if (frequency === "2x") {
      cronExpr = "30 3,15 * * *";
    } else if (frequency === "4x") {
      cronExpr = "30 3,9,15,21 * * *";
    } else if (frequency === "manual") {
      cronExpr = "manual";
    } else {
      throw new Error("Invalid frequency");
    }

    // Call a database function to update pg_cron schedule
    // (Requires 'update_scan_schedule' RPC to be created in Supabase SQL editor)
    const { data, error } = await supabase.rpc("update_scan_schedule", {
      cron_expr: cronExpr,
      project_url: Deno.env.get("SUPABASE_URL"),
      service_role_key: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, schedule: cronExpr }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
