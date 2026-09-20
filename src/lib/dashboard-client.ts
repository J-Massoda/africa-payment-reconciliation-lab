import type { DashboardSnapshot } from "@/domain/types";
import {
  browserDashboardSnapshot,
  browserResetLab,
  browserResolveCase,
  browserRunReconciliation,
  browserSimulateScenario,
  type BrowserScenario,
} from "@/lib/browser-lab-store";

const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";

async function briefDemoDelay() {
  await new Promise((resolve) => window.setTimeout(resolve, 220));
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (isStaticDemo) {
    return browserDashboardSnapshot();
  }

  const response = await fetch("/api/dashboard", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not load the reconciliation workspace");
  }
  return response.json() as Promise<DashboardSnapshot>;
}

export async function performDashboardMutation(
  endpoint: string,
  body?: object,
): Promise<DashboardSnapshot> {
  if (isStaticDemo) {
    await briefDemoDelay();

    if (endpoint === "/api/reset") return browserResetLab();
    if (endpoint === "/api/reconcile") return browserRunReconciliation();

    if (endpoint === "/api/simulate") {
      const scenario = (body as { scenario?: BrowserScenario } | undefined)?.scenario;
      if (!scenario) throw new Error("A simulation scenario is required");
      return browserSimulateScenario(scenario);
    }

    const caseMatch = endpoint.match(/^\/api\/cases\/([^/]+)\/resolve$/);
    if (caseMatch) return browserResolveCase(decodeURIComponent(caseMatch[1]));

    throw new Error(`Unsupported browser-demo action: ${endpoint}`);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error ?? "The action could not be completed");
  }
  return result.snapshot as DashboardSnapshot;
}
