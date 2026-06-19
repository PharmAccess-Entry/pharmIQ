import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState, useCallback, useRef, memo } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Plus, Minus, ShoppingBag, ShoppingCart, Bell, HelpCircle, MessageSquareWarning,
  Check, UtensilsCrossed, ShoppingBasket, Shuffle, ArrowRight, Search, X, Lightbulb,
  BookOpen, Send, Upload, Copy, Trash2, MessageCircle, Loader2, CheckCircle2, Star, BellRing, NavigationOff, MessageSquareText, ChevronDown, ChevronUp, LogOut
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandedLoader, MenuCardSkeleton, CategoryBubbleSkeleton } from "@/components/LoadingState";
// rid resolved at runtime from ?r= param (see below)
import { formatNaira, timeAgo } from "@/lib/format";
import { RealTimeAgo } from "@/components/RealTimeAgo";
import { createNotification } from "@/lib/useNotifications";
import { cn } from "@/lib/utils";
import { sanitizeInput } from "@/lib/sanitize";
import { useOfflineStatus } from "@/lib/useOfflineStatus";
import { ThemeToggle } from "@/lib/theme";
import { useIsMobile } from "@/hooks/use-mobile";
import imageCompression from "browser-image-compression";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image: string | null;
  available: boolean;
  options: string[] | null;
  track_inventory: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  auto_hide_out_of_stock: boolean;
};

type Intent = "dine-in" | "takeaway" | "mixed";
type ItemIntent = "eat-here" | "take-away";

type CartItem = MenuItem & { qty: number; itemIntent?: ItemIntent; selectedOption?: string; notes?: string; bundleId?: string };

type Message = { id: string; sender: string; kind: string; body: string | null; payload: any; created_at: string; read_at: string | null };

// ---------- Food Pairing Helpers (module-level so ItemSheet can access them) ----------
const isSwallow = (m: MenuItem) => m.category === "Swallow" || /swallow|pounded yam|fufu|amala|eba|garri|semo|wheat|tuwo/i.test(m.name);
const isPlainRice = (m: MenuItem) => /white rice|plain rice|boiled rice/i.test(m.name);
const isJollofStyle = (m: MenuItem) => /jollof|fried rice|ofada|coconut rice|native rice/i.test(m.name);
const isSoup = (m: MenuItem) => m.category === "Soup" || /soup/i.test(m.name);
const isStew = (m: MenuItem) => /stew|sauce/i.test(m.category) || /stew|sauce/i.test(m.name);
const isMeat = (m: MenuItem) => m.category === "Proteins" || m.category === "Meat" || /meat|protein|chicken|turkey|fish|goat|beef|ponmo|kpomo|assorted/i.test(m.name);
const isDrink = (m: MenuItem) => m.category === "Drinks" || /drink|beverage|juice|water|soft drink|malt/i.test(m.name);
const isLocalDish = (m: MenuItem) => m.category === "Local Dishes";
const isPastries = (m: MenuItem) => m.category === "Pastries";
const isIntercontinental = (m: MenuItem) => m.category === "Intercontinental";
const isSnack = (m: MenuItem) => m.category === "Pastries" || /snack|pie|roll|puff|chin|samosa|doughnut|shawarma|burger|hot dog|sandwich/i.test(m.category) || /snack/i.test(m.name);

const MenuItemCard = memo(({ item, isEvent, onClick }: { item: MenuItem; isEvent: boolean; onClick: () => void }) => {
  const isOutOfStock = item.track_inventory && item.stock_quantity <= 0;
  return (
    <button
      onClick={onClick}
      disabled={!item.available || isOutOfStock}
      className={`group relative overflow-hidden bg-card hover:bg-accent/5 border border-border rounded-2xl transition-all duration-300 hover:border-primary/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] active:scale-[0.98] cursor-pointer flex gap-3 p-3.5 text-left w-full ${(!item.available || isOutOfStock) ? "opacity-50 grayscale" : ""}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-secondary shadow-inner relative z-10 group-hover:shadow-md transition-shadow">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" loading="lazy" />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground relative z-10"><UtensilsCrossed className="h-7 w-7" /></div>
        )}
        {(!item.available || isOutOfStock) && (
          <div className="absolute inset-0 bg-background/95 grid place-items-center z-20">
            <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest">{isOutOfStock ? "Out of Stock" : "Sold Out"}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">{item.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">{item.description}</p>
        </div>
        <div className="flex items-center justify-between mt-2">
          {!isEvent && (
            <span className="font-bold text-base text-primary">
              {Number(item.price) === 0 && /soup|stew|sauce/i.test(item.category) ? "Included ✓" : formatNaira(Number(item.price))}
            </span>
          )}
          {item.available && !isOutOfStock && (
            <div className="h-7 w-7 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground grid place-items-center shadow-md shadow-primary/20 transition-all duration-300 group-hover:scale-105 active:scale-95">
              <Plus className="h-4 w-4 stroke-[3]" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

const FeaturedMenuItemCard = memo(({ item, isEvent, onClick }: { item: MenuItem; isEvent: boolean; onClick: () => void }) => {
  const isOutOfStock = item.track_inventory && item.stock_quantity <= 0;
  return (
    <button
      onClick={onClick}
      disabled={!item.available || isOutOfStock}
      className={`group relative overflow-hidden bg-card hover:bg-accent/5 border border-border rounded-2xl transition-all duration-300 hover:border-primary/30 hover:shadow-md active:scale-[0.98] cursor-pointer flex flex-col text-left w-full h-full ${(!item.available || isOutOfStock) ? "opacity-50 grayscale" : ""}`}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      <div className="w-full aspect-square bg-secondary relative overflow-hidden z-10">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" loading="lazy" />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground relative z-10 bg-secondary"><UtensilsCrossed className="h-8 w-8" /></div>
        )}
        {(!item.available || isOutOfStock) && (
          <div className="absolute inset-0 bg-background/95 grid place-items-center z-20">
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{isOutOfStock ? "Out of Stock" : "Sold Out"}</span>
          </div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col justify-between w-full">
        <div>
          <h3 className="font-semibold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">{item.name}</h3>
          <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 mt-1 mb-2 leading-relaxed">{item.description}</p>
        </div>
        <div className="flex items-center justify-between mt-auto">
          {!isEvent && (
            <span className="font-bold text-sm text-primary">
              {Number(item.price) === 0 && /soup|stew|sauce/i.test(item.category) ? "Included ✓" : formatNaira(Number(item.price))}
            </span>
          )}
          {item.available && !isOutOfStock && (
            <div className="h-7 w-7 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground grid place-items-center shadow-md shadow-primary/20 transition-all duration-300 group-hover:scale-105 active:scale-95 ml-auto">
              <Plus className="h-4 w-4 stroke-[3]" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

const ResponsiveModal = ({ 
  open, 
  onOpenChange, 
  children, 
  title, 
  description, 
  className,
  side = "bottom"
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  children: React.ReactNode; 
  title?: string;
  description?: string;
  className?: string;
  side?: "bottom" | "top" | "left" | "right";
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side={side} className={cn("overflow-y-auto", className)}>
          <SheetHeader className="sr-only">
            <SheetTitle>{title || "Modal"}</SheetTitle>
            <SheetDescription>{description || "Responsive modal content"}</SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[85vh] flex flex-col overflow-hidden p-0", className)}>
        <DialogHeader className="sr-only">
          <DialogTitle>{title || "Modal"}</DialogTitle>
          <DialogDescription>{description || "Responsive modal content"}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const QrMenu = () => {
  // ---------- Menu state (from DB) ----------
  const [restaurant, setRestaurant] = useState<any>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categoryFlows, setCategoryFlows] = useState<any[]>([]);
  const [rid, setRid] = useState<string>("");
  const [resolving, setResolving] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [invalidMessage, setInvalidMessage] = useState("This QR code is not linked to a restaurant. Please scan a valid table QR or ask a staff member for help.");
  const [eventData, setEventData] = useState<any>(null);
  const isEvent = restaurant?.business_type === "event";
  const isPaused = restaurant !== null && restaurant?.is_accepting_orders === false;
  const isSuspended = restaurant !== null && (restaurant?.subscription_status === 'suspended');

  const { table: rawTable } = useParams();
  const [searchParams] = useSearchParams();
  const table = rawTable && rawTable !== ":table" ? rawTable : "1";
  const ridParam = searchParams.get("r");
  const isOffline = useOfflineStatus();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Session Expiry (3 hours)
  useEffect(() => {
    if (!rid || !table) return;
    const sessionKey = `smarttable.session.start.${rid}.${table}`;
    const startedAt = localStorage.getItem(sessionKey);
    if (startedAt) {
      const elapsed = Date.now() - parseInt(startedAt);
      if (elapsed > 3 * 60 * 60 * 1000) {
        localStorage.removeItem(sessionKey);
        localStorage.removeItem(`smarttable.order.${rid}.${table}`);
        toast.error("Table session expired. Please join again.");
        navigate('/join');
      }
    } else {
      localStorage.setItem(sessionKey, Date.now().toString());
    }
  }, [rid, table, navigate]);

  // ---------- Geofencing ----------
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if (!restaurant?.geofencing_enabled || !restaurant?.latitude || !restaurant?.longitude) {
      setCheckingLocation(false);
      setIsOutOfRange(false);
      return;
    }

    setCheckingLocation(true);
    if (!navigator.geolocation) {
      toast.error("Location is required for ordering at this business.");
      setIsOutOfRange(true);
      setCheckingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = calculateDistance(
          pos.coords.latitude, 
          pos.coords.longitude, 
          restaurant.latitude!, 
          restaurant.longitude!
        );
        setDistance(Math.round(d));
        if (d > (restaurant.geofencing_radius || 300)) {
          setIsOutOfRange(true);
        } else {
          setIsOutOfRange(false);
        }
        setCheckingLocation(false);
      },
      (err) => {
        console.error("Location error", err);
        toast.error("Please enable location to place your order.");
        setIsOutOfRange(true);
        setCheckingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [restaurant]);

  const [customerSessionId, setCustomerSessionId] = useState<string>("");
  const [transactionId, setTransactionId] = useState<string>(() => crypto.randomUUID());
  const [clearTrayConfirmOpen, setClearTrayConfirmOpen] = useState(false);
  const [guestName, setGuestName] = useState(() => localStorage.getItem("smarttable_guest_name") || "");

  useEffect(() => {
    let sid = localStorage.getItem("smarttable_session_id");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("smarttable_session_id", sid);
    }
    setCustomerSessionId(sid);

    // Suppress PWA install prompt warning
    const handler = (e: any) => e.preventDefault();
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Resolve rid: ?r= wins; otherwise, if owner is logged in, preview their restaurant.
      let resolved: string | null = ridParam;
      let isStaffOrOwner = false;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check if owner
        const { data: own } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).maybeSingle();
        if (own?.id) {
          if (!resolved) resolved = own.id;
          if (resolved === own.id) isStaffOrOwner = true;
        } else {
          // Check if staff
          const { data: role } = await supabase.from("user_roles").select("restaurant_id").eq("user_id", user.id).maybeSingle();
          if (role?.restaurant_id) {
            if (!resolved) resolved = role.restaurant_id;
            if (resolved === role.restaurant_id) isStaffOrOwner = true;
          }
        }
      }
      if (!resolved) {
        if (!cancelled) { setInvalid(true); setResolving(false); }
        return;
      }
      // Verify the restaurant exists
      const { data: r } = await supabase.from("restaurants").select("*").eq("id", resolved).maybeSingle();
      if (!r) {
        if (!cancelled) { setInvalid(true); setResolving(false); }
        return;
      }
      
      // Enforce event payment
      if (r.business_type === "event") {
        if (!r.active_event_id) {
          if (!cancelled) { 
            setInvalidMessage("No active event is configured for this QR code.");
            setInvalid(true); 
            setResolving(false); 
          }
          return;
        }
        const { data: ev } = await supabase.from("events").select("name, qr_enabled, event_date").eq("id", r.active_event_id).maybeSingle();
        if (!ev || !ev.qr_enabled) {
          if (!cancelled) { 
            setInvalidMessage("This event's QR codes are not yet active. Please complete payment to activate.");
            setInvalid(true); 
            setResolving(false); 
          }
          return;
        }
        
        // Strict Date Logic
        if (!isStaffOrOwner) {
          if (!ev.event_date) {
            if (!cancelled) {
              setInvalidMessage("This event is missing a scheduled date. Please contact the organizer.");
              setInvalid(true);
              setResolving(false);
            }
            return;
          }
          
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
          
          if (ev.event_date > todayStr) {
            if (!cancelled) {
              const formattedDate = new Date(ev.event_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              setInvalidMessage(`This event has not started yet. The QR codes will be active on ${formattedDate}.`);
              setInvalid(true);
              setResolving(false);
            }
            return;
          } else if (ev.event_date < yesterdayStr) {
            if (!cancelled) {
              setInvalidMessage("This event has ended. Thanks for coming!");
              setInvalid(true);
              setResolving(false);
            }
            return;
          }
        }
        
        if (!cancelled) setEventData(ev);
      } else {
        // Enforce restaurant subscription
        const status = r.subscription_status || "trial";
        if (status !== "active" && status !== "trial") {
          if (!cancelled) { 
            setInvalidMessage("This restaurant's subscription is currently inactive.");
            setInvalid(true); 
            setResolving(false); 
          }
          return;
        }

        // Enforce active subscription expiration
        if (status === "active" && r.subscription_expires_at) {
          if (new Date(r.subscription_expires_at).getTime() < Date.now()) {
            if (!cancelled) {
              setInvalidMessage("This restaurant's subscription is currently inactive.");
              setInvalid(true);
              setResolving(false);
            }
            return;
          }
        }
        
        // Enforce trial expiration
        if (status === "trial" && r.trial_ends_at) {
           const trialEnd = new Date(r.trial_ends_at).getTime();
           if (Date.now() > trialEnd) {
             if (!cancelled) { 
               setInvalidMessage("This restaurant's free trial has expired.");
               setInvalid(true); 
               setResolving(false); 
             }
             return;
           }
        }
      }

      // Validate Table Count (Phase 6 Restoration)
      const isStaffCode = r.staff_codes?.map((c: string) => c.toUpperCase()).includes(table.toUpperCase());
      const maxTables = r.table_count || 10;
      const currentTable = parseInt(table);
      if (!isStaffCode && (isNaN(currentTable) || currentTable < 1 || currentTable > maxTables)) {
        if (!cancelled) {
          setInvalidMessage(`Invalid table number. ${r.name} only has ${maxTables} tables.`);
          setInvalid(true);
          setResolving(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, description, price, category, image, available, options, track_inventory, stock_quantity, low_stock_threshold, auto_hide_out_of_stock")
        .eq("restaurant_id", resolved)
        .order("category")
        .order("name");
        
      if (cancelled) return;
      setRid(resolved);
      setRestaurant(r);
      setMenu((data as MenuItem[]) || []);
      setCategoryFlows([]);
      setInvalid(false);
      setResolving(false);
      
      // Track visit for PWA logic (Phase 14)
      const count = Number(localStorage.getItem("smarttable.visit_count") || "0");
      localStorage.setItem("smarttable.visit_count", String(count + 1));

      // Save/update scan history with real Pharmacy Name
      try {
        const saved = localStorage.getItem("st.scan_history");
        const hist = saved ? JSON.parse(saved) : [];
        const entry = { restaurantId: resolved, restaurantName: r.name || "Pharmacy", table, timestamp: Date.now() };
        const updated = [entry, ...hist.filter((h: any) => h.restaurantId !== resolved)].slice(0, 5);
        localStorage.setItem("st.scan_history", JSON.stringify(updated));
      } catch { /* noop */ }
    };
    load();
    return () => { cancelled = true; };
  }, [ridParam, table]);

  // Re-sync activeOrderId when table or restaurant changes (prevent cross-restaurant conflicts)
  useEffect(() => {
    if (!rid) return;
    const saved = localStorage.getItem(`smarttable.order.${rid}.${table}`);
    setActiveOrderId(saved);
  }, [rid, table]);

  useEffect(() => {
    if (!rid) return;
    const ch = supabase
      .channel(`customer-menu-all-${rid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, (payload: any) => {
        const { eventType, new: newItem, old: oldItem } = payload;
        
        if (eventType === "UPDATE" || eventType === "INSERT") {
          if (!newItem || (newItem.restaurant_id && newItem.restaurant_id !== rid)) return;
          
          setMenu((prev) => {
            const exists = prev.find(i => i.id === newItem.id);
            if (exists) {
              // Update existing item
              return prev.map((item) => item.id === newItem.id ? { ...item, ...newItem } : item);
            } else if (eventType === "INSERT") {
              // Add new item if it belongs to this restaurant
              return [...prev, newItem as MenuItem].sort((a, b) => a.category.localeCompare(b.category));
            }
            return prev;
          });
        } else if (eventType === "DELETE") {
          if (!oldItem) return;
          setMenu((prev) => prev.filter((item) => item.id !== oldItem.id));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "restaurants", filter: `id=eq.${rid}` }, (payload: any) => {
        if (payload.new) {
          setRestaurant((prev: any) => ({ ...prev, ...payload.new }));
        }
      })
      .subscribe((status) => {
        console.log("Menu Realtime Status:", status);
      });

    return () => { supabase.removeChannel(ch); };
  }, [rid]);

  // ---------- Cart & Intent Persistence (Phase 3) ----------
  const [cart, setCart] = useState<CartItem[]>([]);
  const [intent, setIntent] = useState<Intent>("dine-in");

  // Load from localStorage when rid is resolved
  useEffect(() => {
    if (!rid) return;
    try {
      const savedCart = localStorage.getItem(`smarttable.cart.${rid}.${table}`);
      if (savedCart) {
        const parsed: CartItem[] = JSON.parse(savedCart);
        // Sanitize: filter out any items with invalid prices, invalid quantities, or stale 0-price main items
        const clean = parsed.filter((i) => {
          if (!i || !i.id || isNaN(Number(i.price))) return false;
          if (!i.qty || isNaN(Number(i.qty)) || Number(i.qty) <= 0) return false;
          // If price is 0 and it's not a soup/stew/sauce, it's likely stale/corrupted data
          if (Number(i.price) === 0 && !/soup|stew|sauce|included/i.test(i.category || "") && !/included/i.test(i.selectedOption || "")) return false;
          return true;
        });
        setCart(clean);
      }
      const savedIntent = localStorage.getItem(`smarttable.intent.${rid}.${table}`);
      if (savedIntent) setIntent(savedIntent as Intent);
    } catch (e) { console.error("Failed to load cart", e); }
  }, [rid, table]);

  // Save to localStorage when cart/intent changes
  useEffect(() => {
    if (!rid) return;
    localStorage.setItem(`smarttable.cart.${rid}.${table}`, JSON.stringify(cart));
    localStorage.setItem(`smarttable.intent.${rid}.${table}`, intent);
  }, [cart, intent, rid, table]);

  // Sync across tabs
  useEffect(() => {
    if (!rid) return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `smarttable.cart.${rid}.${table}` && e.newValue) {
        try { setCart(JSON.parse(e.newValue)); } catch { /* noop */ }
      }
      if (e.key === `smarttable.intent.${rid}.${table}` && e.newValue) {
        setIntent(e.newValue as Intent);
      }
      if (e.key === `smarttable.order.${rid}.${table}`) {
        setActiveOrderId(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [rid, table]);
  const cartCount = cart.reduce((s, i) => s + (i.qty || 0), 0);
  const cartTotal = cart.reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || 0), 0);
  // Use a unique key per cart line so we can have multiple lines for the same item
  const cartKey = (i: CartItem) => `${i.id}_${i.selectedOption || ''}_${i.itemIntent || ''}_${i.notes || ''}_${i.bundleId || ''}`;
  const addToCart = (m: MenuItem, qty: number, intent: ItemIntent, selectedOption?: string, notes?: string, bundleId?: string) => {
    setCart((p) => {
      const ex = p.find((i) => i.id === m.id && i.selectedOption === selectedOption && i.itemIntent === intent && i.notes === notes && i.bundleId === bundleId);
      if (ex) return p.map((i) => (i === ex ? { ...i, qty: i.qty + qty } : i));
      return [...p, { ...m, qty, itemIntent: intent, selectedOption, notes, bundleId }];
    });
  };
  const setCartItemQty = (idx: number, qty: number) => {
    if (isPlacing) return;
    setCart((p) => qty <= 0 ? p.filter((_, i) => i !== idx) : p.map((item, i) => i === idx ? { ...item, qty } : item));
  };
  const removeCartItem = (idx: number) => {
    if (isPlacing) return;
    setCart((p) => p.filter((_, i) => i !== idx));
  };
  const setCartItemIntent = (idx: number, intent: ItemIntent) => {
    if (isPlacing) return;
    setCart((p) => p.map((item, i) => i === idx ? { ...item, itemIntent: intent } : item));
  };
  // Split a cart item into two lines: keep some eat-here, move rest to take-away
  const splitCartItem = (idx: number) => {
    if (isPlacing) return;
    setCart((p) => {
      const item = p[idx];
      if (!item || item.qty < 2) return p;
      const eatHereQty = Math.ceil(item.qty / 2);
      const takeAwayQty = item.qty - eatHereQty;
      const newCart = [...p];
      newCart[idx] = { ...item, qty: eatHereQty, itemIntent: 'eat-here' };
      newCart.splice(idx + 1, 0, { ...item, qty: takeAwayQty, itemIntent: 'take-away' });
      return newCart;
    });
  };
  const clearCart = () => setCart([]);

  // ---------- UI state ----------
  const [active, setActive] = useState<MenuItem | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [collapsedCats, setCollapsedCats] = useState<string[]>([]);
  const toggleCat = (c: string) => setCollapsedCats(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const [confirmAction, setConfirmAction] = useState<null | "waiter" | "help" | "cancel_order">(null);
  const [helpChooserOpen, setHelpChooserOpen] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [intentOpen, setIntentOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<"complaint" | "suggestion">("complaint");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackPhone, setFeedbackPhone] = useState("");
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  // Rating system
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [showNewOrderConfirm, setShowNewOrderConfirm] = useState(false);
  // Nudge state
  const [nudgeSent, setNudgeSent] = useState(false);
  const isSendingNudgeRef = useRef(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);

  // ---------- Smart Pairing state ----------
  type PairingStage = "swallow" | "rice" | "soup" | "stew" | "meat" | "drink" | "snack" | "notes";
  const [pairingStage, setPairingStage] = useState<PairingStage | null>(null);
  const [pairingQueue, setPairingQueue] = useState<PairingStage[]>([]);
  const [pairingSoupIncluded, setPairingSoupIncluded] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<MenuItem | null>(null);
  const [currentQty, setCurrentQty] = useState<number>(1);
  const [pairingSelections, setPairingSelections] = useState<MenuItem[]>([]);
  const [pairingItemNotes, setPairingItemNotes] = useState<Record<string, string>>({});
  const [pairingNote, setPairingNote] = useState("");
  const [noteTarget, setNoteTarget] = useState<{ id: string, name: string } | null>(null);
  const [noteValue, setNoteValue] = useState("");

  // ---------- Active order (from DB after placing) ----------
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [viewTracker, setViewTracker] = useState(false);
  
  // Intercept physical Back button on mobile to gracefully close the tracker instead of kicking user out
  useEffect(() => {
    if (viewTracker) {
      window.history.pushState({ tracker: true }, "", "#tracker");
    } else if (window.location.hash === "#tracker") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [viewTracker]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.hash !== "#tracker") {
        setViewTracker(false);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [chatBody, setChatBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const [staffTyping, setStaffTyping] = useState(false);
  const typingChannelRef = useRef<any>(null);
  const typingTimerRef = useRef<any>(null);
  const sendTypingTimerRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const onChatChange = (v: string) => {
    setChatBody(v);
    if (!typingChannelRef.current) return;
    if (sendTypingTimerRef.current) return;
    typingChannelRef.current.send({ type: "broadcast", event: "typing", payload: { from: "customer" } });
    sendTypingTimerRef.current = setTimeout(() => { sendTypingTimerRef.current = null; }, 1500);
  };

  // Delayed-response alert (2 min without status change beyond pending)
  const [delayAlertOpen, setDelayAlertOpen] = useState(false);
  const [newStaffMessage, setNewStaffMessage] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  const loadActiveOrder = useCallback(async () => {
    if (!activeOrderId || !customerSessionId) return;
    const [resO, resIt, resM] = await Promise.all([
      supabase.from("orders").select("*").eq("id", activeOrderId).eq("customer_session_id", customerSessionId).maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", activeOrderId).eq("customer_session_id", customerSessionId),
      supabase.from("order_messages").select("*").eq("order_id", activeOrderId).order("created_at"),
    ]);
    
    // If there's a network error, don't wipe out the active order
    if (resO.error) {
      console.error("Failed to load order:", resO.error);
      return;
    }

    const o = resO.data;
    if (!o) {
      // Order actually doesn't exist anymore
      localStorage.removeItem(`smarttable.order.${rid}.${table}`);
      setActiveOrderId(null);
      setActiveOrder(null);
      return;
    }

    setActiveOrder(o);
    // If we just loaded the active order and the hash isn't explicitly missing, show tracker
    if (window.location.hash === "#tracker" || !window.location.hash) {
      setViewTracker(true);
    }
    setOrderItems(resIt.data || []);
    setMessages((resM.data as Message[]) || []);
    
    // Removed immediate cleanup on served/cancelled to allow for Rating Popups
    // Cleanup will happen via manual "Close Tracker" or session expiry.
  }, [activeOrderId, table]);

  useEffect(() => {
    if (!activeOrderId) return;
    loadActiveOrder();
    const ch = supabase
      .channel(`cust-order-${activeOrderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.new && (payload.new as any).id === activeOrderId) loadActiveOrder();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages" }, (payload) => {
        const msg = payload.new as any;
        if (msg && msg.order_id === activeOrderId) {
          setMessages((prev) => prev.find(x => x.id === msg.id) ? prev : [...prev, msg]);
          if (msg?.sender === "staff") {
            setNewStaffMessage(true);
            try { (navigator as any).vibrate?.([100, 50, 100]); } catch { /* noop */ }
          }
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "order_messages" }, (payload) => {
        if (payload.new && (payload.new as any).order_id === activeOrderId) loadActiveOrder();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("connected");
        else if (status === "CLOSED" || status === "CHANNEL_ERROR") setRealtimeStatus("disconnected");
      });
    return () => { supabase.removeChannel(ch); };
  }, [activeOrderId, customerSessionId, loadActiveOrder]);

  // Typing channel + read receipts
  useEffect(() => {
    if (!activeOrderId) return;
    const ty = supabase.channel(`typing-${activeOrderId}`, { config: { broadcast: { self: false } } });
    ty.on("broadcast", { event: "typing" }, (p) => {
      if ((p.payload as any)?.from === "staff") {
        setStaffTyping(true);
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setStaffTyping(false), 2500);
      }
    }).subscribe();
    typingChannelRef.current = ty;
    return () => { supabase.removeChannel(ty); clearTimeout(typingTimerRef.current); };
  }, [activeOrderId]);

  // Announcement Listener
  useEffect(() => {
    if (!rid) return;
    const ch = supabase.channel(`announcements-${rid}-${table}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "customer_requests", filter: `restaurant_id=eq.${rid}` }, (payload) => {
        const req = payload.new as any;
        if (req.type === "announcement") {
          toast.message("📢 EVENT ANNOUNCEMENT", {
            description: req.message,
            duration: 15000,
          });
          try { (navigator as any).vibrate?.([200, 100, 200]); } catch { /* noop */ }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rid, table]);

  // Auto-transition from success screen
  useEffect(() => {
    if (showSuccess) {
      const t = setTimeout(() => {
        setShowSuccess(false);
        setViewTracker(true);
        setOrderOpen(false);
      }, 5000); // 5 seconds
      return () => clearTimeout(t);
    }
  }, [showSuccess]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const unread = messages.filter((m) => m.sender === "staff" && !m.read_at).map((m) => m.id);
    if (unread.length === 0 || !orderOpen) return;
    supabase.from("order_messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => {});
  }, [messages, orderOpen]);

  // Nudge staff: if order stays "pending" 5 min after creation, show nudge button
  useEffect(() => {
    if (!activeOrder || !activeOrderId) {
      setDelayAlertOpen(false);
      return;
    }
    if (activeOrder.status !== "pending") {
      setDelayAlertOpen(false);
      return;
    }
    if (nudgeSent) return;
    const placedAt = new Date(activeOrder.created_at).getTime();
    const remaining = 300_000 - (Date.now() - placedAt); // 5 minutes
    const fire = () => {
      setDelayAlertOpen(true);
      try { (navigator as any).vibrate?.(120); } catch { /* noop */ }
    };
    if (remaining <= 0) { fire(); return; }
    const t = setTimeout(fire, remaining);
    return () => clearTimeout(t);
  }, [activeOrder, activeOrderId, nudgeSent]);

  const sendNudge = async () => {
    if (!rid || !activeOrderId || nudgeSent || isSendingNudgeRef.current) return;
    isSendingNudgeRef.current = true;
    setNudgeSent(true);
    setDelayAlertOpen(false);
    
    // Drop message in chat
    await replyToOrder("message", "🔔 Order Update: I've been waiting for over 5 minutes. Please check my order!");

    // Also send manager notification
    await supabase.from("customer_requests").insert({
      restaurant_id: rid,
      table_number: table,
      type: "nudge",
      message: `🔔 URGENT: Table ${table} has been waiting over 5 minutes!`,
      resolved: false
    });
    
    await createNotification({
      restaurantId: rid,
      type: "waiter",
      title: `🔔 Table ${table} needs attention!`,
      body: `Guest has been waiting over 5 minutes. Order #${activeOrder?.short_code}`,
      link: `/dashboard/orders/${activeOrderId}`,
    });
    toast.success(isEvent ? "Usher has been notified! They'll attend to you shortly." : "Staff has been notified! They'll attend to you shortly.");
  };



  const dismissDelayAlert = () => {
    setDelayAlertOpen(false);
  };

  // Auto-open rating when order is served (only once)
  useEffect(() => {
    if (!activeOrder || activeOrder.status !== "served") return;
    if (ratingSubmitted) return;
    const key = `smarttable.rated.${activeOrderId}`;
    if (localStorage.getItem(key) === "1") { setRatingSubmitted(true); return; }
    const t = setTimeout(() => setRatingOpen(true), 2000);
    return () => clearTimeout(t);
  }, [activeOrder?.status, activeOrderId, ratingSubmitted]);

  const submitRating = async () => {
    if (!rid || !ratingStars || isSubmittingRating) return;
    setIsSubmittingRating(true);
    const starStr = "⭐".repeat(ratingStars);
    const msg = ratingComment.trim() ? `${starStr} — ${ratingComment.trim()}` : starStr;
    
    await supabase.from("customer_requests").insert({
      restaurant_id: rid,
      table_number: table,
      type: "rating",
      message: `${ratingStars}|${msg}`,
      resolved: false,
    });
    
    localStorage.setItem(`smarttable.rated.${activeOrderId}`, "1");
    setRatingSubmitted(true);
    setRatingOpen(false);
    setIsSubmittingRating(false);
    toast.success("Thanks for your feedback! 🎉");
    
    // Auto-clear order session 3 seconds after rating to keep it clean
    setTimeout(() => {
      localStorage.removeItem(`smarttable.order.${rid}.${table}`);
      setActiveOrderId(null);
      setActiveOrder(null);
    }, 3000);
  };

  // Smart session expiry: clear old orders from memory
  useEffect(() => {
    if (!activeOrder || !activeOrderId) return;
    const createdAt = new Date(activeOrder.created_at).getTime();
    const age = Date.now() - createdAt;
    const THREE_HOURS = 3 * 60 * 60 * 1000;

    const shouldClear = (activeOrder.status === "pending" || activeOrder.status === "preparing") && age > THREE_HOURS;
    
    if (shouldClear) {
      localStorage.removeItem(`smarttable.order.${rid}.${table}`);
      setActiveOrderId(null);
      setActiveOrder(null);
    }
  }, [activeOrder, activeOrderId, rid, table]);

  // ---------- Filters ----------
  const categories = useMemo(() => {
    const raw = Array.from(new Set(menu.map((m) => m.category)));
    if (restaurant?.category_order && restaurant.category_order.length > 0) {
      raw.sort((a, b) => {
        const aIdx = restaurant.category_order!.indexOf(a);
        const bIdx = restaurant.category_order!.indexOf(b);
        if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
      return ["All", ...raw];
    }
    // Fallback
    const sorted = raw.sort((a, b) => {
      if (a.toLowerCase().includes("swallow")) return -1;
      if (b.toLowerCase().includes("swallow")) return 1;
      if (a.toLowerCase().includes("soup")) return -1;
      if (b.toLowerCase().includes("soup")) return 1;
      return a.localeCompare(b);
    });
    return ["All", ...sorted];
  }, [menu, restaurant?.category_order]);
  const q = search.trim().toLowerCase();
  const items = menu.filter((m) =>
    (category === "All" || m.category === category) &&
    (q === "" || m.name.toLowerCase().includes(q) || (m.description || "").toLowerCase().includes(q))
  );

  // ---------- Place order ----------
  const executePlaceOrder = async () => {
    if (cart.length === 0 || isPlacing) return;
    
    if (isOutOfRange) {
      toast.error("You are too far from the restaurant to place an order.");
      return;
    }

    setIsPlacing(true);
    // Generate a collision-resistant short code using crypto randomness
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const shortCode = `ORD-${Array.from(bytes, b => chars[b % chars.length]).join('')}`;

    const itemsPayload = cart.map((c) => ({
      menu_item_id: c.id,
      name: c.name,
      qty: c.qty,
      price: Number(c.price),
      item_intent: intent === "mixed" ? (c.itemIntent || "eat-here") : null,
      selected_option: c.selectedOption || null,
      notes: c.notes || null,
      bundle_id: c.bundleId || null,
    }));

    const { data: orderId, error } = await supabase.rpc("create_order_atomic", {
      p_restaurant_id: rid,
      p_short_code: shortCode,
      p_table_number: table,
      p_intent: intent,
      p_total: cartTotal,
      p_customer_session_id: customerSessionId,
      p_transaction_id: transactionId,
      p_items: itemsPayload,
      p_customer_name: guestName.trim() || null,
    });

    if (error || !orderId) { 
      // Regenerate transactionId so a retry doesn't collide with a partially-inserted row
      // (orders.transaction_id has a UNIQUE constraint — reusing the same UUID causes a 400).
      setTransactionId(crypto.randomUUID());
      console.error("[order] RPC error:", error?.message, error?.details, error?.hint, error?.code);
      toast.error("Network issue: Please retry submitting your order."); 
      setIsPlacing(false);
      return; 
    }

    await createNotification({
      restaurantId: rid,
      type: "order",
      title: `New order · Table ${table}`,
      body: cart.map((c) => `${c.qty}× ${c.name}`).join(", "),
      link: `/dashboard/orders/${orderId}`,
    });

    localStorage.setItem(`smarttable.order.${rid}.${table}`, orderId);
    localStorage.setItem("smarttable.has_ordered", "1");
    if (guestName.trim()) localStorage.setItem("smarttable_guest_name", guestName.trim());
    setActiveOrderId(orderId);
    clearCart();
    setTransactionId(crypto.randomUUID());
    setIsPlacing(false);
    setIntentOpen(false);
    setConfirmAction(null);
    setShowSuccess(true);
    toast.success("Order sent to kitchen 🎉");
  };

  // True when customer came from "Add More Items" with an active unfulfilled order
  const isAddingToExisting = !!activeOrderId && !!activeOrder &&
    (activeOrder.status === "pending" || activeOrder.status === "preparing") &&
    !viewTracker;

  const executeAddToExistingOrder = async () => {
    if (cart.length === 0 || isPlacing || !activeOrderId || !activeOrder) return;

    if (isOutOfRange) {
      toast.error("You are too far from the restaurant to place an order.");
      return;
    }

    setIsPlacing(true);

    const itemsPayload = cart.map((c) => ({
      order_id: activeOrderId,
      menu_item_id: c.id,
      name: c.name,
      qty: c.qty,
      price: Number(c.price),
      item_intent: activeOrder.intent === "mixed" ? (c.itemIntent || "eat-here") : null,
      selected_option: c.selectedOption || null,
      notes: c.notes || null,
      customer_session_id: customerSessionId,
    }));

    const { error } = await supabase.from("order_items").insert(itemsPayload);

    if (error) {
      toast.error("Failed to add items. Please try again.");
      setIsPlacing(false);
      return;
    }

    // Recompute the order total
    const newTotal = Number(activeOrder.total) + cartTotal;
    await supabase.from("orders").update({ total: newTotal }).eq("id", activeOrderId);

    await createNotification({
      restaurantId: rid,
      type: "order",
      title: `Items added · Table ${table}`,
      body: cart.map((c) => `${c.qty}\u00d7 ${c.name}`).join(", "),
      link: `/dashboard/orders/${activeOrderId}`,
    });

    clearCart();
    setTransactionId(crypto.randomUUID());
    setIsPlacing(false);
    setIntentOpen(false);
    setViewTracker(true); // Return customer to the order tracker
    toast.success("Items added to your order! \ud83c\udf89");
  };

  const placeOrder = () => {
    if (isAddingToExisting) {
      executeAddToExistingOrder();
      return;
    }
    if (isEvent) {
      setConfirmAction("place_event_order");
    } else {
      executePlaceOrder();
    }
  };

  const cancelOrder = async () => {
    if (!activeOrderId || activeOrder?.status !== "pending") return;
    setConfirmAction("cancel_order");
  };

  const handleCancelConfirm = async () => {
    if (!activeOrderId) return;
    setConfirmAction(null);
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", activeOrderId);
    await createNotification({
      restaurantId: rid,
      type: "order",
      title: `Order Cancelled · Table ${table}`,
      body: `Table ${table} cancelled their pending order (${activeOrder.short_code}).`,
      link: `/dashboard/orders/${activeOrderId}`,
    });
    
    localStorage.removeItem(`smarttable.order.${rid}.${table}`);
    setActiveOrderId(null);
    setActiveOrder(null);
    toast.success("Order cancelled");
  };

  // ---------- Customer requests ----------
  const sendCustomerRequest = async (type: "waiter" | "help" | "complaint" | "suggestion", message: string, extras?: { name?: string; phone?: string }): Promise<boolean> => {
    if (!rid) {
      toast.error("Pharmacy context not found");
      return false;
    }
    const { error } = await supabase.from("customer_requests").insert({
      restaurant_id: rid,
      table_number: table,
      type,
      message: sanitizeInput(message),
      name: extras?.name ? sanitizeInput(extras.name) : null,
      phone: extras?.phone ? sanitizeInput(extras.phone) : null,
    });
    if (error) {
      toast.error("Failed to send. Please try again.");
      return false;
    }
    await createNotification({
      restaurantId: rid,
      type,
      title: type === "waiter" ? `Waiter requested · Table ${table}`
        : type === "help" ? `Help requested · Table ${table}`
        : type === "complaint" ? `Complaint · Table ${table}`
        : `Suggestion · Table ${table}`,
      body: message,
      link: `/dashboard/orders`,
    });
    return true;
  };

  const confirmRequest = async () => {
    if (!confirmAction) return;
    if (confirmAction === "waiter") {
      const ok = await sendCustomerRequest("waiter", "Customer requested a waiter");
      if (ok) {
        toast.success("Waiter is on the way 🛎️");
        setConfirmAction(null);
      }
    } else if (confirmAction === "help") {
      const ok = await sendCustomerRequest("help", "Customer needs help");
      if (ok) {
        toast.success("Help requested 💬");
        setConfirmAction(null);
      }
    } else if (confirmAction === "cancel_order") {
      handleCancelConfirm();
    } else if (confirmAction === "place_event_order") {
      await executePlaceOrder();
    }
  };

  const sendFeedback = async () => {
    if (isSendingFeedback) return;
    const message = feedbackText.trim();
    const name = feedbackName.trim();
    const phone = feedbackPhone.trim();
    if (!message) return toast.error(`Please describe your ${feedbackKind}`);
    if (message.length > 1000) return toast.error("Message is too long (max 1000 characters)");
    if (name.length > 80) return toast.error("Name is too long");
    if (phone) {
      const ok = /^[+\d][\d\s().-]{6,19}$/.test(phone);
      if (!ok) return toast.error("Please enter a valid phone or WhatsApp number");
    }
    setIsSendingFeedback(true);
    const ok = await sendCustomerRequest(feedbackKind, message, { name, phone });
    setIsSendingFeedback(false);
    if (!ok) return;
    setFeedbackText(""); setFeedbackName(""); setFeedbackPhone("");
    setFeedbackOpen(false);
    toast.success(feedbackKind === "complaint" ? "Complaint sent — a manager will check in." : "Thanks for your suggestion 🙌");
  };

  // ---------- Chat / negotiation ----------
  const replyToOrder = async (kind: string, body: string, payload?: any) => {
    if (!activeOrderId) return;
    
    // Optimistic UI — show instantly
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId,
      sender: "customer",
      kind,
      body,
      payload: payload || null,
      created_at: new Date().toISOString(),
      read_at: null
    } as Message]);
    
    const { data: inserted } = await supabase.from("order_messages").insert({
      order_id: activeOrderId, sender: "customer", kind, body, payload: payload || null,
      customer_session_id: customerSessionId,
    }).select().maybeSingle();
    
    // Safely replace temp with real DB record without duplicating realtime broadcast
    if (inserted) {
      setMessages((prev) => {
        const alreadyHasReal = prev.some(m => m.id === inserted.id);
        if (alreadyHasReal) return prev.filter(m => m.id !== tempId);
        return prev.map(m => m.id === tempId ? { ...inserted } as Message : m);
      });
    }
  };

  const acceptQtyOffer = async (m: Message) => {
    const p = m.payload || {};
    if (!p.order_item_id) return;
    if (p.offered_qty <= 0) {
      await supabase.from("order_items").delete().eq("id", p.order_item_id);
    } else {
      await supabase.from("order_items").update({ qty: p.offered_qty }).eq("id", p.order_item_id);
    }
    // recompute total
    const { data: it } = await supabase.from("order_items").select("price, qty").eq("order_id", activeOrderId);
    const total = (it || []).reduce((s, x) => s + Number(x.price) * x.qty, 0);
    await supabase.from("orders").update({ total }).eq("id", activeOrderId);
    await replyToOrder("accepted", `Accepted: ${p.offered_qty} × ${p.name}`, p);
    toast.success("Updated. Thanks!");
  };

  const rejectQtyOffer = async (m: Message) => {
    await replyToOrder("rejected", `Customer declined the reduced quantity for ${m.payload?.name}`, m.payload);
    toast.success("Sent. Staff will follow up.");
  };

  const sendChat = async () => {
    const body = chatBody.trim();
    if (!body) return;
    setChatBody("");
    await replyToOrder("message", body);
    await createNotification({
      restaurantId: rid,
      type: "message",
      title: `Message from Table ${table}`,
      body,
      link: `/dashboard/orders/${activeOrderId}`,
    });
  };

  // ---------- Payment ----------
  const onUploadScreenshot = async (file: File | undefined) => {
    if (!file || !activeOrderId) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    
    setUploading(true);
    try {
      // Compress to 50kb
      const options = {
        maxSizeMB: 0.05,
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: "image/webp" as string,
      };
      const compressedFile = await imageCompression(file, options);
      const newFile = new File([compressedFile], `receipt-${Date.now()}.webp`, { type: "image/webp" });

      const path = `${activeOrderId}/${newFile.name}`;
      const { error } = await supabase.storage.from("payment-screenshots").upload(path, newFile, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("payment-screenshots").getPublicUrl(path);
      await supabase.from("orders").update({ payment_screenshot_url: data.publicUrl, payment_status: "uploaded" }).eq("id", activeOrderId);
      await createNotification({
        restaurantId: rid,
        type: "payment", title: `Payment uploaded · Table ${table}`,
        body: `Customer sent a payment screenshot — please confirm.`,
        link: `/dashboard/orders/${activeOrderId}`,
      });
      toast.success("Screenshot sent — staff will confirm shortly.");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setUploading(false); }
  };

  const notifyPosCashPayment = async () => {
    if (!activeOrderId) return;
    await supabase.from("orders").update({ payment_status: "cash_pos" }).eq("id", activeOrderId);
    await createNotification({
      restaurantId: rid,
      type: "payment", title: `POS/Cash payment · Table ${table}`,
      body: `Customer wishes to pay via POS or Cash.`,
      link: `/dashboard/orders/${activeOrderId}`,
    });
    // Optimistic UI update
    setActiveOrder((prev: any) => ({ ...prev, payment_status: "cash_pos" }));
    toast.success("Staff notified. They will bring the POS or collect cash.");
  };

  // Pending qty offers needing customer action
  const pendingOffers = messages.filter((m) =>
    m.kind === "qty_offer" &&
    m.sender === "staff" &&
    !messages.some((r) => (r.kind === "accepted" || r.kind === "rejected") && r.payload?.order_item_id === m.payload?.order_item_id && new Date(r.created_at) > new Date(m.created_at))
  );

  // Vibrate + toast when order status advances
  const lastStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeOrder) { lastStatusRef.current = null; return; }
    if (lastStatusRef.current && lastStatusRef.current !== activeOrder.status) {
      try { (navigator as any).vibrate?.(80); } catch { /* noop */ }
      toast.info(`Order is now ${activeOrder.status.replace("_", " ")}`);
      
      // Auto-popup rating when served
      if (activeOrder.status === 'served' && !ratingSubmitted) {
        setRatingOpen(true);
      }
    }
    lastStatusRef.current = activeOrder.status;
  }, [activeOrder?.status, ratingSubmitted]);

  // Session auto-reset: after 10 minutes of being served/cancelled, return to menu
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (activeOrder?.status === 'served' || activeOrder?.status === 'cancelled') {
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = setTimeout(() => {
        localStorage.removeItem(`smarttable.order.${rid}.${table}`);
        localStorage.removeItem(`smarttable.session.start.${rid}.${table}`);
        setActiveOrderId(null);
        setActiveOrder(null);
        navigate('/join');
      }, 600000); // 10 minutes
    }
    return () => { if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current); };
  }, [activeOrder?.status, rid, table]);

  // Auto-show rating popup whenever order becomes served (or is already served on load)
  useEffect(() => {
    if (activeOrder?.status === 'served' && !ratingSubmitted && !ratingOpen) {
      const t = setTimeout(() => setRatingOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [activeOrder?.status, ratingSubmitted]);

  // ---------- Guided ordering (Smart Food Pairing) ----------

  const hasSoups = menu.some((m) => m.available && isSoup(m));
  const hasStews = menu.some((m) => m.available && isStew(m));
  const hasMeats = menu.some((m) => m.available && isMeat(m));
  const hasDrinks = menu.some((m) => m.available && isDrink(m));
  const hasSnacks = menu.some((m) => m.available && isSnack(m));
  const hasSwallows = menu.some((m) => m.available && isSwallow(m));
  const hasRice = menu.some((m) => m.available && isPlainRice(m));

  const handleAddItem = (item: MenuItem, qty: number, intent: ItemIntent, opt?: string) => {
    // Reset pairing state for new flow
    setPairingSelections([]);
    setPairingItemNotes({});
    setPairingNote("");
    setCurrentSelection(item);
    setCurrentQty(qty);

    let queue: PairingStage[] = [];

    // 1. Dynamic flow check
    const dynamicFlow = categoryFlows.find(f => f.trigger_category.toLowerCase() === item.category.toLowerCase());
    
    if (dynamicFlow && dynamicFlow.steps.length > 0) {
      queue = [...dynamicFlow.steps];
    }

    if (queue.length > 0) {
      setActive(null); // Close the item sheet
      setPairingStage(queue[0]);
      setPairingQueue(queue.slice(1));
      return; // advancePairing/finalizePairing handles adding to cart
    }

    // Default standalone items (Proteins, Drinks, Snacks, Sides, etc.) skip the guided flow
    addToCart(item, qty, intent, opt);
    toast.success(`Added ${qty}× ${item.name}`);
    setActive(null);
  };

  const pairingPool = useMemo(() => {
    if (!pairingStage) return [] as MenuItem[];
    let pool: MenuItem[] = [];
    
    // Check if pairing stage is exactly a category name first
    const categoryMatches = menu.filter(m => m.available && m.category.toLowerCase() === pairingStage.toLowerCase());
    
    if (categoryMatches.length > 0) {
      pool = categoryMatches;
    } else {
      // Fallback to hardcoded group matches
      switch (pairingStage.toLowerCase()) {
        case "swallow": pool = menu.filter((m) => m.available && isSwallow(m)); break;
        case "rice": pool = menu.filter((m) => m.available && isPlainRice(m)); break;
        case "soup": pool = menu.filter((m) => m.available && isSoup(m)); break;
        case "stew": pool = menu.filter((m) => m.available && (isStew(m) || isSoup(m))); break;
        case "meat": pool = menu.filter((m) => m.available && isMeat(m)); break;
        case "drink": pool = menu.filter((m) => m.available && isDrink(m)); break;
        case "snack": pool = menu.filter((m) => m.available && isSnack(m)); break;
        default: return [] as MenuItem[];
      }
    }

    // Prioritization logic: if the current root item has options, move those to the top
    if (currentSelection?.options && currentSelection.options.length > 0) {
      const opts = currentSelection.options.map(o => o.toLowerCase());
      const recommended = pool.filter(m => opts.includes(m.name.toLowerCase()));
      const others = pool.filter(m => !opts.includes(m.name.toLowerCase()));
      return [...recommended, ...others];
    }
    return pool;
  }, [pairingStage, menu, currentSelection]);

  const pairingTitle: Record<string, { emoji: string; title: string; subtitle: string }> = {
    swallow: { emoji: "🍘", title: "Add a Swallow?", subtitle: "Perfect with your soup" },
    rice: { emoji: "🍚", title: "Add Rice?", subtitle: "Perfect with your stew" },
    soup: { emoji: "🍲", title: "Pick your Soup(s)", subtitle: "Select one or more for your combo" },
    stew: { emoji: "🥘", title: "Pick a Stew", subtitle: "Included with your rice" },
    meat: { emoji: "🍗", title: "Add Meat & Proteins", subtitle: "Complete your meal" },
    drink: { emoji: "🥤", title: "Add a Drink?", subtitle: "Stay refreshed" },
    snack: { emoji: "🥟", title: "Add a Snack?", subtitle: "Perfect with your drink" },
    notes: { emoji: "📝", title: "Review & Note", subtitle: "Any special instructions for the kitchen?" },
  };

  const finalizePairing = () => {
    if (currentSelection) {
      const soupSelections = pairingSelections.filter(m => isSoup(m));
      // Exclude currentSelection from otherSelections to prevent the main item being added twice
      const otherSelections = pairingSelections.filter(m => !isSoup(m) && m.id !== currentSelection.id);
      const bundleId = crypto.randomUUID();
      
      // Construct detailed soup display including their specific notes
      const soupDisplay = soupSelections.map(s => {
        const note = pairingItemNotes[s.id];
        return note ? `${s.name} (${note})` : s.name;
      }).join(", ");

      const combineNotes = (specific?: string, global?: string) => {
        const s = specific?.trim();
        const g = global?.trim();
        if (s && g) return `${s} | ${g}`;
        return s || g || "";
      };
      
      // Main item (swallow/rice): Combine specific root note + global kitchen note
      const rootNote = combineNotes(pairingItemNotes['root'], pairingNote);
      addToCart(currentSelection, currentQty, "eat-here", soupDisplay, rootNote, bundleId);
      
      // Each additional selection (meat, drink, etc.): always default to 1
      otherSelections.forEach(m => {
        const itemSpecificNote = pairingItemNotes[m.id];
        const noteToApply = combineNotes(itemSpecificNote, isDrink(m) ? "" : pairingNote);
        addToCart(m, 1, "eat-here", undefined, noteToApply, bundleId);
      });
      
      toast.success(`Items added to tray!`);
    }
    setPairingStage(null);
    setPairingQueue([]);
    setPairingSelections([]);
    setPairingNote("");
    setPairingItemNotes({});
  };

  const advancePairing = () => {
    if (pairingQueue.length > 0) {
      setPairingStage(pairingQueue[0]);
      setPairingQueue(pairingQueue.slice(1));
    } else {
      finalizePairing();
    }
  };

  if (resolving || (checkingLocation && restaurant?.geofencing_enabled)) {
    return <BrandedLoader fullscreen message={checkingLocation ? "Verifying location…" : "Opening menu…"} />
  }
  if (invalid) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-6">
        <Helmet><title>Invalid QR Code</title></Helmet>
        <div className="max-w-sm text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-destructive/10 text-destructive grid place-items-center mb-4 text-2xl">⚠️</div>
          <h1 className="font-display text-2xl font-bold mb-2">Unavailable</h1>
          <p className="text-sm text-muted-foreground">{invalidMessage}</p>
        </div>
      </div>
    );
  }

  if (isOutOfRange && restaurant?.geofencing_enabled) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-6">
        <Helmet><title>Out of Range | PharmIQ</title></Helmet>
        <div className="max-w-sm text-center">
          <div className="mx-auto h-20 w-20 rounded-[2.5rem] bg-primary/10 text-primary grid place-items-center mb-6 text-3xl shadow-soft">
            <NavigationOff className="h-10 w-10" />
          </div>
          <h1 className="font-display text-2xl font-black mb-3">Out of Range</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This business uses location-based ordering. You must be at <strong>{restaurant?.name}</strong> to view the menu and place orders.
          </p>
          <div className="mt-8 pt-6 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Estimated distance</p>
            <p className="text-2xl font-black text-primary mt-1">{distance ? `${(distance / 1000).toFixed(1)}km` : '---'}</p>
          </div>
          <Button variant="outline" className="mt-8 rounded-xl" onClick={() => window.location.reload()}>
            Try Refreshing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <Helmet>
      <title>{restaurant?.name ? `${restaurant.name} | Digital Menu` : "Digital Menu"}</title>
      <meta property="og:title" content={restaurant?.name ? `${restaurant.name} | Digital Menu` : "Digital Menu"} />
      <meta property="og:description" content={`Scan to view ${restaurant?.name || 'the'} menu and place your order directly from your table.`} />
      <meta property="og:image" content={restaurant?.logo_url || "https://smarttable.com.ng/og-image.jpg"} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
    </Helmet>
    {activeOrder && activeOrder.status !== 'cancelled' && activeOrder.status !== 'archived' && viewTracker ? (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 glass border-b border-border/60">
          <div className="px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
            {restaurant?.website_url ? (
              <a href={restaurant.website_url.startsWith('http') ? restaurant.website_url : `https://${restaurant.website_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity">
                {restaurant?.logo_url && (
                  <img src={restaurant.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover border border-border shrink-0" />
                )}
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[10px] text-muted-foreground truncate uppercase tracking-widest">{restaurant?.name}</div>
                  <div className="font-display font-bold text-foreground">Table {table}</div>
                </div>
              </a>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {restaurant?.logo_url && (
                  <img src={restaurant.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover border border-border shrink-0" />
                )}
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[10px] text-muted-foreground truncate uppercase tracking-widest">{restaurant?.name}</div>
                  <div className="font-display font-bold text-foreground">Table {table}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={() => setHelpChooserOpen(true)}>
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </Button>
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={() => {
                setShowLeaveConfirm(true);
              }} title="Leave Table">
                <LogOut className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-32 animate-in fade-in duration-700">
          {/* New Staff Message Banner */}
          {newStaffMessage && (
            <div className="bg-primary shadow-glow rounded-2xl p-4 flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500 sticky top-4 z-40 border border-white/20">
              <div className="flex items-center gap-3 text-primary-foreground min-w-0">
                <div className="h-10 w-10 rounded-xl bg-white/20 grid place-items-center shrink-0">
                  <MessageSquareText className="h-6 w-6 animate-bounce" />
                </div>
                <div className="min-w-0">
                  <div className="font-black text-xs uppercase tracking-widest opacity-90">Message from Staff</div>
                  <div className="text-sm font-bold truncate">You have a new message!</div>
                </div>
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="rounded-xl font-black text-[10px] uppercase tracking-widest shrink-0 shadow-soft" 
                onClick={() => { setOrderOpen(true); setNewStaffMessage(false); }}
              >
                Open Chat
              </Button>
            </div>
          )}

          {/* Order Status Card */}
          <div className={`border rounded-[2.5rem] p-8 shadow-elevated overflow-hidden relative transition-all duration-700 ${
            activeOrder.status === 'pending' 
              ? 'bg-destructive/15 border-destructive shadow-[0_0_50px_-12px_rgba(239,68,68,0.4)] animate-pulse-soft' 
              : 'bg-card border-border'
          }`}>
            <div className="absolute top-0 right-0 p-4 sm:p-6">
              <div className={`text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-[0.2em] shadow-sm ${activeOrder.status === 'pending' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>
                #{activeOrder.short_code.split('-').pop()}
              </div>
            </div>
            
            <div className="mb-6 pr-12 sm:pr-0">
              <h2 className={`font-display text-xl sm:text-2xl font-black leading-tight tracking-tight ${activeOrder.status === 'pending' ? 'text-destructive' : ''}`}>
                {activeOrder.status === 'pending' ? "Order Received 🎉" : 
                 activeOrder.status === 'preparing' ? "Preparing Food 🍳" : 
                 activeOrder.status === 'served' ? "Enjoy your meal! 😋" : "Status Update"}
              </h2>
              <p className="text-sm text-muted-foreground mt-2 font-medium">
                {activeOrder.status === 'pending' ? "Kitchen is ready to start your meal." : 
                 activeOrder.status === 'preparing' ? "Chef is currently working their magic!" : 
                 "Everything has been served. Enjoy!"}
              </p>
              
              <div className="mt-6 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="rounded-xl h-10 border-primary/20 text-primary font-bold px-4 hover:bg-primary/5" onClick={() => { setConfirmAction("waiter"); confirmRequest(); }}>
                  <Bell className="h-4 w-4 mr-2" /> Call Waiter
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl h-10 border-primary/20 text-primary font-bold px-4 hover:bg-primary/5" onClick={() => { setFeedbackKind("complaint"); setFeedbackOpen(true); }}>
                  <MessageSquareWarning className="h-4 w-4 mr-2" /> Report Issue
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl h-10 border-primary/20 text-primary font-bold px-4 hover:bg-primary/5" onClick={() => setViewTracker(false)}>
                  <Plus className="h-4 w-4 mr-2" /> Add More Items
                </Button>
              </div>
            </div>

            {activeOrder.status === 'pending' && (
              <div className="mb-8 flex justify-center sm:justify-start">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={cancelOrder}
                  className="h-9 rounded-xl border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition-all gap-2 px-4 font-black text-[10px] uppercase tracking-widest"
                >
                  <X className="h-4 w-4" /> Cancel Order
                </Button>
              </div>
            )}

            {/* Animated Stepper */}
            <div className="relative flex justify-between px-2 mb-2">
              <div className="absolute top-5 left-8 right-8 h-[3px] bg-secondary -z-10" />
              <div 
                className="absolute top-5 left-8 h-[3px] bg-primary transition-all duration-1000 ease-in-out -z-10" 
                style={{ width: activeOrder.status === 'pending' ? '0%' : activeOrder.status === 'preparing' ? '45%' : '90%' }}
              />
              
              {[
                { s: 'pending', l: 'Received', icon: Check },
                { s: 'preparing', l: 'Kitchen', icon: UtensilsCrossed },
                { s: 'served', l: 'Served', icon: ShoppingBag }
              ].map((step, idx) => {
                const isDone = (activeOrder.status === 'preparing' && step.s === 'pending') || 
                               (activeOrder.status === 'served' && (step.s === 'pending' || step.s === 'preparing'));
                const isCurrent = activeOrder.status === step.s;
                
                return (
                  <div key={step.s} className="flex flex-col items-center gap-3">
                    <div className={`h-10 w-10 rounded-2xl grid place-items-center transition-all duration-700 ${isDone || isCurrent ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}>
                      {isDone ? <Check className="h-5 w-5 stroke-[3]" /> : <step.icon className={`h-5 w-5 ${isCurrent ? "animate-pulse" : ""}`} />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? "text-primary" : "text-muted-foreground opacity-60"}`}>{step.l}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-soft">
            <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2"><ShoppingBasket className="h-5 w-5 text-primary" /> Your Selection</h3>
            <div className="space-y-4 divide-y divide-border/50">
              {orderItems.map((it) => (
                <div key={it.id} className="flex justify-between items-center pt-4 first:pt-0">
                  <div className="text-sm min-w-0 flex items-center">
                    <span className="font-black text-primary mr-3 text-base shrink-0">{it.qty}×</span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground/90 truncate">{it.name}</span>
                      {activeOrder.intent === "mixed" && it.item_intent && (
                        <span className={`w-fit mt-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest ${it.item_intent === "eat-here" ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                          {it.item_intent === "eat-here" ? "🍽️ Eat Here" : "📦 Takeaway"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-black font-display">{!isEvent && formatNaira(it.price * it.qty)}</div>
                </div>
              ))}
            </div>
            {!isEvent && (
              <div className="mt-5 pt-5 border-t border-border flex justify-between items-end">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Amount</span>
                <span className="font-display text-3xl font-black text-primary leading-none">{formatNaira(activeOrder.total)}</span>
              </div>
            )}
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-4">
             <Button variant="outline" className="h-20 rounded-[2rem] flex flex-col items-center justify-center gap-1.5 py-4 border-2 hover:bg-primary/5 hover:border-primary/20 transition-all group relative" onClick={() => setOrderOpen(true)}>
                <MessageSquareWarning className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">Messages</span>
                {messages.filter(m => m.sender === 'staff' && !m.read_at).length > 0 && (
                  <span className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
                )}
             </Button>
             <Button variant="outline" className="h-20 rounded-[2rem] flex flex-col items-center justify-center gap-1.5 py-4 border-2 hover:bg-primary/5 hover:border-primary/20 transition-all group" onClick={() => setHelpChooserOpen(true)}>
                <Bell className="h-6 w-6 text-primary group-hover:animate-shake" />
                <span className="text-[10px] font-black uppercase tracking-widest">Help / Waiter</span>
             </Button>
          </div>

          {/* Payment Collapsible */}
          {!isEvent && (
            <details className="bg-card border border-border rounded-[2rem] shadow-soft overflow-hidden group transition-all duration-300">
              <summary className="p-5 flex items-center justify-between cursor-pointer list-none">
                 <div className="flex items-center gap-4">
                   <div className="h-12 w-12 rounded-2xl bg-primary-soft text-primary grid place-items-center shrink-0">
                      <Copy className="h-6 w-6" />
                   </div>
                   <div>
                      <div className="font-bold text-sm">Payment Details</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Transfer • POS • Cash</div>
                   </div>
                 </div>
                 <div className="h-8 w-8 rounded-full bg-secondary/50 grid place-items-center group-open:rotate-180 transition-transform">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                 </div>
              </summary>
              <div className="p-6 border-t border-border bg-secondary/10 space-y-5 animate-in fade-in slide-in-from-top-4">
                 {restaurant && (
                   <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Bank</span>
                        <span className="font-bold text-sm">{restaurant.bank_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Account</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-primary text-base break-all">{restaurant.bank_account_number}</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg bg-primary/5" onClick={() => { navigator.clipboard.writeText(restaurant.bank_account_number); toast.success("Copied"); }}>
                            <Copy className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-3 mt-3">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Name</span>
                        <span className="font-bold text-sm text-right">{restaurant.bank_account_name}</span>
                      </div>
                   </div>
                 )}

                 {!activeOrder.payment_screenshot_url && activeOrder.payment_status !== "cash_pos" && activeOrder.payment_status !== "confirmed" && (
                   <div className="grid gap-3">
                      <label className="block">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => onUploadScreenshot(e.target.files?.[0])} />
                        <Button variant="hero" className="w-full h-14 rounded-2xl font-bold" asChild>
                          <span><Upload className="h-5 w-5 mr-3" /> {uploading ? "Uploading..." : "Upload Transfer Proof"}</span>
                        </Button>
                      </label>
                      <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-2" onClick={notifyPosCashPayment}>
                        <Shuffle className="h-5 w-5 mr-3" /> Pay with POS / Cash
                      </Button>
                   </div>
                 )}

                 {activeOrder.payment_status === "cash_pos" && (
                   <div className="bg-warning/10 text-warning border border-warning/20 p-4 rounded-2xl text-center text-xs font-bold uppercase tracking-widest">
                      ⏳ Staff notified. They'll be right with you.
                   </div>
                 )}
                 {activeOrder.payment_screenshot_url && (
                   <div className="bg-primary/10 text-primary border border-primary/20 p-4 rounded-2xl text-center text-xs font-bold uppercase tracking-widest">
                      ✓ Proof sent. Waiting for staff confirmation.
                   </div>
                 )}
              </div>
            </details>
          )}
          {/* Nudge staff button — shown when order has been pending too long */}
          {delayAlertOpen && activeOrder.status === "pending" && !nudgeSent && (
            <div className="pt-4 animate-in fade-in zoom-in duration-500">
              <Button 
                variant="hero" 
                className="w-full h-16 rounded-2xl font-black text-lg shadow-glow gap-3 bg-amber-500 hover:bg-amber-600 text-black" 
                onClick={sendNudge}
              >
                <BellRing className="h-6 w-6 animate-bounce" /> {isEvent ? "Call Usher 🔔" : "Nudge Staff 🔔"}
              </Button>
              <p className="text-center text-[10px] text-muted-foreground mt-2 font-medium">Your order has been waiting. Tap to alert {isEvent ? "ushers" : "staff"}.</p>
            </div>
          )}
          {nudgeSent && activeOrder.status === "pending" && (
            <div className="pt-4">
              <div className="bg-primary/10 text-primary border border-primary/20 p-4 rounded-2xl text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Reminder Sent — {isEvent ? "Usher" : "Staff"} will be with you shortly
              </div>
            </div>
          )}

          {activeOrder.status === 'served' && !ratingSubmitted && (
            <div className="pt-4 animate-in fade-in zoom-in duration-500">
              <Button 
                variant="hero"
                className="w-full h-16 rounded-2xl font-black text-lg shadow-glow gap-3"
                onClick={() => setRatingOpen(true)}
              >
                <Star className="h-5 w-5" /> Rate Your Experience ⭐
              </Button>
              <p className="text-center text-[10px] text-muted-foreground mt-2 font-medium">How was your meal? It only takes 10 seconds!</p>
            </div>
          )}

          {activeOrder.status === 'served' && ratingSubmitted && (
            <div className="pt-4">
              <div className="bg-primary/10 text-primary border border-primary/20 p-4 rounded-2xl text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Thanks for your rating!
              </div>
            </div>
          )}

          <div className="pt-8 mt-8 border-t border-border/50 space-y-3">
            {activeOrder.status === 'served' ? (
              <>
                <Button 
                  variant="hero"
                  className="w-full h-14 rounded-[2rem] text-base font-black shadow-glow uppercase tracking-[0.2em] gap-3"
                  onClick={() => setShowNewOrderConfirm(true)}
                >
                  Place New Order 🚀
                </Button>
                <Button 
                  variant="outline"
                  className="w-full h-12 rounded-[2rem] text-sm font-bold gap-2 border-2"
                  onClick={() => {
                    localStorage.removeItem(`smarttable.order.${rid}.${table}`);
                    setActiveOrderId(null);
                    setActiveOrder(null);
                  }}
                >
                  Back to Menu 🍽️
                </Button>
              </>
            ) : (
              <Button 
                variant="ghost"
                className="w-full h-12 rounded-[2rem] text-sm font-bold text-muted-foreground"
                onClick={() => setShowNewOrderConfirm(true)}
              >
                Close Tracker ✕
              </Button>
            )}
            <p className="text-center text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
              PharmIQ Session • Table {table}
            </p>
          </div>
        </main>
      </div>
    ) : (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass border-b border-border/60">
        <div className="px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
          {restaurant?.website_url ? (
            <a href={restaurant.website_url.startsWith('http') ? restaurant.website_url : `https://${restaurant.website_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity">
              {isEvent ? (
                <div className="min-w-0 w-full pr-2">
                  <div className="text-[10px] uppercase tracking-widest text-primary font-black mb-0.5">Welcome to</div>
                  <h1 className="font-display font-black text-xl truncate leading-tight w-full text-foreground">{eventData?.name || restaurant?.name || "Event"}</h1>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground mt-0.5">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full animate-pulse ${realtimeStatus === 'connected' ? 'bg-green-500' : realtimeStatus === 'connecting' ? 'bg-amber-500' : 'bg-destructive'}`} title={realtimeStatus} />
                    Table {table}
                  </div>
                </div>
              ) : (
                <>
                  {restaurant?.logo_url ? (
                    <img src={restaurant.logo_url} alt="" className="h-10 w-10 rounded-2xl object-cover border border-border shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-2xl bg-primary shadow-glow grid place-items-center shrink-0">
                      <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 pr-2">
                    <h1 className="font-display font-bold text-base truncate leading-tight w-full text-foreground">{restaurant?.name || "PharmIQ"}</h1>
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full animate-pulse ${realtimeStatus === 'connected' ? 'bg-green-500' : realtimeStatus === 'connecting' ? 'bg-amber-500' : 'bg-destructive'}`} title={realtimeStatus} />
                      Table {table}
                    </div>
                  </div>
                </>
              )}
            </a>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {isEvent ? (
                <div className="min-w-0 w-full pr-2">
                  <div className="text-[10px] uppercase tracking-widest text-primary font-black mb-0.5">Welcome to</div>
                  <h1 className="font-display font-black text-xl truncate leading-tight w-full">{eventData?.name || restaurant?.name || "Event"}</h1>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground mt-0.5">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full animate-pulse ${realtimeStatus === 'connected' ? 'bg-green-500' : realtimeStatus === 'connecting' ? 'bg-amber-500' : 'bg-destructive'}`} title={realtimeStatus} />
                    Table {table}
                  </div>
                </div>
              ) : (
                <>
                  {restaurant?.logo_url ? (
                    <img src={restaurant.logo_url} alt="" className="h-10 w-10 rounded-2xl object-cover border border-border shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-2xl bg-primary shadow-glow grid place-items-center shrink-0">
                      <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 pr-2">
                    <h1 className="font-display font-bold text-base truncate leading-tight w-full">{restaurant?.name || "PharmIQ"}</h1>
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full animate-pulse ${realtimeStatus === 'connected' ? 'bg-green-500' : realtimeStatus === 'connecting' ? 'bg-amber-500' : 'bg-destructive'}`} title={realtimeStatus} />
                      Table {table}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-1">
            {cartCount > 0 && (
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative" onClick={() => setCartSheetOpen(true)}>
                <ShoppingCart className="h-5 w-5 text-foreground" />
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center">{cartCount}</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={() => setHelpChooserOpen(true)}><HelpCircle className="h-5 w-5 text-muted-foreground" /></Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 ml-1" onClick={() => {
              setShowLeaveConfirm(true);
            }} title="Leave Table">
              <LogOut className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </header>

      {isOutOfRange && (
        <div className="bg-destructive text-destructive-foreground p-4 text-sm font-bold flex flex-col items-center justify-center gap-2 z-50 sticky top-16 shadow-lg animate-in slide-in-from-top border-b border-white/20 text-center">
          <div className="flex items-center gap-2">
            <NavigationOff className="h-5 w-5" />
            <span>Out of Range</span>
          </div>
          <p className="text-[10px] font-medium opacity-90 max-w-xs">
            You are currently {distance ? `${distance}m` : 'too far'} away. You must be at the restaurant to place orders.
          </p>
        </div>
      )}

      {isOffline && (
        <div className="bg-destructive text-destructive-foreground text-center text-xs font-bold py-1.5 px-4 flex items-center justify-center gap-2 z-50 sticky top-16 shadow-md animate-in slide-in-from-top">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          You are offline. Menu might be outdated.
        </div>
      )}

      {isSuspended && (
        <div className="bg-destructive text-destructive-foreground text-center px-4 py-3 flex flex-col items-center justify-center gap-1 z-50 sticky top-16 shadow-lg animate-in slide-in-from-top border-b border-white/20">
          <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">
            <span className="h-2 w-2 rounded-full bg-white opacity-80" />
            Currently Unavailable
          </div>
          <p className="text-[11px] font-medium opacity-90 max-w-xs">
            {restaurant?.name || "This restaurant"} is not available at the moment. Please try again later.
          </p>
        </div>
      )}

      {isPaused && !isSuspended && (
        <div className="bg-orange-500 text-white text-center px-4 py-3 flex flex-col items-center justify-center gap-1 z-50 sticky top-16 shadow-lg animate-in slide-in-from-top border-b border-white/20">
          <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wide">
            <span className="h-2 w-2 rounded-full bg-white opacity-80" />
            {isEvent ? "Not serving yet" : "Not accepting orders"}
          </div>
          <p className="text-[11px] font-medium opacity-90 max-w-xs">
            {isEvent
              ? "It's not time to start serving yet. Please check back soon!"
              : "We are currently closed and not accepting orders right now. Please check back soon!"}
          </p>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-20 overflow-x-hidden">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="What are you craving?"
            className="h-12 pl-11 rounded-full bg-secondary/50 border-transparent focus:bg-card focus:border-primary/30 transition-all text-sm font-medium"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3 mb-2 -mx-4 px-4">
          {categories.map((c) => (
            <button
              key={c} onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${category === c ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border border-border text-muted-foreground hover:border-primary/40"}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-10">
          {categories.filter(c => c !== "All" && (category === "All" || category === c)).map((catName) => {
            const catItems = items.filter(it => it.category === catName && (search === "" || it.name.toLowerCase().includes(search.toLowerCase()) || it.description?.toLowerCase().includes(search.toLowerCase())));
            if (catItems.length === 0) return null;
            const isCollapsed = collapsedCats.includes(catName);
            
            return (
              <div key={catName} className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div 
                  className="flex items-center gap-4 px-1 cursor-pointer group select-none" 
                  onClick={() => toggleCat(catName)}
                >
                  <div className="flex items-center gap-3">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary whitespace-nowrap bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10 group-hover:bg-primary/10 transition-colors">
                      {catName}
                    </h3>
                    <span className="text-[10px] font-bold text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity">
                      {catItems.length} {catItems.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="h-[1px] bg-primary/20 flex-1 rounded-full" />
                  <ChevronDown className={`h-4 w-4 text-primary transition-transform duration-500 ${isCollapsed ? '-rotate-90 opacity-40' : 'rotate-0'}`} />
                </div>
                
                {!isCollapsed && (
                  <div className="space-y-4">
                    {/* Featured Top Row (Grid) */}
                    {catItems.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {catItems.slice(0, isMobile ? 2 : 3).map((it) => (
                          <FeaturedMenuItemCard 
                            key={it.id} 
                            item={it} 
                            isEvent={isEvent} 
                            onClick={() => it.available && setActive(it)} 
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Remaining Items (Standard List) */}
                    {catItems.length > (isMobile ? 2 : 3) && (
                      <div className="grid gap-3 pt-2">
                        {catItems.slice(isMobile ? 2 : 3).map((it) => (
                          <MenuItemCard 
                            key={it.id} 
                            item={it} 
                            isEvent={isEvent} 
                            onClick={() => it.available && setActive(it)} 
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="py-24 text-center">
            <div className="h-20 w-20 rounded-[2.5rem] bg-secondary/50 grid place-items-center mx-auto mb-6 opacity-40">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No matching cravings found</p>
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 gap-4">
          <button onClick={() => { setFeedbackKind("complaint"); setFeedbackOpen(true); }} className="p-5 rounded-[2rem] border-2 border-dashed border-border text-sm font-bold text-muted-foreground hover:border-destructive hover:text-destructive transition-all flex flex-col items-center gap-2 group">
             <MessageSquareWarning className="h-6 w-6 group-hover:scale-110 transition-transform" />
             COMPLAINT
          </button>
          <button onClick={() => { setFeedbackKind("suggestion"); setFeedbackOpen(true); }} className="p-5 rounded-[2rem] border-2 border-dashed border-border text-sm font-bold text-muted-foreground hover:border-primary hover:text-primary transition-all flex flex-col items-center gap-2 group">
             <Lightbulb className="h-6 w-6 group-hover:scale-110 transition-transform" />
             SUGGESTION
          </button>
        </div>
      </main>
    </div>
    )}

    <ResponsiveModal 
        open={cartSheetOpen} 
        onOpenChange={setCartSheetOpen}
        title="Your Order"
        description={`Table ${table} · ${cart.length} item${cart.length !== 1 ? 's' : ''}`}
        className={isMobile ? "rounded-t-[3rem] max-h-[90vh] flex flex-col p-8 pb-12 border-none shadow-elevated" : "sm:max-w-xl rounded-3xl p-8 max-h-[92vh] flex flex-col overflow-hidden"}
      >
        <div className="overflow-y-auto flex-1 space-y-6">
            <SheetHeader className="text-left mb-6">
              <div className="flex items-center justify-between items-start pt-2">
                <div>
                  <SheetTitle className="text-2xl font-black flex items-center gap-3">
                    <ShoppingBasket className="h-6 w-6 text-primary" /> Your Order
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground uppercase tracking-widest font-black opacity-60">
                    Table {table} · {cart.length} item{cart.length !== 1 ? 's' : ''}
                  </SheetDescription>
                </div>
                {cart.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/5 -mt-1"
                    onClick={() => setClearTrayConfirmOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear Tray
                  </Button>
                )}
              </div>
            </SheetHeader>

            <div className="space-y-3 divide-y divide-border">
              {cart.length === 0 && (
                <div className="py-20 text-center animate-in fade-in zoom-in duration-300">
                  <div className="h-24 w-24 bg-primary/5 rounded-[2rem] grid place-items-center mx-auto mb-6 opacity-40">
                    <ShoppingBasket className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-black mb-2 uppercase tracking-tighter">Your tray is empty</h3>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Add some delicacies to get started</p>
                  <Button variant="outline" className="mt-8 rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-[0.2em]" onClick={() => setCartSheetOpen(false)}>Continue Browsing</Button>
                </div>
              )}
              {cart.map((item, idx) => (
                <div key={`${item.id}_${idx}`} className="pt-3 first:pt-0 flex gap-3">
                  <div className="h-14 w-14 rounded-lg bg-secondary overflow-hidden shrink-0">
                    {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm line-clamp-1">{item.name}</h4>
                        {item.selectedOption && (
                          <div className="text-[10px] text-primary mt-0.5">{item.selectedOption}</div>
                        )}
                        {!isEvent && item.itemIntent && (
                          <div className={`text-[10px] font-medium mt-0.5 ${item.itemIntent === 'take-away' ? 'text-amber-600' : 'text-green-600'}`}>
                            {item.itemIntent === 'take-away' ? '📦 Take Away' : '🍽️ Eat Here'}
                          </div>
                        )}
                      </div>
                      <span className="font-semibold text-sm shrink-0">{!isEvent && formatNaira(Number(item.price) * item.qty)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-2 py-0.5">
                        <button onClick={() => setCartItemQty(idx, item.qty - 1)} className="p-0.5 hover:text-primary"><Minus className="h-3.5 w-3.5 stroke-[3]" /></button>
                        <span className="text-xs font-bold min-w-[16px] text-center">{item.qty}</span>
                        <button onClick={() => setCartItemQty(idx, item.qty + 1)} className="p-0.5 hover:text-primary"><Plus className="h-3.5 w-3.5 stroke-[3]" /></button>
                      </div>
                      <div className="flex items-center gap-1">
                        {!isEvent && item.qty >= 2 && !item.itemIntent && (
                          <button
                            onClick={() => splitCartItem(idx)}
                            className="h-7 px-2 rounded-md bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1"
                          >
                            <Shuffle className="h-3 w-3" /> Split
                          </button>
                        )}
                        {!isEvent && !item.itemIntent && item.qty < 2 && (
                          <div className="flex gap-0.5">
                            <button onClick={() => setCartItemIntent(idx, 'eat-here')} className="h-7 px-1.5 rounded-md bg-green-500/10 text-green-600 text-[10px] font-semibold">🍽️</button>
                            <button onClick={() => setCartItemIntent(idx, 'take-away')} className="h-7 px-1.5 rounded-md bg-amber-500/10 text-amber-600 text-[10px] font-semibold">📦</button>
                          </div>
                        )}
                        {!isEvent && item.itemIntent && (
                          <button
                            onClick={() => setCartItemIntent(idx, item.itemIntent === 'eat-here' ? 'take-away' : 'eat-here')}
                            className={`h-7 px-1.5 rounded-md text-[10px] font-semibold transition-colors ${
                              item.itemIntent === 'take-away' ? 'bg-amber-500/10 text-amber-600' : 'bg-green-500/10 text-green-600'
                            }`}
                          >
                            {item.itemIntent === 'take-away' ? '📦→🍽️' : '🍽️→📦'}
                          </button>
                        )}
                        <button onClick={() => removeCartItem(idx)} className="h-7 w-7 rounded-md bg-destructive/10 text-destructive grid place-items-center hover:bg-destructive hover:text-destructive-foreground transition-all">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && !isEvent && (
              <div className="bg-primary/5 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatNaira(cartTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-primary/10 items-end">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-primary">{formatNaira(cartTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="pt-6 mt-auto space-y-4">
              <div className="space-y-1.5">
                <Input 
                  placeholder="Your Name / Nickname (Optional)" 
                  value={guestName} 
                  onChange={(e) => setGuestName(e.target.value)}
                  className="h-12 bg-secondary/50 border-border/50 font-medium placeholder:text-muted-foreground/60"
                />
                <p className="text-[10px] text-muted-foreground/80 px-1 font-medium">
                  💡 Helps our waiter deliver your food directly to you if you're sharing a table.
                </p>
              </div>
            {isSuspended ? (
              <div className="w-full h-14 rounded-2xl bg-destructive/10 border border-destructive/30 flex flex-col items-center justify-center text-destructive">
                <span className="text-xs font-black uppercase tracking-wide">Currently Unavailable</span>
                <span className="text-[10px] opacity-80 mt-0.5">Ordering is not available right now</span>
              </div>
            ) : isPaused ? (
              <div className="w-full h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex flex-col items-center justify-center text-orange-600">
                <span className="text-xs font-black uppercase tracking-wide">{isEvent ? "Not serving yet" : "Orders Paused"}</span>
                <span className="text-[10px] opacity-80 mt-0.5">{isEvent ? "Check back soon" : "Pharmacy is currently closed"}</span>
              </div>
            ) : (
              <Button variant="hero" size="lg" className="w-full h-14 rounded-2xl text-base font-black shadow-elevated active:scale-95 transition-transform" onClick={() => { 
                setCartSheetOpen(false); 
                if (isAddingToExisting) {
                  // Skip intent dialog — use existing order's intent
                  executeAddToExistingOrder();
                } else if (isEvent) {
                  setIntent("dine-in");
                  placeOrder();
                } else {
                  const hasTakeaway = cart.some(item => item.itemIntent === 'take-away');
                  const hasEatHere = cart.some(item => item.itemIntent === 'eat-here' || !item.itemIntent);
                  if (hasTakeaway && hasEatHere) {
                    setIntent("mixed");
                  } else if (hasTakeaway && !hasEatHere) {
                    setIntent("takeaway");
                  } else {
                    setIntent("dine-in");
                  }
                  setIntentOpen(true);
                }
              }}>
                {isAddingToExisting ? "Add to Order · " + formatNaira(cartTotal) : isEvent ? "Place Order" : "Continue · " + formatNaira(cartTotal)}
              </Button>
            )}
          </div>
          )}
      </ResponsiveModal>

    <ResponsiveModal 
      open={!!active} 
      onOpenChange={(o) => !o && setActive(null)}
      title={active?.name || "Item Details"}
      description="View item details and add to cart."
      className={isMobile ? "rounded-t-[2.5rem] border-none shadow-elevated max-h-[92vh]" : "sm:max-w-xl rounded-3xl"}
    >
      {active && <ItemSheet item={active} menu={menu} isEvent={isEvent} onAdd={(qty, intent, opt) => handleAddItem(active, qty, intent, opt)} onClose={() => setActive(null)} />}
    </ResponsiveModal>

    <Dialog open={intentOpen} onOpenChange={setIntentOpen}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 border-none shadow-elevated">
        <DialogHeader className="text-center mb-6">
          <DialogTitle className="text-xl font-bold">How to serve?</DialogTitle>
          <DialogDescription className="text-sm">Choose how you'd like your order delivered.</DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto pr-3 space-y-4 scrollbar-thin scrollbar-thumb-border">
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: "dine-in" as Intent, label: "Dine in", icon: UtensilsCrossed },
              { key: "takeaway" as Intent, label: "Takeaway", icon: ShoppingBasket },
              { key: "mixed" as Intent, label: "Mixed", icon: Shuffle },
            ]).map((opt) => {
              const sel = intent === opt.key;
              return (
                <button key={opt.key} onClick={() => setIntent(opt.key)} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${sel ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/20"}`}>
                  <opt.icon className="h-5 w-5" /><span className="text-[10px] font-semibold">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {intent === "mixed" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 text-center">Assign Items</div>
              {cart.map((c, i) => (
                <div key={i} className="flex flex-col gap-2 bg-secondary/50 p-3 rounded-xl border border-border/50">
                  <div className="flex justify-between items-start">
                    <div className="font-semibold text-sm line-clamp-1 flex-1 pr-2">{c.qty}× {c.name}</div>
                    {c.qty >= 2 && (!c.itemIntent || c.itemIntent === 'eat-here') && (
                      <button onClick={() => splitCartItem(i)} className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-1 rounded-md shrink-0">Split</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button onClick={() => setCartItemIntent(i, "eat-here")} className={`h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${(!c.itemIntent || c.itemIntent === 'eat-here') ? "bg-green-500/10 text-green-600 border border-green-500/20 shadow-sm" : "bg-card text-muted-foreground border border-border hover:bg-secondary"}`}>
                      <UtensilsCrossed className="h-3 w-3" /> Eat Here
                    </button>
                    <button onClick={() => setCartItemIntent(i, "take-away")} className={`h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all ${(c.itemIntent === 'take-away') ? "bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-sm" : "bg-card text-muted-foreground border border-border hover:bg-secondary"}`}>
                      <ShoppingBasket className="h-3 w-3" /> Takeaway
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 shrink-0 pt-2 border-t border-border/50">
          <Button 
            variant="hero" 
            size="lg" 
            className="w-full h-12 rounded-xl text-sm font-bold" 
            onClick={placeOrder}
            disabled={isPlacing}
          >
            {isPlacing ? <Loader2 className="h-5 w-5 animate-spin" /> : isAddingToExisting ? <>Add to Order · {formatNaira(cartTotal)}</> : <>Place Order {isEvent ? "" : `· ${formatNaira(cartTotal)}`}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
      <DialogContent className="sm:max-w-[400px] rounded-[2rem] p-8 border-none shadow-2xl">
        <DialogHeader className="text-center mb-6">
          <DialogTitle className="text-xl font-bold">Confirm Action</DialogTitle>
          <DialogDescription className="text-sm font-medium">
            {confirmAction === "cancel_order" 
              ? "This will permanently remove your pending order from our system." 
              : "Confirm that you'd like to proceed with this request."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setConfirmAction(null)}>No, back</Button>
          <Button 
            variant={confirmAction === "cancel_order" ? "destructive" : "hero"} 
            className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest shadow-lg" 
            onClick={confirmRequest}
          >
            {confirmAction === "cancel_order" ? "Yes, cancel" : "Yes, please"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={helpChooserOpen} onOpenChange={setHelpChooserOpen}>
      <DialogContent className="max-w-sm rounded-[2.5rem] p-6">
        <DialogHeader className="text-center mb-6">
          <DialogTitle className="font-display text-2xl font-black uppercase tracking-wider">Need Help?</DialogTitle>
          <DialogDescription className="font-medium">How can we assist you today?</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {isEvent ? (
            <>
              <Button variant="outline" className="h-14 rounded-2xl flex items-center justify-start gap-4 px-6 border-2 hover:border-primary/40 hover:bg-primary/5 transition-all group" onClick={async () => { 
                setHelpChooserOpen(false); 
                toast.loading("Sending request...");
                await sendCustomerRequest("help", "Quick Request: Concierge Assistance");
                toast.success("Concierge has been notified!");
              }}>
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors"><Bell className="h-4 w-4" /></div>
                <div className="text-left leading-tight"><div className="font-bold">Call Concierge</div><div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Request table service</div></div>
              </Button>
              <Button variant="outline" className="h-14 rounded-2xl flex items-center justify-start gap-4 px-6 border-2 hover:border-primary/40 hover:bg-primary/5 transition-all group" onClick={async () => { 
                setHelpChooserOpen(false); 
                toast.loading("Sending request...");
                await sendCustomerRequest("help", "Quick Request: Clean Table / Clear Plates");
                toast.success("Staff will clean your table shortly!");
              }}>
                <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-500 grid place-items-center group-hover:bg-blue-500 group-hover:text-white transition-colors"><MessageSquareWarning className="h-4 w-4" /></div>
                <div className="text-left leading-tight"><div className="font-bold">Clean Table</div><div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Clear plates and glasses</div></div>
              </Button>
              <Button variant="outline" className="h-14 rounded-2xl flex items-center justify-start gap-4 px-6 border-2 hover:border-primary/40 hover:bg-primary/5 transition-all group" onClick={() => { setHelpChooserOpen(false); setFeedbackKind("suggestion"); setFeedbackOpen(true); }}>
                <div className="h-8 w-8 rounded-full bg-amber-500/10 text-amber-600 grid place-items-center group-hover:bg-amber-500 group-hover:text-white transition-colors"><Lightbulb className="h-4 w-4" /></div>
                <div className="text-left leading-tight"><div className="font-bold">Event Feedback</div><div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Share your thoughts</div></div>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="h-14 rounded-2xl flex items-center justify-start gap-4 px-6 border-2 hover:border-primary/40 hover:bg-primary/5 transition-all group" onClick={() => { setHelpChooserOpen(false); setConfirmAction("waiter"); }}>
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors"><Bell className="h-4 w-4" /></div>
                <div className="text-left leading-tight"><div className="font-bold">Call Waiter</div><div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Request table service</div></div>
              </Button>
              <Button variant="outline" className="h-14 rounded-2xl flex items-center justify-start gap-4 px-6 border-2 hover:border-primary/40 hover:bg-primary/5 transition-all group" onClick={() => { setHelpChooserOpen(false); setFeedbackKind("complaint"); setFeedbackOpen(true); }}>
                <div className="h-8 w-8 rounded-full bg-amber-500/10 text-amber-600 grid place-items-center group-hover:bg-amber-500 group-hover:text-white transition-colors"><MessageSquareWarning className="h-4 w-4" /></div>
                <div className="text-left leading-tight"><div className="font-bold">Report Issue</div><div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Feedback & Complaints</div></div>
              </Button>
              <Button variant="outline" className="h-14 rounded-2xl flex items-center justify-start gap-4 px-6 border-2 hover:border-primary/40 hover:bg-primary/5 transition-all group" onClick={() => { setHelpChooserOpen(false); setHowToOpen(true); }}>
                <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-500 grid place-items-center group-hover:bg-blue-500 group-hover:text-white transition-colors"><Lightbulb className="h-4 w-4" /></div>
                <div className="text-left leading-tight"><div className="font-bold">How it Works</div><div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Read the quick guide</div></div>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>


    <Dialog open={howToOpen} onOpenChange={setHowToOpen}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-[2.5rem] p-8">
        <DialogHeader className="mb-6">
          <DialogTitle className="font-display text-2xl font-black uppercase tracking-wider text-center">PharmIQ Guide</DialogTitle>
          <DialogDescription className="text-center text-xs text-muted-foreground">Quick instructions on how to use the app.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-5 text-sm">
          {[
            ["🔍", "Browse Choice", "Use the categories or search to find your cravings."],
            ["🛒", "Build Cart", "Tap items to add. Edit quantities directly in the cart."],
            ["🚀", "Order Now", "Place your order and track it live on this page."],
            ["💬", "Live Status", "See exactly when the kitchen starts and serves your meal."],
            ["🛎️", "Quick Help", "Need anything? Call a waiter with one tap."]
          ].map(([emoji, title, desc]) => (
            <li key={title} className="flex gap-4 p-4 rounded-2xl bg-secondary/30">
              <div className="text-2xl shrink-0">{emoji}</div>
              <div><div className="font-black uppercase tracking-widest text-xs mb-1">{title}</div><div className="text-muted-foreground text-xs leading-relaxed font-medium">{desc}</div></div>
            </li>
          ))}
        </ol>
        <Button variant="hero" className="w-full mt-8 h-14 rounded-2xl font-black" onClick={() => setHowToOpen(false)}>GOT IT</Button>
      </DialogContent>
    </Dialog>

    <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
      <DialogContent className="sm:max-w-[425px] rounded-[2.5rem] p-8 border-none shadow-elevated">
        <DialogHeader className="text-center mb-6">
          <DialogTitle className="text-xl font-bold">Feedback & Suggestions</DialogTitle>
          <DialogDescription className="font-medium">Your feedback helps us serve you better.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 mb-4">
          {(["complaint", "suggestion"] as const).map((k) => (
            <button key={k} onClick={() => setFeedbackKind(k)} className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${feedbackKind === k ? "bg-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground"}`}>{k}</button>
          ))}
        </div>
        <Textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder={feedbackKind === "complaint" ? "What's wrong? (e.g. cold food, late service)" : "Any ideas to improve your experience?"} className="min-h-[120px] rounded-2xl p-4" />
        <div className="rounded-2xl border-2 border-dashed border-border p-4 space-y-3 mt-4">
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Contact Info (Optional)</div>
          <Input value={feedbackName} onChange={(e) => setFeedbackName(e.target.value)} placeholder="Your Name" className="rounded-xl h-12" />
          <Input value={feedbackPhone} onChange={(e) => setFeedbackPhone(e.target.value)} placeholder="WhatsApp Number" className="rounded-xl h-12" />
        </div>
        <Button variant="hero" className="w-full h-14 rounded-2xl font-black mt-6" onClick={sendFeedback} disabled={isSendingFeedback}>
          {isSendingFeedback ? <Loader2 className="h-5 w-5 animate-spin" /> : "SEND FEEDBACK"}
        </Button>
      </DialogContent>
    </Dialog>

    {/* New Order Confirm Dialog */}
    <Dialog open={showNewOrderConfirm} onOpenChange={setShowNewOrderConfirm}>
      <DialogContent className="sm:max-w-[380px] rounded-[2.5rem] p-8 border-none shadow-elevated text-center">
        <DialogHeader className="text-center mb-2">
          <div className="h-16 w-16 bg-primary/10 rounded-[1.5rem] grid place-items-center mx-auto mb-4">
            <ShoppingBag className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-black uppercase tracking-wide">Start Fresh?</DialogTitle>
          <DialogDescription className="font-medium mt-1">
            This will clear your current order tracker. You'll be taken back to the menu.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-6">
          <Button
            variant="hero"
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-glow"
            onClick={() => {
              localStorage.removeItem(`smarttable.order.${rid}.${table}`);
              setActiveOrderId(null);
              setActiveOrder(null);
              setShowNewOrderConfirm(false);
            }}
          >
            Yes, Start Fresh 🚀
          </Button>
          <Button
            variant="ghost"
            className="w-full h-12 rounded-2xl font-bold text-muted-foreground"
            onClick={() => setShowNewOrderConfirm(false)}
          >
            Keep Tracking
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Item Note Dialog */}
    <Dialog open={!!noteTarget} onOpenChange={(o) => !o && setNoteTarget(null)}>
      <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] p-8 border-none shadow-elevated">
        <DialogHeader className="text-center mb-6">
          <DialogTitle className="text-xl font-bold flex items-center justify-center gap-2">
            <MessageSquareText className="h-5 w-5 text-primary" />
            Note for {noteTarget?.name}
          </DialogTitle>
          <DialogDescription className="text-xs font-medium">Any special preparation for this specific item?</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="relative group">
            <Textarea 
              value={noteValue} 
              onChange={(e) => setNoteValue(e.target.value)} 
              placeholder="e.g. Extra spicy, no onions, well done..." 
              className="min-h-[120px] rounded-2xl p-5 bg-secondary/30 border-transparent focus:border-primary/20 focus:bg-card transition-all text-sm font-medium"
              autoFocus
            />
            <div className="absolute bottom-3 right-3 text-[10px] font-bold text-muted-foreground opacity-40 uppercase tracking-widest">
              {noteValue.length} chars
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1 h-12 rounded-xl font-bold" onClick={() => setNoteTarget(null)}>Cancel</Button>
            <Button 
              variant="hero" 
              className="flex-[2] h-12 rounded-xl font-black uppercase tracking-widest shadow-glow" 
              onClick={() => {
                setPairingItemNotes(prev => ({ ...prev, [noteTarget!.id]: noteValue }));
                setNoteTarget(null);
              }}
            >
              Save Note
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
      <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] p-8 border-none shadow-2xl text-center">
        <DialogHeader className="text-center mb-4">
          <DialogTitle className="text-2xl font-black uppercase tracking-wider">Rate Your Experience</DialogTitle>
          <DialogDescription className="font-medium">How was the service and meal?</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setRatingStars(s)}
              className={`p-1 transition-all duration-200 ${s <= ratingStars ? "scale-110" : "opacity-30 hover:opacity-60"}`}
            >
              <Star className={`h-10 w-10 ${s <= ratingStars ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        {ratingStars > 0 && (
          <p className="text-center text-sm font-bold mb-4">
            {ratingStars === 1 ? "😞 Poor" : ratingStars === 2 ? "😐 Fair" : ratingStars === 3 ? "🙂 Good" : ratingStars === 4 ? "😊 Great" : "🤩 Excellent!"}
          </p>
        )}
        <Textarea
          value={ratingComment}
          onChange={(e) => setRatingComment(e.target.value)}
          placeholder="Tell us more (optional)..."
          className="min-h-[80px] rounded-2xl p-4"
        />
        <Button
          variant="hero"
          className="w-full h-14 rounded-2xl font-black mt-4"
          onClick={submitRating}
          disabled={!ratingStars || isSubmittingRating}
        >
          {isSubmittingRating ? <Loader2 className="h-5 w-5 animate-spin" /> : "SUBMIT RATING"}
        </Button>
        <button onClick={() => setRatingOpen(false)} className="w-full text-center text-xs text-muted-foreground mt-2 font-medium hover:text-foreground transition-colors">
          Maybe Later
        </button>
      </DialogContent>
    </Dialog>

    <ResponsiveModal 
      open={orderOpen} 
      onOpenChange={setOrderOpen}
      title="Staff Chat"
      description={`Order #${activeOrder?.short_code}`}
      className={isMobile ? "rounded-t-[3rem] h-[75vh] flex flex-col p-0 overflow-hidden border-none shadow-elevated" : "sm:max-w-xl rounded-3xl p-0 overflow-hidden"}
    >
      <div className="p-8 overflow-y-auto flex-1 space-y-6">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl font-black flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-primary" /> Staff Chat
          </SheetTitle>
          <SheetDescription className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
            Order #{activeOrder?.short_code}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-10 font-medium">No messages yet. We'll reach out if needed!</p>}
          {messages.map((m) => {
            const isMe = m.sender === "customer";
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm font-medium ${isMe ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                  {m.body}
                  <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                    <span><RealTimeAgo date={m.created_at} /></span>
                    {isMe && <span className="font-bold">{m.read_at ? "✓✓" : "✓"}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </div>
      <div className="p-8 bg-card border-t border-border flex flex-col gap-2">
        {staffTyping && <div className="text-[10px] text-primary font-bold animate-pulse px-2">Staff is typing...</div>}
        <div className="flex gap-3">
          <Textarea value={chatBody} onChange={(e) => onChatChange(e.target.value)} placeholder="Type a message..." className="min-h-[56px] rounded-2xl resize-none py-4" rows={1} />
          <Button onClick={sendChat} className="h-14 w-14 rounded-2xl shadow-glow shrink-0"><Send className="h-6 w-6" /></Button>
        </div>
      </div>
    </ResponsiveModal>

    <ResponsiveModal 
      open={!!pairingStage} 
      onOpenChange={(o) => { if (!o) { finalizePairing(); } }}
      title={pairingStage ? `${pairingTitle[pairingStage]?.emoji} ${pairingTitle[pairingStage]?.title}` : "Pairing"}
      description={pairingStage ? pairingTitle[pairingStage]?.subtitle : "Suggested items"}
      className={isMobile ? "rounded-t-[3rem] p-0 border-none shadow-elevated max-h-[92vh] flex flex-col" : "sm:max-w-md rounded-[2.5rem] max-h-[85vh] flex flex-col p-0 overflow-hidden"}
    >
      <div className="flex flex-col h-full max-h-[inherit] overflow-hidden">
        <div className="text-center p-8 pb-4 shrink-0 relative">
          <h2 className="text-xl font-black flex items-center justify-center gap-2 mb-1">
            {pairingStage && pairingTitle[pairingStage]?.emoji} {pairingStage && pairingTitle[pairingStage]?.title}
          </h2>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">
            {pairingStage && pairingTitle[pairingStage]?.subtitle}
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto px-8 py-2 scrollbar-none">
          {pairingStage === "notes" ? (
            <div className="space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-primary/5 rounded-[2rem] p-6 border border-primary/10">
                <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Your Selection</div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold">{currentSelection?.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black opacity-50">{!isEvent && formatNaira(Number(currentSelection?.price))}</span>
                        <button onClick={() => {
                          setNoteValue(pairingItemNotes['root'] || "");
                          setNoteTarget({ id: 'root', name: currentSelection?.name || "Item" });
                        }} className={`p-1.5 rounded-lg transition-colors ${pairingItemNotes['root'] ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-primary/20'}`}>
                          <MessageSquareText className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {pairingItemNotes['root'] && (
                      <div className="text-[10px] bg-primary/10 text-primary px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 animate-in slide-in-from-left-2">
                         <span className="shrink-0">📝</span> {pairingItemNotes['root']}
                      </div>
                    )}
                  </div>

                  {pairingSelections.map(m => (
                    <div key={m.id} className="flex flex-col gap-2 pl-4 border-l-2 border-primary/20">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-muted-foreground">{m.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-primary">{isSoup(m) ? "Included" : (!isEvent ? formatNaira(Number(m.price)) : "")}</span>
                          <button onClick={() => {
                            setNoteValue(pairingItemNotes[m.id] || "");
                            setNoteTarget({ id: m.id, name: m.name });
                          }} className={`p-1.5 rounded-lg transition-colors ${pairingItemNotes[m.id] ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-primary/20'}`}>
                            <MessageSquareText className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {pairingItemNotes[m.id] && (
                        <div className="text-[10px] bg-primary/10 text-primary px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 animate-in slide-in-from-left-2">
                           <span className="shrink-0">📝</span> {pairingItemNotes[m.id]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-2">Kitchen Note</label>
                <Textarea 
                  value={pairingNote} 
                  onChange={(e) => setPairingNote(e.target.value)} 
                  placeholder="e.g. More Egusi, less Okra please..." 
                  className="min-h-[120px] rounded-[1.5rem] p-5 bg-secondary/30 border-transparent focus:border-primary/20 focus:bg-card transition-all"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-4">
              {pairingPool.slice(0, 16).map((it) => {
                const showIncluded = pairingSoupIncluded && (pairingStage === "soup" || pairingStage === "stew");
                const isSelected = pairingSelections.some(s => s.id === it.id);
                const isMulti = true; // Make everything multi-selectable as requested

                return (
                  <button 
                    key={it.id} 
                    onClick={() => {
                      if (isMulti) {
                        setPairingSelections(p => isSelected ? p.filter(s => s.id !== it.id) : [...p, it]);
                      } else {
                        setPairingSelections(p => [...p, it]);
                        advancePairing();
                      }
                    }} 
                    className={`bg-card border-2 rounded-2xl overflow-hidden text-left shadow-soft hover:shadow-elevated transition-all group active:scale-[0.97] ${isSelected ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-transparent"}`}
                  >
                    <div className="aspect-[4/3] bg-secondary relative">
                      {it.image && <img src={it.image} alt={it.name} className="w-full h-full object-cover" />}
                      <div className={`absolute top-2 right-2 h-7 w-7 rounded-full grid place-items-center transition-all shadow-glow ${isSelected ? "bg-primary text-primary-foreground scale-110 opacity-100" : "bg-primary text-primary-foreground opacity-0 group-hover:opacity-100"}`}>
                        {isSelected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="font-bold text-xs line-clamp-1 mb-0.5">{it.name}</div>
                      {showIncluded ? (
                        <div className="text-[10px] font-black text-green-600 uppercase tracking-widest">Included ✓</div>
                      ) : !isEvent ? (
                        <div className="font-black text-primary text-sm">{formatNaira(Number(it.price))}</div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-8 pt-4 border-t border-border/50 bg-secondary/5 shrink-0 flex flex-col gap-3">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-14 rounded-2xl text-xs font-bold border-2" 
              onClick={advancePairing}
            >
               {pairingStage === "notes" ? "Skip Notes" : "Skip"}
            </Button>
            <Button 
              variant="hero" 
              className="flex-1 h-14 rounded-2xl text-sm font-black uppercase tracking-widest shadow-glow" 
              onClick={advancePairing}
            >
              {pairingStage === "notes" ? 'Add to Tray' : (pairingSelections.some(s => pairingPool.some(p => p.id === s.id)) ? 'Next' : 'Next')}
            </Button>
          </div>
          <Button 
            variant="ghost" 
            className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10" 
            onClick={finalizePairing}
          >
            <ShoppingBasket className="h-4 w-4 mr-2" /> Finish & Add To Tray
          </Button>
        </div>
      </div>
    </ResponsiveModal>
    {/* Unified Floating Action Bar */}
    {(!activeOrderId || !viewTracker) && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-4 animate-in slide-in-from-bottom-8 duration-500">
        <button 
          onClick={() => activeOrderId && cart.length === 0 ? setViewTracker(true) : setCartSheetOpen(true)}
          className="w-full bg-card border-2 border-primary/20 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3)] rounded-3xl py-4 px-6 flex items-center justify-between group active:scale-[0.97] transition-all hover:bg-secondary/50"
        >
          <div className="flex items-center gap-4 text-left">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center relative shadow-glow">
              {activeOrderId ? <UtensilsCrossed className="h-6 w-6" /> : <ShoppingBasket className="h-6 w-6" />}
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive rounded-full border-2 border-background text-[10px] font-black grid place-items-center animate-in zoom-in duration-300">
                  {cart.reduce((s, i) => s + (i.qty || 0), 0)}
                </span>
              )}
              {activeOrderId && cart.length === 0 && activeOrder?.status === 'pending' && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-destructive rounded-full border-2 border-background animate-pulse" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-0.5 truncate">
                {activeOrderId 
                  ? (cart.length > 0 ? "Adding to Order" : "Live Tracker") 
                  : (cart.length > 0 ? "Your Tray" : "Tray is Empty")}
              </div>
              <div className="font-display font-black text-sm truncate">
                {cart.length > 0 
                  ? formatNaira(cart.reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || 0), 0)) 
                  : (activeOrderId ? (activeOrder?.status || "Processing...") : "0 Items")}
              </div>
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shrink-0 ml-2">
            <ArrowRight className="h-5 w-5" />
          </div>
        </button>
      </div>
    )}

    {showSuccess && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 glass animate-in fade-in zoom-in duration-500">
        <div className="w-full max-w-sm bg-card border border-border rounded-[3rem] p-10 text-center shadow-elevated">
          <div className="h-24 w-24 rounded-[2rem] bg-primary shadow-glow grid place-items-center mx-auto mb-8 animate-bounce">
            <CheckCircle2 className="h-12 w-12 text-primary-foreground" />
          </div>
          <h2 className="font-display text-3xl font-black mb-3">Order Sent! 🥘</h2>
          <p className="text-muted-foreground font-medium mb-10 leading-relaxed">
            Your delicacies are now being communicated to our chefs. We'll notify you once they are ready!
          </p>
          <Button 
            variant="hero" 
            className="w-full h-18 rounded-[2rem] text-xl font-black shadow-glow gap-3" 
            onClick={() => { setShowSuccess(false); setViewTracker(true); setOrderOpen(false); }}
          >
            TRACK MY ORDER <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    )}


    {/* Clear Tray Confirm Dialog */}
    <Dialog open={clearTrayConfirmOpen} onOpenChange={setClearTrayConfirmOpen}>
      <DialogContent className="sm:max-w-[380px] rounded-[2.5rem] p-8 border-none shadow-2xl">
        <DialogHeader className="text-center mb-4">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive grid place-items-center mx-auto mb-4">
            <Trash2 className="h-7 w-7" />
          </div>
          <DialogTitle className="text-xl font-black">Clear your tray?</DialogTitle>
          <DialogDescription className="text-sm">
            This will remove all {cart.length} item{cart.length !== 1 ? 's' : ''} from your tray. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Button
            variant="destructive"
            className="w-full h-12 rounded-xl text-sm font-black uppercase tracking-widest"
            onClick={() => { clearCart(); setClearTrayConfirmOpen(false); }}
          >
            Yes, Clear Tray
          </Button>
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl text-sm font-bold"
            onClick={() => setClearTrayConfirmOpen(false)}
          >
            Keep My Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Leave Table Confirm Dialog */}
    <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
      <DialogContent className="sm:max-w-[380px] rounded-[2.5rem] p-8 border-none shadow-2xl">
        <DialogHeader className="text-center mb-4">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 text-destructive grid place-items-center mx-auto mb-4">
            <LogOut className="h-7 w-7" />
          </div>
          <DialogTitle className="text-xl font-black">Leave Table?</DialogTitle>
          <DialogDescription className="text-sm">
            You are about to go back to the join page. If you have an active order, you will lose access to trace it. Do you wish to continue?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Button
            variant="destructive"
            className="w-full h-12 rounded-xl text-sm font-black uppercase tracking-widest"
            onClick={() => {
              setShowLeaveConfirm(false);
              navigate('/join');
            }}
          >
            Yes, Leave Table
          </Button>
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl text-sm font-bold"
            onClick={() => setShowLeaveConfirm(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delay Alert — fires when order stays pending 5+ minutes */}
    <Dialog open={delayAlertOpen} onOpenChange={setDelayAlertOpen}>
      <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] p-8 border-none shadow-2xl">
        <DialogHeader className="text-center mb-3">
          <DialogTitle className="text-xl font-bold">Order Update</DialogTitle>
          <DialogDescription className="text-sm">
            Your order has been pending for over 5 minutes. Would you like to nudge the staff to check on it?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Button variant="hero" className="w-full h-12 rounded-xl text-sm font-bold gap-2" onClick={sendNudge}>
            <BellRing className="h-4 w-4" /> Nudge Staff Now
          </Button>
          <Button variant="outline" className="w-full h-10 rounded-xl text-sm" onClick={dismissDelayAlert}>
            I'll keep waiting
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

const ItemSheet = ({ item, menu, isEvent, onAdd, onClose }: { item: MenuItem; menu: MenuItem[]; isEvent?: boolean; onAdd: (qty: number, intent: ItemIntent, opt?: string) => void; onClose: () => void }) => {
  const [qty, setQty] = useState(1);
  const [qtyInput, setQtyInput] = useState("1");
  const [qtyFocused, setQtyFocused] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [itemIntent, setItemIntent] = useState<ItemIntent>("eat-here");
  const hasOptions = item.options && item.options.length > 0;
  
  // If the item is a Swallow, Soup, or Local Dish, we hide the manual options selector
  // and let the Food Pairing flow handle it instead (using the options as hints).
  // EXCEPTION: if the item has options but no paired items, show the picker so the
  // cart doesn't submit an empty selectedOption which causes a 400 from the RPC.
  const isPairingCategory = isSwallow(item) || isSoup(item) || isLocalDish(item) || isPlainRice(item);
  const pairedItemsForCheck = menu.filter((m) => item.pairs_with?.includes(m.id) && m.available);
  const showOptions = hasOptions && (!isPairingCategory || pairedItemsForCheck.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {item.image && (
          <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-soft border border-border/50">
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          </div>
        )}
        
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-2xl font-black tracking-tight leading-tight">{item.name}</h2>
            {!isEvent && (
              <div className="text-xl font-bold text-primary shrink-0">{formatNaira(Number(item.price))}</div>
            )}
          </div>
          {item.description && (
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">{item.description}</p>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {showOptions && (
          <div className="space-y-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pick an Option</div>
            <div className="grid grid-cols-2 gap-2">
              {item.options!.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelected(opt)}
                  className={`px-4 py-3 rounded-xl text-xs font-bold border-2 transition-all ${selected === opt ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/20"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between bg-secondary/30 p-4 rounded-2xl border border-border/50">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity</span>
          <div className="flex items-center gap-4 bg-background rounded-xl p-1.5 shadow-sm border border-border/30">
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { const n = Math.max(1, qty - 1); setQty(n); setQtyInput(String(n)); }}><Minus className="h-4 w-4 stroke-[3]" /></Button>
            <input
              type="number"
              min={1}
              max={999}
              value={qtyInput}
              onFocus={() => { setQtyInput(String(qty)); }}
              onBlur={() => { const n = Math.min(999, Math.max(1, parseInt(qtyInput) || 1)); setQty(n); setQtyInput(String(n)); }}
              onChange={(e) => {
                setQtyInput(e.target.value);
                const n = parseInt(e.target.value);
                if (!isNaN(n) && n >= 1 && n <= 999) setQty(n);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-12 text-center font-black text-base text-foreground bg-transparent border-none outline-none focus:bg-primary/10 rounded-lg py-1 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { const n = Math.min(999, qty + 1); setQty(n); setQtyInput(String(n)); }}><Plus className="h-4 w-4 stroke-[3]" /></Button>
          </div>
        </div>
      </div>

      <Button 
        variant="hero" 
        size="lg" 
        className="w-full h-14 rounded-2xl text-base font-black shadow-elevated uppercase tracking-widest active:scale-95 transition-transform mt-2" 
        onClick={() => {
          if (showOptions && !selected) return toast.error("Please select an option first");
          const finalQty = Math.min(999, Math.max(1, parseInt(qtyInput) || 1));
          // Auto-select first option for pairing-category items whose options are hidden.
          const resolvedOption = selected || (hasOptions && item.options![0]) || undefined;
          onAdd(finalQty, itemIntent, resolvedOption);
        }}
      >
        ADD TO CART {isEvent ? "" : `· ${formatNaira(Number(item.price) * (parseInt(qtyInput) || 1))}`}
      </Button>
    </div>
  );
};




export default QrMenu;
