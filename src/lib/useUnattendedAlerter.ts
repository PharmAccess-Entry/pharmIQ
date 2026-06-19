import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { createNotification } from "@/lib/useNotifications";
import { toast } from "sonner";

/**
 * Polls every 30s for pending orders older than 2 min that haven't been
 * acknowledged yet. Marks them as acknowledged + creates a notification +
 * shows a toast.
 */
export function useUnattendedAlerter() {
  const { restaurant } = useRestaurant();
  const rid = restaurant?.id;
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!rid) return;
    let cancelled = false;
    const tick = async () => {
      const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("id, short_code, table_number, created_at, acknowledged, status")
        .eq("restaurant_id", rid)
        .eq("status", "pending")
        .eq("acknowledged", false)
        .lte("created_at", cutoff);

      if (cancelled || !data) return;
      for (const o of data) {
        if (seen.current.has(o.id)) continue;
        seen.current.add(o.id);
        await supabase.from("orders").update({ acknowledged: true }).eq("id", o.id);
        await createNotification({
          restaurantId: rid,
          type: "unattended",
          title: `Order unattended · Table ${o.table_number}`,
          body: `${o.short_code} has been pending for over 2 minutes`,
          link: "/dashboard/orders",
        });
        toast.warning(`⚠️ ${o.short_code} unattended`, { description: `Table ${o.table_number} · pending > 2 min` });
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [rid]);
}
