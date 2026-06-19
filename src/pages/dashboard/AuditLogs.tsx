import { DashboardLayout } from "@/components/DashboardLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { format } from "date-fns";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    if (!restaurant?.id) return;
    setLoading(true);
    const { data: auditData, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    let enrichedLogs = auditData as AuditLog[];
    
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
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [restaurant?.id]);

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" /> Audit Logs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">System-wide tracking of critical actions.</p>
        </div>
        <Button onClick={fetchLogs} variant="outline" className="bg-card">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="bg-card border border-border shadow-soft rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
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
                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate" title={JSON.stringify(log.details)}>
                      {log.details ? JSON.stringify(log.details) : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    {loading ? "Loading logs..." : "No audit logs found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
