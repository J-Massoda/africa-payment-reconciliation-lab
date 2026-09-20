"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Code2,
  Database,
  FileClock,
  Gauge,
  GitCompareArrows,
  LayoutDashboard,
  Menu,
  Play,
  RefreshCcw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatMoney, providerNames, titleCase } from "@/domain/format";
import type {
  DashboardSnapshot,
  ReconciliationCase,
  Severity,
} from "@/domain/types";

type Scenario = "missing_ledger" | "amount_mismatch" | "duplicate_webhook";
type View = "overview" | "exceptions" | "activity" | "transactions";

const severityClass: Record<Severity, string> = {
  critical: "badge-critical",
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

function relativeTime(timestamp: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function MetricCard({
  icon,
  eyebrow,
  value,
  note,
  tone = "teal",
}: {
  icon: React.ReactNode;
  eyebrow: string;
  value: string;
  note: React.ReactNode;
  tone?: "teal" | "amber" | "coral" | "slate";
}) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-head">
        <span>{eyebrow}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <div className="metric-note">{note}</div>
    </article>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty-state">
      <CheckCircle2 size={28} />
      <p>{children}</p>
    </div>
  );
}

export function ReconciliationDashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ReconciliationCase | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the reconciliation workspace");
        return response.json() as Promise<DashboardSnapshot>;
      })
      .then((data) => {
        if (active) setSnapshot(data);
      })
      .catch(() => {
        if (active) setNotice("The demo workspace could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  const mutate = useCallback(
    async (key: string, endpoint: string, body?: object, success?: string) => {
      setBusy(key);
      setNotice(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "The action could not be completed");
        setSnapshot(result.snapshot);
        setNotice(success ?? "Action completed successfully.");
        setSelectedCase(null);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const maxVolume = useMemo(
    () => Math.max(...(snapshot?.volume.map((point) => point.matched + point.exceptions) ?? [1])),
    [snapshot],
  );

  if (!snapshot) {
    return (
      <main className="loading-screen">
        <div className="brand-mark"><GitCompareArrows size={22} /></div>
        <p>Preparing the reconciliation workspace</p>
        <span className="loading-line" />
      </main>
    );
  }

  const openCases = snapshot.cases.filter((item) => item.status !== "resolved");

  return (
    <div className="app-shell">
      <aside className={`sidebar ${drawerOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark"><GitCompareArrows size={20} /></span>
          <div><strong>ReconLab</strong><span>Africa payments</span></div>
          <button className="mobile-close" onClick={() => setDrawerOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <nav aria-label="Main navigation">
          <span className="nav-label">Workspace</span>
          <button className={view === "overview" ? "active" : ""} onClick={() => { setView("overview"); setDrawerOpen(false); }}><LayoutDashboard size={18} />Overview</button>
          <button className={view === "exceptions" ? "active" : ""} onClick={() => { setView("exceptions"); setDrawerOpen(false); }}><TriangleAlert size={18} />Exceptions<span className="nav-count">{openCases.length}</span></button>
          <button className={view === "transactions" ? "active" : ""} onClick={() => { setView("transactions"); setDrawerOpen(false); }}><Banknote size={18} />Transactions</button>
          <button className={view === "activity" ? "active" : ""} onClick={() => { setView("activity"); setDrawerOpen(false); }}><FileClock size={18} />Audit trail</button>
          <span className="nav-label nav-label-space">System</span>
          <button><Webhook size={18} />Provider adapters</button>
          <button><Database size={18} />Ledger accounts</button>
          <button><Settings size={18} />Rules & controls</button>
        </nav>

        <div className="sidebar-card">
          <span className="sidebar-card-icon"><ShieldCheck size={18} /></span>
          <strong>Safe demo mode</strong>
          <p>All providers, payments and balances are synthetic.</p>
          <span className="status-line"><i />No live money</span>
        </div>

        <div className="profile-chip">
          <span>JM</span>
          <div><strong>Jean Massoda</strong><small>Demo operator</small></div>
          <ChevronDown size={15} />
        </div>
      </aside>

      {drawerOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="menu-button" onClick={() => setDrawerOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="environment"><span />Demo environment</div>
          <div className="topbar-actions">
            <button aria-label="Search"><Search size={18} /></button>
            <button aria-label="Notifications" className="notification-button"><Bell size={18} /><i /></button>
            <a href="https://github.com/J-Massoda/africa-payment-reconciliation-lab" target="_blank" rel="noreferrer"><Code2 size={17} />View source</a>
          </div>
        </header>

        <div className="content-wrap">
          {notice && <div className="toast" role="status"><CircleDot size={16} />{notice}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}

          <section className="page-intro">
            <div>
              <span className="kicker">Payment operations workspace</span>
              <h1>{view === "overview" ? "Reconciliation overview" : titleCase(view)}</h1>
              <p>{view === "overview" ? "Find money movement gaps before they become customer balance problems." : "Inspect the evidence behind every payment state and operational decision."}</p>
            </div>
            <div className="intro-actions">
              <button className="button-secondary" onClick={() => mutate("reset", "/api/reset", undefined, "The lab has been restored to its baseline dataset.")} disabled={busy !== null}><RotateCcw size={16} />Reset lab</button>
              <button className="button-primary" onClick={() => mutate("reconcile", "/api/reconcile", undefined, "Reconciliation completed and the exception queue is up to date.")} disabled={busy !== null}>{busy === "reconcile" ? <RefreshCcw className="spin" size={16} /> : <Play size={16} />}Run reconciliation</button>
            </div>
          </section>

          {view === "overview" && (
            <>
              <section className="metrics-grid" aria-label="Key metrics">
                <MetricCard icon={<Activity size={19} />} eyebrow="Processed today" value={snapshot.metrics.processedToday.toLocaleString()} tone="teal" note={<><span className="positive"><ArrowUpRight size={13} />12.4%</span> from yesterday</>} />
                <MetricCard icon={<Gauge size={19} />} eyebrow="Auto-matched" value={`${snapshot.metrics.reconciliationRate}%`} tone="slate" note="Target is 99.5% or better" />
                <MetricCard icon={<AlertTriangle size={19} />} eyebrow="Open exceptions" value={snapshot.metrics.openExceptions.toString()} tone="coral" note={<><span className="negative"><ArrowDownRight size={13} />{openCases.filter((item) => item.severity === "critical").length}</span> need priority review</>} />
                <MetricCard icon={<Banknote size={19} />} eyebrow="Recovered value" value={formatMoney(snapshot.metrics.recoveredValueMinor)} tone="amber" note={`${snapshot.metrics.duplicateEventsBlocked} duplicate credits prevented`} />
              </section>

              <section className="overview-grid">
                <article className="panel throughput-panel">
                  <div className="panel-heading">
                    <div><span className="section-kicker">Last 24 hours</span><h2>Reconciliation throughput</h2></div>
                    <div className="legend"><span><i className="legend-teal" />Matched</span><span><i className="legend-coral" />Exceptions</span></div>
                  </div>
                  <div className="chart-summary"><strong>{formatMoney(snapshot.metrics.processedValueMinor)}</strong><span>processed across connected providers</span></div>
                  <div className="bar-chart" aria-label="Matched and exception volume by time">
                    {snapshot.volume.map((point) => (
                      <div className="bar-column" key={point.label}>
                        <div className="bar-stack" style={{ height: `${Math.max(24, ((point.matched + point.exceptions) / maxVolume) * 150)}px` }}>
                          <span className="bar-matched" style={{ flex: point.matched }} />
                          <span className="bar-exception" style={{ flex: point.exceptions }} />
                        </div>
                        <span>{point.label}</span>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="panel providers-panel">
                  <div className="panel-heading"><div><span className="section-kicker">Live adapters</span><h2>Provider health</h2></div><button aria-label="Refresh providers"><RefreshCcw size={16} /></button></div>
                  <div className="provider-list">
                    {snapshot.providers.map((provider) => (
                      <div className="provider-row" key={provider.provider}>
                        <span className={`provider-logo provider-${provider.provider}`}>{provider.displayName.slice(0, 2).toUpperCase()}</span>
                        <div className="provider-name"><strong>{provider.displayName}</strong><span>{provider.latencyMs}ms response</span></div>
                        <div className="provider-rate"><strong>{provider.successRate}%</strong><span>success</span></div>
                        <span className={`health-pill health-${provider.status}`}><i />{provider.status}</span>
                      </div>
                    ))}
                  </div>
                  <div className="provider-foot"><Clock3 size={15} />Highest webhook lag: {Math.max(...snapshot.providers.map((item) => item.webhookLagSeconds))} seconds</div>
                </article>
              </section>

              <section className="scenario-strip">
                <div className="scenario-copy"><span className="spark-icon"><Sparkles size={19} /></span><div><strong>Prove the failure path</strong><p>Generate a controlled anomaly, reconcile it, then recover it safely.</p></div></div>
                <div className="scenario-actions">
                  <button onClick={() => mutate("missing_ledger", "/api/simulate", { scenario: "missing_ledger" satisfies Scenario }, "A provider success with no ledger entry was generated.")} disabled={busy !== null}><Database size={15} />Missing ledger</button>
                  <button onClick={() => mutate("amount_mismatch", "/api/simulate", { scenario: "amount_mismatch" satisfies Scenario }, "An amount mismatch was generated and detected.")} disabled={busy !== null}><GitCompareArrows size={15} />Amount mismatch</button>
                  <button onClick={() => mutate("duplicate_webhook", "/api/simulate", { scenario: "duplicate_webhook" satisfies Scenario }, "The duplicate delivery was blocked by its idempotency key.")} disabled={busy !== null}><Webhook size={15} />Duplicate webhook</button>
                </div>
              </section>
            </>
          )}

          {(view === "overview" || view === "exceptions") && (
            <section className="panel exception-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">Action queue</span><h2>Reconciliation exceptions</h2></div>
                <button className="text-button" onClick={() => setView(view === "overview" ? "exceptions" : "overview")}>{view === "overview" ? "View all" : "Back to overview"}</button>
              </div>
              {openCases.length ? (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Exception</th><th>Provider</th><th>Reference</th><th>Expected</th><th>Observed</th><th>Detected</th><th><span className="sr-only">Action</span></th></tr></thead>
                    <tbody>
                      {openCases.map((item) => (
                        <tr key={item.id}>
                          <td><button className="case-link" onClick={() => setSelectedCase(item)}><span className={`severity-dot severity-${item.severity}`} /><span><strong>{titleCase(item.type)}</strong><small className={severityClass[item.severity]}>{item.severity}</small></span></button></td>
                          <td>{providerNames[item.provider]}</td>
                          <td className="mono">{item.externalReference}</td>
                          <td>{item.expectedMinor === null ? "—" : formatMoney(item.expectedMinor, item.currency)}</td>
                          <td>{item.observedMinor === null ? "Not found" : formatMoney(item.observedMinor, item.currency)}</td>
                          <td>{relativeTime(item.detectedAt)}</td>
                          <td><button className="row-action" onClick={() => setSelectedCase(item)}>Review</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState>Every provider record currently agrees with the internal ledger.</EmptyState>}
            </section>
          )}

          {view === "transactions" && (
            <section className="panel exception-panel">
              <div className="panel-heading"><div><span className="section-kicker">Provider feed</span><h2>Recent payment events</h2></div><span className="soft-label">Synthetic data</span></div>
              <div className="table-scroll"><table><thead><tr><th>Provider reference</th><th>Merchant reference</th><th>Provider</th><th>Amount</th><th>Status</th><th>Received</th></tr></thead><tbody>{snapshot.transactions.map((transaction) => <tr key={transaction.id}><td className="mono">{transaction.externalReference}</td><td className="mono">{transaction.merchantReference}</td><td>{providerNames[transaction.provider]}</td><td>{formatMoney(transaction.amountMinor, transaction.currency)}</td><td><span className={`status-badge status-${transaction.status}`}>{transaction.status}</span></td><td>{relativeTime(transaction.occurredAt)}</td></tr>)}</tbody></table></div>
            </section>
          )}

          {view === "activity" && (
            <section className="activity-layout">
              <article className="panel audit-panel">
                <div className="panel-heading"><div><span className="section-kicker">Append-only evidence</span><h2>Operational audit trail</h2></div><span className="soft-label"><ShieldCheck size={14} />Tamper-aware</span></div>
                <div className="audit-list">{snapshot.audit.map((event) => <div className="audit-row" key={event.id}><span className={`audit-icon audit-${event.outcome}`}>{event.outcome === "success" ? <Check size={15} /> : <AlertTriangle size={15} />}</span><div><strong>{titleCase(event.action.toLowerCase())}</strong><p>{event.detail}</p><span><b>{event.actor}</b> · {event.target} · {relativeTime(event.timestamp)}</span></div></div>)}</div>
              </article>
              <aside className="panel principles-panel"><span className="section-kicker">Design decision</span><h2>Why compensating entries?</h2><p>Financial history should explain what happened, not quietly rewrite it. Recovery creates a new auditable action while preserving the original event.</p><ul><li><Check size={15} />Original provider payload retained</li><li><Check size={15} />Every operator action attributed</li><li><Check size={15} />Balance repair remains reversible</li></ul></aside>
            </section>
          )}

          <footer><span><Zap size={14} />Built for unreliable networks and asynchronous payment providers</span><span>All values and providers are demonstration data.</span></footer>
        </div>
      </main>

      {selectedCase && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedCase(null)}>
          <article className="case-modal" role="dialog" aria-modal="true" aria-labelledby="case-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head"><span className={`modal-symbol severity-bg-${selectedCase.severity}`}><AlertTriangle size={20} /></span><div><span className="section-kicker">Exception details</span><h2 id="case-title">{titleCase(selectedCase.type)}</h2></div><button onClick={() => setSelectedCase(null)} aria-label="Close"><X size={20} /></button></div>
            <div className="modal-reference"><span>Provider reference</span><strong>{selectedCase.externalReference}</strong><small>{providerNames[selectedCase.provider]} · {selectedCase.merchantReference}</small></div>
            <div className="comparison-grid"><div><span>Expected value</span><strong>{selectedCase.expectedMinor === null ? "No value" : formatMoney(selectedCase.expectedMinor, selectedCase.currency)}</strong></div><div><span>Observed value</span><strong>{selectedCase.observedMinor === null ? "Not found" : formatMoney(selectedCase.observedMinor, selectedCase.currency)}</strong></div></div>
            <div className="explanation-block"><strong>What the engine found</strong><p>{selectedCase.summary}</p></div>
            <div className="recommendation-block"><ShieldCheck size={18} /><div><strong>Safe recovery plan</strong><p>{selectedCase.recommendation}</p></div></div>
            <div className="modal-actions"><button className="button-secondary" onClick={() => setSelectedCase(null)}>Cancel</button><button className="button-primary" disabled={busy !== null} onClick={() => mutate(`resolve-${selectedCase.id}`, `/api/cases/${selectedCase.id}/resolve`, undefined, "A compensating entry recovered the exception and preserved the audit history.")}>{busy === `resolve-${selectedCase.id}` ? <RefreshCcw className="spin" size={16} /> : <ShieldCheck size={16} />}Apply safe recovery</button></div>
          </article>
        </div>
      )}
    </div>
  );
}
