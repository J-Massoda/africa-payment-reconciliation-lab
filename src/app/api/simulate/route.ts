import { dashboardSnapshot, simulateScenario } from "@/lib/store";
import { simulationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = simulationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Unsupported simulation scenario", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const result = simulateScenario(parsed.data.scenario);
  return Response.json({ result, snapshot: dashboardSnapshot() }, { status: 201 });
}
