import type { Currency, ProviderCode } from "./types";

export const providerNames: Record<ProviderCode, string> = {
  mobimoney: "MobiMoney CM",
  "orange-pay": "OrangePay Sandbox",
  "pesa-link": "PesaLink Lab",
};

export function formatMoney(amountMinor: number, currency: Currency = "XAF") {
  const zeroDecimal = currency === "XAF" || currency === "XOF";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(amountMinor / (zeroDecimal ? 1 : 100));
}

export function titleCase(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
