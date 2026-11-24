import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405, headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return Response.json({ error: "Sign in required." }, { status: 401, headers: cors });
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return Response.json({ error: "Your session is not valid." }, { status: 401, headers: cors });
    const body = await req.json();
    const word = String(body.word ?? "").trim().toLowerCase();
    if (!/^[a-z]{2,24}$/.test(word)) return Response.json({ valid: false, error: "Enter one English word using 2 to 24 letters." }, { status: 422, headers: cors });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: cached, error: cacheError } = await admin.from("word_chain_dictionary").select("word").eq("word", word).maybeSingle();
    if (cacheError) throw cacheError;
    if (cached) return Response.json({ valid: true, word, cached: true }, { headers: cors });
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!response.ok) return Response.json({ valid: false, error: "That word was not found in the English dictionary. Try another word." }, { status: 422, headers: cors });
    const entry = await response.json();
    if (!Array.isArray(entry) || !entry.length) return Response.json({ valid: false, error: "That word could not be verified." }, { status: 422, headers: cors });
    const { error: insertError } = await admin.from("word_chain_dictionary").upsert({ word, source: "dictionaryapi.dev", verified_at: new Date().toISOString() });
    if (insertError) throw insertError;
    return Response.json({ valid: true, word, cached: false }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Dictionary validation failed." }, { status: 500, headers: cors });
  }
});