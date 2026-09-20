import { resetLab } from "@/lib/store";

export async function POST() {
  return Response.json({ snapshot: resetLab() });
}
