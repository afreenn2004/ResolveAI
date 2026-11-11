
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = process.env.PAYPAL_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error("PayPal configuration is missing.");
  }

  const saved = await prisma.paymentAuthorization.findFirst({
    where: {
      agreementId: "resolveai-demo-agreement",
      paypalAuthorizationId: { not: null },
    },
  });

  if (!saved?.paypalAuthorizationId) {
    throw new Error("Saved PayPal authorization not found.");
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    throw new Error("PayPal authentication failed.");
  }

  const tokenData = await tokenResponse.json();

  const response = await fetch(
    `${baseUrl}/v2/payments/authorizations/${encodeURIComponent(saved.paypalAuthorizationId)}`,
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  console.log("PayPal authorization lookup:");
  console.log(
    JSON.stringify(
      {
        httpStatus: response.status,
        id: data.id,
        status: data.status,
        amount: data.amount,
        expirationTime: data.expiration_time,
      },
      null,
      2
    )
  );

  if (!response.ok) {
    throw new Error("PayPal authorization lookup failed.");
  }
}

main()
  .catch((error) => {
    console.error("Inspection failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
