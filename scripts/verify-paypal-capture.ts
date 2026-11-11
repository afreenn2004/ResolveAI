import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are missing.");
  }

  const baseUrl = "https://api-m.sandbox.paypal.com";

  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenResponse.ok) {
    throw new Error(`PayPal OAuth failed: HTTP ${tokenResponse.status}`);
  }

  const token = await tokenResponse.json();

  const response = await fetch(
    `${baseUrl}/v2/payments/captures/27160295K8588634W`,
    {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  console.log(JSON.stringify({
    httpStatus: response.status,
    id: data.id,
    status: data.status,
    amount: data.amount,
    final_capture: data.final_capture,
    seller_protection: data.seller_protection,
    create_time: data.create_time,
    update_time: data.update_time,
    invoice_id: data.invoice_id,
    custom_id: data.custom_id,
    supplementary_data: data.supplementary_data,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});