# ResolveAI

ResolveAI is an AI-powered milestone payment and service recovery prototype built with Next.js, TypeScript, Prisma, Ollama, PayPal Sandbox, and AG Grid.

It demonstrates how AI agents can negotiate service recovery plans while deterministic backend rules protect buyer-approved agreements and control payment execution.

## What It Does

- Uses buyer-side and seller-side AI agents to negotiate recovery plans.
- Limits negotiations to a maximum of three rounds.
- Enforces agreement rules and budget limits outside the AI.
- Validates submitted evidence against required sections and citation rules.
- Requires recorded buyer acceptance and successful evidence validation before milestone capture.
- Integrates PayPal Sandbox authorization and milestone capture.
- Uses AG Grid Community for the financial command centre.
- Maintains hash-linked audit records for important events.

## Technology Stack

- Next.js and React
- TypeScript
- Prisma and SQLite
- Ollama with qwen3:1.7b
- PayPal REST API (Sandbox)
- AG Grid Community
- Vitest

## Getting Started

### Requirements

- Node.js and npm
- Ollama
- A PayPal Developer account and Sandbox credentials

### 1. Clone the repository

```bash
git clone https://github.com/afreenn2004/ResolveAI.git
cd ResolveAI
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env`.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Add your own PayPal Sandbox credentials to `.env`.

Keep `ENABLE_SANDBOX_CAPTURE="false"` until you have configured and checked your Sandbox credentials.

Never commit `.env` or share your credentials.

### 4. Set up the database

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

The seed script creates a demo agreement with three milestones of USD 10 each, totalling USD 30.

### 5. Set up Ollama

```bash
ollama pull qwen3:1.7b
```

Make sure Ollama is running.

### 6. Start the application

```bash
npm run dev
```

Open http://localhost:3000.

## Demo Scenario

The demo uses a USD 30 research brief agreement split into three USD 10 milestones.

It demonstrates:

1. A buyer-approved agreement and milestone structure.
2. AI negotiation when a seller misses a requirement and requests an additional fee.
3. Rejection of an unauthorized fee and negotiation of a recovery plan.
4. Evidence validation and review of missing requirements.
5. PayPal Sandbox authorization and milestone capture.
6. Payment records and audit verification.

## Payment Safety

Payment execution is controlled by backend checks, not by AI-generated decisions.

The prototype includes safeguards such as:

- Buyer acceptance recorded before capture.
- Evidence validation required before capture.
- Agreement hash verification.
- Milestone ordering and authorized-balance checks.
- Idempotency controls to reduce duplicate capture risk.
- PayPal authorization status verification and reconciliation.
- Pending or uncertain payment outcomes blocked from proceeding until verified.

PayPal integration uses Sandbox transactions only. This is a prototype, not a production payment service.

## Testing

Run the automated tests:

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

The submitted prototype passed 40 automated tests. Its audit verification script also reported a valid hash-linked sequence of 44 events.

## Sponsor Technology

- **PayPal:** PayPal REST API Sandbox authorization and capture.
- **AG Grid:** AG Grid Community for the interactive milestone and financial dashboard.

AG Grid Community is used; AG Studio and AG Charts are not part of this implementation.

## Limitations

- Payments are demonstrated using PayPal Sandbox, not live funds.
- Evidence validation checks defined requirements but cannot guarantee that submitted information is truthful.
- Hash-linked audit records provide tamper evidence, not an immutable external ledger.
- AI negotiation outputs are constrained by deterministic application rules.
- This is a hackathon prototype and has not been designed or audited for production financial use.

## Future Work

Potential improvements include broader evidence evaluation, more extensive adversarial testing, additional payment-provider support, and deployment with production-grade security and monitoring.

## License

This project is licensed under the MIT License.

---

Built for the PayPal AI Hackathon 2026.
