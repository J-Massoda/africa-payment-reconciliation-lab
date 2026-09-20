import { dashboardSnapshot, runReconciliation } from "@/lib/store";

export async function POST() {
  const run = runReconciliation();
  return Response.json({ run, snapshot: dashboardSnapshot() });
}
