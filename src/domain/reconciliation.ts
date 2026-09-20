import type {
  LedgerEntry,
  ProviderTransaction,
  ReconciliationCase,
} from "./types";

export type CaseDraft = Omit<
  ReconciliationCase,
  "id" | "detectedAt" | "attempts" | "status"
>;

export interface ReconciliationResult {
  matched: string[];
  exceptions: CaseDraft[];
}

function baseCase(
  transaction: ProviderTransaction,
  overrides: Pick<
    CaseDraft,
    | "type"
    | "severity"
    | "summary"
    | "recommendation"
    | "expectedMinor"
    | "observedMinor"
  >,
): CaseDraft {
  return {
    ...overrides,
    provider: transaction.provider,
    externalReference: transaction.externalReference,
    merchantReference: transaction.merchantReference,
    currency: transaction.currency,
  };
}

export function reconcile(
  providerTransactions: ProviderTransaction[],
  ledgerEntries: LedgerEntry[],
): ReconciliationResult {
  const matched: string[] = [];
  const exceptions: CaseDraft[] = [];
  const ledgerByExternalRef = new Map(
    ledgerEntries.map((entry) => [entry.externalReference, entry]),
  );
  const providerRefs = new Set(providerTransactions.map((item) => item.externalReference));

  for (const transaction of providerTransactions) {
    const ledger = ledgerByExternalRef.get(transaction.externalReference);

    if (!ledger) {
      exceptions.push(
        baseCase(transaction, {
          type: "missing_ledger_entry",
          severity: transaction.status === "successful" ? "critical" : "medium",
          expectedMinor: transaction.amountMinor,
          observedMinor: null,
          summary: "Provider confirmed the payment, but no ledger entry exists.",
          recommendation:
            "Replay the posting command using the original idempotency key after validating the provider receipt.",
        }),
      );
      continue;
    }

    if (ledger.currency !== transaction.currency) {
      exceptions.push(
        baseCase(transaction, {
          type: "currency_mismatch",
          severity: "critical",
          expectedMinor: transaction.amountMinor,
          observedMinor: ledger.amountMinor,
          summary: `Provider reported ${transaction.currency}, while the ledger recorded ${ledger.currency}.`,
          recommendation:
            "Quarantine the record and verify the merchant configuration before making any balance adjustment.",
        }),
      );
      continue;
    }

    if (ledger.amountMinor !== transaction.amountMinor) {
      exceptions.push(
        baseCase(transaction, {
          type: "amount_mismatch",
          severity: "high",
          expectedMinor: transaction.amountMinor,
          observedMinor: ledger.amountMinor,
          summary: "Provider and internal ledger amounts do not agree.",
          recommendation:
            "Inspect fees, partial captures and currency conversion before posting a compensating entry.",
        }),
      );
      continue;
    }

    const expectedLedgerStatus =
      transaction.status === "successful"
        ? "posted"
        : transaction.status === "reversed"
          ? "reversed"
          : "pending";

    if (ledger.status !== expectedLedgerStatus) {
      exceptions.push(
        baseCase(transaction, {
          type: "status_mismatch",
          severity: transaction.status === "successful" ? "high" : "medium",
          expectedMinor: transaction.amountMinor,
          observedMinor: ledger.amountMinor,
          summary: `Provider status is ${transaction.status}, while the ledger remains ${ledger.status}.`,
          recommendation:
            "Verify the latest provider event and safely advance the ledger state with a compensating command.",
        }),
      );
      continue;
    }

    matched.push(transaction.externalReference);
  }

  for (const ledger of ledgerEntries) {
    if (!providerRefs.has(ledger.externalReference)) {
      exceptions.push({
        type: "missing_provider_record",
        severity: "high",
        provider: "mobimoney",
        externalReference: ledger.externalReference,
        merchantReference: ledger.merchantReference,
        expectedMinor: ledger.amountMinor,
        observedMinor: null,
        currency: ledger.currency,
        summary: "The internal ledger contains a payment that the provider export does not contain.",
        recommendation:
          "Check whether the entry was created optimistically, then verify or reverse it with a compensating entry.",
      });
    }
  }

  return { matched, exceptions };
}
