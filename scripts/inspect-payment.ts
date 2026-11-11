
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const agreement = await prisma.agreement.findUnique({
    where: { id: "resolveai-demo-agreement" },
       include: {
      authorizations: true,
      paymentOperations: true,
      milestones: {
        include: {
          evidenceSubmissions: {
            include: {
              validations: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
  });

  if (!agreement) {
    console.log("Agreement not found.");
    return;
  }

  console.log("MILESTONE DATABASE STATE:");

  console.log(
    JSON.stringify(
            agreement.milestones.map((item) => ({
        id: item.id,
        title: item.title,
        sequence: item.sequence,
        evidenceValidated: item.evidenceValidated,
        buyerAcceptedAt: item.buyerAcceptedAt,
        submissions: item.evidenceSubmissions.map((submission) => ({
          id: submission.id,
          status: submission.status,
          createdAt: submission.createdAt,
          validations: submission.validations.map((validation) => ({
            status: validation.status,
            createdAt: validation.createdAt,
            validatorVersion: validation.validatorVersion,
            results: validation.results,
          })),
        })),
      })),
      null,
      2
    )
  );

  console.log("\nPAYMENT AUTHORIZATIONS:");

  console.log(
    JSON.stringify(
      agreement.authorizations.map((item) => ({
        id: item.id,
        paypalOrderId: item.paypalOrderId,
        paypalAuthorizationId: item.paypalAuthorizationId,
        amount: item.amount,
        currency: item.currency,
        authorizationStatus: item.authorizationStatus,
        orderStatus: item.orderStatus,
      })),
      null,
      2
    )
  );

  console.log("\nPAYMENT OPERATIONS:");

  console.log(
    JSON.stringify(
      agreement.paymentOperations.map((item) => ({
        id: item.id,
        milestoneId: item.milestoneId,
        operationType: item.operationType,
        amount: item.amount,
        status: item.status,
        paypalCaptureId: item.paypalCaptureId,
        idempotencyKey: item.idempotencyKey,
      })),
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Inspection failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
