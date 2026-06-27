/** Country & Currency detection utility for PharmIQ */

export interface CountryInfo {
  country: string;
  country_code: string;
  currency_code: string;
  currency_symbol: string;
  timezone: string;
  language: string;
}

/** Hard-coded currency symbol map for common currencies */
const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦",
  GHS: "₵",
  KES: "KSh",
  ZAR: "R",
  GBP: "£",
  USD: "$",
  EUR: "€",
  UGX: "USh",
  TZS: "TSh",
  RWF: "FRw",
  XOF: "CFA",
  XAF: "FCFA",
  EGP: "E£",
  MAD: "MAD",
  ZMW: "K",
  MWK: "MK",
  BWP: "P",
  ETB: "Br",
  SDG: "SDG",
  CDF: "FC",
  AOA: "Kz",
  CAD: "CA$",
  AUD: "A$",
  INR: "₹",
  BRL: "R$",
  MXN: "MX$",
  AED: "AED",
  SAR: "SAR",
  JPY: "¥",
  CNY: "¥",
  SGD: "S$",
};

/** Resolve a currency symbol from its code */
export const symbolForCode = (code: string): string =>
  CURRENCY_SYMBOLS[code?.toUpperCase()] ?? code ?? "₦";

/**
 * Detect the user's country via IP-based geolocation (ipapi.co).
 * Returns null if offline or the API call fails.
 */
export const detectCountryInfo = async (): Promise<CountryInfo | null> => {
  if (!navigator.onLine) return null;
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const currencyCode: string = data.currency || "USD";
    return {
      country: data.country_name || "",
      country_code: data.country_code || "",
      currency_code: currencyCode,
      currency_symbol: symbolForCode(currencyCode),
      timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language || "en",
    };
  } catch {
    return null;
  }
};

/** List of supported countries for the manual picker */
export const SUPPORTED_COUNTRIES: { name: string; code: string; currency_code: string }[] = [
  { name: "Nigeria", code: "NG", currency_code: "NGN" },
  { name: "Ghana", code: "GH", currency_code: "GHS" },
  { name: "Kenya", code: "KE", currency_code: "KES" },
  { name: "South Africa", code: "ZA", currency_code: "ZAR" },
  { name: "United Kingdom", code: "GB", currency_code: "GBP" },
  { name: "United States", code: "US", currency_code: "USD" },
  { name: "Canada", code: "CA", currency_code: "CAD" },
  { name: "Australia", code: "AU", currency_code: "AUD" },
  { name: "Uganda", code: "UG", currency_code: "UGX" },
  { name: "Tanzania", code: "TZ", currency_code: "TZS" },
  { name: "Rwanda", code: "RW", currency_code: "RWF" },
  { name: "Ethiopia", code: "ET", currency_code: "ETB" },
  { name: "Zambia", code: "ZM", currency_code: "ZMW" },
  { name: "Botswana", code: "BW", currency_code: "BWP" },
  { name: "Egypt", code: "EG", currency_code: "EGP" },
  { name: "Morocco", code: "MA", currency_code: "MAD" },
  { name: "India", code: "IN", currency_code: "INR" },
  { name: "United Arab Emirates", code: "AE", currency_code: "AED" },
  { name: "Saudi Arabia", code: "SA", currency_code: "SAR" },
  { name: "European Union", code: "EU", currency_code: "EUR" },
];
