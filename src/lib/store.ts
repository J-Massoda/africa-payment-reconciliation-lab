import { randomUUID } from "node:crypto";
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
} from "./seed";

interface LabState {
  transactions: ProviderTransaction[];
  ledger: LedgerEntry[];
  cases: ReconciliationCase[];
  audit: AuditEvent[];
  idempotency: Map<string, IdempotencyRecord>;
  runs: ReconciliationRun[];
  recoveredValueMinor: number;
  duplicateEventsBlocked: number;
}

function newId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
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

function createInitialState(): LabState {
  const transactions = structuredClone(seedTransactions);
  const ledger = structuredClone(seedLedger);
  const result = reconcile(transactions, ledger);
  const completedAt = new Date(Date.now() - 50 * 60_000).toISOString();
  return {
    transactions,
    ledger,
    cases: makeCases(transactions, ledger),
    audit: structuredClone(seedAudit),
    idempotency: new Map([
      [
        "evt_mm_91ca",
        {
          key: "evt_mm_91ca",
          provider: "mobimoney",
          externalReference: "MM-240918-A81F",
          firstSeenAt: new Date(Date.now() - 24 * 60_000).toISOString(),
          duplicateCount: 1,
        },
      ],
    ]),
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

declare global {
  var reconciliationLabState: LabState | undefined;
}

function state() {
  globalThis.reconciliationLabState ??= createInitialState();
  return globalThis.reconciliationLabState;
}

function prependAudit(event: Omit<AuditEvent, "id" | "timestamp">) {
  state().audit.unshift({
    ...event,
    id: newId("aud"),
    timestamp: new Date().toISOString(),
  });
  state().audit = state().audit.slice(0, 12);
}

export function dashboardSnapshot(): DashboardSnapshot {
  const current = state();
  const total = current.transactions.length;
  const openCases = current.cases.filter((item) => item.status !== "resolved");
  const processedToday = 2847 + total;
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      processedToday,
      processedValueMinor: 186_450_000,
      reconciliationRate: Number(
        (((processedToday - openCases.length) / processedToday) * 100).toFixed(1),
      ),
      openExceptions: openCases.length,
      recoveredValueMinor: current.recoveredValueMinor,
      duplicateEventsBlocked: current.duplicateEventsBlocked,
    },
    providers: providerHealth,
    transactions: current.transactions.slice(0, 8),
    cases: current.cases,
    audit: current.audit,
    runs: current.runs,
    volume: seedVolume,
  };
}

export function runReconciliation(actor = "operator:demo") {
  const current = state();
  const startedAt = new Date().toISOString();
  const result = reconcile(current.transactions, current.ledger);
  current.cases = makeCases(current.transactions, current.ledger, current.cases);
  const run: ReconciliationRun = {
    id: newId("run"),
    startedAt,
    completedAt: new Date().toISOString(),
    providerRecords: current.transactions.length,
    ledgerRecords: current.ledger.length,
    matched: result.matched.length,
    exceptions: result.exceptions.length,
    status: result.exceptions.length ? "completed_with_exceptions" : "completed",
  };
  current.runs.unshift(run);
  prependAudit({
    action: "RECONCILIATION_COMPLETED",
    actor,
    target: run.id,
    detail: `${run.matched} records matched; ${run.exceptions} exceptions require review.`,
    outcome: run.exceptions ? "warning" : "success",
  });
  return run;
}

export function ingestWebhook(
  payload: IncomingWebhook,
  options: { postLedger?: boolean; ledgerAmountMinor?: number } = {},
) {
  const current = state();
  const existing = current.idempotency.get(payload.eventId);
  if (existing) {
    existing.duplicateCount += 1;
    current.duplicateEventsBlocked += 1;
    prependAudit({
      action: "IDEMPOTENCY_HIT",
      actor: "webhook-gateway",
      target: payload.eventId,
      detail: "Duplicate delivery returned the original acknowledgement; no second ledger write occurred.",
      outcome: "warning",
    });
    return { duplicate: true, transactionId: existing.externalReference };
  }

  current.idempotency.set(payload.eventId, {
    key: payload.eventId,
    provider: payload.provider,
    externalReference: payload.externalReference,
    firstSeenAt: new Date().toISOString(),
    duplicateCount: 0,
  });
  current.transactions.unshift({
    id: newId("txn"),
    provider: payload.provider,
    externalReference: payload.externalReference,
    merchantReference: payload.merchantReference,
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    status: payload.status,
    customerLabel: payload.customerLabel,
    occurredAt: payload.occurredAt,
    settlementBatch: "LIVE-DEMO",
  });

  if (options.postLedger !== false) {
    current.ledger.unshift({
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
    action: "WEBHOOK_ACCEPTED",
    actor: `adapter:${payload.provider}`,
    target: payload.externalReference,
    detail: "Signature and schema checks passed; the event was processed exactly once.",
    outcome: "success",
  });
  return { duplicate: false, transactionId: payload.externalReference };
}

export function simulateScenario(
  scenario: "missing_ledger" | "amount_mismatch" | "duplicate_webhook",
) {
  const token = randomUUID().slice(0, 6).toUpperCase();
  const payload: IncomingWebhook = {
    eventId: `evt_demo_${token}`,
    provider: "mobimoney",
    externalReference: `MM-DEMO-${token}`,
    merchantReference: `ORD-DEMO-${token}`,
    amountMinor: 73500,
    currency: "XAF",
    status: "successful",
    customerLabel: "Live scenario",
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
  runReconciliation("simulator:interactive");
  return { scenario, reference: payload.externalReference };
}

export function resolveCase(caseId: string) {
  const current = state();
  const target = current.cases.find((item) => item.id === caseId);
  if (!target) return null;

  const transaction = current.transactions.find(
    (item) => item.externalReference === target.externalReference,
  );
  const ledger = current.ledger.find(
    (item) => item.externalReference === target.externalReference,
  );

  if (target.type === "missing_ledger_entry" && transaction) {
    current.ledger.push({
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
  current.recoveredValueMinor += target.expectedMinor ?? 0;
  prependAudit({
    action: "COMPENSATING_ENTRY_POSTED",
    actor: "operator:demo",
    target: target.externalReference,
    detail: `Case ${target.id} was recovered without mutating the original provider event.`,
    outcome: "success",
  });
  runReconciliation("recovery-worker");
  return target;
}

export function resetLab() {
  globalThis.reconciliationLabState = createInitialState();
  return dashboardSnapshot();
}
