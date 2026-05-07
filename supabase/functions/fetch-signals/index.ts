import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai.ts";
import { corsHeaders } from "../_shared/utils.ts";
import {
  entityExtractionSystemPrompt,
  entityExtractionUserPrompt,
} from "../_shared/prompts.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // RSS feed URLs — multi-source coverage
    const feeds = [
      { name: "Inc42", url: "https://inc42.com/feed/" },
      { name: "ETBFSI", url: "https://etbfsi.com/feed/" },
      { name: "YourStory", url: "https://yourstory.com/feed" },
      { name: "Entrackr", url: "https://entrackr.com/feed/" },
      { name: "LiveMint", url: "https://www.livemint.com/rss/companies" },
      { name: "Moneycontrol", url: "https://www.moneycontrol.com/rss/business.xml" },
      { name: "Economic Times", url: "https://economictimes.indiatimes.com/rssfeedstopstories.cms" },
    ];

    // Get all known prospects for name-matching
    const { data: prospects } = await supabase.from("prospects").select("id, name");
    if (!prospects || prospects.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, message: "No prospects found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalInserted = 0;
    let totalDiscovered = 0;
    const companiesMatched = new Set<string>();
    const companiesDiscovered = new Set<string>();

    for (const feed of feeds) {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "BlostemPulse/1.0" },
        });
        if (!res.ok) continue;

        const xml = await res.text();
        const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

        for (const item of items.slice(0, 20)) {
          const titleMatch =
            item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
            item.match(/<title>(.*?)<\/title>/);
          const linkMatch = item.match(/<link>(.*?)<\/link>/);

          if (!titleMatch || !linkMatch) continue;

          const title = titleMatch[1].trim();
          const link = linkMatch[1].trim();

          // ── STAGE 1: Match against known prospects ────────────────
          let matchedExisting = false;
          for (const prospect of prospects) {
            if (title.toLowerCase().includes(prospect.name.toLowerCase())) {
              matchedExisting = true;
              const { data: existing } = await supabase
                .from("signals")
                .select("id")
                .eq("url", link)
                .limit(1);

              if (!existing || existing.length === 0) {
                await supabase.from("signals").insert({
                  company_id: prospect.id,
                  headline: title,
                  source: feed.name,
                  url: link,
                  score_contribution: Math.floor(Math.random() * 15) + 5,
                });
                totalInserted++;
                companiesMatched.add(prospect.name);
              }
            }
          }

          // ── STAGE 2: Entity extraction for UNKNOWN companies ──────
          // Only run if this headline didn't match any known prospect
          // to avoid double-processing and unnecessary AI calls
          if (!matchedExisting) {
            try {
              const { text } = await callAI(
                entityExtractionSystemPrompt(),
                entityExtractionUserPrompt(title)
              );

              let entities: string[] = [];
              try {
                // Strip any markdown fences the model might add
                const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
                entities = JSON.parse(cleaned);
                if (!Array.isArray(entities)) entities = [];
              } catch {
                entities = [];
              }

              for (const entityName of entities) {
                if (!entityName || entityName.length < 3 || entityName.length > 80) continue;

                // Check if this entity already exists in prospects (case-insensitive)
                const alreadyKnown = prospects.some(
                  (p) => p.name.toLowerCase() === entityName.toLowerCase()
                );
                if (alreadyKnown) continue;

                // Check if already staged for validation (avoid duplicate staging)
                const { data: alreadyStaged } = await supabase
                  .from("prospects")
                  .select("id")
                  .ilike("name", entityName)
                  .limit(1);

                if (alreadyStaged && alreadyStaged.length > 0) continue;

                // Insert as unvalidated prospect for human review
                await supabase.from("prospects").insert({
                  name: entityName,
                  sector: "Fintech",          // default — user can edit after adding
                  stage: "Unknown",
                  hq_city: "India",
                  needs_validation: true,
                  discovery_source: feed.name,
                  discovery_headline: title.slice(0, 300),
                  intent_score: null,
                  is_new_entrant: false,       // set TRUE only after user approves
                });

                totalDiscovered++;
                companiesDiscovered.add(entityName);
              }
            } catch (aiErr) {
              console.error(`Entity extraction failed for headline "${title}":`, aiErr);
              // Non-fatal — continue to next item
            }
          }
        }
      } catch (feedErr) {
        console.error(`Feed ${feed.name} failed:`, feedErr);
        // Non-fatal — continue to next feed
      }
    }

    return new Response(
      JSON.stringify({
        inserted: totalInserted,
        discovered: totalDiscovered,
        companies_matched: companiesMatched.size,
        companies_discovered: Array.from(companiesDiscovered),
        companies: Array.from(companiesMatched),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
