import { useOfflineSync } from "@/lib/offline/useOfflineSync";
import { Cloud, CloudOff, RefreshCw, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function SystemMonitor() {
  const { isOnline, isSyncing, queueSize, lastSyncTime } = useOfflineSync();

  return (
    <div className="flex items-center space-x-4 bg-secondary/50 px-3 py-1.5 rounded-full border border-border/50 text-xs shadow-sm">
      <div className="flex items-center space-x-1.5">
        {isOnline ? (
          <Cloud className="w-4 h-4 text-emerald-500" />
        ) : (
          <CloudOff className="w-4 h-4 text-destructive" />
        )}
        <span className="font-medium hidden sm:inline">
          {isOnline ? "Online" : "Offline Mode"}
        </span>
      </div>

      <div className="w-px h-3 bg-border" />

      <div className="flex items-center space-x-1.5">
        {isSyncing ? (
          <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
        ) : queueSize > 0 ? (
          <AlertCircle className="w-4 h-4 text-amber-500" />
        ) : (
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="font-medium">
          {queueSize > 0 ? `${queueSize} pending` : "Synced"}
        </span>
      </div>

      {lastSyncTime && (
        <>
          <div className="w-px h-3 bg-border hidden sm:block" />
          <div className="text-muted-foreground hidden sm:block">
            Last sync: {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
          </div>
        </>
      )}
    </div>
  );
}
