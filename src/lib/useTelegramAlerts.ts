import { useOfflineQueue } from '@/lib/offline/useOfflineQueue';
import { useAuth } from '@/lib/auth';
import { useRestaurant } from '@/lib/restaurant';

export function useTelegramAlerts() {
  const { queueAction } = useOfflineQueue();
  const { user } = useAuth();
  const { restaurant, role } = useRestaurant();

  const sendAlert = async (title: string, details: string, prefKey?: string) => {
    // Only send if telegram is enabled and connected
    if (!restaurant?.telegram_enabled || !restaurant?.telegram_chat_id) return;
    
    // Check if preference is explicitly disabled
    if (prefKey && restaurant.telegram_notify_prefs) {
      if (restaurant.telegram_notify_prefs[prefKey] === false) {
        return; // User disabled this type of alert
      }
    }
    
    const email = user?.email || "Unknown User";
    const roleName = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Staff";
    const userName = user?.user_metadata?.full_name || email;
    
    const msg = `
${title}

👤 User: ${userName}
✉️ Email: ${email}
💼 Role: ${roleName}

━━━━━━━━━━━━━━━
${details}
`.trim();

    try {
      await queueAction(restaurant.id, "TELEGRAM_NOTIFY", { restaurant_id: restaurant.id, message: msg });
    } catch (err) {
      console.error("Failed to queue telegram alert", err);
    }
  };

  return { sendAlert };
}
