import { describe, expect, it } from "vitest";
import { signPayload, verifyWebhookSignature } from "./security";

describe("webhook signature verification", () => {
  const body = JSON.stringify({ eventId: "evt_123", amountMinor: 45_000 });
  const secret = "test-signing-secret";

  it("accepts an authentic HMAC signature", () => {
    expect(verifyWebhookSignature(body, signPayload(body, secret), secret)).toBe(true);
  });

  it("rejects a payload changed after signing", () => {
    const signature = signPayload(body, secret);
    expect(verifyWebhookSignature(`${body} `, signature, secret)).toBe(false);
  });

  it("rejects malformed signatures without throwing", () => {
    expect(verifyWebhookSignature(body, "invalid", secret)).toBe(false);
  });
});
