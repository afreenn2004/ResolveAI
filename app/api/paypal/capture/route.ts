
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { appendAuditEvent } from "@/lib/audit";
import { validateCapturePreflight } from "@/lib/payment-capture";

const CAPTURE_ENABLED =
  process.env.ENABLE_SANDBOX_CAPTURE === "true";

export async function POST(request: NextRequest) {
  try {
    // Keep payment capture disabled unless explicitly enabled.
    if (!CAPTURE_ENABLED) {
      return NextResponse.json(
        { error: "Sandbox capture is disabled." },
        { status: 403 }
      );
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const baseUrl =
      process.env.PAYPAL_BASE_URL ||
      "https://api-m.sandbox.paypal.com";

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "PayPal credentials are not configured." },
        { status: 500 }
      );
    }

    // Permit only the official PayPal Sandbox API hostname.
    try {
      const parsedBaseUrl = new URL(baseUrl);

      if (
        parsedBaseUrl.protocol !== "https:" ||
        parsedBaseUrl.hostname !== "api-m.sandbox.paypal.com" ||
        parsedBaseUrl.username ||
        parsedBaseUrl.password ||
        parsedBaseUrl.pathname !== "/" ||
        parsedBaseUrl.search ||
        parsedBaseUrl.hash
      ) {
        return NextResponse.json(
          {
            error:
              "This demo only permits the official PayPal Sandbox API.",
          },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "PayPal base URL is invalid." },
        { status: 500 }
      );
    }

    // Validate request body.
    let body: { milestoneId?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must contain valid JSON." },
        { status: 400 }
      );
    }

    const { milestoneId } = body;

    if (
      typeof milestoneId !== "string" ||
      milestoneId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "A valid milestoneId is required." },
        { status: 400 }
      );
    }

    // Load milestone and agreement.
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { agreement: true },
    });

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found." },
        { status: 404 }
      );
    }

    const agreement = milestone.agreement;

    // Only one authorization is permitted for this demo agreement.
    const authorizations =
      await prisma.paymentAuthorization.findMany({
        where: { agreementId: agreement.id },
      });

    if (authorizations.length !== 1) {
      return NextResponse.json(
        {
          error:
            "Exactly one recorded PayPal authorization is required.",
        },
        { status: 409 }
      );
    }

    const savedAuthorization = authorizations[0];

    if (!savedAuthorization.paypalAuthorizationId) {
      return NextResponse.json(
        { error: "PayPal authorization ID is missing." },
        { status: 409 }
      );
    }

    // Recalculate the agreement hash from the stored agreement.
    const { createAgreementHash } = await import(
      "@/lib/agreement-hash"
    );

    const storedMilestones = await prisma.milestone.findMany({
      where: { agreementId: agreement.id },
      orderBy: { sequence: "asc" },
    });

    const calculatedHash = createAgreementHash({
      id: agreement.id,
      title: agreement.title,
      buyerName: agreement.buyerName,
      sellerName: agreement.sellerName,
      totalAmount: agreement.totalAmount,
      currency: agreement.currency,
      milestones: storedMilestones.map((item) => ({
        sequence: item.sequence,
        title: item.title,
        description: item.description,
        amount: item.amount,
      })),
    });

    if (calculatedHash !== agreement.agreementHash) {
      return NextResponse.json(
        { error: "Agreement hash verification failed." },
        { status: 409 }
      );
    }

    // Confirm that milestone amounts still equal the agreement total.
    const milestoneTotal = storedMilestones.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    if (milestoneTotal !== agreement.totalAmount) {
      return NextResponse.json(
        { error: "Milestone amounts do not match the agreement." },
        { status: 409 }
      );
    }

    // Confirm recorded payment operations match captured milestone totals.
    const paymentOperations =
      await prisma.paymentOperation.findMany({
        where: {
          agreementId: agreement.id,
          status: "COMPLETED",
        },
      });

    const operationTotal = paymentOperations.reduce(
      (sum, operation) => sum + operation.amount,
      0
    );

    const milestoneCaptureTotal = storedMilestones.reduce(
      (sum, item) => sum + item.capturedAmount,
      0
    );

    if (operationTotal !== milestoneCaptureTotal) {
      return NextResponse.json(
        {
          error:
            "Payment records do not match captured milestone amounts. Manual reconciliation is required.",
        },
        { status: 409 }
      );
    }

    // Idempotency: never create a second capture for the same milestone.
    const existingOperation =
  await prisma.paymentOperation.findFirst({
    where: { milestoneId: milestone.id },
  });

    if (existingOperation) {
      if (existingOperation.status === "COMPLETED") {
        return NextResponse.json({
          success: true,
          alreadyCaptured: true,
          message: "This milestone has already been captured.",
          operation: existingOperation,
        });
      }

      return NextResponse.json(
        {
          error:
            "A payment operation already exists and requires reconciliation before another capture.",
          operation: existingOperation,
        },
        { status: 409 }
      );
    }

    // Enforce milestone order.
    const previousMilestones = storedMilestones.filter(
      (item) => item.sequence < milestone.sequence
    );

    const previousMilestonesCompleted =
      previousMilestones.every(
        (item) =>
          item.capturedAmount === item.amount &&
          item.capturedAt !== null
      );

    if (!previousMilestonesCompleted) {
      return NextResponse.json(
        {
          error:
            "Previous milestones must be fully captured first.",
        },
        { status: 409 }
      );
    }

    // No unresolved operations are allowed.
    const unresolvedOperation =
      await prisma.paymentOperation.findFirst({
        where: {
          agreementId: agreement.id,
          status: { in: ["PENDING", "PROCESSING"] },
        },
      });

    if (unresolvedOperation) {
      return NextResponse.json(
        {
          error:
            "An unresolved payment operation exists. Reconciliation is required.",
          operation: unresolvedOperation,
        },
        { status: 409 }
      );
    }

    // Calculate remaining authorized funds.
    const capturedCents = storedMilestones.reduce(
      (sum, item) => sum + item.capturedAmount,
      0
    );

    const remainingAuthorizedAmount =
      savedAuthorization.amount - capturedCents;

    // Validate all deterministic payment safety rules.
    const preflight = validateCapturePreflight({
      amount: milestone.amount,
      milestoneAmount: milestone.amount,
      remainingAuthorizedAmount,
      buyerAcceptanceRecorded:
        milestone.buyerAcceptedAt !== null,
      evidenceValidated: milestone.evidenceValidated,
      agreementHashMatches:
        calculatedHash === agreement.agreementHash,
      alreadyCaptured:
        milestone.capturedAmount > 0 ||
        milestone.capturedAt !== null,
      milestoneSequence: milestone.sequence,
      completedPreviousMilestones:
        previousMilestones.length,
      authorizationStatus:
        savedAuthorization.authorizationStatus,
      hasPendingOperation: false,
    });

    if (!preflight.allowed) {
      return NextResponse.json(
        {
          error: "Payment safety checks failed.",
          reasons: preflight.reasons,
        },
        { status: 409 }
      );
    }

    // Verify authorization amount and currency in the database.
    if (
      savedAuthorization.amount !== agreement.totalAmount ||
      savedAuthorization.currency !== agreement.currency ||
      agreement.currency !== "USD"
    ) {
      return NextResponse.json(
        {
          error:
            "Authorization amount or currency does not match the agreement.",
        },
        { status: 409 }
      );
    }

    // Obtain PayPal OAuth access token.
    const tokenResponse = await fetch(
      `${baseUrl}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Basic ${Buffer.from(
              `${clientId}:${clientSecret}`
            ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        cache: "no-store",
      }
    );

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { error: "Could not authenticate with PayPal." },
        { status: 502 }
      );
    }

    const tokenData: unknown = await tokenResponse.json();

    if (
      tokenData === null ||
      typeof tokenData !== "object" ||
      !("access_token" in tokenData) ||
      typeof tokenData.access_token !== "string" ||
      tokenData.access_token.length === 0
    ) {
      return NextResponse.json(
        { error: "PayPal returned an invalid access token response." },
        { status: 502 }
      );
    }

    const accessToken = tokenData.access_token;

    // Fetch the actual authorization from PayPal before capture.
    const authorizationResponse = await fetch(
      `${baseUrl}/v2/payments/authorizations/${savedAuthorization.paypalAuthorizationId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!authorizationResponse.ok) {
      return NextResponse.json(
        {
          error:
            "Could not verify the PayPal authorization. Capture was not attempted.",
        },
        { status: 502 }
      );
    }

    const authorizationData: unknown =
      await authorizationResponse.json();

    if (
      authorizationData === null ||
      typeof authorizationData !== "object" ||
      Array.isArray(authorizationData)
    ) {
      return NextResponse.json(
        { error: "PayPal returned an invalid authorization response." },
        { status: 502 }
      );
    }

    const remoteAuthorization = authorizationData as {
      id?: string;
      status?: string;
      amount?: {
        value?: string;
        currency_code?: string;
      };
      expiration_time?: string;
    };

    if (
      remoteAuthorization.id !==
        savedAuthorization.paypalAuthorizationId ||
      remoteAuthorization.amount?.value !==
        (savedAuthorization.amount / 100).toFixed(2) ||
      remoteAuthorization.amount?.currency_code !==
        savedAuthorization.currency
    ) {
      return NextResponse.json(
        {
          error:
            "PayPal authorization details do not match the database.",
        },
        { status: 409 }
      );
    }

    // Require a valid, non-expired authorization expiry date.
    if (typeof remoteAuthorization.expiration_time !== "string") {
      return NextResponse.json(
        {
          error:
            "PayPal authorization expiry is missing. Manual review is required.",
        },
        { status: 409 }
      );
    }

    const expirationTime = Date.parse(
      remoteAuthorization.expiration_time
    );

    if (
      !Number.isFinite(expirationTime) ||
      expirationTime <= Date.now()
    ) {
      return NextResponse.json(
        { error: "PayPal authorization is expired or invalid." },
        { status: 409 }
      );
    }

    if (
      !["CREATED", "PARTIALLY_CAPTURED"].includes(
        remoteAuthorization.status || ""
      )
    ) {
      return NextResponse.json(
        {
          error:
            "PayPal authorization is not in a capturable state.",
          authorizationStatus: remoteAuthorization.status,
        },
        { status: 409 }
      );
    }

    if (
      remoteAuthorization.status !==
      savedAuthorization.authorizationStatus
    ) {
      return NextResponse.json(
        {
          error:
            "PayPal authorization status differs from the database. Reconciliation is required.",
          databaseStatus:
            savedAuthorization.authorizationStatus,
          paypalStatus: remoteAuthorization.status,
        },
        { status: 409 }
      );
    }

// Atomically acquire the agreement capture lock and record the operation.
const operation = await prisma.$transaction(async (tx) => {
  const lockResult = await tx.agreement.updateMany({
    where: {
      id: agreement.id,
      captureInProgress: false,
    },
    data: {
      captureInProgress: true,
    },
  });

  if (lockResult.count !== 1) {
    throw new Error(
      "Another capture is in progress or requires reconciliation."
    );
  }

  const captureRequestId =
    `resolveai-capture-${milestone.id}`;

  const createdOperation =
    await tx.paymentOperation.create({
      data: {
        agreementId: agreement.id,
        milestoneId: milestone.id,
        authorizationId: savedAuthorization.id,
        operationType: "CAPTURE",
        amount: milestone.amount,
        currency: agreement.currency,
        status: "PENDING",
        idempotencyKey: captureRequestId,
        paypalRequestId: captureRequestId,
      },
    });

  const { appendAuditEventInTransaction } = await import("@/lib/audit");

  await appendAuditEventInTransaction(tx, {
    agreementId: agreement.id,
    milestoneId: milestone.id,
    eventType: "PAYMENT_CAPTURE_REQUESTED",
    details: {
      operationId: createdOperation.id,
      amount: milestone.amount,
      currency: agreement.currency,
      paypalAuthorizationId: savedAuthorization.paypalAuthorizationId,
    },
  });

  return createdOperation;
});

    // Ask PayPal to capture this milestone's exact amount.
    let captureResponse: Response;

    try {
      captureResponse = await fetch(
        `${baseUrl}/v2/payments/authorizations/${savedAuthorization.paypalAuthorizationId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id":
              `resolveai-capture-${milestone.id}`,
          },
          body: JSON.stringify({
            amount: {
              currency_code: agreement.currency,
              value: (milestone.amount / 100).toFixed(2),
            },
            final_capture:
              milestone.sequence === storedMilestones.length,
          }),
          cache: "no-store",
        }
      );
    } catch (error) {
      await appendAuditEvent({
        agreementId: agreement.id,
        milestoneId: milestone.id,
        eventType: "PAYMENT_CAPTURE_UNCONFIRMED",
        details: {
          operationId: operation.id,
          reason: "Network error while contacting PayPal.",
          error:
            error instanceof Error
              ? error.message
              : "Unknown network error",
        },
      });

      return NextResponse.json(
        {
          success: false,
          pending: true,
          message:
            "PayPal capture could not be confirmed. Do not retry until the operation and audit records have been reconciled.",
          operationId: operation.id,
        },
        { status: 202 }
      );
    }

    // Parse the capture response safely.
    let captureData: {
      status?: string;
      id?: string;
      amount?: {
        value?: unknown;
        currency_code?: string;
      };
      final_capture?: boolean;
    };

    try {
      const parsed: unknown = await captureResponse.json();

      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("Invalid PayPal capture response.");
      }

      captureData = parsed as typeof captureData;
    } catch {
      await appendAuditEvent({
        agreementId: agreement.id,
        milestoneId: milestone.id,
        eventType: "PAYMENT_CAPTURE_UNCONFIRMED",
        details: {
          operationId: operation.id,
          reason:
            "PayPal returned an unreadable capture response.",
          httpStatus: captureResponse.status,
        },
      });

      return NextResponse.json(
        {
          success: false,
          pending: true,
          message:
            "PayPal's response could not be read. Manual reconciliation is required before retrying.",
          operationId: operation.id,
        },
        { status: 202 }
      );
    }

    const captureStatus = captureData.status;

    // An unclear HTTP error response must never be treated as a safe failure.
    if (
      !captureResponse.ok &&
      !["DECLINED", "FAILED"].includes(captureStatus || "")
    ) {
      await appendAuditEvent({
        agreementId: agreement.id,
        milestoneId: milestone.id,
        eventType: "PAYMENT_CAPTURE_UNCONFIRMED",
        details: {
          operationId: operation.id,
          httpStatus: captureResponse.status,
          response: captureData,
        },
      });

      return NextResponse.json(
        {
          success: false,
          pending: true,
          message:
            "PayPal did not provide a confirmed capture result. Reconciliation is required.",
          operationId: operation.id,
        },
        { status: 202 }
      );
    }

    // A definite PayPal decline or failure.
    if (["DECLINED", "FAILED"].includes(captureStatus || "")) {
      await prisma.$transaction(async (tx) => {
        await tx.paymentOperation.update({
          where: { id: operation.id },
          data: {
            status: "FAILED",
            responseDetails: JSON.stringify(captureData),
          },
        });

        const { appendAuditEventInTransaction } = await import(
          "@/lib/audit"
        );

        await appendAuditEventInTransaction(tx, {
          agreementId: agreement.id,
          milestoneId: milestone.id,
          eventType: "PAYMENT_CAPTURE_FAILED",
          details: {
            operationId: operation.id,
            captureStatus,
            response: captureData,
          },
        });
        await tx.agreement.updateMany({
  where: {
    id: agreement.id,
    captureInProgress: true,
  },
  data: {
    captureInProgress: false,
  },
});
      });

      return NextResponse.json(
        {
          success: false,
          captured: false,
          message: "PayPal declined or failed the capture.",
          operationId: operation.id,
          captureStatus,
        },
        { status: 409 }
      );
    }

    // PENDING or any unexpected status is not a completed payment.
    if (captureStatus !== "COMPLETED") {
      await appendAuditEvent({
        agreementId: agreement.id,
        milestoneId: milestone.id,
        eventType: "PAYMENT_CAPTURE_UNCONFIRMED",
        details: {
          operationId: operation.id,
          captureStatus,
          response: captureData,
        },
      });

      return NextResponse.json(
        {
          success: false,
          pending: true,
          message:
            "PayPal has not confirmed a completed capture. Manual reconciliation is required.",
          operationId: operation.id,
          captureStatus,
        },
        { status: 202 }
      );
    }

    // Verify the capture ID, exact amount, and currency.
    if (
      typeof captureData.id !== "string" ||
      captureData.id.length === 0 ||
      captureData.amount?.value !==
        (milestone.amount / 100).toFixed(2) ||
      captureData.amount?.currency_code !== agreement.currency ||
      captureData.final_capture !==
        (milestone.sequence === storedMilestones.length)
    ) {
      await appendAuditEvent({
        agreementId: agreement.id,
        milestoneId: milestone.id,
        eventType: "PAYMENT_CAPTURE_MISMATCH",
        details: {
          operationId: operation.id,
          response: captureData,
        },
      });

      return NextResponse.json(
        {
          success: false,
          pending: true,
          message:
            "PayPal reported a completed capture, but its details did not match the requested payment. Manual reconciliation is required.",
          operationId: operation.id,
        },
        { status: 202 }
      );
    }

    // Verify the authorization's post-capture state with PayPal.
    let authorizationStatusAfterCapture =
      "RECONCILIATION_REQUIRED";
    let authorizationVerificationReason:
      | string
      | null = null;

    try {
      const updatedAuthorizationResponse = await fetch(
        `${baseUrl}/v2/payments/authorizations/${savedAuthorization.paypalAuthorizationId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );

      if (!updatedAuthorizationResponse.ok) {
        throw new Error(
          "Could not retrieve authorization after capture."
        );
      }

      const updatedAuthorization: unknown =
        await updatedAuthorizationResponse.json();

      if (
        updatedAuthorization === null ||
        typeof updatedAuthorization !== "object" ||
        Array.isArray(updatedAuthorization)
      ) {
        throw new Error(
          "PayPal returned an invalid post-capture authorization."
        );
      }

      const updatedData = updatedAuthorization as {
        id?: string;
        status?: string;
        amount?: {
          value?: string;
          currency_code?: string;
        };
      };

      const expectedStatus =
        milestone.sequence === storedMilestones.length
          ? "CAPTURED"
          : "PARTIALLY_CAPTURED";

      if (
        updatedData.id !==
          savedAuthorization.paypalAuthorizationId ||
        updatedData.amount?.value !==
          (savedAuthorization.amount / 100).toFixed(2) ||
        updatedData.amount?.currency_code !==
          savedAuthorization.currency ||
        updatedData.status !== expectedStatus
      ) {
        throw new Error(
          `Post-capture authorization did not match expected state ${expectedStatus}.`
        );
      }

      authorizationStatusAfterCapture = updatedData.status;
    } catch (error) {
      authorizationVerificationReason =
        error instanceof Error
          ? error.message
          : "Unknown authorization verification error.";
    }

    // Recheck payment totals before final database update.
    const currentOperations =
      await prisma.paymentOperation.findMany({
        where: {
          agreementId: agreement.id,
          status: "COMPLETED",
        },
      });

    const currentCapturedTotal = currentOperations.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    const currentMilestoneCapturedTotal =
      await prisma.milestone.aggregate({
        where: { agreementId: agreement.id },
        _sum: { capturedAmount: true },
      });

    const milestoneTotalCaptured =
      currentMilestoneCapturedTotal._sum.capturedAmount || 0;

    if (currentCapturedTotal !== milestoneTotalCaptured) {
      await appendAuditEvent({
        agreementId: agreement.id,
        milestoneId: milestone.id,
        eventType: "PAYMENT_CAPTURE_MISMATCH",
        details: {
          operationId: operation.id,
          reason:
            "Payment totals changed during capture reconciliation.",
          operationTotal: currentCapturedTotal,
          milestoneTotal: milestoneTotalCaptured,
        },
      });

      return NextResponse.json(
        {
          success: false,
          pending: true,
          message:
            "Payment totals require manual reconciliation.",
          operationId: operation.id,
        },
        { status: 202 }
      );
    }

    // Save confirmed capture and audit record atomically.
    await prisma.$transaction(async (tx) => {
      await tx.paymentOperation.update({
        where: { id: operation.id },
        data: {
          status: "COMPLETED",
          paypalCaptureId: captureData.id,
          responseDetails: JSON.stringify(captureData),
        },
      });

      await tx.milestone.update({
        where: { id: milestone.id },
        data: {
          capturedAmount: milestone.amount,
          capturedAt: new Date(),
        },
      });

      await tx.paymentAuthorization.update({
        where: { id: savedAuthorization.id },
        data: {
          authorizationStatus:
            authorizationStatusAfterCapture,
        },
      });

      const { appendAuditEventInTransaction } = await import(
        "@/lib/audit"
      );

      await appendAuditEventInTransaction(tx, {
        agreementId: agreement.id,
        milestoneId: milestone.id,
        eventType: "PAYMENT_CAPTURE_COMPLETED",
        details: {
          operationId: operation.id,
          paypalCaptureId: captureData.id,
          amount: milestone.amount,
          currency: agreement.currency,
          authorizationStatus:
            authorizationStatusAfterCapture,
          authorizationVerificationReason,
        },
      });
            if (
        authorizationStatusAfterCapture !==
        "RECONCILIATION_REQUIRED"
      ) {
        await tx.agreement.updateMany({
          where: {
            id: agreement.id,
            captureInProgress: true,
          },
          data: {
            captureInProgress: false,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      captured:
        authorizationStatusAfterCapture !==
        "RECONCILIATION_REQUIRED",
      pending:
        authorizationStatusAfterCapture ===
        "RECONCILIATION_REQUIRED",
      message:
        authorizationStatusAfterCapture ===
        "RECONCILIATION_REQUIRED"
          ? "PayPal confirmed the capture, but the authorization state requires manual reconciliation. Further captures are blocked."
          : "PayPal confirmed the capture and the database and audit records were updated.",
      operationId: operation.id,
      captureId: captureData.id,
      amount: captureData.amount,
      authorizationStatus:
        authorizationStatusAfterCapture,
      reconciliationReason:
        authorizationVerificationReason,
    });
  } catch (error) {
    console.error("PayPal capture error:", error);

    return NextResponse.json(
      {
        error:
          "Capture was not confirmed. Check the payment operation and audit records before retrying.",
      },
      { status: 500 }
    );
  }
}
