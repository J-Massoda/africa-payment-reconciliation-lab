import { beforeEach, describe, expect, it } from "vitest";
import {
  dashboardSnapshot,
  resetLab,
  resolveCase,
  runReconciliation,
  simulateScenario,
} from "./store";

describe("reconciliation application service", () => {
  beforeEach(() => {
    resetLab();
  });

  it("creates an explainable critical case for a missing ledger scenario", () => {
    const simulation = simulateScenario("missing_ledger");
    const created = dashboardSnapshot().cases.find(
      (item) => item.externalReference === simulation.reference,
    );
    expect(created).toMatchObject({
      type: "missing_ledger_entry",
      severity: "critical",
      status: "open",
    });
  });

  it("recovers a missing posting and removes the mismatch on the verification run", () => {
    const simulation = simulateScenario("missing_ledger");
    const created = dashboardSnapshot().cases.find(
      (item) => item.externalReference === simulation.reference,
    );
    expect(created).toBeDefined();

    const resolved = resolveCase(created!.id);
    expect(resolved?.status).toBe("resolved");
    expect(
      dashboardSnapshot().cases.some(
        (item) => item.externalReference === simulation.reference,
      ),
    ).toBe(false);
  });

  it("admits a duplicated webhook only once", () => {
    const before = dashboardSnapshot();
    simulateScenario("duplicate_webhook");
    const after = dashboardSnapshot();

    expect(after.transactions).toHaveLength(before.transactions.length + 1);
    expect(after.metrics.duplicateEventsBlocked).toBe(
      before.metrics.duplicateEventsBlocked + 1,
    );
    expect(after.audit.some((event) => event.action === "IDEMPOTENCY_HIT")).toBe(true);
  });

  it("records every manual reconciliation run", () => {
    const before = dashboardSnapshot().runs.length;
    const run = runReconciliation("test:operator");
    expect(dashboardSnapshot().runs).toHaveLength(before + 1);
    expect(run.providerRecords).toBeGreaterThan(0);
    expect(run.status).toBe("completed_with_exceptions");
  });
});
