import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { detectCountryInfo } from "@/lib/countryDetect";

export type Restaurant = {
  id: string;
  owner_id: string | null;
  name: string;
  phone: string | null;
  business_type: "restaurant" | "event" | "pharmacy" | null;
  table_count: number;
  short_code: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  logo_url: string | null;
  website_url: string | null;
  base_url: string | null;
  subscription_status: "trial" | "active" | "past_due" | "none" | "cancelled";
  subscription_plan: string | null;
  subscription_period: "monthly" | "annual" | null;
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  active_event_id: string | null;
  latitude: number | null;
  longitude: number | null;
  geofencing_enabled: boolean;
  geofencing_radius: number;
  is_accepting_orders?: boolean;
  // Telegram (SaaS Architecture)
  telegram_enabled?: boolean;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  telegram_connected_at?: string | null;
  telegram_last_notified_at?: string | null;
  telegram_notify_prefs?: Record<string, boolean> | null;
  // Country / Currency
  country?: string | null;
  currency_code?: string | null;
  currency_symbol?: string | null;
  timezone?: string | null;
  language?: string | null;
  active_event?: {
    id: string;
    name: string;
    payment_status: string;
    qr_enabled: boolean;
    amount: number;
    expires_at?: string | null;
  } | null;
};

// Re-export all pure data and utilities from the separate data file
export {
  RESTAURANT_ID,
  RESTAURANT_NAME,
  PRICE_PER_TABLE_MONTHLY,
  monthlyPriceForTables,
  annualPriceFor,
  EVENT_TIERS,
  eventTierForTables,
  trialDaysLeft,
  initialsFromName,
} from "@/lib/restaurantData";
export type { EventTier } from "@/lib/restaurantData";

type Ctx = { 
  restaurant: Restaurant | null; 
  loading: boolean; 
  refresh: () => Promise<void>;
  role: "owner" | "manager" | "staff" | null;
};
const RestCtx = createContext<Ctx | null>(null);

const decodeHtml = (str: string) => {
  if (!str) return str;
  return str.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
};

export const RestaurantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [role, setRole] = useState<"owner" | "manager" | "staff" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurant?.business_type) {
      localStorage.setItem("smarttable_business_type", restaurant.business_type);
    } else if (restaurant === null && !loading && !user) {
      localStorage.removeItem("smarttable_business_type");
    }
  }, [restaurant?.business_type, restaurant, loading, user]);

  const refresh = useCallback(async () => {
    if (!user) { setRestaurant(null); setRole(null); sessionStorage.removeItem("st.role"); setLoading(false); return; }

    // Hard timeout — if Supabase is unreachable, don't hang forever
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error("restaurant refresh timeout")), 12_000)
    );

    const doRefresh = async () => {
      // 1. Try owner
      let { data: rData, error: ownerErr } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (rData) {
        if (rData.active_event_id) {
          const { data: ev } = await supabase.from("events").select("id, name, payment_status, qr_enabled, amount, expires_at").eq("id", rData.active_event_id).maybeSingle();
          (rData as any).active_event = ev;
        }
        rData.name = decodeHtml(rData.name);
        setRestaurant(rData as any);
        setRole("owner");
        sessionStorage.setItem("st.role", "owner");
        localStorage.setItem("pharmiq_cached_restaurant", JSON.stringify(rData));

        // Backfill: if country/currency not saved yet, detect silently in background
        if (!rData.country && navigator.onLine) {
          detectCountryInfo().then(async (info) => {
            if (!info) return;
            try {
              await supabase.from("restaurants").update({
                country: info.country,
                currency_code: info.currency_code,
                currency_symbol: info.currency_symbol,
                timezone: info.timezone,
                language: info.language,
              }).eq("id", rData.id);
              // Re-cache with new data
              const updated = { ...rData, ...info };
              localStorage.setItem("pharmiq_cached_restaurant", JSON.stringify(updated));
            } catch {}
          });
        }

      } else if (!navigator.onLine && ownerErr) {
        // Fallback to local cache if completely offline
        try {
          const cached = localStorage.getItem("pharmiq_cached_restaurant");
          if (cached) {
            setRestaurant(JSON.parse(cached));
            const rRole = sessionStorage.getItem("st.role") || "staff";
            setRole(rRole as any);
            setLoading(false);
            return;
          }
        } catch (e) {}
      } else {
        // 2. Fallback: staff member
        const { data: roleEntry, error: roleErr } = await supabase
          .from("user_roles")
          .select("restaurant_id, role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        
        if (roleEntry?.restaurant_id) {
          const { data: r } = await supabase.from("restaurants").select("*").eq("id", roleEntry.restaurant_id).maybeSingle();
          if (r) {
            if (r.active_event_id) {
              const { data: ev } = await supabase.from("events").select("id, name, payment_status, qr_enabled, amount, expires_at").eq("id", r.active_event_id).maybeSingle();
              (r as any).active_event = ev;
            }
            r.name = decodeHtml(r.name);
            setRestaurant(r as any);
            const resolvedRole = roleEntry.role || "staff";
            setRole(resolvedRole);
            sessionStorage.setItem("st.role", resolvedRole);
            localStorage.setItem("pharmiq_cached_restaurant", JSON.stringify(r));
            setLoading(false);
            return;
          }
        } else if (!navigator.onLine && roleErr) {
          // Fallback to local cache if offline
          try {
            const cached = localStorage.getItem("pharmiq_cached_restaurant");
            if (cached) {
              setRestaurant(JSON.parse(cached));
              const rRole = sessionStorage.getItem("st.role") || "staff";
              setRole(rRole as any);
              setLoading(false);
              return;
            }
          } catch (e) {}
        }

        // 3. Auto-create if no role and no restaurant (ONLY IF ONLINE)
        if (navigator.onLine) {
          const meta = (user.user_metadata as any) || {};
          const { data: created, error: createErr } = await supabase
            .from("restaurants")
            .insert({
              owner_id: user.id,
              name: meta.restaurant_name || "My Business",
              business_type: meta.business_type || "restaurant",
              table_count: 0,
              subscription_status: "trial",
              trial_ends_at: new Date(Date.now() + 3 * 86400_000).toISOString(),
            })
            .select("*")
            .maybeSingle();
          
          if (createErr) {
            console.error("CRITICAL: Failed to auto-create restaurant profile.", createErr);
          }
          
          if (created) {
            created.name = decodeHtml(created.name);
            setRestaurant(created as any);
            setRole("owner");
            localStorage.setItem("pharmiq_cached_restaurant", JSON.stringify(created));
            try {
              const isEvent = created.business_type === "event";
              await supabase.from("notifications").insert({
                restaurant_id: created.id,
                type: "system",
                title: isEvent ? `Welcome to PharmIQ Events, ${created.name.replace(/&#x27;/g, "'")}! 🎉` : `Welcome to PharmIQ, ${created.name.replace(/&#x27;/g, "'")}! 🎉`,
                body: isEvent 
                  ? "Set up your event profile, add your menu items, and generate your table QR codes."
                  : "Your 3-day free trial has started. Add your menu, generate QR codes, and start taking orders.",
                link: "/dashboard",
              });

              // Trigger welcome email via Edge Function
              if (user.email) {
                const welcomeKey = `st.welcome_sent.${user.id}`;
                if (!localStorage.getItem(welcomeKey)) {
                  localStorage.setItem(welcomeKey, "true");
                  supabase.functions.invoke("send-email", {
                    body: {
                      template: "welcome",
                      to: user.email,
                      data: {
                        businessName: created.name,
                        dashboardUrl: window.location.origin + "/dashboard"
                      }
                    }
                  }).then(({ error }) => {
                    if (error) localStorage.removeItem(welcomeKey);
                  }).catch(err => {
                    localStorage.removeItem(welcomeKey);
                    console.error("Failed to send welcome email:", err);
                  });
                }
              }
            } catch { /* noop */ }
          }
        }
      }
      setLoading(false);
    };

    try {
      if (!navigator.onLine) {
        // Quick offline path
        try {
          const cached = localStorage.getItem("pharmiq_cached_restaurant");
          if (cached) {
            setRestaurant(JSON.parse(cached));
            const rRole = sessionStorage.getItem("st.role") || "staff";
            setRole(rRole as any);
            setLoading(false);
            return;
          }
        } catch (e) {}
      }
      await Promise.race([doRefresh(), timeoutPromise]);
    } catch (err) {
      console.warn("[restaurant] refresh timed out or failed:", err);
      // Ensure we have something from cache if timeout happens
      try {
        const cached = localStorage.getItem("pharmiq_cached_restaurant");
        if (cached && !restaurant) {
          setRestaurant(JSON.parse(cached));
          const rRole = sessionStorage.getItem("st.role") || "staff";
          setRole(rRole as any);
        }
      } catch (e) {}
      setLoading(false); // Unblock UI even on failure
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!restaurant?.id) return;
    
    const handleOnline = () => refresh();
    window.addEventListener("online", handleOnline);

    if (!navigator.onLine) {
      return () => window.removeEventListener("online", handleOnline);
    }

    const ch = supabase
      .channel(`restaurant-info-${restaurant.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${restaurant.id}` }, () => {
        if (navigator.onLine) refresh();
      })
      .subscribe();
      
    return () => { 
      supabase.removeChannel(ch); 
      window.removeEventListener("online", handleOnline);
    };
  }, [restaurant?.id, refresh]);

  return <RestCtx.Provider value={{ restaurant, loading, refresh, role }}>{children}</RestCtx.Provider>;
};

export const useRestaurant = () => {
  const c = useContext(RestCtx);
  if (!c) return { restaurant: null, loading: false, refresh: async () => {}, role: null as "owner" | "manager" | "staff" | null };
  return c;
};
