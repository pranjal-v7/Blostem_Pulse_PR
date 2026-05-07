import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/utils.ts";

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

    // Get all prospects
    const { data: prospects } = await supabase.from("prospects").select("id, name");
    if (!prospects || prospects.length === 0) {
      return new Response(JSON.stringify({ inserted: 0, message: "No prospects found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalInserted = 0;
    const companiesMatched = new Set<string>();

    for (const feed of feeds) {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "BlostemPulse/1.0" },
        });
        if (!res.ok) continue;

        const xml = await res.text();

        // Simple XML parsing for <item> elements
        const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

        for (const item of items.slice(0, 20)) {
          const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                             item.match(/<title>(.*?)<\/title>/);
          const linkMatch = item.match(/<link>(.*?)<\/link>/);

          if (!titleMatch || !linkMatch) continue;

          const title = titleMatch[1].trim();
          const link = linkMatch[1].trim();

          // Check if title mentions any prospect
          for (const prospect of prospects) {
            if (title.toLowerCase().includes(prospect.name.toLowerCase())) {
              // Check for duplicate URL
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
        }
      } catch (feedErr) {
        console.error(`Feed ${feed.name} failed:`, feedErr);
        // Continue to next feed
      }
    }

    return new Response(
      JSON.stringify({
        inserted: totalInserted,
        companies_matched: companiesMatched.size,
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
