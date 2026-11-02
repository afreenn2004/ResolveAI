
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { appendAuditEvent } from "@/lib/audit";

const AGREEMENT_ID = "resolveai-demo-agreement";
const EXPECTED_AMOUNT = "30.00";
const CURRENCY = "USD";

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

    if (
      typeof orderId !== "string" ||
      !/^[A-Z0-9]+$/.test(orderId)
    ) {
      return NextResponse.json(
        { error: "A valid PayPal order ID is required." },
        { status: 400 }
      );
    }

    const agreement = await prisma.agreement.findUnique({
      where: { id: AGREEMENT_ID },
    });

    if (!agreement) {
      return NextResponse.json(
        { error: "ResolveAI demo agreement was not found." },
        { status: 404 }
      );
    }

    // Step 1: Authenticate with PayPal.
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

    // Step 2: Retrieve the PayPal order.
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
      orderData.intent !== "AUTHORIZE" ||
      amount?.currency_code !== CURRENCY ||
      amount?.value !== EXPECTED_AMOUNT
    ) {
      return NextResponse.json(
        {
          error: "Order failed authorization safety checks.",
          orderStatus: orderData.status,
        },
        { status: 409 }
      );
    }

    let finalOrderData = orderData;

    // Step 3: Authorize only if the order is still approved.
    if (orderData.status === "APPROVED") {
      const authorizationResponse = await fetch(
        `${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
            "PayPal-Request-Id": `resolveai-auth-${orderId}`,
          },
          body: JSON.stringify({}),
          cache: "no-store",
        }
      );

      const authorizationData = await authorizationResponse.json();

      if (!authorizationResponse.ok) {
        console.error(
          "PayPal authorization error:",
          authorizationData
        );

        return NextResponse.json(
          { error: "PayPal could not authorize this order." },
          { status: 502 }
        );
      }

      finalOrderData = authorizationData;
    } else if (orderData.status !== "COMPLETED") {
      return NextResponse.json(
        {
          error: "Order is not in an authorizable or already-authorized state.",
          orderStatus: orderData.status,
        },
        { status: 409 }
      );
    }

    // Step 4: Extract the authorization from the final order.
    const authorization =
      finalOrderData.purchase_units?.[0]?.payments?.authorizations?.[0];

    if (
      !authorization?.id ||
      !["CREATED", "PENDING"].includes(authorization.status) ||
      authorization.amount?.currency_code !== CURRENCY ||
      authorization.amount?.value !== EXPECTED_AMOUNT
    ) {
      return NextResponse.json(
        {
          error: "A valid PayPal authorization could not be confirmed.",
        },
        { status: 409 }
      );
    }

    const amountInCents = Math.round(
      Number(authorization.amount.value) * 100
    );

    if (
      !Number.isSafeInteger(amountInCents) ||
      amountInCents !== agreement.totalAmount
    ) {
      return NextResponse.json(
        { error: "Authorization amount does not match the agreement." },
        { status: 409 }
      );
    }

    // Step 5: Persist the authorization in SQLite.
    const existingAuthorization =
      await prisma.paymentAuthorization.findUnique({
        where: { paypalOrderId: orderId },
      });

    if (
      existingAuthorization?.paypalAuthorizationId &&
      existingAuthorization.paypalAuthorizationId !== authorization.id
    ) {
      return NextResponse.json(
        { error: "Order is already linked to a different authorization." },
        { status: 409 }
      );
    }

    const savedAuthorization =
      await prisma.paymentAuthorization.upsert({
        where: { paypalOrderId: orderId },
        update: {
          paypalAuthorizationId: authorization.id,
          orderStatus: finalOrderData.status,
          authorizationStatus: authorization.status,
          amount: amountInCents,
          currency: CURRENCY,
        },
        create: {
          agreementId: agreement.id,
          paypalOrderId: orderId,
          paypalAuthorizationId: authorization.id,
          amount: amountInCents,
          currency: CURRENCY,
          orderStatus: finalOrderData.status,
          authorizationStatus: authorization.status,
        },
      });

    // Step 6: Record the authorization event only once.
    const existingAuditEvent = await prisma.auditEvent.findFirst({
      where: {
        agreementId: agreement.id,
        eventType: "PAYPAL_AUTHORIZATION_RECORDED",
        details: {
          contains: authorization.id,
        },
      },
    });

    if (!existingAuditEvent) {
      await appendAuditEvent({
        agreementId: agreement.id,
        eventType: "PAYPAL_AUTHORIZATION_RECORDED",
        details: {
          orderId,
          authorizationId: authorization.id,
          amount: amountInCents,
          currency: CURRENCY,
          status: authorization.status,
        },
      });
    }

    return NextResponse.json({
      success: true,
      orderId,
      orderStatus: finalOrderData.status,
      authorizationId: savedAuthorization.paypalAuthorizationId,
      authorizationStatus: savedAuthorization.authorizationStatus,
      amount: (savedAuthorization.amount / 100).toFixed(2),
      currency: savedAuthorization.currency,
      databaseSaved: true,
      message:
        "PayPal authorization recorded. No capture has been made.",
    });
  } catch (error) {
    console.error("Authorization failed:", error);

    return NextResponse.json(
      { error: "Unable to process PayPal authorization." },
      { status: 500 }
    );
  }
}
