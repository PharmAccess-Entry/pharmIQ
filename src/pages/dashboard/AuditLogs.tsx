import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { format } from "date-fns";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUp, ArrowDown, WifiOff } from "lucide-react";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { Skeleton } from "@/components/ui/skeleton";

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
  user_id: string | null;
  user_name?: string;
};

export default function AuditLogs() {
  const { restaurant } = useRestaurant();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isOffline = useOfflineStatus();

  const fetchLogs = async () => {
    if (!restaurant?.id) return;
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: auditData, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Audit Logs Error:", error);
      }

      let enrichedLogs = (auditData as AuditLog[]) || [];
      
      if (enrichedLogs.length > 0) {
        const userIds = Array.from(new Set(enrichedLogs.map(l => l.user_id).filter(Boolean))) as string[];
        if (userIds.length > 0) {
          const { data: users } = await supabase.rpc("get_users_by_ids", { user_ids: userIds });
          if (users) {
            enrichedLogs = enrichedLogs.map(log => {
              const u = users.find((u: any) => u.id === log.user_id);
              return { ...log, user_name: u?.full_name || u?.email || "Unknown User" };
            });
          }
        }
      }

      setLogs(enrichedLogs);

      // Fetch Inventory Ledger (fixed to not query non-existent profiles table)
      const { data: invData, error: invError } = await supabase
        .from("inventory_logs")
        .select("*, menu_items(name)")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (invError) {
        console.error("Inventory Logs Error:", invError);
      }

      let enrichedInvLogs = invData || [];
      
      if (enrichedInvLogs.length > 0) {
        const invUserIds = Array.from(new Set(enrichedInvLogs.map(l => l.user_id).filter(Boolean))) as string[];
        if (invUserIds.length > 0) {
          const { data: invUsers } = await supabase.rpc("get_users_by_ids", { user_ids: invUserIds });
          if (invUsers) {
            enrichedInvLogs = enrichedInvLogs.map(log => {
              const u = invUsers.find((u: any) => u.id === log.user_id);
              return { ...log, user_name: u?.full_name || u?.email || "Unknown User" };
            });
          }
        }
      }

      setInventoryLogs(enrichedInvLogs);
    } catch (e) {
      console.error("Unhandled error fetching logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [restaurant?.id]);

  return (
    <DashboardLayout>
      {isOffline && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You're offline — Audit logs cannot be loaded without an active connection.</span>
        </div>
      )}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" /> Audit Logs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">System-wide tracking of critical actions.</p>
        </div>
        <Button onClick={fetchLogs} variant="outline" className="bg-card" disabled={isOffline} title={isOffline ? "Online only" : undefined}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="inventory">Inventory Ledger</TabsTrigger>
          <TabsTrigger value="system">System Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-0">
          <div className="bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                <thead className="bg-muted/50 text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Movement</th>
                    <th className="px-6 py-4">Quantity</th>
                    <th className="px-6 py-4">Reason & Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inventoryLogs.length > 0 ? (
                    inventoryLogs.map((log) => {
                      const isPositive = log.change_qty > 0;
                      return (
                        <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                            {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {log.menu_items?.name || "Unknown"}
                          </td>
                          <td className="px-6 py-4 font-medium">
                            {log.user_name || "System"}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                              {log.movement_type || "Legacy"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-bold flex items-center gap-1 ${isPositive ? 'text-emerald-500' : 'text-destructive'}`}>
                              {isPositive ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                              {Math.abs(log.change_qty)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium">{log.reason || "—"}</div>
                            {log.note && <div className="text-xs text-muted-foreground truncate max-w-xs">{log.note}</div>}
                          </td>
                        </tr>
                      );
                    })
                  ) : loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="px-6 py-4"><Skeleton className="h-4 w-32 rounded-md" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-40 rounded-md" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-24 rounded-md" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-12 rounded-md" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-48 rounded-md" /></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        No inventory movements found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="system" className="mt-0">
          <div className="bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
                <thead className="bg-muted/50 text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.length > 0 ? (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                          {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                        </td>
                        <td className="px-6 py-4 font-medium">
                          {log.user_name || "System"}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          {log.details && typeof log.details === "object" ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(log.details).slice(0, 4).map(([k, v]) => (
                                <span key={k} className="inline-flex items-center gap-1 text-[11px] bg-secondary border border-border rounded-md px-1.5 py-0.5 text-foreground">
                                  <span className="text-muted-foreground font-medium capitalize">{k.replace(/_/g, " ")}:</span>
                                  <span className="font-semibold truncate max-w-[80px]" title={String(v)}>{String(v)}</span>
                                </span>
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))
                  ) : loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="px-6 py-4"><Skeleton className="h-4 w-32 rounded-md" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-24 rounded-md" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-5 w-28 rounded-full" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-6 w-full max-w-[200px] rounded-md" /></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                        No audit logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
