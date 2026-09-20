import type { ProviderCode } from "@/domain/types";
import { dashboardSnapshot, ingestWebhook, runReconciliation } from "@/lib/store";
import { verifyWebhookSignature } from "@/lib/security";
import { webhookSchema } from "@/lib/validation";

const supportedProviders = new Set<ProviderCode>([
  "mobimoney",
  "orange-pay",
  "pesa-link",
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!supportedProviders.has(provider as ProviderCode)) {
    return Response.json({ error: "Unknown payment provider" }, { status: 404 });
  }

  const rawPayload = await request.text();
  const signature = request.headers.get("x-recon-signature") ?? "";
  const secret = process.env.WEBHOOK_SIGNING_SECRET ?? "local-demo-secret";
  if (!verifyWebhookSignature(rawPayload, signature, secret)) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(rawPayload);
  } catch {
    return Response.json({ error: "Webhook body must be valid JSON" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(candidate);
  if (!parsed.success || parsed.data.provider !== provider) {
    return Response.json(
      { error: "Webhook schema validation failed", issues: parsed.error?.issues },
      { status: 422 },
    );
  }

  const result = ingestWebhook(parsed.data);
  runReconciliation(`adapter:${provider}`);
  return Response.json(
    { accepted: true, ...result, snapshot: dashboardSnapshot() },
    { status: result.duplicate ? 200 : 202 },
  );
}
