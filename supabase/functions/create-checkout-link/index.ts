import "https://deno.land/x/xhr@0.2.1/mod.ts";
import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1.35.5";
import { Client, Environment } from "https://esm.sh/square@24.0.0";
import { stringify } from "../_shared/index.ts";
import { PackageCheckoutLinkRequest } from "../_shared/checkout.ts";

const squareLocationId = Deno.env.get("SQUARE_LOCATION_ID")!;

const square = new Client({
  accessToken: Deno.env.get("SQUARE_ACCESS_TOKEN")!,
  environment: Environment.Sandbox,
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

  // get the user token from the request
  const token = req.headers.get("Authorization")!.replace("Bearer ", "");
  const { user } = await supabase.auth.api.getUser(token);

  if (!user) {
    return new Response(
      stringify({
        message: `Error: user not found`,
      }),
      { status: 500 }
    );
  }

  // conver the body json into a PackageCheckoutLinkRequest
  const { handle } = (await req.json()) as PackageCheckoutLinkRequest;

  // use the supabase client to get the associated square variation id from the database
  const { data: variation, error } = await supabase
    .from("purchasable_packages")
    .select("square_variation_id, price")
    .eq("handle", handle)
    .limit(1)
    .single();

  if (error) {
    return new Response(
      stringify({
        message: `Error getting the square variation id from the database, error: ${stringify(
          error
        )}`,
      }),
      { status: 500 }
    );
  }

  // if there's no variation id, return an error
  if (!variation) {
    return new Response(
      stringify({
        message: `Error: no variation found for handle: ${handle}`,
      }),
      { status: 500 }
    );
  }

  // get the customer id from the user
  const { data: user_metadata, error: customerError } = await supabase
    .from("user_metadata")
    .select("square_customer_id")
    .eq("id", user.id)
    .limit(1)
    .single();

  if (customerError) {
    return new Response(
      stringify({
        message: `Error getting the square customer id from the database, error: ${stringify(
          customerError
        )}`,
      }),
      { status: 500 }
    );
  }

  // if there's no customer id, return an error
  if (!user_metadata) {
    return new Response(
      stringify({
        message: `Error: no customer found for user: ${user.id}`,
      }),
      { status: 500 }
    );
  }

  // get the customer id
  const customerId: string = user_metadata.data.square_customer_id;
  // get the variation id
  const variationId: string = variation.data.square_variation_id;
  // get the price
  const price: number = variation.data.price;

  // log the variation id
  console.log(`Found variation id from handle: ${handle}, id: ${variation}`);

  // use the square client to create a checkout link
  let checkoutLink: string | undefined;
  try {
    const response = await square.checkoutApi.createPaymentLink({
      // generate a random idempotency key
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: squareLocationId,
        customerId: customerId,
        lineItems: [
          {
            quantity: "1",
            catalogObjectId: variationId,
          },
        ],
      },
    });

    // if there's an error, throw it
    if (response.result.errors) {
      throw new Error(response.result.errors[0].detail);
    }

    // get the checkout link
    checkoutLink = response.result.paymentLink!.url;

    // if there's no checkout link, throw an error
    if (!checkoutLink) {
      throw new Error("No checkout link found");
    }
  } catch (error) {
    console.error("An error occurred: " + error.message);
    return new Response(
      stringify({
        message: `Error creating a checkout link through stripe or the database , error: ${stringify(
          error
        )}`,
      }),
      { status: 500 }
    );
  }

  // log the customer object
  console.log("Checkout link created: " + stringify(checkoutLink));

  return new Response(stringify({ url: checkoutLink }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
