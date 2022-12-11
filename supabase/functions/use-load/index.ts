import "https://deno.land/x/xhr@0.2.1/mod.ts";
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1.35.5";
import { stringify } from "../_shared/index.ts";

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

  // get the user id from the request body
  const { user_id: userId } = await req.json();

  // if the user id is missing, return an error
  if (!userId) {
    return new Response(
      stringify({
        message: `Error: Missing user id`,
      }),
      { status: 500 }
    );
  }

  // get the user's metadata from the database
  const { data, error } = await supabase
    .from("user_metadata")
    .select("loads_available")
    .eq("user_id", userId)
    .limit(1)
    .single();

  // if there is an error, return an error
  if (error) {
    return new Response(
      stringify({
        message: `Error: ${error.message}`,
      }),
      { status: 500 }
    );
  }

  // subtract one load from the user's loads
  const updatedLoads = data?.loads_available - 1;

  // if the user has no loads left, return an error
  if (updatedLoads < 0) {
    return new Response(
      stringify({
        message: `Error: User has no loads left`,
      }),
      { status: 500 }
    );
  }

  // update the user's loads in the database
  await supabase
    .from("user_metadata")
    .update({ loads_available: updatedLoads })
    .eq("user_id", userId);

  return new Response(
    stringify({
      message: `Success: User has ${updatedLoads} loads left`,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
