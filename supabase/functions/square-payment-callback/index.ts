import "https://deno.land/x/xhr@0.2.1/mod.ts";
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1.35.5";
import { Client, Environment } from "https://esm.sh/square@24.0.0";
import { stringify } from "../_shared/index.ts";

const squareEnvironment = Deno.env.get("SQUARE_ENVIRONMENT")!;

const square = new Client({
  accessToken: Deno.env.get("SQUARE_ACCESS_TOKEN")!,
  environment: squareEnvironment === "production" ? Environment.Production : Environment.Sandbox,
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  // todo: implement

  return new Response(stringify({}), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
