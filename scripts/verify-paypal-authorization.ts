import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;
  const base = "https://api-m.sandbox.paypal.com";

  const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenResponse.ok) throw new Error(`OAuth failed: ${tokenResponse.status}`);
  const token = await tokenResponse.json();

  const response = await fetch(
    `${base}/v2/payments/authorizations/7L10006951353442T`,
    { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }
  );

  const data = await response.json();
  console.log(JSON.stringify({
    httpStatus: response.status,
    id: data.id,
    status: data.status,
    amount: data.amount,
    seller_receivable_breakdown: data.seller_receivable_breakdown,
    create_time: data.create_time,
    update_time: data.update_time,
  }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
