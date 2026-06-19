import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { toast } from "sonner";

// ---------- Premium Bell Sound ----------
/**
 * Synthesises a realistic restaurant ding using inharmonic overtones.
 * Inspired by real bell acoustics (1st partial, 2.756× partial, 5.404× partial).
 */
function playBell(fundamental: number, gain = 0.35) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();

    // Resume context if it was suspended (browser autoplay policy)
    if (ctx.state === "suspended") ctx.resume();

    const partials: { ratio: number; gainMul: number }[] = [
      { ratio: 1,     gainMul: 1.0  },  // fundamental
      { ratio: 2.756, gainMul: 0.55 },  // characteristic bell overtone
      { ratio: 5.404, gainMul: 0.22 },  // upper partial
    ];

    partials.forEach(({ ratio, gainMul }) => {
      const osc  = ctx.createOscillator();
      const env  = ctx.createGain();
      osc.connect(env);
      env.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.value = fundamental * ratio;

      const now = ctx.currentTime;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain * gainMul, now + 0.008); // fast attack
      env.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);      // slow bell decay

      osc.start(now);
      osc.stop(now + 2.3);
    });
  } catch {
    /* audio not available */
  }
}

/** Plays a 3-tone ascending chime for new orders */
function playOrderChime() {
  playBell(1318, 0.3);   // E6
  setTimeout(() => playBell(1568, 0.25), 180);  // G6
  setTimeout(() => playBell(2093, 0.22), 360);  // C7  → pleasant ascending "ding-ding-ding"
}

/** Plays a 2-tone chime for staff requests */
function playRequestChime() {
  playBell(1047, 0.28);  // C6
  setTimeout(() => playBell(1319, 0.22), 200);  // E6
}

/** Plays an urgent double-hit for complaints / help */
function playUrgentChime() {
  playBell(880, 0.38);
  setTimeout(() => playBell(880, 0.32), 160);
  setTimeout(() => playBell(1047, 0.26), 380);
}

// ---------- Browser Notification ----------
export function showBrowserNotification(title: string, body: string, tag: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  
  const options = {
    body,
    icon: "/pwa-192x192.png",
    badge: "/favicon.ico",
    tag,
    renotify: true,          // re-alert even if same tag (forces heads-up banner)
    requireInteraction: false, // let it auto-dismiss like a native notification
    silent: false,           // allow system sound/vibration to trigger heads-up
    vibrate: [200, 100, 200], // vibration pattern → signals HIGH priority to Android → triggers heads-up banner
  };

  try {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, options);
      }).catch(() => {
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  } catch {
    /* noop */
  }
}

// ---------- Hook ----------
/**
 * Global real-time alerter — mount once at DashboardLayout level.
 *
 * Handles:
 *  - Premium bell sound on new orders / requests
 *  - Browser-level pop-up notifications (if permission granted)
 *  - Haptic vibration on mobile
 *  - In-app toast alerts
 *
 * Uses a local Set to deduplicate events even if the hook remounts.
 */
export function useGlobalAlerts() {
  const { restaurant } = useRestaurant();
  const rid = restaurant?.id;
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!rid) return;

    const ch = supabase
      .channel(`global-alerts-${rid}`)
      // ---- New order ----
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${rid}`,
        },
        (payload) => {
          const o: any = payload.new;
          if (!o?.id || seen.current.has(o.id)) return;
          seen.current.add(o.id);

          playOrderChime();
          try { (navigator as any).vibrate?.([150, 60, 150]); } catch { /* noop */ }

          const title = `🛎️ New Order · Table ${o.table_number}`;
          const body  = o.short_code ?? "";

          toast.success(title, {
            description: body,
            duration: 8_000,
            action: {
              label: "View",
              onClick: () => window.location.assign("/dashboard/orders"),
            },
          });
          showBrowserNotification(title, body, `order-${o.id}`);
        }
      )
      // ---- Customer request (waiter, help, complaint, suggestion) ----
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer_requests",
          filter: `restaurant_id=eq.${rid}`,
        },
        (payload) => {
          const r: any = payload.new;
          if (!r?.id || seen.current.has(r.id)) return;
          seen.current.add(r.id);

          const isUrgent = r.type === "complaint" || r.type === "help";
          if (isUrgent) {
            playUrgentChime();
          } else {
            playRequestChime();
          }
          try { (navigator as any).vibrate?.([200, 80, 200, 80, 200]); } catch { /* noop */ }

          const typeLabel = String(r.type ?? "request").toUpperCase();
          const emoji     = r.type === "waiter" ? "🛎️" : r.type === "complaint" ? "⚠️" : r.type === "help" ? "🆘" : "💬";
          const title     = `${emoji} ${typeLabel} · Table ${r.table_number}`;
          const body      = r.message ?? "";

          if (isUrgent) {
            toast.error(title, {
              description: body,
              duration: 12_000,
              action: {
                label: "View",
                onClick: () => window.location.assign("/dashboard/orders"),
              },
            });
          } else {
            toast.warning(title, {
              description: body,
              duration: 10_000,
              action: {
                label: "View",
                onClick: () => window.location.assign("/dashboard/orders"),
              },
            });
          }
          showBrowserNotification(title, body, `req-${r.id}`);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [rid]);
}

// ============================================================
// Inventory Stock Alert Hook
// Mount inside DashboardLayout so owners/managers get real-time
// popup alerts when stock runs low or hits zero.
// ============================================================
export function useInventoryAlerts(role: string | null) {
  const { restaurant } = useRestaurant();
  const rid = restaurant?.id;
  const seen = useRef<Set<string>>(new Set());
  const [activeAlert, setActiveAlert] = useState<any | null>(null);

  useEffect(() => {
    // Only alert owners and managers
    if (!rid || (role !== "owner" && role !== "manager")) return;

    const ch = supabase
      .channel(`inventory-alerts-${rid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `restaurant_id=eq.${rid}`,
        },
        (payload) => {
          const n: any = payload.new;
          if (!n?.id || seen.current.has(n.id)) return;
          if (n.type !== "stock_out" && n.type !== "low_stock") return;
          seen.current.add(n.id);

          const isOut = n.type === "stock_out";

          // Play an urgent chime for stock-out, softer for low-stock
          if (isOut) {
            playUrgentChime();
            try { (navigator as any).vibrate?.([300, 100, 300]); } catch { /* noop */ }
          } else {
            playRequestChime();
          }

          if (isOut) {
            toast.error(n.title, {
              description: n.body ?? undefined,
              duration: 15_000,
              action: {
                label: "View Inventory",
                onClick: () => window.location.assign("/dashboard/inventory"),
              },
            });
            // Also trigger a popup modal for stock outs
            setActiveAlert(n);
          } else {
            toast.warning(n.title, {
              description: n.body ?? undefined,
              duration: 12_000,
              action: {
                label: "View Inventory",
                onClick: () => window.location.assign("/dashboard/inventory"),
              },
            });
          }

          // Show browser push notification
          showBrowserNotification(n.title, n.body ?? "", `inv-${n.id}`);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [rid, role]);

  return { 
    activeAlert, 
    clearAlert: () => setActiveAlert(null) 
  };
}
