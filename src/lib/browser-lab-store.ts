import { reconcile } from "@/domain/reconciliation";
import type {
  AuditEvent,
  DashboardSnapshot,
  IdempotencyRecord,
  IncomingWebhook,
  LedgerEntry,
  ProviderTransaction,
  ReconciliationCase,
  ReconciliationRun,
} from "@/domain/types";
import {
  providerHealth,
  seedAudit,
  seedLedger,
  seedTransactions,
  seedVolume,
} from "@/lib/seed";

export type BrowserScenario =
  | "missing_ledger"
  | "amount_mismatch"
  | "duplicate_webhook";

interface BrowserLabState {
  transactions: ProviderTransaction[];
  ledger: LedgerEntry[];
  cases: ReconciliationCase[];
  audit: AuditEvent[];
  idempotency: Record<string, IdempotencyRecord>;
  runs: ReconciliationRun[];
  recoveredValueMinor: number;
  duplicateEventsBlocked: number;
}

const STORAGE_KEY = "reconlab-static-demo-v1";
let memoryState: BrowserLabState | null = null;

function token() {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function newId(prefix: string) {
  return `${prefix}_${token()}`;
}

function makeCases(
  transactions: ProviderTransaction[],
  ledger: LedgerEntry[],
  previous: ReconciliationCase[] = [],
) {
  const previousByKey = new Map(
    previous.map((item) => [`${item.type}:${item.externalReference}`, item]),
  );

  return reconcile(transactions, ledger).exceptions.map((draft) => {
    const existing = previousByKey.get(`${draft.type}:${draft.externalReference}`);
    return {
      ...draft,
      id: existing?.id ?? newId("case"),
      status: existing?.status ?? "open",
      attempts: existing?.attempts ?? 0,
      detectedAt: existing?.detectedAt ?? new Date().toISOString(),
      resolvedAt: existing?.resolvedAt,
    } satisfies ReconciliationCase;
  });
}

function createInitialState(): BrowserLabState {
  const transactions = structuredClone(seedTransactions);
  const ledger = structuredClone(seedLedger);
  const result = reconcile(transactions, ledger);
  const completedAt = new Date(Date.now() - 50 * 60_000).toISOString();

  return {
    transactions,
    ledger,
    cases: makeCases(transactions, ledger),
    audit: structuredClone(seedAudit),
    idempotency: {
      evt_mm_91ca: {
        key: "evt_mm_91ca",
        provider: "mobimoney",
        externalReference: "MM-240918-A81F",
        firstSeenAt: new Date(Date.now() - 24 * 60_000).toISOString(),
        duplicateCount: 1,
      },
    },
    runs: [
      {
        id: "run_20260918_0700",
        startedAt: new Date(Date.now() - 51 * 60_000).toISOString(),
        completedAt,
        providerRecords: transactions.length,
        ledgerRecords: ledger.length,
        matched: result.matched.length,
        exceptions: result.exceptions.length,
        status: "completed_with_exceptions",
      },
    ],
    recoveredValueMinor: 192500,
    duplicateEventsBlocked: 12,
  };
}

function readStoredState(): BrowserLabState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BrowserLabState) : null;
  } catch {
    return null;
  }
}

function currentState() {
  memoryState ??= readStoredState() ?? createInitialState();
  return memoryState;
}

function saveState() {
  if (!memoryState || typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  } catch {
    // The demo still works in memory when browser storage is unavailable.
  }
}

function prependAudit(event: Omit<AuditEvent, "id" | "timestamp">) {
  const state = currentState();
  state.audit.unshift({
    ...event,
    id: newId("aud"),
    timestamp: new Date().toISOString(),
  });
  state.audit = state.audit.slice(0, 12);
}

function runReconciliation(actor = "operator:browser-demo") {
  const state = currentState();
  const startedAt = new Date().toISOString();
  const result = reconcile(state.transactions, state.ledger);
  state.cases = makeCases(state.transactions, state.ledger, state.cases);

  const run: ReconciliationRun = {
    id: newId("run"),
    startedAt,
    completedAt: new Date().toISOString(),
    providerRecords: state.transactions.length,
    ledgerRecords: state.ledger.length,
    matched: result.matched.length,
    exceptions: result.exceptions.length,
    status: result.exceptions.length ? "completed_with_exceptions" : "completed",
  };

  state.runs.unshift(run);
  prependAudit({
    action: "RECONCILIATION_COMPLETED",
    actor,
    target: run.id,
    detail: `${run.matched} records matched; ${run.exceptions} exceptions require review.`,
    outcome: run.exceptions ? "warning" : "success",
  });
  saveState();
}

function ingestWebhook(
  payload: IncomingWebhook,
  options: { postLedger?: boolean; ledgerAmountMinor?: number } = {},
) {
  const state = currentState();
  const existing = state.idempotency[payload.eventId];

  if (existing) {
    existing.duplicateCount += 1;
    state.duplicateEventsBlocked += 1;
    prependAudit({
      action: "IDEMPOTENCY_HIT",
      actor: "browser-demo:webhook-gateway",
      target: payload.eventId,
      detail:
        "Duplicate delivery returned the original acknowledgement; no second ledger write occurred.",
      outcome: "warning",
    });
    saveState();
    return;
  }

  state.idempotency[payload.eventId] = {
    key: payload.eventId,
    provider: payload.provider,
    externalReference: payload.externalReference,
    firstSeenAt: new Date().toISOString(),
    duplicateCount: 0,
  };

  state.transactions.unshift({
    id: newId("txn"),
    provider: payload.provider,
    externalReference: payload.externalReference,
    merchantReference: payload.merchantReference,
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    status: payload.status,
    customerLabel: payload.customerLabel,
    occurredAt: payload.occurredAt,
    settlementBatch: "BROWSER-DEMO",
  });

  if (options.postLedger !== false) {
    state.ledger.unshift({
      id: newId("led"),
      externalReference: payload.externalReference,
      merchantReference: payload.merchantReference,
      amountMinor: options.ledgerAmountMinor ?? payload.amountMinor,
      currency: payload.currency,
      status: payload.status === "successful" ? "posted" : "pending",
      account: `collections:demo:${payload.currency.toLowerCase()}`,
      postedAt: new Date().toISOString(),
    });
  }

  prependAudit({
    action: "WEBHOOK_SIMULATED",
    actor: `browser-demo:${payload.provider}`,
    target: payload.externalReference,
    detail:
      "Synthetic event admitted to the browser-only demonstration. No external provider was contacted.",
    outcome: "success",
  });
  saveState();
}

export function browserDashboardSnapshot(): DashboardSnapshot {
  const state = currentState();
  const openCases = state.cases.filter((item) => item.status !== "resolved");
  const processedToday = 2847 + state.transactions.length;

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      processedToday,
      processedValueMinor: 186_450_000,
      reconciliationRate: Number(
        (((processedToday - openCases.length) / processedToday) * 100).toFixed(1),
      ),
      openExceptions: openCases.length,
      recoveredValueMinor: state.recoveredValueMinor,
      duplicateEventsBlocked: state.duplicateEventsBlocked,
    },
    providers: structuredClone(providerHealth),
    transactions: structuredClone(state.transactions.slice(0, 8)),
    cases: structuredClone(state.cases),
    audit: structuredClone(state.audit),
    runs: structuredClone(state.runs),
    volume: structuredClone(seedVolume),
  };
}

export function browserRunReconciliation() {
  runReconciliation();
  return browserDashboardSnapshot();
}

export function browserSimulateScenario(scenario: BrowserScenario) {
  const referenceToken = token().slice(0, 6).toUpperCase();
  const payload: IncomingWebhook = {
    eventId: `evt_demo_${referenceToken}`,
    provider: "mobimoney",
    externalReference: `MM-DEMO-${referenceToken}`,
    merchantReference: `ORD-DEMO-${referenceToken}`,
    amountMinor: 73500,
    currency: "XAF",
    status: "successful",
    customerLabel: "Browser-only scenario",
    occurredAt: new Date().toISOString(),
  };

  if (scenario === "missing_ledger") {
    ingestWebhook(payload, { postLedger: false });
  } else if (scenario === "amount_mismatch") {
    ingestWebhook(payload, { ledgerAmountMinor: 70500 });
  } else {
    ingestWebhook(payload);
    ingestWebhook(payload);
  }

  runReconciliation("simulator:browser-demo");
  return browserDashboardSnapshot();
}

export function browserResolveCase(caseId: string) {
  const state = currentState();
  const target = state.cases.find((item) => item.id === caseId);
  if (!target) throw new Error("Reconciliation case not found");

  const transaction = state.transactions.find(
    (item) => item.externalReference === target.externalReference,
  );
  const ledger = state.ledger.find(
    (item) => item.externalReference === target.externalReference,
  );

  if (target.type === "missing_ledger_entry" && transaction) {
    state.ledger.push({
      id: newId("led"),
      externalReference: transaction.externalReference,
      merchantReference: transaction.merchantReference,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      status: transaction.status === "reversed" ? "reversed" : "posted",
      account: `collections:recovery:${transaction.currency.toLowerCase()}`,
      postedAt: new Date().toISOString(),
    });
  } else if (ledger && transaction) {
    ledger.amountMinor = transaction.amountMinor;
    ledger.currency = transaction.currency;
    ledger.status = transaction.status === "reversed" ? "reversed" : "posted";
  } else if (target.type === "missing_provider_record" && ledger) {
    ledger.status = "reversed";
  }

  target.status = "resolved";
  target.attempts += 1;
  target.resolvedAt = new Date().toISOString();
  state.recoveredValueMinor += target.expectedMinor ?? 0;

  prependAudit({
    action: "COMPENSATING_ENTRY_POSTED",
    actor: "operator:browser-demo",
    target: target.externalReference,
    detail: `Case ${target.id} was recovered without mutating the original provider event.`,
    outcome: "success",
  });

  runReconciliation("recovery-worker:browser-demo");
  return browserDashboardSnapshot();
}

export function browserResetLab() {
  memoryState = createInitialState();
  saveState();
  return browserDashboardSnapshot();
}
