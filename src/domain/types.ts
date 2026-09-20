export type ProviderCode = "mobimoney" | "orange-pay" | "pesa-link";
export type Currency = "XAF" | "XOF" | "KES" | "GHS" | "NGN";
export type PaymentStatus =
  | "initiated"
  | "processing"
  | "successful"
  | "failed"
  | "reversed";
export type LedgerStatus = "pending" | "posted" | "reversed";
export type CaseType =
  | "missing_ledger_entry"
  | "missing_provider_record"
  | "amount_mismatch"
  | "currency_mismatch"
  | "status_mismatch"
  | "duplicate_event"
  | "late_settlement";
export type CaseStatus = "open" | "investigating" | "resolved";
export type Severity = "critical" | "high" | "medium" | "low";

export interface ProviderTransaction {
  id: string;
  provider: ProviderCode;
  externalReference: string;
  merchantReference: string;
  amountMinor: number;
  currency: Currency;
  status: PaymentStatus;
  customerLabel: string;
  occurredAt: string;
  settlementBatch: string;
}

export interface LedgerEntry {
  id: string;
  externalReference: string;
  merchantReference: string;
  amountMinor: number;
  currency: Currency;
  status: LedgerStatus;
  account: string;
  postedAt: string;
}

export interface ReconciliationCase {
  id: string;
  type: CaseType;
  severity: Severity;
  status: CaseStatus;
  provider: ProviderCode;
  externalReference: string;
  merchantReference: string;
  expectedMinor: number | null;
  observedMinor: number | null;
  currency: Currency;
  summary: string;
  recommendation: string;
  attempts: number;
  detectedAt: string;
  resolvedAt?: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  timestamp: string;
  outcome: "success" | "warning" | "failure";
}

export interface IdempotencyRecord {
  key: string;
  provider: ProviderCode;
  externalReference: string;
  firstSeenAt: string;
  duplicateCount: number;
}

export interface ReconciliationRun {
  id: string;
  startedAt: string;
  completedAt: string;
  providerRecords: number;
  ledgerRecords: number;
  matched: number;
  exceptions: number;
  status: "completed" | "completed_with_exceptions";
}

export interface ProviderHealth {
  provider: ProviderCode;
  displayName: string;
  successRate: number;
  latencyMs: number;
  webhookLagSeconds: number;
  status: "healthy" | "degraded" | "incident";
}

export interface VolumePoint {
  label: string;
  matched: number;
  exceptions: number;
}

export interface DashboardSnapshot {
  generatedAt: string;
  metrics: {
    processedToday: number;
    processedValueMinor: number;
    reconciliationRate: number;
    openExceptions: number;
    recoveredValueMinor: number;
    duplicateEventsBlocked: number;
  };
  providers: ProviderHealth[];
  transactions: ProviderTransaction[];
  cases: ReconciliationCase[];
  audit: AuditEvent[];
  runs: ReconciliationRun[];
  volume: VolumePoint[];
}

export interface IncomingWebhook {
  eventId: string;
  provider: ProviderCode;
  externalReference: string;
  merchantReference: string;
  amountMinor: number;
  currency: Currency;
  status: PaymentStatus;
  customerLabel: string;
  occurredAt: string;
}
