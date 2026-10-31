
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

// CREATE a new $30 PayPal Sandbox order
export async function POST() {
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

    const orderResponse = await fetch(
      `${baseUrl}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
          "PayPal-Request-Id": randomUUID(),
        },
        body: JSON.stringify({
          intent: "AUTHORIZE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: "30.00",
              },
              description: "ResolveAI research brief - demo",
            },
          ],
        }),
        cache: "no-store",
      }
    );

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error("PayPal order error:", orderData);

      return NextResponse.json(
        { error: "PayPal could not create the order." },
        { status: 502 }
      );
    }

    const approvalLink = orderData.links?.find(
      (link: { rel: string; href: string }) =>
        link.rel === "approve" || link.rel === "payer-action"
    );

    return NextResponse.json({
      success: true,
      orderId: orderData.id,
      status: orderData.status,
      approvalUrl: approvalLink?.href ?? null,
      amount: "30.00",
      currency: "USD",
      intent: "AUTHORIZE",
    });
  } catch (error) {
    console.error("Order creation failed:", error);

    return NextResponse.json(
      { error: "Unable to connect to PayPal." },
      { status: 500 }
    );
  }
}

// VERIFY an existing PayPal order
export async function GET(request: NextRequest) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = process.env.PAYPAL_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    return NextResponse.json(
      { error: "PayPal configuration is missing." },
      { status: 500 }
    );
  }

  const orderId = request.nextUrl.searchParams.get("id");

  if (!orderId) {
    return NextResponse.json(
      { error: "Please provide an order ID using ?id=ORDER_ID." },
      { status: 400 }
    );
  }

  try {
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

    const orderResponse = await fetch(
      `${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error("PayPal verification error:", orderData);

      return NextResponse.json(
        { error: "PayPal could not retrieve this order." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: orderData.id,
      status: orderData.status,
      intent: orderData.intent,
      purchaseUnits: orderData.purchase_units?.map(
        (unit: {
          amount?: {
            currency_code?: string;
            value?: string;
          };
        }) => ({
          currency: unit.amount?.currency_code,
          amount: unit.amount?.value,
        })
      ),
    });
  } catch (error) {
    console.error("Order verification failed:", error);

    return NextResponse.json(
      { error: "Unable to connect to PayPal." },
      { status: 500 }
    );
  }
}
