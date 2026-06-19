// Pure data / utilities — no React, no JSX.
// Extracted from restaurant.tsx to fix Vite Fast Refresh HMR warning.

// Fallback id for the public/QR routes that aren't logged in.
export const RESTAURANT_ID = "00000000-0000-0000-0000-000000000001";
export const RESTAURANT_NAME = "PharmIQ";

// ----- Pricing tiers (table-based) -----
export const PRICE_PER_TABLE_MONTHLY = 2000;
export const monthlyPriceForTables = (n: number): number => {
  return Math.max(1, n) * PRICE_PER_TABLE_MONTHLY;
};
// Annual = 10× monthly (2 months free)
export const annualPriceFor = (monthly: number) => monthly * 10;

// ----- Event pricing tiers (per-event, table-based) -----
export type EventTier = { id: "small" | "medium" | "large"; name: string; price: number; minTables: number; maxTables: number | null; description: string };
export const EVENT_TIERS: EventTier[] = [
  { id: "small", name: "Small Event", price: 15000, minTables: 1, maxTables: 10, description: "Up to 10 tables — birthdays, small gatherings" },
  { id: "medium", name: "Standard Event", price: 25000, minTables: 11, maxTables: 25, description: "11–25 tables — weddings, parties" },
  { id: "large", name: "Large Event", price: 40000, minTables: 26, maxTables: null, description: "26+ tables — large weddings, conferences" },
];
export const eventTierForTables = (n: number): EventTier => {
  if (n <= 0) return EVENT_TIERS[0];
  return EVENT_TIERS.find((t) => n >= t.minTables && (t.maxTables === null || n <= t.maxTables)) || EVENT_TIERS[2];
};

export const trialDaysLeft = (iso: string | null) => {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400_000));
};

export const initialsFromName = (name: string) => {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "R";
};
