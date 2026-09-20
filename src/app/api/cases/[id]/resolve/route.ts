import { dashboardSnapshot, resolveCase } from "@/lib/store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resolved = resolveCase(id);
  if (!resolved) {
    return Response.json({ error: "Reconciliation case not found" }, { status: 404 });
  }
  return Response.json({ resolved, snapshot: dashboardSnapshot() });
}
