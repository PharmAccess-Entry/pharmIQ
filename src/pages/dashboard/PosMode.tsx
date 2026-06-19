import { useEffect, useRef, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { useAuth } from "@/lib/auth";
import { formatNaira } from "@/lib/format";
import { toast } from "sonner";
import { createNotification } from "@/lib/useNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Plus, Minus, Trash2, ShoppingCart, Printer, Download, X,
  Banknote, CreditCard, CheckCircle2, Search, UtensilsCrossed,
  User, RotateCcw, Monitor, ChevronUp, Clock, LogOut, AlertCircle, Scan, Shield
} from "lucide-react";
import html2canvas from "html2canvas";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Receipt } from "@/components/Receipt";
import { useOfflinePos } from "@/lib/offline/useOfflinePos";
import { generateAndSaveOfflineReceipt } from "@/lib/offline/receipt";
import { validateStockChange } from "@/lib/validations/stock";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image: string | null;
  available: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  auto_hide_out_of_stock: boolean;
  barcode?: string | null;
  requires_prescription?: boolean | null;
};

type CartItem = MenuItem & { cartItemId: string; qty: number; item_intent: "take-away" | "eat-here"; notes?: string };
type PaymentMethod = "cash" | "pos_terminal" | "bank_transfer";
type PendingTransfer = {
  orderId: string;
  shortCode: string;
  total: number;
  customerName: string;
  items: CartItem[];
  paymentMethod: PaymentMethod;
  cashGiven: number;
  orderIntent: "takeaway" | "dine-in" | "mixed";
  placedAt: number;
  patientId?: string;
};

// ---- Main POS Page ----
export default function PosMode() {
  const { restaurant, role } = useRestaurant();
  const { user } = useAuth();

  // ── Subscription gate: POS requires active plan or trial
  // Pharmacies don't have tables so we bypass the table-count check.
  const subStatus = restaurant?.subscription_status;
  const isPharmacy = restaurant?.business_type === "pharmacy";
  const posUnlocked = subStatus === "active" || subStatus === "trial" || isPharmacy;
  const subLoaded = restaurant !== null; // once context loads

  // ── Shift state ──
  type Shift = { id: string; start_cash: number; start_time: string; start_pos?: number; start_transfers?: number };
  const [activeShift, setActiveShift] = useState<Shift | null | undefined>(undefined); // undefined = loading
  const [previousShift, setPreviousShift] = useState<any>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [endShiftModalOpen, setEndShiftModalOpen] = useState(false);
  const [startCashStr, setStartCashStr] = useState("");
  const [startPosStr, setStartPosStr] = useState("");
  const [startTransferStr, setStartTransferStr] = useState("");
  const [endCashStr, setEndCashStr] = useState("");
  const [endPosStr, setEndPosStr] = useState("");
  const [endTransferStr, setEndTransferStr] = useState("");
  const [shiftNotes, setShiftNotes] = useState("");
  const [shiftLoading, setShiftLoading] = useState(false);

  // Settle Register state
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [lastClosedShift, setLastClosedShift] = useState<any>(null);
  const [settleLoading, setSettleLoading] = useState(false);

  const parseCurrency = (val: string) => parseInt(val.replace(/,/g, "")) || 0;
  const handleCurrencyInput = (val: string, setter: (v: string) => void) => {
    const raw = val.replace(/[^0-9]/g, "");
    setter(raw ? parseInt(raw).toLocaleString("en-US") : "");
  };

  // Load active shift for the current user
  const loadActiveShift = useCallback(async () => {
    if (!restaurant?.id || !user?.id) return;
    const { data } = await supabase
      .from("shifts")
      .select("id, start_cash, start_time, start_pos, start_transfers")
      .eq("restaurant_id", restaurant.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveShift(data ?? null);
    // If no active shift, fetch previous shift for handover balances
    if (!data) {
      const { data: prevShift } = await supabase
        .from("shifts")
        .select("id, actual_cash, actual_pos, actual_transfers, settled_at")
        .eq("restaurant_id", restaurant.id)
        .eq("status", "completed")
        .order("end_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevShift) {
        setPreviousShift(prevShift);
        if (prevShift.settled_at) {
          setStartCashStr("0");
          setStartPosStr("0");
          setStartTransferStr("0");
        } else {
          setStartCashStr(prevShift.actual_cash ? Number(prevShift.actual_cash).toLocaleString("en-US") : "");
          setStartPosStr(prevShift.actual_pos ? Number(prevShift.actual_pos).toLocaleString("en-US") : "");
          setStartTransferStr(prevShift.actual_transfers ? Number(prevShift.actual_transfers).toLocaleString("en-US") : "");
        }
      }
      setShiftModalOpen(true);
    }
  }, [restaurant?.id, user?.id]);

  const startShift = async () => {
    if (!restaurant?.id || !user?.id) return;

    const cashVal = parseCurrency(startCashStr);
    const posVal = parseCurrency(startPosStr);
    const transferVal = parseCurrency(startTransferStr);

    let discrepancyCash = 0, discrepancyPos = 0, discrepancyTransfer = 0;
    const expectedCash = previousShift && !previousShift.settled_at ? (Number(previousShift.actual_cash) || 0) : 0;
    const expectedPos = previousShift && !previousShift.settled_at ? (Number(previousShift.actual_pos) || 0) : 0;
    const expectedTransfer = previousShift && !previousShift.settled_at ? (Number(previousShift.actual_transfers) || 0) : 0;

    if (previousShift) {
      discrepancyCash = cashVal - expectedCash;
      discrepancyPos = posVal - expectedPos;
      discrepancyTransfer = transferVal - expectedTransfer;
    }

    setShiftLoading(true);
    try {
      const { data, error } = await supabase
        .from("shifts")
        .insert({
          restaurant_id: restaurant.id,
          user_id: user.id,
          start_cash: cashVal,
          start_pos: posVal,
          start_transfers: transferVal,
          status: "active",
          previous_shift_id: previousShift?.id || null
        })
        .select("id, start_cash, start_time, start_pos, start_transfers")
        .single();
      if (error) throw error;

      // Log handover discrepancies against the previous shift
      if (previousShift && (discrepancyCash !== 0 || discrepancyPos !== 0 || discrepancyTransfer !== 0)) {
        await supabase.from("shifts").update({
          handover_discrepancy_cash: discrepancyCash,
          handover_discrepancy_pos: discrepancyPos,
          handover_discrepancy_transfers: discrepancyTransfer
        }).eq("id", previousShift.id);
      }

      setActiveShift(data);
      setShiftModalOpen(false);
      setStartCashStr("");
      setStartPosStr("");
      setStartTransferStr("");
      toast.success("Shift started! Have a great day ✓");
    } catch (e: any) {
      toast.error(e.message || "Could not start shift");
    } finally {
      setShiftLoading(false);
    }
  };

  const handleOpenEndShift = async () => {
    if (!activeShift || !restaurant?.id) return;

    try {
      const { data: shiftOrders } = await supabase
        .from("orders")
        .select("total, payment_status")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", activeShift.start_time)
        .in("payment_status", ["cash_paid", "pos_paid", "cash_pos", "confirmed"]);

      let expectedPos = Number(activeShift.start_pos) || 0;
      let expectedTransfer = Number(activeShift.start_transfers) || 0;

      (shiftOrders || []).forEach(o => {
        const amt = Number(o.total) || 0;
        if (o.payment_status === "pos_paid" || o.payment_status === "cash_pos") expectedPos += amt;
        else if (o.payment_status === "confirmed") expectedTransfer += amt;
      });

      if (expectedPos > 0) setEndPosStr(expectedPos.toLocaleString("en-US"));
      else setEndPosStr("");

      if (expectedTransfer > 0) setEndTransferStr(expectedTransfer.toLocaleString("en-US"));
      else setEndTransferStr("");

      setEndShiftModalOpen(true);
    } catch (e) {
      console.error("Could not pre-fill amounts", e);
      setEndShiftModalOpen(true);
    }
  };

  const endShift = async () => {
    if (!activeShift || !restaurant?.id) return;
    setShiftLoading(true);
    try {
      const { data: shiftOrders } = await supabase
        .from("orders")
        .select("total, payment_status")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", activeShift.start_time)
        .in("payment_status", ["cash_paid", "pos_paid", "cash_pos", "confirmed"]);

      let expectedCash = Number(activeShift.start_cash) || 0;
      let expectedPos = Number(activeShift.start_pos) || 0;
      let expectedTransfer = Number(activeShift.start_transfers) || 0;

      (shiftOrders || []).forEach(o => {
        const amt = Number(o.total) || 0;
        if (o.payment_status === "cash_paid") expectedCash += amt;
        else if (o.payment_status === "pos_paid" || o.payment_status === "cash_pos") expectedPos += amt;
        else if (o.payment_status === "confirmed") expectedTransfer += amt;
      });

      const actualCash = parseCurrency(endCashStr);
      const actualPos = parseCurrency(endPosStr);
      const actualTransfer = parseCurrency(endTransferStr);

      const { error } = await supabase
        .from("shifts")
        .update({
          status: "completed",
          end_time: new Date().toISOString(),
          expected_cash: expectedCash,
          actual_cash: actualCash,
          expected_pos: expectedPos,
          actual_pos: actualPos,
          expected_transfers: expectedTransfer,
          actual_transfers: actualTransfer,
          notes: shiftNotes || null,
        })
        .eq("id", activeShift.id);

      if (error) throw error;

      const cashVariance = actualCash - expectedCash;
      const varianceMsg = cashVariance === 0 ? "" : cashVariance > 0 ? ` (+${formatNaira(cashVariance)} cash over)` : ` (${formatNaira(Math.abs(cashVariance))} cash short)`;
      toast.success(`Shift ended!${varianceMsg}`);
      setActiveShift(null);
      setEndShiftModalOpen(false);
      setEndCashStr(""); setEndPosStr(""); setEndTransferStr(""); setShiftNotes("");
      setShiftModalOpen(true);
    } catch (e: any) {
      toast.error(e.message || "Could not end shift");
    } finally {
      setShiftLoading(false);
    }
  };

  const handleOpenSettle = async () => {
    if (!restaurant?.id) {
      toast.error("Account not loaded yet.");
      return;
    }
    setSettleLoading(true);
    try {
      const { data: shift, error } = await supabase
        .from("shifts")
        .select("id, actual_cash, actual_pos, actual_transfers, settled_at, end_time")
        .eq("restaurant_id", restaurant.id)
        .eq("status", "completed")
        .order("end_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) { toast.error("Database error: " + error.message); return; }
      if (!shift) { toast.info("No completed shifts found. End a shift first."); return; }
      if (shift.settled_at) { toast.info("The register has already been settled for the last shift."); return; }

      setLastClosedShift(shift);
      setSettleModalOpen(true);
    } catch (err: any) {
      toast.error("Unexpected error: " + err.message);
    } finally {
      setSettleLoading(false);
    }
  };

  const confirmSettle = async () => {
    if (!lastClosedShift) return;
    setSettleLoading(true);
    try {
      const { error } = await supabase
        .from("shifts")
        .update({ settled_at: new Date().toISOString() })
        .eq("id", lastClosedShift.id);
      if (error) throw error;
      toast.success("Register settled! Expected balances are now ₦0.");
      setSettleModalOpen(false);
      if (previousShift && previousShift.id === lastClosedShift.id) {
        setPreviousShift({ ...previousShift, settled_at: new Date().toISOString() });
        setStartCashStr("0");
        setStartPosStr("0");
        setStartTransferStr("0");
      }
    } catch (err: any) {
      toast.error("Failed to settle register: " + err.message);
    } finally {
      setSettleLoading(false);
    }
  };
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [orderIntent, setOrderIntent] = useState<"takeaway" | "dine-in" | "mixed">("takeaway");
  
  const { products: menuItems, isLoading: loading, placeOrder: offlinePlaceOrder, isOffline } = useOfflinePos(restaurant?.id, user?.id);
  const [cashGivenStr, setCashGivenStr] = useState<string>("");
  const cashGiven = parseInt(cashGivenStr.replace(/,/g, "")) || 0;
  const [placing, setPlacing] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ id: string; shortCode: string; items: CartItem[]; total: number; paymentMethod: PaymentMethod; cashGiven: number; orderIntent: string } | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [confirmingTransfer, setConfirmingTransfer] = useState<PendingTransfer | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Pharmacy POS state
  const [rxVerificationOpen, setRxVerificationOpen] = useState(false);
  const [pharmacistPin, setPharmacistPin] = useState("");
  const [patientId, setPatientId] = useState("");
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const barcodeTimeoutRef = useRef<any>(null);
  const [patients, setPatients] = useState<{ id: string; name: string; phone: string }[]>([]);

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const change = cashGiven - total;
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // Update categories whenever menuItems change
  useEffect(() => {
    if (menuItems && menuItems.length > 0) {
      const cats = Array.from(new Set(menuItems.map((i) => i.category)));
      setCategories(cats);
    }
  }, [menuItems]);

  const loadPendingTransfers = useCallback(async () => {
    if (!restaurant?.id) return;
    const { data, error } = await supabase
      .from("orders")
      .select("id, short_code, total, customer_name, intent, created_at, order_items(name, qty, item_intent)")
      .eq("restaurant_id", restaurant.id)
      .eq("table_number", "POS")
      .eq("payment_status", "awaiting_transfer")
      .order("created_at", { ascending: true });

    if (!error && data) {
      const mapped: PendingTransfer[] = data.map(o => ({
        orderId: o.id,
        shortCode: o.short_code,
        total: o.total,
        customerName: o.customer_name || "Walk-in",
        items: (o.order_items as any[] || []).map(i => ({
          name: i.name,
          qty: i.qty,
          item_intent: i.item_intent
        })) as CartItem[],
        paymentMethod: "bank_transfer",
        cashGiven: 0,
        orderIntent: o.intent as any,
        placedAt: new Date(o.created_at).getTime()
      }));
      setPendingTransfers(mapped);
    }

    if (isPharmacy) {
      const { data: pats } = await supabase
        .from("patients")
        .select("id, name, phone")
        .eq("restaurant_id", restaurant.id)
        .order("name");
      if (pats) setPatients(pats);
    }
  }, [restaurant?.id, isPharmacy]);

  useEffect(() => { loadPendingTransfers(); }, [loadPendingTransfers]);
  // Load shift only once posUnlocked is confirmed and user is known
  useEffect(() => { if (posUnlocked && user?.id) loadActiveShift(); }, [posUnlocked, user?.id, loadActiveShift]);

  // Barcode scanner listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
      
      if (e.key === "Enter") {
        if (barcodeBuffer.length > 0) {
          const item = menuItems.find(i => i.barcode === barcodeBuffer);
          if (item) {
            addToCart(item);
            toast.success(`Scanned: ${item.name}`);
          } else {
            toast.error(`Barcode not found: ${barcodeBuffer}`);
          }
          setBarcodeBuffer("");
        }
      } else if (e.key.length === 1) {
        setBarcodeBuffer(prev => prev + e.key);
        if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
        barcodeTimeoutRef.current = setTimeout(() => setBarcodeBuffer(""), 200);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [barcodeBuffer, menuItems]);

  const handleOrderIntentChange = (newIntent: "takeaway" | "dine-in" | "mixed") => {
    setOrderIntent(newIntent);
    if (newIntent !== "mixed") {
      setCart((prev) => {
        const itemIntentTarget = newIntent === "takeaway" ? "take-away" : "eat-here";
        const merged: Record<string, CartItem> = {};
        for (const i of prev) {
          if (merged[i.id]) {
            merged[i.id].qty += i.qty;
          } else {
            merged[i.id] = { ...i, item_intent: itemIntentTarget, cartItemId: `${i.id}-${itemIntentTarget}` };
          }
        }
        return Object.values(merged);
      });
    }
  };

  const addToCart = (item: MenuItem) => {
    if (!activeShift) {
      setShiftModalOpen(true);
      toast.error("Please start a shift to begin taking orders.", { icon: "👋" });
      return;
    }
    setCart((prev) => {
      const intentToAdd = orderIntent === "takeaway" ? "take-away" : "eat-here";
      const cartItemId = `${item.id}-${intentToAdd}`;
      const existing = prev.find((i) => i.cartItemId === cartItemId);
      if (existing) {
        return prev.map((i) => i.cartItemId === cartItemId ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, cartItemId, qty: 1, item_intent: intentToAdd }];
    });
  };

  const handleManualBarcode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    const item = menuItems.find(i => i.barcode === manualBarcode.trim());
    if (item) {
      addToCart(item);
      toast.success(`Added: ${item.name}`);
    } else {
      toast.error(`Barcode not found: ${manualBarcode}`);
    }
    setManualBarcode("");
  };

  const changeQty = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((i) => i.cartItemId === cartItemId ? { ...i, qty: i.qty + delta } : i);
      return updated.filter((i) => i.qty > 0);
    });
  };

  const setQtyExact = (cartItemId: string, val: string) => {
    setCart((prev) => {
      if (val === "") {
        return prev.map((i) => i.cartItemId === cartItemId ? { ...i, qty: 0 } : i);
      }
      const parsed = parseInt(val);
      if (isNaN(parsed)) return prev;
      return prev.map((i) => i.cartItemId === cartItemId ? { ...i, qty: parsed < 0 ? 0 : parsed } : i);
    });
  };

  const toggleItemIntent = (cartItemId: string) => {
    setCart((prev) => {
      const item = prev.find(i => i.cartItemId === cartItemId);
      if (!item) return prev;
      const newIntent = item.item_intent === "take-away" ? "eat-here" : "take-away";
      const newCartItemId = `${item.id}-${newIntent}`;
      const existingTarget = prev.find(i => i.cartItemId === newCartItemId);
      if (existingTarget) {
        return prev.map(i => i.cartItemId === newCartItemId ? { ...i, qty: i.qty + item.qty } : i).filter(i => i.cartItemId !== cartItemId);
      }
      return prev.map(i => i.cartItemId === cartItemId ? { ...i, item_intent: newIntent, cartItemId: newCartItemId } : i);
    });
  };

  const splitItem = (cartItemId: string) => {
    setCart((prev) => {
      const item = prev.find(i => i.cartItemId === cartItemId);
      if (!item || item.qty <= 1) return prev;
      const newIntent = item.item_intent === "take-away" ? "eat-here" : "take-away";
      const newCartItemId = `${item.id}-${newIntent}`;
      const existingTarget = prev.find(i => i.cartItemId === newCartItemId);
      let nextCart = prev.map(i => i.cartItemId === cartItemId ? { ...i, qty: i.qty - 1 } : i);
      if (existingTarget) {
         nextCart = nextCart.map(i => i.cartItemId === newCartItemId ? { ...i, qty: i.qty + 1 } : i);
      } else {
         nextCart.push({ ...item, qty: 1, item_intent: newIntent, cartItemId: newCartItemId });
      }
      return nextCart;
    });
  };

  const setItemNotes = (cartItemId: string, notes: string) => {
    setCart((prev) => prev.map((i) => i.cartItemId === cartItemId ? { ...i, notes } : i));
  };

  const removeFromCart = (cartItemId: string) => setCart((prev) => prev.filter((i) => i.cartItemId !== cartItemId));

  const clearCart = () => {
    setCart([]);
    setCustomerName("");
    setCashGivenStr("");
  };

  const handleCashChange = (val: string) => {
    const raw = val.replace(/[^0-9]/g, "");
    if (!raw) setCashGivenStr("");
    else setCashGivenStr(parseInt(raw).toLocaleString("en-US"));
  };

  // Quick cash buttons
  const quickCashAmounts = () => {
    const amounts: number[] = [];
    const base = Math.ceil(total / 500) * 500;
    [base, base + 500, base + 1000, base + 2000].forEach((a) => {
      if (!amounts.includes(a)) amounts.push(a);
    });
    return amounts.slice(0, 4);
  };

  // Place order
  const placeOrder = async () => {
    const validCart = cart.filter((i) => i.qty > 0);
    if (validCart.length === 0) return;
    if (!restaurant?.id) return;
    // Block ordering if manager has paused the restaurant
    if (restaurant?.is_accepting_orders === false) {
      toast.error("Orders are paused", { description: "The restaurant is currently not accepting orders. Re-enable ordering in Settings before placing POS orders." });
      return;
    }

    // Run Data Integrity / Anti-Abuse validations
    const validation = validateStockChange(validCart, patientId);
    if (!validation.valid) {
      toast.error("Validation Failed", { description: validation.error });
      return;
    }

    setPlacing(true);
    try {
      const { shortCode, orderId } = await offlinePlaceOrder(validCart, paymentMethod, total, customerName, cashGiven, patientId);

      // We only attempt to notify if we're online, but the order is already secured offline
      if (!isOffline) {
        try {
          await createNotification({
            restaurantId: restaurant.id,
            type: "new_order",
            title: "New POS Order",
            body: `POS · ${validCart.length} item${validCart.length !== 1 ? "s" : ""} · ${formatNaira(total)}`,
            link: `/dashboard/orders/${orderId}`,
          });
        } catch (e) {
          // ignore notification failure
        }
      }

      if (paymentMethod === "bank_transfer") {
        // Park this order — cashier can attend to next customer while awaiting transfer
        setPendingTransfers(prev => [...prev, {
          orderId: orderId,
          shortCode,
          total,
          customerName: customerName || "Walk-in",
          items: validCart,
          paymentMethod,
          cashGiven,
          orderIntent,
          placedAt: Date.now(),
        }]);
        setCheckoutOpen(false);
        clearCart();
        toast.success(`${shortCode} sent to kitchen — awaiting transfer confirmation`);
      } else {
        setSuccessOrder({
          id: orderId,
          shortCode, items: validCart, total, paymentMethod, cashGiven, orderIntent });
        setMobileCartOpen(false);
        toast.success(`Order ${shortCode} placed!`);
        // Re-sync pending transfers so any dismissed banners reappear
        loadPendingTransfers();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  // Confirm transfer payment for a parked order
  const confirmTransfer = async (pt: PendingTransfer) => {
    setConfirmingTransfer(pt);
    await supabase.from("orders").update({ payment_status: "confirmed" }).eq("id", pt.orderId);
    setPendingTransfers(prev => prev.filter(t => t.orderId !== pt.orderId));
    setSuccessOrder({ id: pt.orderId, shortCode: pt.shortCode, items: pt.items, total: pt.total, paymentMethod: pt.paymentMethod, cashGiven: pt.cashGiven, orderIntent: pt.orderIntent });
    setConfirmingTransfer(null);
    toast.success(`Transfer confirmed for ${pt.shortCode} ✓`);
    // Re-sync in case other pending transfers exist
    loadPendingTransfers();
  };

  // Dismiss a parked transfer without confirming
  const dismissTransfer = (orderId: string) => {
    setPendingTransfers(prev => prev.filter(t => t.orderId !== orderId));
  };

  // Download receipt as PNG
  const downloadReceipt = async (itemsOverride?: CartItem[], totalOverride?: number) => {
    if (!receiptRef.current) return;
    try {
      const canvas = await html2canvas(receiptRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${successOrder?.shortCode || "order"}.png`;
      a.click();
      toast.success("Receipt downloaded!");
    } catch {
      toast.error("Could not generate receipt image.");
    }
  };

  // Print receipt
  const printReceipt = () => {
    if (!receiptRef.current) return;
    const content = receiptRef.current.innerHTML;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:13px;padding:20px;}</style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const filteredItems = menuItems.filter((item) => {
    const matchCat = activeCategory === "All" || item.category === activeCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const renderTicketPanel = () => (
    <div className="w-full h-full bg-card border border-border lg:rounded-2xl flex flex-col lg:shadow-soft overflow-hidden">
      {/* Ticket header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/40">
        <div className="flex items-center justify-between mb-3">
          <span className="font-display font-bold text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Order Ticket
          </span>
          {cartCount > 0 && (
            <Badge variant="secondary" className="font-bold">{cartCount} item{cartCount !== 1 ? "s" : ""}</Badge>
          )}
        </div>
        {/* Customer name */}
        <div className="relative">
          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Customer name (optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex bg-background border border-border rounded-lg mt-3 overflow-hidden p-0.5">
          <button
            onClick={() => handleOrderIntentChange("takeaway")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
              orderIntent === "takeaway" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            Takeaway
          </button>
          <button
            onClick={() => handleOrderIntentChange("dine-in")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
              orderIntent === "dine-in" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            Dine In
          </button>
          <button
            onClick={() => handleOrderIntentChange("mixed")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
              orderIntent === "mixed" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            Mixed
          </button>
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-[200px]">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12 gap-2">
            <ShoppingCart className="h-8 w-8 opacity-20" />
            <p className="text-xs text-center">Tap items to add them to the order</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.cartItemId} className="flex flex-col gap-1 bg-secondary/50 rounded-xl px-2 py-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{item.name}</div>
                  <div className="text-xs text-primary font-bold mt-0.5">{formatNaira(item.price * item.qty)}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => changeQty(item.cartItemId, -1)}
                    className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive transition-colors shrink-0"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={item.qty === 0 ? "" : item.qty}
                    onChange={(e) => setQtyExact(item.cartItemId, e.target.value)}
                    className="w-10 text-center text-sm font-bold bg-transparent border-b border-transparent focus:border-primary outline-none appearance-none p-0"
                  />
                  <button
                    onClick={() => changeQty(item.cartItemId, 1)}
                    className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => removeFromCart(item.cartItemId)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors ml-0.5 shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              
              {/* Intent Badges on their own row */}
              {orderIntent === "mixed" && (
                <div className="flex items-center gap-2 pt-1.5 border-t border-border/50">
                  <button 
                    onClick={() => toggleItemIntent(item.cartItemId)}
                    className="text-[10px] bg-background border border-border px-2 py-1 rounded-md text-muted-foreground hover:text-primary transition-colors font-semibold"
                  >
                    {item.item_intent === "take-away" ? "🛍️ Takeaway" : "🍽️ Dine In"}
                  </button>
                  {item.qty > 1 && (
                    <button 
                      onClick={() => splitItem(item.cartItemId)}
                      className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-md transition-colors hover:bg-primary/20 font-semibold"
                      title="Split 1 item to other intent"
                    >
                      ⎌ Split 1
                    </button>
                  )}
                </div>
              )}
              {isPharmacy && (
                <div className="pt-1 border-t border-border/50">
                  <Input 
                    type="text" 
                    placeholder="Dosage / instructions (e.g. 1x3 daily)" 
                    value={item.notes || ""} 
                    onChange={e => setItemNotes(item.cartItemId, e.target.value)}
                    className="h-7 text-xs px-2 bg-background border-border"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Total & Checkout */}
      <div className="px-4 py-3 border-t border-border bg-secondary/40 space-y-3 pb-8 lg:pb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Subtotal</span>
          <span className="font-display font-bold text-lg text-primary">{formatNaira(total)}</span>
        </div>
        {isPharmacy && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> Link Patient (optional)</label>
            <select
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-border bg-card px-2 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Walk-in / No patient</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.phone}</option>
              ))}
            </select>
          </div>
        )}
        <Button
          className="w-full gap-2 font-bold"
          disabled={cart.filter(i => i.qty > 0).length === 0}
          onClick={() => {
            const hasRx = isPharmacy && cart.some(i => i.requires_prescription);
            if (hasRx) {
              setRxVerificationOpen(true);
            } else {
              setCheckoutOpen(true);
            }
          }}
          size="lg"
        >
          <Banknote className="h-4 w-4" /> Charge Customer
        </Button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <Helmet>
        <title>Cashier / POS — PharmIQ</title>
      </Helmet>

      {/* ── SUBSCRIPTION GATE ── */}
      {subLoaded && !posUnlocked && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6 gap-6">
          <div className="h-20 w-20 rounded-full bg-amber-500/10 text-amber-500 grid place-items-center">
            <Banknote className="h-10 w-10" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold mb-2">Cashier / POS is a Premium Feature</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              The Cashier POS requires an active subscription with at least
              <span className="font-bold text-foreground"> 5 tables (&#x20A6;10,000/month)</span>.
              Upgrade your plan to unlock walk-in order management, mixed orders, bank transfer tracking, and printed receipts.
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 max-w-xs w-full shadow-soft text-left space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What you unlock</div>
            {["Lightning-fast walk-in orders", "Cash, POS & Bank Transfer support", "Park &amp; Attend for transfers", "Dine In / Takeaway / Mixed orders", "Printable &amp; downloadable receipts"].map(f => (
              <div key={f} className="flex items-start gap-2 text-sm">
                <span className="text-primary mt-0.5">✓</span> <span dangerouslySetInnerHTML={{ __html: f }} />
              </div>
            ))}
          </div>
          <a href="/dashboard/settings#plan">
            <Button size="lg" className="gap-2 font-bold">
              <Banknote className="h-5 w-5" /> Upgrade to Unlock POS
            </Button>
          </a>
          {subStatus === "trial" && (
            <p className="text-xs text-muted-foreground">You are currently on a free trial. Subscribe to any plan with 5+ tables to access this feature.</p>
          )}
        </div>
      )}

      {/* ── MAIN POS CONTENT (only shown when unlocked) ── */}
      {posUnlocked && (<>

      {/* Paused orders warning banner */}
      {restaurant?.is_accepting_orders === false && (
        <div className="mb-4 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 flex items-center gap-3 text-destructive text-sm font-semibold">
          <span className="text-lg">🚫</span>
          <div>
            <div className="font-bold">Orders Are Currently Paused</div>
            <div className="text-xs font-normal text-destructive/80 mt-0.5">The restaurant is not accepting orders. Re-enable in <a href="/dashboard/settings" className="underline font-bold">Settings → Accepting Orders</a>.</div>
          </div>
        </div>
      )}

      {/* Hidden receipt for image export */}
      {successOrder && (
        <Receipt
          receiptRef={receiptRef}
          items={successOrder.items}
          total={successOrder.total}
          paymentMethod={successOrder.paymentMethod as PaymentMethod}
          customerName={successOrder.items.length > 0 ? (successOrder.items[0] as any)?.customerName || customerName : customerName}
          orderId={successOrder.shortCode}
          restaurantName={restaurant?.name || "Pharmacy"}
          change={Math.max(0, successOrder.cashGiven - successOrder.total)}
          cashGiven={successOrder.cashGiven}
        />
      )}

      <div className="flex flex-col h-full gap-4 max-w-[1400px] mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <Monitor className="h-6 w-6 text-primary" /> Cashier / POS
            </h1>
            <p className="text-muted-foreground text-sm">
              {activeShift
                ? <span className="text-green-600 dark:text-green-400 font-semibold">● Shift active since {new Date(activeShift.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                : "Fast walk-in order entry for your cashier"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeShift && (
              <Button variant="outline" size="sm" onClick={handleOpenEndShift} className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10">
                <LogOut className="h-4 w-4" /> End Shift
              </Button>
            )}
            {!activeShift && (role === "owner" || role === "manager") && (
              <Button variant="outline" size="sm" onClick={handleOpenSettle} disabled={settleLoading} className="gap-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20 dark:text-amber-400">
                <CheckCircle2 className="h-4 w-4" /> Settle Day
              </Button>
            )}
            {cartCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive gap-1.5">
                <RotateCcw className="h-4 w-4" /> Clear Order
              </Button>
            )}
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="flex flex-col lg:flex-row gap-4 w-full h-[calc(100vh-180px)] lg:h-[calc(100vh-180px)] pb-16 lg:pb-0">

          {/* ── LEFT: Menu Panel ── */}
          <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">

          {/* Search bar row with barcode indicator */}
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {isPharmacy && (
                <form onSubmit={handleManualBarcode} className="relative shrink-0 w-32 sm:w-48">
                  <Scan className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Scan / enter barcode"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    className="pl-8 h-10 text-xs bg-secondary/50"
                  />
                </form>
              )}
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-hide">
              {["All", ...categories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-smooth border ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground border-primary shadow-glow"
                      : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu grid */}
            <div className="flex-1 overflow-y-auto rounded-xl">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-24 bg-secondary animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-16">
                  <UtensilsCrossed className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No items found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pb-4">
                  {filteredItems.map((item) => {
                    const inCart = cart.find((c) => c.id === item.id);
                    const isOutOfStock = item.track_inventory && item.stock_quantity <= 0;
                    return (
                      <button
                        key={item.id}
                        disabled={isOutOfStock}
                        onClick={() => addToCart(item)}
                        className={`group relative bg-card border rounded-xl p-3 text-left transition-all active:scale-95
                          ${isOutOfStock ? "opacity-50 grayscale cursor-not-allowed border-border" : inCart ? "border-primary bg-primary-soft" : "border-border hover:border-primary/60 hover:shadow-md"}
                        `}
                      >
                        {/* Item image — for pharmacy, show a styled pill-badge placeholder instead */}
                        {item.image ? (
                          <div className="w-full h-16 rounded-lg overflow-hidden mb-2 bg-secondary">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ) : isPharmacy ? (
                          <div className="w-full h-16 rounded-lg mb-2 bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center px-2 overflow-hidden">
                            <span className="text-[10px] font-bold text-primary text-center leading-tight line-clamp-2 break-words">{item.name}</span>
                          </div>
                        ) : null}
                        <div className="font-semibold text-xs leading-tight line-clamp-2 mb-1">{item.name}</div>
                        <div className="text-primary font-bold text-sm">{formatNaira(item.price)}</div>
                        {item.requires_prescription && (
                          <div className="mt-1"><span className="text-[9px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit"><Shield className="h-2.5 w-2.5" />Rx</span></div>
                        )}
                        {isOutOfStock ? (
                           <div className="mt-1"><span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Out of Stock</span></div>
                        ) : inCart ? (
                          <Badge className="absolute top-2 right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full bg-primary">
                            {inCart.qty}
                          </Badge>
                        ) : null}
                        {!isOutOfStock && (
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Order Ticket Panel (Desktop) ── */}
          <div className="hidden lg:flex w-72 xl:w-80 shrink-0 h-full">
            {renderTicketPanel()}
          </div>
        </div>
      </div>

      {/* ── MOBILE FAB FOR TICKET ── */}
      <div className="lg:hidden fixed bottom-20 left-4 right-4 z-40">
        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetTrigger asChild>
            <Button size="lg" className="w-full rounded-2xl shadow-xl h-14 font-bold text-base flex items-center justify-between px-5">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> View Ticket
                {cartCount > 0 && <Badge variant="secondary" className="ml-1 bg-white text-primary hover:bg-white">{cartCount}</Badge>}
              </span>
              <span>{formatNaira(total)} <ChevronUp className="inline ml-1 h-4 w-4" /></span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col rounded-t-3xl">
            <SheetHeader className="sr-only">
              <SheetTitle>Order Ticket</SheetTitle>
            </SheetHeader>
            {renderTicketPanel()}
          </SheetContent>
        </Sheet>
      </div>

      {/* ── CHECKOUT MODAL ── */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>Select how the customer is paying</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Order summary */}
            <div className="bg-secondary/50 rounded-xl p-3 space-y-1.5 max-h-40 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.qty}× {item.name}</span>
                  <span className="font-medium">{formatNaira(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span>Total</span>
                <span className="text-primary">{formatNaira(total)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === "cash" ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50"
                }`}
              >
                <Banknote className="h-5 w-5 text-primary" />
                <span className="font-semibold text-xs text-center">Cash</span>
              </button>
              <button
                onClick={() => setPaymentMethod("pos_terminal")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === "pos_terminal" ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50"
                }`}
              >
                <CreditCard className="h-5 w-5 text-primary" />
                <span className="font-semibold text-xs text-center">POS Terminal</span>
              </button>
              <button
                onClick={() => setPaymentMethod("bank_transfer")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === "bank_transfer" ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50"
                }`}
              >
                <RotateCcw className="h-5 w-5 text-primary" />
                <span className="font-semibold text-xs text-center">Transfer</span>
              </button>
            </div>

            {/* Cash calculator */}
            {paymentMethod === "cash" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Cash Given</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter amount..."
                  value={cashGivenStr}
                  onChange={(e) => handleCashChange(e.target.value)}
                  className="text-lg font-bold h-12"
                />
                {/* Quick amounts */}
                <div className="flex gap-2 flex-wrap">
                  {quickCashAmounts().map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCashGivenStr(amt.toLocaleString("en-US"))}
                      className={`px-3 py-1 rounded-lg border text-xs font-bold transition-all ${
                        cashGiven === amt ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary"
                      }`}
                    >
                      {formatNaira(amt)}
                    </button>
                  ))}
                </div>
                {cashGiven >= total && (
                  <div className="bg-green-500/10 text-green-600 dark:text-green-400 rounded-xl p-3 flex justify-between font-bold">
                    <span>Change to return</span>
                    <span>{formatNaira(change)}</span>
                  </div>
                )}
                {cashGiven > 0 && cashGiven < total && (
                  <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium">
                    Short by {formatNaira(total - cashGiven)}
                  </div>
                )}
              </div>
            )}

            {(paymentMethod === "pos_terminal" || paymentMethod === "bank_transfer") && (
              <div className={`rounded-xl p-3 text-sm text-center w-full overflow-hidden break-words ${paymentMethod === "bank_transfer" ? "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400" : "bg-secondary/50 text-muted-foreground"}`}>
                {paymentMethod === "pos_terminal"
                  ? "Swipe / tap the customer's card on your POS terminal, then click Confirm below."
                  : <><span className="font-bold block mb-1">🏃 Park &amp; Attend</span><span className="text-xs leading-relaxed">Order goes to kitchen right away. A banner will remind you to confirm the transfer — serve the next customer meanwhile!</span></>}
              </div>
            )}

            <Button
              className="w-full gap-2 font-bold"
              size="lg"
              disabled={placing || (paymentMethod === "cash" && cashGiven > 0 && cashGiven < total)}
              onClick={placeOrder}
            >
              {placing ? (
                <><span className="animate-spin">⏳</span> Processing...</>
              ) : paymentMethod === "bank_transfer" ? (
                <><Clock className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Send to Kitchen &amp; Wait for Transfer</span><span className="sm:hidden">Send to Kitchen</span></>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Confirm &amp; Send to Kitchen</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── START SHIFT MODAL ── */}
      <Dialog open={shiftModalOpen} onOpenChange={setShiftModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Start Your Shift
            </DialogTitle>
            <DialogDescription>
              {previousShift ? "Please verify the handover balances from the previous shift. Edit the amounts if what you count differs from what was left." : "Enter your starting balances to begin your shift."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium block mb-1.5 flex justify-between">
                <span>Opening Cash (₦)</span>
                {previousShift && <span className="text-muted-foreground font-normal">Expected: {formatNaira(previousShift.settled_at ? 0 : (Number(previousShift.actual_cash) || 0))}</span>}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 5,000"
                value={startCashStr}
                onChange={(e) => handleCurrencyInput(e.target.value, setStartCashStr)}
                className="text-lg font-bold h-12"
                autoFocus
              />
              {previousShift && parseCurrency(startCashStr) !== (previousShift.settled_at ? 0 : (Number(previousShift.actual_cash) || 0)) && (
                <p className="text-xs text-destructive mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Variance of {formatNaira(parseCurrency(startCashStr) - (previousShift.settled_at ? 0 : (Number(previousShift.actual_cash) || 0)))} will be logged against previous shift.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5 flex justify-between">
                <span>POS Terminal Total (₦)</span>
                {previousShift && <span className="text-muted-foreground font-normal">Expected: {formatNaira(previousShift.settled_at ? 0 : (Number(previousShift.actual_pos) || 0))}</span>}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 50,000"
                value={startPosStr}
                onChange={(e) => handleCurrencyInput(e.target.value, setStartPosStr)}
                className="text-lg font-bold h-12"
              />
              {previousShift && parseCurrency(startPosStr) !== (previousShift.settled_at ? 0 : (Number(previousShift.actual_pos) || 0)) && (
                <p className="text-xs text-destructive mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Variance of {formatNaira(parseCurrency(startPosStr) - (previousShift.settled_at ? 0 : (Number(previousShift.actual_pos) || 0)))} will be logged.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5 flex justify-between">
                <span>Bank Transfers Total (₦)</span>
                {previousShift && <span className="text-muted-foreground font-normal">Expected: {formatNaira(previousShift.settled_at ? 0 : (Number(previousShift.actual_transfers) || 0))}</span>}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 20,000"
                value={startTransferStr}
                onChange={(e) => handleCurrencyInput(e.target.value, setStartTransferStr)}
                className="text-lg font-bold h-12"
              />
              {previousShift && parseCurrency(startTransferStr) !== (previousShift.settled_at ? 0 : (Number(previousShift.actual_transfers) || 0)) && (
                <p className="text-xs text-destructive mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Variance of {formatNaira(parseCurrency(startTransferStr) - (previousShift.settled_at ? 0 : (Number(previousShift.actual_transfers) || 0)))} will be logged.
                </p>
              )}
            </div>

            <Button className="w-full font-bold mt-2" size="lg" onClick={startShift} disabled={shiftLoading}>
              {shiftLoading ? <><span className="animate-spin mr-2">⏳</span> Starting...</> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Start Shift</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── END SHIFT MODAL ── */}
      <Dialog open={endShiftModalOpen} onOpenChange={setEndShiftModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" /> End Shift — Handover
            </DialogTitle>
            <DialogDescription>
              Count your totals and enter what you actually have. The system will detect any variance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium block mb-1">Actual Cash in Drawer (₦)</label>
              <Input type="text" inputMode="numeric" placeholder="0" value={endCashStr}
                onChange={(e) => handleCurrencyInput(e.target.value, setEndCashStr)} className="font-bold" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">POS Terminal Total (₦)</label>
              <Input type="text" inputMode="numeric" placeholder="0" value={endPosStr}
                onChange={(e) => handleCurrencyInput(e.target.value, setEndPosStr)} className="font-bold" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Bank Transfers Total (₦)</label>
              <Input type="text" inputMode="numeric" placeholder="0" value={endTransferStr}
                onChange={(e) => handleCurrencyInput(e.target.value, setEndTransferStr)} className="font-bold" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Notes (optional)</label>
              <Input placeholder="e.g. Gave change for ₦500 shortage..." value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)} />
            </div>
            <Button className="w-full font-bold" variant="destructive" size="lg" onClick={endShift} disabled={shiftLoading}>
              {shiftLoading ? <><span className="animate-spin mr-2">⏳</span> Ending...</> : <><LogOut className="h-4 w-4 mr-2" /> Confirm & End Shift</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── SETTLE DAY MODAL ── */}
      <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <CheckCircle2 className="h-5 w-5" /> End of Day Settlement
            </DialogTitle>
            <DialogDescription>
              Confirm that you have withdrawn the cash and settled the POS terminal. This will reset the expected starting balances for the next shift to ₦0.
            </DialogDescription>
          </DialogHeader>
          {lastClosedShift && (
            <div className="space-y-4 py-2">
              <div className="bg-secondary/40 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Actual Cash to Withdraw:</span>
                  <span className="font-bold">{formatNaira(Number(lastClosedShift.actual_cash) || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Actual POS Settled:</span>
                  <span className="font-bold">{formatNaira(Number(lastClosedShift.actual_pos) || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Actual Transfers Settled:</span>
                  <span className="font-bold">{formatNaira(Number(lastClosedShift.actual_transfers) || 0)}</span>
                </div>
              </div>
              <p className="text-xs bg-primary/10 text-primary p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                By confirming, the next staff member will be prompted to start with ₦0 in all categories.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="w-full" onClick={() => setSettleModalOpen(false)}>
                  Cancel
                </Button>
                <Button className="w-full font-bold" onClick={confirmSettle} disabled={settleLoading}>
                  {settleLoading ? "Settling..." : "Confirm Settlement"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── RX VERIFICATION DIALOG (Pharmacy only) ── */}
      <Dialog open={rxVerificationOpen} onOpenChange={(o) => { if (!o) { setRxVerificationOpen(false); setPharmacistPin(""); } }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" /> Prescription Required
            </DialogTitle>
            <DialogDescription>
              One or more items in this order require a valid prescription (Rx). Enter the pharmacist override PIN to proceed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 space-y-1">
              {cart.filter(i => i.requires_prescription).map(i => (
                <div key={i.cartItemId} className="flex items-center gap-2 text-xs text-destructive font-semibold">
                  <Shield className="h-3 w-3 shrink-0" /> {i.name}
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Pharmacist PIN</label>
              <Input
                type="password"
                placeholder="Enter 4-digit PIN"
                maxLength={6}
                value={pharmacistPin}
                onChange={e => setPharmacistPin(e.target.value.replace(/\D/g, ""))}
                className="text-center text-xl font-mono tracking-widest h-12"
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setRxVerificationOpen(false); setPharmacistPin(""); }}>Cancel</Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={() => {
                  // PIN "1234" is the mock pharmacist override PIN
                  if (pharmacistPin === "1234") {
                    setRxVerificationOpen(false);
                    setPharmacistPin("");
                    setCheckoutOpen(true);
                  } else {
                    toast.error("Incorrect PIN. Use 1234 (demo)");
                  }
                }}
              >
                <Shield className="h-4 w-4" /> Verify & Continue
              </Button>
            </div>
            <p className="text-[10px] text-center text-muted-foreground">Demo PIN: <strong>1234</strong></p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PENDING TRANSFER BANNERS ── */}
      {pendingTransfers.length > 0 && (
        <div className="fixed bottom-36 lg:bottom-6 left-4 z-50 flex flex-col gap-2 max-w-xs w-full">
          {pendingTransfers.map((pt) => {
            const waitSec = Math.floor((Date.now() - pt.placedAt) / 1000);
            const waitStr = waitSec >= 60 ? `${Math.floor(waitSec / 60)}m ${waitSec % 60}s` : `${waitSec}s`;
            return (
              <div
                key={pt.orderId}
                className="bg-amber-500 text-black rounded-2xl shadow-2xl border-2 border-amber-400 p-4 animate-in slide-in-from-right-4 duration-300"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-black text-sm flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> Awaiting Transfer
                    </div>
                    <div className="text-xs font-bold opacity-70 mt-0.5">
                      {pt.shortCode} · {pt.customerName} · waiting {waitStr}
                    </div>
                  </div>
                  <button
                    onClick={() => dismissTransfer(pt.orderId)}
                    className="h-6 w-6 rounded-full bg-black/20 grid place-items-center hover:bg-black/30 transition shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-xs font-semibold mb-3 opacity-80">
                  {pt.items.slice(0, 3).map(i => `${i.qty}× ${i.name}`).join(", ")}{pt.items.length > 3 ? " ..." : ""}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-base">{formatNaira(pt.total)}</span>
                  <Button
                    size="sm"
                    onClick={() => confirmTransfer(pt)}
                    disabled={confirmingTransfer?.orderId === pt.orderId}
                    className="bg-black text-white hover:bg-black/80 font-black text-xs rounded-xl gap-1.5 h-9 px-4 disabled:opacity-70"
                  >
                    {confirmingTransfer?.orderId === pt.orderId ? (
                      <><span className="animate-spin">⏳</span> Confirming...</>
                    ) : (
                      <><CheckCircle2 className="h-3.5 w-3.5" /> Transfer Received ✓</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SUCCESS + RECEIPT MODAL ── */}
      <Dialog open={!!successOrder} onOpenChange={(o) => { if (!o) { setSuccessOrder(null); clearCart(); setCheckoutOpen(false); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" /> Order Placed!
            </DialogTitle>
            <DialogDescription>
              {successOrder?.shortCode} has been sent to the kitchen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Summary */}
            <div className="bg-secondary/50 rounded-xl p-3 space-y-1 text-sm">
              {(successOrder?.items || []).map((item) => (
                <div key={item.cartItemId} className="flex justify-between">
                  <span className="text-muted-foreground">{item.qty}× {item.name}</span>
                  <span>{formatNaira(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span className="text-primary">{formatNaira(successOrder?.total || 0)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2 border-t border-border pt-2">
                <span>Order Type</span>
                <span className="font-semibold">{successOrder?.orderIntent === "takeaway" ? "Takeaway" : successOrder?.orderIntent === "mixed" ? "Mixed" : "Dine In"}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Payment</span>
                <span>{successOrder?.paymentMethod === "cash" ? "Cash" : successOrder?.paymentMethod === "pos_terminal" ? "POS Terminal" : "Bank Transfer"}</span>
              </div>
              {successOrder?.paymentMethod === "cash" && (successOrder?.cashGiven || 0) > 0 && (
                <div className="flex justify-between text-xs font-semibold text-green-600 dark:text-green-400">
                  <span>Change</span>
                  <span>{formatNaira(Math.max(0, (successOrder?.cashGiven || 0) - (successOrder?.total || 0)))}</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadReceipt()}>
                <Download className="h-4 w-4" /> Save PNG
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={printReceipt}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
            <Button
              className="w-full gap-2 font-bold"
              onClick={() => { setSuccessOrder(null); clearCart(); setCheckoutOpen(false); }}
            >
              <Plus className="h-4 w-4" /> New Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </>)}
    </DashboardLayout>
  );
}
