import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { toast } from "sonner";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function useNotifications() {
   const { restaurant } = useRestaurant();
  const rid = restaurant?.id;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

   const load = useCallback(async () => {
    if (!rid) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    const { data, count } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false })
      .range(0, PAGE_SIZE - 1);
      
    setItems((data as AppNotification[]) || []);
    setPage(0);
    setHasMore(count !== null ? count > PAGE_SIZE : false);
    setLoading(false);
  }, [rid]);

  const fetchMore = useCallback(async () => {
    if (!rid || !hasMore || !navigator.onLine) return;
    const { data, count } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false })
      .range((page + 1) * PAGE_SIZE, (page + 2) * PAGE_SIZE - 1);
    
    if (data && data.length > 0) {
      setItems((prev) => {
        const existingIds = new Set(prev.map(r => r.id));
        const newItems = (data as AppNotification[]).filter((r) => !existingIds.has(r.id));
        return [...prev, ...newItems];
      });
      setPage(p => p + 1);
      if (count !== null) setHasMore((page + 2) * PAGE_SIZE < count);
    } else {
      setHasMore(false);
    }
  }, [rid, hasMore, page]);

   useEffect(() => {
    if (!rid) return;
    load();
    
    const handleOnline = () => {
      load();
    };
    window.addEventListener("online", handleOnline);

    if (!navigator.onLine) {
      return () => {
        window.removeEventListener("online", handleOnline);
      };
    }

    const ch = supabase
      .channel(`notifications-feed-${rid}-${Math.random().toString(36).slice(2, 9)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `restaurant_id=eq.${rid}` },
        () => {
          if (navigator.onLine) load();
          try {
            // Play a notification sound
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log('Audio autoplay blocked until user interaction', e));
          } catch(e) {}
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `restaurant_id=eq.${rid}` },
        () => { if (navigator.onLine) load(); }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `restaurant_id=eq.${rid}` },
        () => { if (navigator.onLine) load(); }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("online", handleOnline);
    };
  }, [load, rid]);

  const unreadCount = items.filter((n) => !n.read).length;

   const markAllRead = async () => {
    if (!rid) return;
    // Optimistic update
    const prev = [...items];
    setItems(items.map(n => ({ ...n, read: true })));
    
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("restaurant_id", rid)
      .eq("read", false);
      
    if (error) {
      setItems(prev);
      toast.error("Could not update notifications");
    }
  };

  const markRead = async (id: string) => {
    // Optimistic update
    const prev = [...items];
    setItems(items.map(n => n.id === id ? { ...n, read: true } : n));

    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    
    if (error) {
      setItems(prev);
      toast.error("Could not mark as read");
    }
  };

  return { items, loading, hasMore, fetchMore, unreadCount, markAllRead, markRead, reload: load };
}

export async function createNotification(input: {
  restaurantId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const { error } = await supabase.from("notifications").insert({
    restaurant_id: input.restaurantId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
  
  if (error) console.error("Notification Error:", error);
  
  // Best-effort push notification delivery
  supabase.functions.invoke("send-push", {
    body: {
      restaurantId: input.restaurantId,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    }
  }).catch(() => { /* ignore */ });
}
