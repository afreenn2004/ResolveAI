import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.auditEvent.findMany({
    where: {
      agreementId: "resolveai-demo-agreement",
      eventType: "PAYMENT_CAPTURE_MISMATCH",
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(
    JSON.stringify(
      events.map((event) => ({
        id: event.id,
        createdAt: event.createdAt,
        details: JSON.parse(event.details),
      })),
      null,
      2
    )
  );
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
