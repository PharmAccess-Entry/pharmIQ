/** Reads the saved currency symbol from the restaurant cache. Falls back to ₦ for existing Nigerian users. */
const getCurrencySymbol = (): string => {
  try {
    const cached = localStorage.getItem("pharmiq_cached_restaurant");
    if (cached) {
      const r = JSON.parse(cached);
      if (r?.currency_symbol) return r.currency_symbol;
    }
  } catch {}
  return "₦";
};

export const formatCurrency = (n: number) =>
  `${getCurrencySymbol()}${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** @deprecated Use formatCurrency instead. Kept for backward compatibility. */
export const formatNaira = formatCurrency;

export const timeAgo = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

export const formatDate = (iso: string) => {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
