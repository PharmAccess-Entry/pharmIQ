import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { db, OfflineAction } from "@/lib/offline/db";
import { useOfflineSync } from "@/lib/offline/useOfflineSync";
import { Button } from "@/components/ui/button";
import { CloudOff, RefreshCw, CheckCircle2, RotateCcw, AlertTriangle, Database } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function SyncStatus() {
  const { isOnline, isSyncing, queueSize, lastSyncTime, triggerSync } = useOfflineSync();
  const [queue, setQueue] = useState<OfflineAction[]>([]);

  const loadQueue = async () => {
    const items = await db.offline_queue.orderBy("created_at").reverse().toArray();
    setQueue(items);
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [queueSize]); // reload when queueSize changes

  const handleForceSync = async () => {
    if (!isOnline) {
      toast.error("Cannot sync while offline.");
      return;
    }
    await triggerSync();
    await loadQueue();
  };

  const handleClearFailed = async () => {
    const failedItems = queue.filter(q => q.status === 'failed');
    for (const item of failedItems) {
      await db.offline_queue.delete(item.id);
    }
    await loadQueue();
    toast.success("Cleared failed sync items.");
  };

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const failedCount = queue.filter(q => q.status === 'failed').length;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Status</h1>
          <p className="text-muted-foreground">Manage offline data and background synchronization.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Connection</p>
              <div className="flex items-center gap-2 mt-1">
                {!isOnline ? (
                  <><CloudOff className="h-5 w-5 text-destructive" /><span className="font-bold text-destructive text-lg">Offline</span></>
                ) : (
                  <><RefreshCw className="h-5 w-5 text-emerald-500" /><span className="font-bold text-emerald-500 text-lg">Online</span></>
                )}
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Pending Items</p>
            <p className="font-display font-bold text-2xl mt-1">{pendingCount}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">Failed Syncs</p>
            <p className="font-display font-bold text-2xl mt-1 text-destructive">{failedCount}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 bg-secondary/50 p-4 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Local Database: {queue.length} total queue entries</span>
          </div>
          <div className="flex items-center gap-2">
            {failedCount > 0 && (
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleClearFailed}>
                Clear Failed
              </Button>
            )}
            <Button onClick={handleForceSync} disabled={!isOnline || isSyncing || queue.length === 0} className="gap-2">
              <RotateCcw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? "Syncing..." : "Force Sync"}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Error Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    All caught up. No pending data to sync.
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(item.created_at), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {item.type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.status === "pending" && <Badge className="bg-amber-500 hover:bg-amber-600">Pending</Badge>}
                      {item.status === "syncing" && <Badge className="bg-blue-500 hover:bg-blue-600">Syncing</Badge>}
                      {item.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                      {item.status === "conflict" && <Badge className="bg-purple-500">Conflict</Badge>}
                    </TableCell>
                    <TableCell>{item.attempts}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {item.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
