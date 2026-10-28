
"use client";

import { useState } from "react";

const milestones = [
  { id: "M-001", name: "Research and source collection", amount: 10, status: "Completed", evidence: "5 sources verified" },
  { id: "M-002", name: "Analysis and findings", amount: 10, status: "Needs recovery", evidence: "Required section missing" },
  { id: "M-003", name: "Final research brief", amount: 10, status: "Pending", evidence: "Awaiting submission" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [showRecovery, setShowRecovery] = useState(false);

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-900 md:flex">
      <aside className="w-full border-b border-slate-200 bg-white p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">R</div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">ResolveAI</h1>
            <p className="text-xs text-slate-500">Agent Payment Recovery</p>
          </div>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Workspace</p>
        <nav className="flex gap-2 overflow-x-auto md:flex-col">
          {["Overview", "Jobs & milestones", "Negotiations", "Payment records"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="mt-8 hidden rounded-2xl bg-slate-50 p-4 md:block">
          <p className="text-sm font-semibold">Sandbox environment</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Demo workspace. No real payments are being processed.
          </p>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Demo mode
          </span>
        </div>
      </aside>

      <section className="min-w-0 flex-1 p-5 md:p-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Workspace / {activeTab}</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              {activeTab === "Overview" ? "Payment recovery overview" : activeTab}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Monitor agreements, resolve failed milestones, and review payment decisions.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium">
            Demo account
          </div>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total job budget", value: "$30.00", note: "1 demo job" },
            { label: "Authorized amount", value: "$30.00", note: "Demo figures only" },
            { label: "Captured amount", value: "$10.00", note: "Illustrative data" },
            { label: "Needs attention", value: "1 milestone", note: "Recovery required" },
          ].map((item) => (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-3 text-2xl font-bold tracking-tight">{item.value}</p>
              <p className="mt-2 text-xs text-slate-400">{item.note}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h3 className="font-semibold">Milestone tracker</h3>
                <p className="mt-1 text-sm text-slate-500">Research brief · Job RA-001</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                Recovery in progress
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Milestone</th>
                    <th className="px-5 py-4 font-semibold">Amount</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                    <th className="px-5 py-4 font-semibold">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-5 py-4">
                        <p className="font-medium">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{item.id}</p>
                      </td>
                      <td className="px-5 py-4 font-medium">${item.amount.toFixed(2)}</td>
                      <td className="px-5 py-4">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.status === "Completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.status === "Needs recovery"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500">{item.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 p-5">
              <button
                onClick={() => setShowRecovery(!showRecovery)}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                {showRecovery ? "Hide recovery details" : "Review recovery case"}
              </button>
              {showRecovery && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">Milestone M-002 needs recovery</p>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    A required section is missing. The seller's proposed extra $5 fee is outside the
                    approved $30 budget and must be rejected. A permitted recovery plan still needs
                    to be reviewed before any further payment decision.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h3 className="font-semibold">Recovery activity</h3>
              <p className="mt-1 text-sm text-slate-500">Illustrative event history</p>
            </div>
            <div className="space-y-6 p-5">
              {[
                { title: "Agreement created", detail: "Buyer approved a $30 total budget.", color: "bg-indigo-500" },
                { title: "First milestone completed", detail: "$10 allocated to completed work in this example.", color: "bg-emerald-500" },
                { title: "Acceptance check failed", detail: "A required section was missing from milestone M-002.", color: "bg-amber-500" },
                { title: "Extra fee rejected", detail: "The requested $5 exceeds the approved agreement.", color: "bg-rose-500" },
              ].map((event, index) => (
                <div key={event.title} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 h-3 w-3 rounded-full ${event.color}`} />
                    {index < 3 && <span className="mt-2 w-px flex-1 bg-slate-200" />}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-semibold">{event.title}</p>
                    <p className="mt-1 text-sm leading-5 text-slate-500">{event.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mx-5 mb-5 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold">Payment safety rule</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                AI can suggest a resolution. Only server-side rules may authorize a payment action.
              </p>
            </div>
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400">
          <p>ResolveAI · AI-assisted service recovery</p>
          <p>Prototype interface · Demo data only</p>
        </footer>
      </section>
    </main>
  );
}
