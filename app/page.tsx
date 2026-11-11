
"use client";

import { useEffect, useState, type FormEvent } from "react";
import MilestoneGrid from "@/components/MilestoneGrid";

type Milestone = {
  id: string;
  title: string;
  description: string;
  amount: number;
  sequence: number;
  status: string;
  evidenceValidated: boolean;
  evidenceStatus: string;
  buyerAcceptedAt: string | null;
  capturedAmount: number;
  capturedAt: string | null;
};

type Agreement = {
  id: string;
  version: number;
  title: string;
  buyerName: string;
  sellerName: string;
  totalAmount: number;
  currency: string;
  status: string;
  milestones: Milestone[];
};

type NegotiationRound = {
  round: number;
  sellerProposal: {
    explanation: string;
    deliveryPlan: string[];
    requestedExtraCents: number;
    requestedExtensionDays: number;
  };
  buyerDecision: {
    decision: string;
    reason: string;
    counterProposal: string;
    conditions: string[];
  };
};

type NegotiationResult = {
  status: string;
  roundsCompleted: number;
  rounds: NegotiationRound[];
  originalMilestoneAmountCents: number;
  approvedExtraCents: number;
  finalPlan: string[];
  finalConditions: string[];
  summary: string;
};

type EvidenceCheck = {
  name: string;
  passed: boolean;
  critical: boolean;
  message: string;
};

type EvidenceResult = {
  success: boolean;
  submissionId?: string;
  validationId?: string;
  status?: "PASS" | "FAIL" | "HUMAN_REVIEW";
  checks?: EvidenceCheck[];
  message?: string;
};

const navigation = [
  { name: "Overview", icon: "◫", description: "Workspace" },
  { name: "Milestones", icon: "▤", description: "Workspace" },
  { name: "Negotiations", icon: "⇄", description: "AI workspace" },
  { name: "Evidence Review", icon: "✓", description: "Verification" },
  { name: "Payment records", icon: "◈", description: "Finance" },
];

function money(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toUpperCase();

  const style =
    normalized === "PASS" ||
    normalized === "COMPLETED" ||
    normalized === "PAID" ||
    normalized === "AGREED"
      ? "status-success"
      : normalized === "FAIL" ||
          normalized === "FAILED" ||
          normalized === "REJECT"
        ? "status-danger"
        : "status-warning";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${style}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  accent: string;
}) {
  return (
    <article className="glass-panel glass-panel-hover relative overflow-hidden rounded-2xl p-5">
      <div
        className="absolute -right-7 -top-8 h-28 w-28 rounded-full opacity-10 blur-2xl"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm text-[#aaa6c3]">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {value}
          </p>
          <p className="mt-2 text-xs text-[#8985a4]">{note}</p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border text-lg"
          style={{
            color: accent,
            borderColor: `${accent}35`,
            background: `${accent}12`,
          }}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedMilestone, setSelectedMilestone] = useState("");
  const [deliveryProblem, setDeliveryProblem] = useState(
    "The seller missed the required Sources section and needs additional time to complete it."
  );
  const [extraFee, setExtraFee] = useState("500");
  const [negotiating, setNegotiating] = useState(false);
  const [negotiationError, setNegotiationError] = useState("");
  const [negotiationResult, setNegotiationResult] =
    useState<NegotiationResult | null>(null);

  const [evidenceContent, setEvidenceContent] = useState("");
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [evidenceResult, setEvidenceResult] =
    useState<EvidenceResult | null>(null);
  const [acceptingEvidence, setAcceptingEvidence] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState("");
  const [capturingMilestone, setCapturingMilestone] = useState("");
  const [capturePendingMilestone, setCapturePendingMilestone] = useState("");
  const [captureMessage, setCaptureMessage] = useState("");
  const [captureError, setCaptureError] = useState("");

  useEffect(() => {
    async function loadAgreement() {
      try {
        const response = await fetch("/api/agreements");
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Could not load agreement.");
        }

        setAgreement(data.agreement);

        if (data.agreement?.milestones?.length) {
          setSelectedMilestone(data.agreement.milestones[0].id);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    }

    loadAgreement();
  }, []);

  const milestones = agreement?.milestones ?? [];

  const totalCaptured = milestones.reduce(
    (total, item) => total + item.capturedAmount,
    0
  );

  const validatedCount = milestones.filter(
    (item) => item.evidenceValidated
  ).length;

  const attentionCount = milestones.filter(
    (item) =>
      item.status === "NEEDS_RECOVERY" ||
      item.status === "FAILED"
  ).length;

  const completedCount = milestones.filter(
    (item) =>
      item.status === "COMPLETED" ||
      item.status === "PAID"
  ).length;

  const selectedMilestoneData = milestones.find(
    (item) => item.id === selectedMilestone
  );

  async function startNegotiation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNegotiating(true);
    setNegotiationError("");
    setNegotiationResult(null);

    try {
      const fee = Number(extraFee);

      if (!Number.isSafeInteger(fee) || fee < 0 || fee > 10000) {
        throw new Error("Enter an extra fee between 0 and 10,000 cents.");
      }

      if (!selectedMilestone) {
        throw new Error("Select a milestone first.");
      }

      const response = await fetch("/api/negotiations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          milestoneId: selectedMilestone,
          deliveryProblem,
          sellerRequestedExtraCents: fee,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Negotiation failed.");
      }

      setNegotiationResult(data.result);
    } catch (err) {
      setNegotiationError(
        err instanceof Error ? err.message : "Negotiation failed."
      );
    } finally {
      setNegotiating(false);
    }
  }

    async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEvidenceSubmitting(true);
    setEvidenceError("");
    setEvidenceResult(null);

    try {
      if (!selectedMilestone) {
        throw new Error("Select a milestone first.");
      }

      if (!evidenceContent.trim()) {
        throw new Error("Enter evidence content first.");
      }

      const response = await fetch("/api/evidence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          milestoneId: selectedMilestone,
          content: evidenceContent,
          submittedBy: "Demo Seller",
        }),
      });

      const data: EvidenceResult = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Evidence submission failed.");
      }

      setEvidenceResult(data);
    } catch (err) {
      setEvidenceError(
        err instanceof Error ? err.message : "Evidence submission failed."
      );
    } finally {
      setEvidenceSubmitting(false);
    }
  }
  async function acceptEvidence() {
    setAcceptingEvidence(true);
    setAcceptanceError("");

    try {
      if (!selectedMilestone) {
        throw new Error("Select a milestone first.");
      }

      if (evidenceResult?.status !== "PASS") {
        throw new Error(
          "Buyer acceptance is only available after evidence validation passes."
        );
      }

      const response = await fetch("/api/milestones/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          milestoneId: selectedMilestone,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Buyer acceptance failed.");
      }

      const agreementResponse = await fetch("/api/agreements");
      const agreementData = await agreementResponse.json();

      if (!agreementResponse.ok || !agreementData.success) {
        throw new Error(
          agreementData.message || "Could not refresh agreement data."
        );
      }

      setAgreement(agreementData.agreement);
    } catch (err) {
      setAcceptanceError(
        err instanceof Error ? err.message : "Buyer acceptance failed."
      );
    } finally {
      setAcceptingEvidence(false);
    }
  }
    async function captureMilestone(milestoneId: string) {
    setCapturingMilestone(milestoneId);
    setCaptureMessage("");
    setCaptureError("");

    try {
      const response = await fetch("/api/paypal/capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ milestoneId }),
      });

      const data = await response.json();

      if (data.pending) {
  setCapturePendingMilestone(milestoneId);
  setCaptureMessage(data.message);
} else if (
        response.ok &&
        data.success &&
        data.captured === true
      ) {
        setCaptureMessage(data.message);
      } else {
        throw new Error(
  data.message ||
    (Array.isArray(data.reasons)
      ? data.reasons.join("; ")
      : data.error) ||
    "Payment capture failed."
);
      }

      const agreementResponse = await fetch("/api/agreements");
      const agreementData = await agreementResponse.json();

      if (!agreementResponse.ok || !agreementData.success) {
        throw new Error(
          agreementData.message || "Could not refresh agreement data."
        );
      }

      setAgreement(agreementData.agreement);
    } catch (err) {
      setCaptureError(
        err instanceof Error ? err.message : "Payment capture failed."
      );
    } finally {
      setCapturingMilestone("");
    }
  }
  return (
    <main className="min-h-screen text-[#f4f3ff] lg:flex">
      {/* SIDEBAR */}
      <aside className="relative z-10 flex w-full flex-col border-b border-white/[0.07] bg-[#101124]/80 p-5 backdrop-blur-2xl lg:sticky lg:top-0 lg:h-screen lg:w-[250px] lg:shrink-0 lg:border-b-0 lg:border-r lg:border-white/[0.07]">
        <div className="mb-8 flex items-center gap-3 px-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#b49aff] to-[#7651dc] text-xl font-bold text-white shadow-lg shadow-violet-900/30">
            R
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              ResolveAI
            </h1>
            <p className="text-[11px] tracking-wide text-[#9691b2]">
              INTELLIGENT RECOVERY
            </p>
          </div>
        </div>

        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#77738f]">
          Workspace
        </div>

        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {navigation.map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`flex min-w-fit items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition-all ${
                activeTab === item.name
                  ? "border border-violet-300/15 bg-violet-400/10 text-[#d7c9ff] shadow-inner shadow-violet-300/5"
                  : "border border-transparent text-[#aaa6c3] hover:bg-white/[0.045] hover:text-white"
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.045] text-base">
                {item.icon}
              </span>
              <span className="whitespace-nowrap font-medium">
                {item.name}
              </span>
              {activeTab === item.name && (
                <span className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-[#a78bfa] lg:block" />
              )}
            </button>
          ))}
        </nav>

        <div className="mt-8 hidden rounded-2xl border border-amber-300/10 bg-amber-300/[0.045] p-4 lg:block">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.5)]" />
            <p className="text-xs font-semibold text-amber-200">
              Sandbox environment
            </p>
          </div>
          <p className="mt-2 text-xs leading-5 text-[#aaa6c3]">
            Demonstration workspace. Payment actions are restricted and no live
            customer funds are involved.
          </p>
        </div>

        <div className="mt-auto hidden border-t border-white/[0.07] pt-5 lg:block">
          <p className="text-xs font-semibold text-[#d8d3ee]">
            ResolveAI Control Layer
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[#77738f]">
            AI proposes. Deterministic rules protect.
          </p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <section className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-[#8985a4]">
              <span>ResolveAI</span>
              <span className="text-[#55516e]">/</span>
              <span className="text-[#c5b8f5]">{activeTab}</span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {activeTab === "Overview"
                ? "Your command centre"
                : activeTab === "Milestones"
                  ? "Milestone control"
                  : activeTab === "Negotiations"
                    ? "AI negotiation workspace"
                    : "Payment records"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9691b2]">
              {activeTab === "Overview"
                ? "A clear view of agreement health, evidence progress and payment safety."
                : activeTab === "Milestones"
                  ? "Track delivery, evidence validation and milestone payment progress."
                  : activeTab === "Negotiations"
                    ? "Let the buyer and seller agents work through a recovery proposal."
                    : "Review recorded payment activity and authorization state."}
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6ee7c0] opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#6ee7c0]" />
            </span>
            <span className="text-xs font-medium text-[#d1cce6]">
              Demo workspace
            </span>
          </div>
        </header>

        {loading ? (
          <div className="glass-panel rounded-2xl p-10 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-violet-300/20 border-t-violet-300" />
            <p className="text-sm text-[#aaa6c3]">
              Connecting to the agreement database...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-200">
            Could not load agreement: {error}
          </div>
        ) : agreement ? (
          <>
            {/* OVERVIEW */}
            {activeTab === "Overview" && (
              <div className="space-y-6">
                <section className="relative overflow-hidden rounded-3xl border border-violet-300/15 bg-gradient-to-br from-[#282044]/90 via-[#1b1b36]/95 to-[#14252f]/90 p-6 shadow-2xl shadow-black/20 sm:p-8">
                  <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-violet-500/15 blur-[85px]" />
                  <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-teal-400/10 blur-[80px]" />
                  <div className="relative grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-center">
                    <div>
                      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200/15 bg-violet-200/[0.07] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#d3c3ff]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#b49aff]" />
                        AI-ASSISTED SERVICE RECOVERY
                      </div>
                      <h3 className="max-w-xl text-2xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                        Keep agreements on track.
                        <span className="text-[#b49aff]">
                          {" "}Keep payments accountable.
                        </span>
                      </h3>
                      <p className="mt-4 max-w-xl text-sm leading-6 text-[#b5b0cc]">
                        Resolve delivery problems through bounded AI
                        negotiation, evidence checks and deterministic
                        payment controls.
                      </p>
                      <button
                        onClick={() => setActiveTab("Negotiations")}
                        className="primary-button mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
                      >
                        Open negotiation workspace
                        <span>↗</span>
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/15 p-5 backdrop-blur-xl">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#aaa6c3]">
                          Agreement health
                        </p>
                        <StatusPill status={agreement.status} />
                      </div>
                      <p className="mt-4 truncate text-lg font-semibold text-white">
                        {agreement.title}
                      </p>
                      <p className="mt-1 text-xs text-[#9691b2]">
                        {agreement.id}
                      </p>
                      <div className="mt-6 flex items-end justify-between">
                        <div>
                          <p className="text-xs text-[#9691b2]">
                            Evidence validated
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-white">
                            {validatedCount}
                            <span className="ml-1 text-sm font-normal text-[#9691b2]">
                              / {milestones.length}
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#9691b2]">
                            Milestones completed
                          </p>
                          <p className="mt-1 text-2xl font-semibold text-[#6ee7c0]">
                            {completedCount}/{milestones.length}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-[#6ee7c0] transition-all"
                          style={{
                            width: `${
                              milestones.length
                                ? (validatedCount / milestones.length) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    label="Agreed budget"
                    value={money(agreement.totalAmount, agreement.currency)}
                    note="Original agreement value"
                    icon="◈"
                    accent="#b49aff"
                  />
                  <MetricCard
                    label="PayPal authorization"
                    value="$30.00"
                    note="Sandbox authorization recorded"
                    icon="⌁"
                    accent="#80c9ff"
                  />
                  <MetricCard
                    label="Recorded captures"
                    value={money(totalCaptured, agreement.currency)}
                    note="Confirmed in application database"
                    icon="↗"
                    accent="#6ee7c0"
                  />
                  <MetricCard
                    label="Needs attention"
                    value={String(attentionCount).padStart(2, "0")}
                    note="Milestones requiring recovery"
                    icon="!"
                    accent="#f4c66b"
                  />
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
                  <div className="glass-panel min-w-0 overflow-hidden rounded-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] p-5">
                      <div>
                        <h3 className="font-semibold text-white">
                          Milestone command centre
                        </h3>
                        <p className="mt-1 text-xs text-[#9691b2]">
                          Live records from the agreement database
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab("Milestones")}
                        className="secondary-button rounded-lg px-3 py-2 text-xs font-semibold"
                      >
                        View all milestones ↗
                      </button>
                    </div>
                    <div className="p-3 sm:p-4">
                      <MilestoneGrid milestones={milestones} />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white">
                          Agreement details
                        </h3>
                        <span className="text-lg text-[#b49aff]">⌘</span>
                      </div>
                      <div className="mt-5 space-y-4">
                        {[
                          ["Buyer", agreement.buyerName],
                          ["Seller", agreement.sellerName],
                          ["Agreement version", String(agreement.version)],
                          ["Currency", agreement.currency],
                          [
                            "Total agreed value",
                            money(agreement.totalAmount, agreement.currency),
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0"
                          >
                            <span className="text-xs text-[#9691b2]">
                              {label}
                            </span>
                            <span className="text-right text-sm font-medium text-[#e9e5fa]">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass-panel rounded-2xl p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-300/10 text-lg text-[#6ee7c0]">
                          ◉
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            Payment safety layer
                          </h3>
                          <p className="text-[11px] text-[#9691b2]">
                            Deterministic controls
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 text-xs leading-6 text-[#aaa6c3]">
                        AI agents can propose recovery plans, but cannot
                        change the original agreement or authorize payment.
                        Evidence validation and recorded buyer acceptance
                        are separate requirements.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="status-success rounded-full px-2.5 py-1 text-[10px] font-semibold">
                          RULE-BASED CONTROL
                        </span>
                        <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-2.5 py-1 text-[10px] font-semibold text-[#c7b7ff]">
                          AUDIT TRAIL
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* MILESTONES */}
            {activeTab === "Milestones" && (
              <section className="glass-panel overflow-hidden rounded-2xl">
                <div className="border-b border-white/[0.07] p-5 sm:p-6">
                  <h3 className="font-semibold text-white">
                    All agreement milestones
                  </h3>
                  <p className="mt-1 text-sm text-[#9691b2]">
                    Sort, filter and inspect the milestone records.
                  </p>
                </div>
                <div className="p-3 sm:p-5">
                  <MilestoneGrid milestones={milestones} />
                </div>
                <div className="grid gap-3 border-t border-white/[0.07] p-5 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-[#9691b2]">Total milestones</p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {milestones.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9691b2]">Evidence validated</p>
                    <p className="mt-1 text-xl font-semibold text-[#6ee7c0]">
                      {validatedCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#9691b2]">Captured to date</p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {money(totalCaptured, agreement.currency)}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* NEGOTIATIONS */}
            {activeTab === "Negotiations" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <section className="glass-panel h-fit rounded-2xl p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-400/10 text-xl text-[#b49aff]">
                      ⇄
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        Start a recovery negotiation
                      </h3>
                      <p className="text-xs text-[#9691b2]">
                        Buyer agent ↔ Seller agent
                      </p>
                    </div>
                  </div>

                  <form onSubmit={startNegotiation} className="space-y-5">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-[#c8c2df]">
                        Select milestone
                      </label>
                      <select
                        value={selectedMilestone}
                        onChange={(event) =>
                          setSelectedMilestone(event.target.value)
                        }
                        className="w-full rounded-xl border border-white/10 bg-[#17192e] px-4 py-3 text-sm text-white"
                        required
                      >
                        {milestones.map((item) => (
                          <option key={item.id} value={item.id}>
                            {`Milestone ${item.sequence} — ${item.title}`}
                          </option>
                        ))}
                      </select>
                      {selectedMilestoneData && (
                        <p className="mt-2 text-xs text-[#9691b2]">
                          Agreed amount:{" "}
                          {money(
                            selectedMilestoneData.amount,
                            agreement.currency
                          )}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold text-[#c8c2df]">
                        Delivery problem
                      </label>
                      <textarea
                        value={deliveryProblem}
                        onChange={(event) =>
                          setDeliveryProblem(event.target.value)
                        }
                        rows={5}
                        minLength={1}
                        maxLength={3000}
                        required
                        className="w-full resize-y rounded-xl border border-white/10 bg-[#17192e] px-4 py-3 text-sm leading-6 text-white placeholder:text-[#77738f]"
                        placeholder="Describe what went wrong with delivery..."
                      />
                      <p className="mt-1 text-right text-[10px] text-[#77738f]">
                        {deliveryProblem.length}/3000
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold text-[#c8c2df]">
                        Seller's requested extra fee (cents)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={extraFee}
                        onChange={(event) => setExtraFee(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#17192e] px-4 py-3 text-sm text-white"
                      />
                      <p className="mt-2 text-xs text-[#9691b2]">
                        Example: 500 cents = $5.00. The buyer agent cannot
                        approve an unauthorized fee.
                      </p>
                    </div>

                    {negotiationError && (
                      <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-xs leading-5 text-rose-200">
                        {negotiationError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={negotiating || !milestones.length}
                      className="primary-button flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {negotiating ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Agents are negotiating...
                        </>
                      ) : (
                        <>Run AI negotiation <span>↗</span></>
                      )}
                    </button>

                    <p className="text-center text-[10px] leading-5 text-[#77738f]">
                      Maximum 3 negotiation rounds. Agent agreement does not
                      record buyer acceptance or trigger a payment.
                    </p>
                  </form>
                </section>

                <section className="glass-panel min-w-0 rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">
                        Negotiation results
                      </h3>
                      <p className="mt-1 text-xs text-[#9691b2]">
                        Actual responses from the local AI agents
                      </p>
                    </div>
                    <span className="rounded-lg border border-violet-300/15 bg-violet-300/[0.07] px-2.5 py-1.5 text-[10px] font-semibold text-[#cbbaff]">
                      LOCAL AI
                    </span>
                  </div>

                  {!negotiationResult && !negotiating && (
                    <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-violet-300/15 bg-violet-300/[0.07] text-3xl text-[#b49aff]">
                        ⇄
                      </div>
                      <h4 className="font-semibold text-white">
                        Ready for negotiation
                      </h4>
                      <p className="mt-2 max-w-xs text-xs leading-6 text-[#9691b2]">
                        Submit a delivery problem to see the seller's recovery
                        proposal, the buyer's decision and each negotiation
                        round.
                      </p>
                    </div>
                  )}

                  {negotiating && (
                    <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                      <div className="mb-5 h-12 w-12 animate-spin rounded-full border-2 border-violet-300/20 border-t-violet-300" />
                      <h4 className="font-semibold text-white">
                        Agents are working...
                      </h4>
                      <p className="mt-2 max-w-xs text-xs leading-6 text-[#9691b2]">
                        The seller agent is proposing a recovery plan and the
                        buyer agent is evaluating it. This can take a little
                        time on a local model.
                      </p>
                    </div>
                  )}

                  {negotiationResult && (
                    <div className="mt-6 space-y-5">
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-xs text-[#9691b2]">
                            Final negotiation status
                          </span>
                          <StatusPill status={negotiationResult.status} />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#e5e0f7]">
                          {negotiationResult.summary}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-[#9691b2]">
                              Rounds completed
                            </p>
                            <p className="mt-1 text-xl font-semibold text-white">
                              {negotiationResult.roundsCompleted}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-[#9691b2]">
                              Approved extra fees
                            </p>
                            <p className="mt-1 text-xl font-semibold text-[#6ee7c0]">
                              {money(negotiationResult.approvedExtraCents)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {negotiationResult.rounds.map((round) => (
                        <div
                          key={round.round}
                          className="space-y-3 rounded-xl border border-white/[0.08] bg-black/10 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-white">
                              Round {round.round}
                            </h4>
                            <StatusPill status={round.buyerDecision.decision} />
                          </div>

                          <div className="rounded-lg border border-sky-300/10 bg-sky-300/[0.045] p-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-sky-200">
                              Seller agent proposal
                            </p>
                            <p className="text-xs leading-5 text-[#d3d0e3]">
                              {round.sellerProposal.explanation}
                            </p>
                            <p className="mt-3 text-[11px] text-[#9691b2]">
                              Requested extra fee:{" "}
                              <span className="font-semibold text-white">
                                {money(round.sellerProposal.requestedExtraCents)}
                              </span>
                            </p>
                            <ul className="mt-2 space-y-1">
                              {round.sellerProposal.deliveryPlan.map(
                                (step, index) => (
                                  <li
                                    key={index}
                                    className="text-xs leading-5 text-[#b8b3ce]"
                                  >
                                    <span className="mr-2 text-sky-300">•</span>
                                    {step}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>

                          <div className="rounded-lg border border-violet-300/10 bg-violet-300/[0.045] p-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#c9b8ff]">
                              Buyer agent decision
                            </p>
                            <p className="text-xs leading-5 text-[#d3d0e3]">
                              {round.buyerDecision.reason}
                            </p>
                            {round.buyerDecision.counterProposal && (
                              <p className="mt-3 text-xs leading-5 text-[#c9b8ff]">
                                Counter: {round.buyerDecision.counterProposal}
                              </p>
                            )}
                            {round.buyerDecision.conditions.length > 0 && (
                              <ul className="mt-3 space-y-1">
                                {round.buyerDecision.conditions.map(
                                  (condition, index) => (
                                    <li
                                      key={index}
                                      className="text-xs text-[#aaa6c3]"
                                    >
                                      <span className="mr-2 text-[#6ee7c0]">✓</span>
                                      {condition}
                                    </li>
                                  )
                                )}
                              </ul>
                            )}
                          </div>
                        </div>
                      ))}

                      <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-4">
                        <p className="text-xs font-semibold text-amber-200">
                          Payment safety notice
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[#aaa6c3]">
                          This is an agent negotiation result only.
                          Agreement terms have not been changed, buyer
                          acceptance has not been recorded by this result,
                          and no payment was authorized or captured.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
            {/* EVIDENCE REVIEW */}
            {activeTab === "Evidence Review" && (
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <section className="glass-panel h-fit rounded-2xl p-5 sm:p-6">
                  <h3 className="font-semibold text-white">
                    Submit milestone evidence
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[#9691b2]">
                    Submit the seller's deliverable for deterministic evidence
                    checks before buyer acceptance can be considered.
                  </p>

                  <form onSubmit={submitEvidence} className="mt-5 space-y-5">
                    <div>
                      <label className="mb-2 block text-xs font-semibold text-[#c8c2df]">
                        Select milestone
                      </label>
                      <select
                        value={selectedMilestone}
                        onChange={(event) => {
                          setSelectedMilestone(event.target.value);
                          setEvidenceResult(null);
                          setEvidenceError("");
                        }}
                        className="w-full rounded-xl border border-white/10 bg-[#17192e] px-4 py-3 text-sm text-white"
                        required
                      >
                        {milestones.map((item) => (
                          <option key={item.id} value={item.id}>
                            {`Milestone ${item.sequence} — ${item.title}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold text-[#c8c2df]">
                        Deliverable content
                      </label>
                      <textarea
                        value={evidenceContent}
                        onChange={(event) => setEvidenceContent(event.target.value)}
                        rows={12}
                        maxLength={20000}
                        required
                        placeholder="Paste the seller's research brief or milestone deliverable here..."
                        className="w-full resize-y rounded-xl border border-white/10 bg-[#17192e] px-4 py-3 text-sm leading-6 text-white placeholder:text-[#77738f]"
                      />
                      <p className="mt-1 text-right text-[10px] text-[#77738f]">
                        {evidenceContent.length}/20000 characters
                      </p>
                    </div>

                    <div className="rounded-xl border border-sky-300/10 bg-sky-300/[0.045] p-3">
                      <p className="text-xs leading-5 text-sky-100">
                        Demo source fixtures: SRC-001 to SRC-005 are controlled
                        synthetic records. They are not independently verified
                        external sources.
                      </p>
                    </div>

                    {evidenceError && (
                      <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-xs leading-5 text-rose-200">
                        {evidenceError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={evidenceSubmitting || !milestones.length}
                      className="primary-button flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {evidenceSubmitting
                        ? "Validating evidence..."
                        : "Run evidence validation ↗"}
                    </button>
                  </form>
                </section>

                <section className="glass-panel min-w-0 rounded-2xl p-5 sm:p-6">
                  <h3 className="font-semibold text-white">
                    Validation results
                  </h3>
                  <p className="mt-1 text-xs text-[#9691b2]">
                    Seven checks assess the submitted deliverable.
                  </p>

                  {!evidenceResult && !evidenceSubmitting && (
                    <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-violet-300/15 bg-violet-300/[0.07] text-3xl text-[#b49aff]">
                        ✓
                      </div>
                      <h4 className="font-semibold text-white">
                        Ready to inspect evidence
                      </h4>
                      <p className="mt-2 max-w-xs text-xs leading-6 text-[#9691b2]">
                        Submit a deliverable to see required-section,
                        citation, relevance, duplicate and prompt-injection
                        checks.
                      </p>
                    </div>
                  )}

                  {evidenceSubmitting && (
                    <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                      <div className="mb-5 h-12 w-12 animate-spin rounded-full border-2 border-violet-300/20 border-t-violet-300" />
                      <h4 className="font-semibold text-white">
                        Inspecting deliverable...
                      </h4>
                      <p className="mt-2 text-xs text-[#9691b2]">
                        Running deterministic validation rules.
                      </p>
                    </div>
                  )}

                  {evidenceResult && (
                    <div className="mt-6 space-y-5">
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-xs text-[#9691b2]">
                            Overall validation status
                          </span>
                          <StatusPill status={evidenceResult.status ?? "UNKNOWN"} />
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#e5e0f7]">
                          {evidenceResult.message}
                        </p>
                        <p className="mt-3 text-[10px] text-[#9691b2]">
                          Submission ID: {evidenceResult.submissionId ?? "—"}
                        </p>
                      </div>

                      <div className="space-y-2">
                        {evidenceResult.checks?.map((check, index) => (
                          <div
                            key={`${check.name}-${index}`}
                            className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"
                          >
                            <span
                              className={`mt-0.5 text-sm ${
                                check.passed
                                  ? "text-[#6ee7c0]"
                                  : "text-rose-300"
                              }`}
                            >
                              {check.passed ? "✓" : "✕"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-semibold text-white">
                                  {check.name.replaceAll("_", " ")}
                                </p>
                                <span className="text-[9px] text-[#9691b2]">
                                  {check.critical ? "CRITICAL" : "REVIEW"}
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-[#aaa6c3]">
                                {check.message}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-4">
                        <p className="text-xs font-semibold text-amber-200">
                          Buyer acceptance is separate
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[#aaa6c3]">
                          A PASS means the configured evidence checks passed.
                          It does not record buyer acceptance or authorize a
                          payment. A HUMAN REVIEW result requires manual review.
                        </p>
                      </div>
                      {acceptanceError && (
  <p className="mt-3 text-xs text-rose-300">
    {acceptanceError}
  </p>
)}

{selectedMilestoneData?.buyerAcceptedAt ? (
  <p className="mt-3 text-sm text-emerald-300">
    ✓ Buyer acceptance recorded
  </p>
) : evidenceResult.status === "PASS" ? (
  <button
    type="button"
    onClick={acceptEvidence}
    disabled={acceptingEvidence}
    className="mt-4 w-full rounded-xl bg-violet-400 px-4 py-3 text-sm font-semibold text-[#171329] disabled:opacity-50"
  >
    {acceptingEvidence
      ? "Recording acceptance..."
      : "Accept milestone evidence"}
  </button>
) : null}
                    </div>
                  )}
                </section>
              </div>
            )}
            {/* PAYMENT RECORDS */}
            {activeTab === "Payment records" && (
              <div className="space-y-6">
                <section className="glass-panel rounded-2xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">
                        PayPal Sandbox payment overview
                      </h3>
                      <p className="mt-1 text-xs text-[#9691b2]">
                        Authorization and capture records
                      </p>
                    </div>
                    <span className="status-warning rounded-full px-3 py-1 text-[10px] font-semibold">
                      SANDBOX
                    </span>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                      <p className="text-xs text-[#9691b2]">
                        Recorded authorization
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        $30.00
                      </p>
                      <p className="mt-1 text-[10px] text-[#80c9ff]">
                        Authorization created
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                      <p className="text-xs text-[#9691b2]">
                        Recorded captures
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-[#6ee7c0]">
                        {money(totalCaptured, agreement.currency)}
                      </p>
                      <p className="mt-1 text-[10px] text-[#9691b2]">
                        Database-confirmed total
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                      <p className="text-xs text-[#9691b2]">
                        Remaining authorized
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {money(
                          Math.max(0, agreement.totalAmount - totalCaptured),
                          agreement.currency
                        )}
                      </p>
                      <p className="mt-1 text-[10px] text-[#9691b2]">
                        Calculated from recorded captures
                      </p>
                    </div>
                  </div>
                </section>

                <section className="glass-panel rounded-2xl p-5">
                  <h3 className="font-semibold text-white">
                    Milestone payment records
                  </h3>
                  <p className="mt-1 text-xs text-[#9691b2]">
                    A captured amount is shown only when recorded in the
                    application database.
                  </p>
                                    {captureError && (
                    <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-xs leading-5 text-rose-200">
                      {captureError}
                    </div>
                  )}

                  {captureMessage && (
                    <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3 text-xs leading-5 text-amber-200">
                      {captureMessage}
                    </div>
                  )}
                  <div className="mt-5 space-y-3">
                    {milestones.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">
                            {item.title}
                          </p>
                          <p className="mt-1 text-xs text-[#9691b2]">
                            Milestone {item.sequence}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">
                            {money(item.capturedAmount, agreement.currency)}
                          </p>
                          <p className="mt-1 text-[10px] text-[#9691b2]">
                            of {money(item.amount, agreement.currency)}
                          </p>
                        </div>
                                                <div className="w-full">
                          {item.capturedAt ||
                          item.capturedAmount >= item.amount ? (
                            <p className="text-sm text-emerald-300">
                              Payment captured
                            </p>
                          ) : capturePendingMilestone === item.id ? (
                            <p className="text-sm text-amber-300">
                              Capture pending — manual reconciliation required.
                              Do not retry.
                            </p>
                          ) : item.buyerAcceptedAt ? (
                            milestones
                              .filter(
                                (previous) =>
                                  previous.sequence < item.sequence
                              )
                              .every(
                                (previous) =>
                                  previous.capturedAmount >= previous.amount
                              ) ? (
                              <button
                                type="button"
                                onClick={() => captureMilestone(item.id)}
                                disabled={capturingMilestone === item.id}
                                className="rounded-xl bg-violet-400 px-4 py-2 text-sm font-semibold text-[#171329] disabled:opacity-50"
                              >
                                {capturingMilestone === item.id
                                  ? "Capturing..."
                                  : "Capture payment"}
                              </button>
                            ) : (
                              <p className="text-sm text-amber-300">
                                Complete earlier milestones first.
                              </p>
                            )
                          ) : (
                            <p className="text-sm text-slate-400">
                              Awaiting evidence validation and buyer acceptance.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </>
        ) : (
          <div className="glass-panel rounded-2xl p-8 text-sm text-[#aaa6c3]">
            No agreement was returned by the database.
          </div>
        )}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5 text-[10px] text-[#77738f]">
          <p>RESOLVEAI · AI-ASSISTED SERVICE RECOVERY</p>
          <p>DEMO ENVIRONMENT · PAYPAL SANDBOX · NOT LIVE ESCROW</p>
        </footer>
      </section>
    </main>
  );
}
