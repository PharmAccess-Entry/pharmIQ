import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, UtensilsCrossed, QrCode, ClipboardList, Settings, Menu, LogOut, Bell, Calendar, Monitor, MessageSquareText, HelpCircle, Compass, TrendingUp, ShoppingBag, Package, AlertTriangle, ChevronDown, Pill, User, Truck, FileText, ShieldAlert, Users, Briefcase, Receipt, ListChecks, RefreshCw, Printer, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ThemeToggle } from "@/lib/theme";
import { Logo } from "@/components/Logo";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useGlobalAlerts, useInventoryAlerts } from "@/lib/useGlobalAlerts";
import { usePushPermission } from "@/lib/usePushPermission";
import { useAuth } from "@/lib/auth";
import { useRestaurant, initialsFromName, trialDaysLeft } from "@/lib/restaurant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { AudioUnlockBanner } from "@/components/AudioUnlockBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SystemMonitor } from "@/components/dashboard/SystemMonitor";

const sidebarNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/dashboard/products", label: "Products", icon: Pill },
  { to: "/dashboard/inventory", label: "Inventory", icon: Package },
  { to: "/dashboard/pos", label: "Cashier / POS", icon: ShoppingBag },
  { to: "/dashboard/sales", label: "Sales", icon: ClipboardList },
  {
    label: "Management",
    icon: Settings,
    subItems: [
      { name: "Patients", to: "/dashboard/patients", icon: Users },
      { name: "Suppliers", to: "/dashboard/suppliers", icon: Briefcase },
      { name: "Purchases", to: "/dashboard/purchases", icon: Truck },
      { name: "Shifts", to: "/dashboard/shifts", icon: Clock },
      { name: "Reconciliation", to: "/dashboard/reconciliation", icon: ListChecks },
      { name: "Expenses", to: "/dashboard/expenses", icon: Receipt },
      { name: "Audit Logs", to: "/dashboard/audit", icon: ListChecks },
      { name: "Reports & Printing", to: "/dashboard/reports", icon: Printer },
      { name: "Sync Status", to: "/dashboard/sync", icon: RefreshCw },
    ],
  },
  { to: "/dashboard/analytics", label: "Analytics", icon: TrendingUp },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

const bottomNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/dashboard/pos", label: "POS", icon: ShoppingBag },
  { to: "/dashboard/sales", label: "Sales", icon: ClipboardList },
  { to: "/dashboard/analytics", label: "Analytics", icon: TrendingUp },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [expandedNav, setExpandedNav] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { restaurant, refresh, role } = useRestaurant();
  useGlobalAlerts();
  const { activeAlert: stockAlert, clearAlert: clearStockAlert } = useInventoryAlerts(role);

  const { permission, requestPermission } = usePushPermission(restaurant?.id);
  const isOffline = useOfflineStatus();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const STAFF_HIDDEN_PATHS = ["/dashboard/settings", "/dashboard/analytics", "/dashboard/menu", "/dashboard/qr", "/dashboard/events", "/dashboard/notifications", "/dashboard/inventory", "/dashboard/suppliers", "/dashboard/purchases", "/dashboard/expenses", "/dashboard/audit"];
  const MANAGER_HIDDEN_PATHS = ["/dashboard/settings", "/dashboard/audit"];
  const filterNav = (nav: any[]) => nav.filter(item => {
    if (role === 'staff' && STAFF_HIDDEN_PATHS.includes(item.to)) return false;
    if (role === 'manager' && MANAGER_HIDDEN_PATHS.includes(item.to)) return false;
    return true;
  });

  const filteredBottomNav = filterNav(bottomNav);
  const filteredSidebarNav = filterNav(sidebarNav);
  
  const name = restaurant?.name || "Your business";
  const status = restaurant?.subscription_status ?? "trial";
  const trialLeft = trialDaysLeft(restaurant?.trial_ends_at ?? null);
  const planLabel = status === "trial"
      ? `Trial · ${trialLeft}d left`
      : restaurant?.subscription_plan
        ? `${restaurant.subscription_plan} plan`
        : "No active plan";

  const onLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const Sidebar = (
    <aside className="w-64 shrink-0 bg-card border-r border-border flex flex-col h-full overflow-hidden">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Logo size="md" />
      </div>
      <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
        {filteredSidebarNav.map((item) => {
        if (item.subItems) {
            const groupKey = item.label; // use label as unique key since no `to`
            const isActiveParent = item.subItems.some((sub: any) => location.pathname.startsWith(sub.to));
            const isExpanded = expandedNav === groupKey || (expandedNav === null && isActiveParent);
            return (
              <div key={groupKey} className="space-y-1">
                <button
                  onClick={() => setExpandedNav(isExpanded ? "" : groupKey)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-smooth ${
                    isActiveParent ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : "opacity-50"}`} />
                </button>
                {isExpanded && (
                  <div className="pl-9 space-y-1 animate-in slide-in-from-top-2">
                    {item.subItems.map((sub: any) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        end={sub.end}
                        onClick={() => setOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-smooth ${
                            isActive ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`
                        }
                      >
                        {sub.icon && <sub.icon className="h-3.5 w-3.5 shrink-0" />}
                        {sub.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-smooth ${
                  isActive ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          );
        })}
        <NavLink
          to="/dashboard/support"
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-smooth ${
              isActive ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`
          }
        >
          <HelpCircle className="h-4 w-4" />
          <span className="flex-1">Support</span>
        </NavLink>
      </nav>
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-accent-soft text-accent grid place-items-center font-display font-semibold overflow-hidden">
            {restaurant?.logo_url ? <img src={restaurant.logo_url} alt="" className="w-full h-full object-cover" /> : initialsFromName(name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{planLabel}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} className="w-full justify-start text-muted-foreground">
          <LogOut className="h-4 w-4 mr-2" />Log out
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      <OfflineBanner />
      
      {/* Global Stock Alert Modal */}
      <Dialog open={!!stockAlert} onOpenChange={(open) => { if (!open) clearStockAlert(); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-destructive/10 text-destructive rounded-full grid place-items-center mb-4">
              <AlertTriangle className="h-6 w-6 animate-pulse" />
            </div>
            <DialogTitle className="text-center text-xl">{stockAlert?.title}</DialogTitle>
            <DialogDescription className="text-center pt-2 text-base">
              {stockAlert?.body}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={clearStockAlert} className="flex-1">
              Dismiss
            </Button>
            <Button onClick={() => { clearStockAlert(); navigate("/dashboard/inventory"); }} className="flex-1" variant="destructive">
              Restock Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="flex flex-1 w-full min-h-0">
        <div className="hidden lg:block sticky top-0 h-screen">{Sidebar}</div>

      {open && (
        <>
          <div className="fixed inset-0 bg-foreground/40 z-40 lg:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden animate-slide-up">{Sidebar}</div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <button className="lg:hidden p-2" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block text-sm text-muted-foreground">
            {sidebarNav.find((n) => location.pathname === n.to || (n.to !== "/dashboard" && location.pathname.startsWith(n.to)))?.label || "Dashboard"}
          </div>
          <div className="flex items-center gap-3">
            <SystemMonitor />
            <div className="flex items-center gap-1.5 border-l border-border pl-3">
              <ThemeToggle />
              <NotificationsBell />
            </div>
          </div>
        </header>
        <AudioUnlockBanner />
        {permission === "default" && (
          <div className="bg-primary/10 text-primary border-b border-primary/20 px-4 py-3 flex items-center justify-between text-sm">
            <div className="font-medium">Please allow notifications to receive new order alerts.</div>
            <Button size="sm" onClick={requestPermission} className="h-8 rounded-full px-4 text-xs font-bold">
              Allow
            </Button>
          </div>
        )}
        <main className="flex-1 p-4 lg:p-8 pb-32 lg:pb-8 animate-fade-in overflow-x-hidden">{children}</main>

        {/* Mobile bottom nav */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none">
          <nav className="pointer-events-auto mx-auto max-w-md glass border border-border/60 shadow-elevated rounded-2xl flex justify-around p-1.5">
            {filteredBottomNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex-1 flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl text-[10px] font-semibold transition-smooth ${
                    isActive
                      ? "bg-gradient-hero text-primary-foreground shadow-glow scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      </div>
    </div>
  );
};
