import "https://deno.land/x/xhr@0.2.1/mod.ts";
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1.35.5";
import { Client, Environment } from "https://esm.sh/square@24.0.0";
import { stringify } from "../_shared/index.ts";

const squareEnvironment = Deno.env.get("SQUARE_ENVIRONMENT")!;

// const square = new Client({
//   accessToken: Deno.env.get("SQUARE_ACCESS_TOKEN")!,
//   environment:
//     squareEnvironment === "production"
//       ? Environment.Production
//       : Environment.Sandbox,
// });

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

  // get the square customer id and package variation id from the request body
  const { customer_id: customerId, package_id: packageId } = await req.json();

  // if the customer id or package variation id is missing, return an error
  if (!customerId || !packageId) {
    return new Response(
      stringify({
        message: `Error: Missing customer id or package variation id`,
      }),
      { status: 500 }
    );
  }

  // get the package data (to give to the user) from the database
  const { data: packageData, error } = await supabase
    .from("purchasable_packages")
    .select("user_received_loads, handle")
    .eq("square_variation_id", packageId)
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

  // get the number of loads the user will receive from the package
  const receivedLoads = packageData?.user_received_loads;
  // get the package handle from the database
  const packageHandle = packageData?.handle;

  // get the current user's metadata from the database
  const { data: userMetadata, error: userError } = await supabase
    .from("user_metadata")
    .select("loads_available, user_id")
    .eq("square_customer_id", customerId)
    .limit(1)
    .single();

  // if there is an error, return an error
  if (userError) {
    return new Response(
      stringify({
        message: `Error: ${userError.message}`,
      }),
      { status: 500 }
    );
  }

  // get the user's id from the database
  const userId = userMetadata?.user_id;
  // get the user's current loads from the database
  const userLoads = userMetadata?.loads_available;

  // update the user's loads in the database
  await supabase
    .from("user_metadata")
    .update({ loads_available: userLoads + receivedLoads })
    .eq("user_id", userId);

  // add a new row to the payment history table
  await supabase.from("payment_history").insert({
    user_id: userId,
    package_handle: packageHandle,
    square_variation_id: packageId,
    user_received_loads: receivedLoads,
  });

  return new Response(
    stringify({
      message: `Success: Added ${receivedLoads} loads to user ${userId}`,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
