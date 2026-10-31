
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = process.env.PAYPAL_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    return NextResponse.json(
      { error: "PayPal configuration is missing." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const orderId = body.orderId;

    if (typeof orderId !== "string" || !/^[A-Z0-9]+$/.test(orderId)) {
      return NextResponse.json(
        { error: "A valid PayPal order ID is required." },
        { status: 400 }
      );
    }

    // Step 1: Authenticate with PayPal
    const credentials = Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

    const tokenResponse = await fetch(
      `${baseUrl}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        cache: "no-store",
      }
    );

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: "PayPal authentication failed." },
        { status: 502 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Retrieve and validate the order
    const orderResponse = await fetch(
      `${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      return NextResponse.json(
        { error: "Could not retrieve the PayPal order." },
        { status: 502 }
      );
    }

    const purchaseUnit = orderData.purchase_units?.[0];
    const amount = purchaseUnit?.amount;

    if (
      orderData.status !== "APPROVED" ||
      orderData.intent !== "AUTHORIZE" ||
      amount?.currency_code !== "USD" ||
      amount?.value !== "30.00"
    ) {
      return NextResponse.json(
        {
          error: "Order failed authorization safety checks.",
          orderStatus: orderData.status,
        },
        { status: 409 }
      );
    }

    // Step 3: Request authorization from PayPal
    const authorizationResponse = await fetch(
      `${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
          "PayPal-Request-Id": randomUUID(),
        },
        body: JSON.stringify({}),
        cache: "no-store",
      }
    );

    const authorizationData = await authorizationResponse.json();

    if (!authorizationResponse.ok) {
      console.error("PayPal authorization error:", authorizationData);

      return NextResponse.json(
        { error: "PayPal could not authorize this order." },
        { status: 502 }
      );
    }

    const authorization =
      authorizationData.purchase_units?.[0]?.payments?.authorizations?.[0];

    return NextResponse.json({
      success: true,
      orderId: authorizationData.id,
      orderStatus: authorizationData.status,
      authorizationId: authorization?.id ?? null,
      authorizationStatus: authorization?.status ?? null,
      amount: authorization?.amount?.value ?? null,
      currency: authorization?.amount?.currency_code ?? null,
      message: "PayPal authorization completed. No capture has been made.",
    });
  } catch (error) {
    console.error("Authorization failed:", error);

    return NextResponse.json(
      { error: "Unable to process PayPal authorization." },
      { status: 500 }
    );
  }
}
