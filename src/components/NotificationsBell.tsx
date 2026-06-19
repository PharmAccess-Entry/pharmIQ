import { Bell, Check, ShoppingBag, HelpCircle, MessageSquareWarning, Lightbulb, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "react-router-dom";
import { useNotifications, type AppNotification } from "@/lib/useNotifications";
import { RealTimeAgo } from "@/components/RealTimeAgo";

const iconFor = (t: string) => {
  switch (t) {
    case "order": return ShoppingBag;
    case "help": return HelpCircle;
    case "complaint": return MessageSquareWarning;
    case "suggestion": return Lightbulb;
    case "unattended": return AlertTriangle;
    case "payment": return CreditCard;
    default: return Bell;
  }
};

const colorFor = (t: string) => {
  switch (t) {
    case "unattended": return "text-destructive bg-destructive/10";
    case "payment": return "text-accent bg-accent-soft";
    case "help":
    case "complaint": return "text-warning bg-warning/10";
    default: return "text-primary bg-primary-soft";
  }
};

export const NotificationsBell = () => {
  const { items, unreadCount, markAllRead, markRead } = useNotifications();
  const top = items.slice(0, 6);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unreadCount} unread`}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold grid place-items-center animate-pulse-soft">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="p-0 w-[min(92vw,22rem)] max-w-[92vw] overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="font-display font-semibold text-sm">Notifications</div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary font-medium inline-flex items-center gap-1 hover:underline">
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {top.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">You're all caught up ✨</div>
          ) : (
            top.map((n) => <Row key={n.id} n={n} onClick={() => markRead(n.id)} />)
          )}
        </div>
        <div className="border-t border-border p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/dashboard/notifications">See all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const Row = ({ n, onClick }: { n: AppNotification; onClick: () => void }) => {
  const Icon = iconFor(n.type);
  const cls = colorFor(n.type);
  const content = (
    <div className={`flex gap-3 px-4 py-3 hover:bg-secondary/50 transition-smooth ${!n.read ? "bg-primary/5" : ""}`}>
      <div className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${cls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-sm truncate">{n.title}</div>
          {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />}
        </div>
        {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
        <div className="text-[10px] text-muted-foreground mt-1"><RealTimeAgo date={n.created_at} /></div>
      </div>
    </div>
  );
  return n.link ? (
    <Link to={n.link} onClick={onClick}>{content}</Link>
  ) : (
    <button onClick={onClick} className="w-full text-left">{content}</button>
  );
};
