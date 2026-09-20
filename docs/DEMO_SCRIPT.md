# LinkedIn launch video script

Target length: 75 to 100 seconds. Record the browser at 1080p. Keep the cursor movement deliberate and zoom the page to a readable level before recording.

## 0:00–0:08 — Hook

**Screen:** Dashboard overview.

**Say:**

> A payment provider says a customer paid, but your internal ledger has no record of it. How do you recover the money without crediting the customer twice?

## 0:08–0:22 — Frame the product

**Screen:** Move across Processed today, Auto-matched and Open exceptions.

**Say:**

> I built ReconLab to demonstrate the backend controls behind reliable digital payments. It compares provider records with an internal ledger and turns every disagreement into an explainable operations case.

## 0:22–0:37 — Create a real failure

**Screen:** Select **Missing ledger** under “Prove the failure path.”

**Say:**

> This simulator sends a valid provider success but intentionally prevents the ledger write. The signed event is accepted once, and reconciliation immediately classifies the missing entry as critical.

## 0:37–0:55 — Inspect evidence

**Screen:** Open the newly created exception. Pause over the expected and observed values.

**Say:**

> The operator sees the provider reference, the expected amount, what the ledger actually contains and a recovery recommendation. The engine never hides an uncertain match behind a green status.

## 0:55–1:10 — Recover safely

**Screen:** Click **Apply safe recovery**. Show the open-exception count and recovered value change.

**Say:**

> Recovery posts a compensating action instead of rewriting history. The original event stays intact, the case is reconciled again and every action is attributed in the audit trail.

## 1:10–1:23 — Prove idempotency

**Screen:** Run **Duplicate webhook**, then open the Audit trail.

**Say:**

> Duplicate deliveries are normal in payment systems. ReconLab recognizes the idempotency key, returns the original acknowledgement and blocks the second ledger credit.

## 1:23–1:35 — Close

**Screen:** Return to the overview, then briefly show the repository README.

**Say:**

> The repository includes the matching engine, signed webhook API, test suite, PostgreSQL schema and production architecture notes. I built it around the payment reliability problems African products have to handle every day.

On-screen closing text:

**Fintech APIs · Webhooks · Idempotency · Reconciliation · Failure recovery**
