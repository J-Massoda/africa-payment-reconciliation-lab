import { dashboardSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(dashboardSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
