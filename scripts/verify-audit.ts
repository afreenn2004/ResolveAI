import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const { verifyAuditChain } = await import("../lib/audit");
  const { prisma } = await import("../lib/prisma");

  try {
    const result = await verifyAuditChain("resolveai-demo-agreement");
    console.log("AUDIT CHAIN VERIFICATION:");
    console.log(JSON.stringify(result, null, 2));

    if (!result.valid) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("AUDIT VERIFICATION FAILED:", error);
  process.exitCode = 1;
});
