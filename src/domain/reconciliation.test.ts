import { describe, expect, it } from "vitest";
import type { LedgerEntry, ProviderTransaction } from "./types";
import { reconcile } from "./reconciliation";

const providerRecord: ProviderTransaction = {
  id: "txn_test",
  provider: "mobimoney",
  externalReference: "PROVIDER-REF-001",
  merchantReference: "ORDER-001",
  amountMinor: 50_000,
  currency: "XAF",
  status: "successful",
  customerLabel: "Test payment",
  occurredAt: "2026-09-20T08:00:00.000Z",
  settlementBatch: "TEST-BATCH",
};

const ledgerRecord: LedgerEntry = {
  id: "ledger_test",
  externalReference: "PROVIDER-REF-001",
  merchantReference: "ORDER-001",
  amountMinor: 50_000,
  currency: "XAF",
  status: "posted",
  account: "collections:test:xaf",
  postedAt: "2026-09-20T08:00:01.000Z",
};

describe("reconciliation engine", () => {
  it("matches records that agree on reference, amount, currency and state", () => {
    const result = reconcile([providerRecord], [ledgerRecord]);
    expect(result.matched).toEqual(["PROVIDER-REF-001"]);
    expect(result.exceptions).toHaveLength(0);
  });

  it("classifies a provider success without a ledger entry as critical", () => {
    const result = reconcile([providerRecord], []);
    expect(result.exceptions[0]).toMatchObject({
      type: "missing_ledger_entry",
      severity: "critical",
      expectedMinor: 50_000,
      observedMinor: null,
    });
  });

  it("detects amount mismatches before state comparison", () => {
    const result = reconcile(
      [providerRecord],
      [{ ...ledgerRecord, amountMinor: 49_000, status: "pending" }],
    );
    expect(result.exceptions).toHaveLength(1);
    expect(result.exceptions[0].type).toBe("amount_mismatch");
  });

  it("detects currency mismatches even when the numeric value agrees", () => {
    const result = reconcile(
      [providerRecord],
      [{ ...ledgerRecord, currency: "XOF" }],
    );
    expect(result.exceptions[0]).toMatchObject({
      type: "currency_mismatch",
      severity: "critical",
    });
  });

  it("flags optimistic ledger writes missing from the provider export", () => {
    const result = reconcile([], [ledgerRecord]);
    expect(result.exceptions[0].type).toBe("missing_provider_record");
  });
});
