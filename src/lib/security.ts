import { createHmac, timingSafeEqual } from "node:crypto";

export function signPayload(rawPayload: string, secret: string) {
  return createHmac("sha256", secret).update(rawPayload).digest("hex");
}

export function verifyWebhookSignature(
  rawPayload: string,
  suppliedSignature: string,
  secret: string,
) {
  const expected = Buffer.from(signPayload(rawPayload, secret), "utf8");
  const supplied = Buffer.from(suppliedSignature, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
