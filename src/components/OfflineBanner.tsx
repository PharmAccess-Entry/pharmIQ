import { useEffect, useState } from "react";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { db } from "@/lib/offline/db";
import { CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";

export function OfflineBanner() {
  const isOffline = useOfflineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    const updateCount = async () => {
      try {
        const count = await db.syncQueue.where("status").anyOf("pending", "failed").count();
        setPendingCount(count);
      } catch (err) {
        console.error(err);
      }
    };

    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOffline && pendingCount === 0) {
      // Transition from offline/pending to online/synced
      setJustSynced(true);
      const timer = setTimeout(() => setJustSynced(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, pendingCount]);

  if (!isOffline && pendingCount === 0 && !justSynced) {
    return null;
  }

  if (justSynced) {
    return (
      <div className="bg-emerald-500 text-white text-center text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 z-50 animate-in slide-in-from-top">
        <CheckCircle2 className="h-3.5 w-3.5" />
        All changes synced successfully!
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className="bg-destructive text-destructive-foreground text-center text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 z-50 animate-in slide-in-from-top">
        <CloudOff className="h-3.5 w-3.5 animate-pulse" />
        You are offline. {pendingCount > 0 ? `${pendingCount} changes saved locally.` : "Ready to work offline."}
      </div>
    );
  }

  if (!isOffline && pendingCount > 0) {
    return (
      <div className="bg-amber-500 text-white text-center text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 z-50 animate-in slide-in-from-top">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Connection restored. Syncing {pendingCount} changes...
      </div>
    );
  }

  return null;
}
