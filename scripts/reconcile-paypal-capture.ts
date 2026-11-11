import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

let disconnectPrisma: (() => Promise<void>) | undefined;

const expected = {
  agreementId: "resolveai-demo-agreement",
  operationId: "cmwck4mko000t2pcwa39176as",
  milestoneId: "cmvyatdrb00002pz8f7erdkhw",
  authorizationId: "cmvzodejs00012px4htazg7xi",
  paypalCaptureId: "27160295K8588634W",
  paypalAuthorizationId: "7L10006951353442T",
  paypalOrderId: "5G0299454Y590101N",
  amount: 1000,
  currency: "USD",
};

async function main() {
  const { prisma } = await import("../lib/prisma");
  const { appendAuditEventInTransaction } = await import("../lib/audit");
  disconnectPrisma = () => prisma.$disconnect();
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are missing from .env.local");
  }

  const baseUrl = "https://api-m.sandbox.paypal.com";

  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenResponse.ok) {
    throw new Error(`PayPal authentication failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  const headers = {
    Authorization: `Bearer ${tokenData.access_token}`,
    "Content-Type": "application/json",
  };

  // These are read-only GET requests. No payment is captured here.
  const [captureResponse, authorizationResponse] = await Promise.all([
    fetch(`${baseUrl}/v2/payments/captures/${expected.paypalCaptureId}`, {
      headers,
    }),
    fetch(
      `${baseUrl}/v2/payments/authorizations/${expected.paypalAuthorizationId}`,
      { headers }
    ),
  ]);

  if (!captureResponse.ok || !authorizationResponse.ok) {
    throw new Error(
      `PayPal verification failed. Capture: ${captureResponse.status}; Authorization: ${authorizationResponse.status}`
    );
  }

  const capture = await captureResponse.json();
  const authorization = await authorizationResponse.json();

  if (
    capture.id !== expected.paypalCaptureId ||
    capture.status !== "COMPLETED" ||
    capture.amount?.currency_code !== expected.currency ||
    capture.amount?.value !== "10.00" ||
    capture.final_capture !== false ||
    capture.supplementary_data?.related_ids?.authorization_id !==
      expected.paypalAuthorizationId ||
    capture.supplementary_data?.related_ids?.order_id !==
      expected.paypalOrderId
  ) {
    throw new Error("PayPal capture details did not match expected values.");
  }

  if (
    authorization.id !== expected.paypalAuthorizationId ||
    authorization.status !== "PARTIALLY_CAPTURED" ||
    authorization.amount?.currency_code !== expected.currency ||
    authorization.amount?.value !== "30.00"
  ) {
    throw new Error("PayPal authorization details did not match expected values.");
  }

  console.log("PayPal independently verified. Checking local database...");

  await prisma.$transaction(async (tx) => {
    const operation = await tx.paymentOperation.findUnique({
      where: { id: expected.operationId },
      include: {
        milestone: true,
        authorization: true,
        agreement: { include: { milestones: true } },
      },
    });

    if (!operation) throw new Error("Payment operation not found.");

    if (
      operation.agreementId !== expected.agreementId ||
      operation.milestoneId !== expected.milestoneId ||
      operation.operationType !== "CAPTURE" ||
      operation.amount !== expected.amount ||
      operation.status !== "PENDING" ||
      operation.paypalCaptureId !== null
    ) {
      throw new Error("Payment operation state does not match expected state.");
    }

    const milestone = operation.milestone;
    const auth = operation.authorization;
    const agreement = operation.agreement;

    if (
      !milestone ||
      milestone.sequence !== 1 ||
      milestone.amount !== expected.amount ||
      milestone.evidenceValidated !== true ||
      !milestone.buyerAcceptedAt ||
      milestone.capturedAmount !== 0 ||
      milestone.capturedAt !== null
    ) {
      throw new Error("Milestone state does not match expected state.");
    }

    if (
      !auth ||
      auth.id !== expected.authorizationId ||
      auth.paypalAuthorizationId !== expected.paypalAuthorizationId ||
      auth.paypalOrderId !== expected.paypalOrderId ||
      auth.amount !== 3000 ||
      auth.currency !== expected.currency ||
      auth.authorizationStatus !== "CREATED"
    ) {
      throw new Error("Local authorization state does not match expected state.");
    }

    if (
      agreement.id !== expected.agreementId ||
      agreement.currency !== expected.currency ||
      agreement.totalAmount !== 3000 ||
      agreement.milestones.length !== 3
    ) {
      throw new Error("Agreement state does not match expected state.");
    }

    const otherCompletedCaptures = await tx.paymentOperation.count({
      where: {
        agreementId: expected.agreementId,
        operationType: "CAPTURE",
        status: "COMPLETED",
        id: { not: expected.operationId },
      },
    });

    if (otherCompletedCaptures !== 0) {
      throw new Error("Another completed capture exists. Stopping reconciliation.");
    }

    const now = new Date();

    await tx.paymentOperation.update({
      where: { id: expected.operationId },
      data: {
        status: "COMPLETED",
        paypalCaptureId: expected.paypalCaptureId,
       responseDetails: JSON.stringify({
  reconciliationMethod: "INDEPENDENT_PAYPAL_GET_VERIFICATION",
  captureId: capture.id,
  captureStatus: capture.status,
  captureAmount: capture.amount,
  finalCapture: capture.final_capture,
  authorizationStatus: authorization.status,
  verifiedAt: now.toISOString(),
}),
      },
    });

    await tx.milestone.update({
      where: { id: expected.milestoneId },
      data: {
        capturedAmount: expected.amount,
        capturedAt: now,
      },
    });

    await tx.paymentAuthorization.update({
      where: { id: expected.authorizationId },
      data: { authorizationStatus: "PARTIALLY_CAPTURED" },
    });

    await tx.agreement.update({
      where: { id: expected.agreementId },
      data: { captureInProgress: false },
    });

    await appendAuditEventInTransaction(tx, {
      agreementId: expected.agreementId,
      milestoneId: expected.milestoneId,
      eventType: "PAYMENT_CAPTURE_COMPLETED",
      details: {
        paypalCaptureId: expected.paypalCaptureId,
        amount: expected.amount,
        currency: expected.currency,
        reconciliationMethod: "INDEPENDENT_PAYPAL_GET_VERIFICATION",
      },
    });
  });

  console.log("Reconciliation completed successfully.");
}

main()
  .catch((error) => {
    console.error("RECONCILIATION STOPPED:", error.message);
    process.exitCode = 1;
  })
    .finally(async () => {
    await disconnectPrisma?.();
  });
