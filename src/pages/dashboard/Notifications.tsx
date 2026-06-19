import { DashboardLayout } from "@/components/DashboardLayout";
import { useNotifications } from "@/lib/useNotifications";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { RealTimeAgo } from "@/components/RealTimeAgo";
import { NotificationRowSkeleton } from "@/components/LoadingState";

const Notifications = () => {
  const { items, loading, unreadCount, markAllRead, markRead, hasMore, fetchMore } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const list = useMemo(() => (filter === "unread" ? items.filter((n) => !n.read) : items), [items, filter]);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) fetchMore();
    }, { threshold: 0.1 });
    
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, fetchMore]);

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Bell className="h-7 w-7 text-primary" />Notifications</h1>
          <p className="text-muted-foreground mt-1">{unreadCount} unread · {items.length} total</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllRead}><Check className="h-4 w-4" />Mark all read</Button>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-smooth ${filter === f ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {f === "all" ? "All" : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden divide-y divide-border">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <NotificationRowSkeleton key={i} />)
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No notifications.</div>
        ) : (
          list.map((n) => {
            const inner = (
              <div className={`flex items-start gap-4 p-4 hover:bg-secondary/50 transition-smooth ${!n.read ? "bg-primary/5" : ""}`}>
                <div className={`h-2 w-2 rounded-full mt-2 ${!n.read ? "bg-primary" : "bg-transparent"}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>}
                  <div className="text-xs text-muted-foreground mt-1"><RealTimeAgo date={n.created_at} /> · {n.type}</div>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} to={n.link} onClick={() => markRead(n.id)}>{inner}</Link>
            ) : (
              <button key={n.id} onClick={() => markRead(n.id)} className="w-full text-left">{inner}</button>
            );
          })
        )}
        
        {hasMore && (
          <div ref={loaderRef} className="py-6 flex justify-center text-muted-foreground border-t border-border">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
