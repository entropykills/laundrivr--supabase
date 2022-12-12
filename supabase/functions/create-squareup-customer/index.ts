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

  const { record } = await req.json();

  console.log("Record: " + stringify(record));

  // get the user id and email from the request body record
  const { user_id: userId, email } = record;

  let customer;

  try {
    console.log("Creating customer for user: " + userId);
    const response = await square.customersApi.createCustomer({
      emailAddress: email,
      referenceId: userId,
    });

    customer = response.result.customer;
    // get the customer id from the response
    const customerId = customer?.id;

    // log the customer id
    console.log("Creating customer ID: " + customerId);

    // if the customer id exists, update the user in supabase with the customer id
    if (customerId) {
      const { error } = await supabase
        .from("user_metadata")
        .update({ square_customer_id: customerId })
        .eq("user_id", userId);

      if (error) {
        throw new Error(
          "Error updating the user with the customer id, error: " + error.message
        );
      }
    } else {
      throw new Error(
        "Customer ID not found, there was an error creating the customer"
      );
    }
  } catch (error) {
    console.error("An error occurred: " + error.message);
    return new Response(
      stringify({
        message: `Error creating a customer through stripe or the database , error: ${stringify(
          error
        )}`,
      }),
      { status: 500 }
    );
  }

  // log the customer object
  console.log("Customer created: " + stringify(customer));

  return new Response(stringify(customer), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
