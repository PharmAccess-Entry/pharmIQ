import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getFcmToken, onForegroundMessage } from "./firebase";
import { toast } from "sonner";

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

/**
 * Manages FCM push notification permission and token subscription.
 * When permission is granted, saves the FCM token to Supabase.
 */
export function usePushPermission(restaurantId?: string) {
  const supported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator;

  const [permission, setPermission] = useState<NotifPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window))
      return "unsupported";
    return Notification.permission as NotifPermission;
  });

  // Subscribe the current user's FCM token to the restaurant
  const subscribeToPush = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const token = await getFcmToken();
      if (!token) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          restaurant_id: restaurantId,
          fcm_token: token,
          // keep legacy subscription field compatible
          subscription: { endpoint: "fcm", keys: {} },
        },
        { onConflict: "user_id" }
      );

      console.log("[PharmIQ] FCM token saved:", token.slice(0, 20) + "…");
    } catch (e) {
      console.warn("Push subscribe failed:", e);
    }
  }, [restaurantId]);

  // Auto-subscribe if already granted on mount
  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission as NotifPermission);
    if (Notification.permission === "granted") {
      subscribeToPush();
    }
  }, [supported, subscribeToPush]);

  // Listen for foreground messages and show a toast
  useEffect(() => {
    if (!supported || Notification.permission !== "granted") return;
    let unsub: (() => void) | undefined;
    onForegroundMessage(({ title, body, link }) => {
      toast(title || "PharmIQ", {
        description: body,
        action: link
          ? {
              label: "View",
              onClick: () => (window.location.href = link),
            }
          : undefined,
        duration: 8000,
      });
    }).then((fn) => {
      unsub = fn;
    });
    return () => unsub?.();
  }, [supported, permission]);

  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (!supported) return "unsupported";
    try {
      const result = await Notification.requestPermission();
      const perm = result as NotifPermission;
      setPermission(perm);
      if (perm === "granted") {
        await subscribeToPush();
      }
      return perm;
    } catch {
      return "denied";
    }
  }, [supported, subscribeToPush]);

  return { permission, requestPermission, supported };
}
