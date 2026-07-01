import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, Minus, ShoppingBag, ShoppingCart, Bell, Check, UtensilsCrossed, 
  ArrowRight, Search, X, Star, Send, Loader2, MessageSquareText, 
  ChevronRight, Sparkles, MapPin, Coffee, Flame, Heart
} from "lucide-react";
import { toast } from "sonner";
import { getCurrencySymbol } from "@/lib/format";

type DemoMenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
  options?: string[];
};

type DemoCartItem = DemoMenuItem & {
  qty: number;
  selectedOption?: string;
  notes?: string;
};

type DemoMessage = {
  id: string;
  sender: "customer" | "staff";
  body: string;
  time: string;
};

const DEMO_MENU: DemoMenuItem[] = [
  {
    id: "s1",
    name: "Spicy Beef Suya Platter",
    description: "Sizzling skewered beef seasoned with authentic Northern Nigerian yaji spice, garnished with fresh onions and tomatoes.",
    price: 4500,
    category: "Suya Starters",
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&q=80&w=600",
    available: true,
    options: ["Mild Spicy", "Medium Hot", "Yaji Fire! 🌶️"]
  },
  {
    id: "s2",
    name: "Gizzard & Dodo (Gizdodo)",
    description: "A mouthwatering stir-fry of peppered gizzard chunks and sweet fried plantain cubes in spicy tomato-bell pepper sauce.",
    price: 3500,
    category: "Suya Starters",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=600",
    available: true
  },
  {
    id: "m1",
    name: "Party Jollof Rice Feast",
    description: "Smoky, rich wood-fired party Jollof rice served with a juicy quarter grilled chicken, sweet plantain, and crisp coleslaw.",
    price: 6000,
    category: "Main Dishes",
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&q=80&w=600",
    available: true
  },
  {
    id: "m2",
    name: "Pounded Yam & Egusi Soup",
    description: "Smooth, fluffy pounded yam served with rich melon-seed soup, cooked with assorted meats, stockfish, shaki, and fresh spinach.",
    price: 7500,
    category: "Main Dishes",
    image: "https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&q=80&w=600",
    available: true,
    options: ["Assorted Meat", "Beef Only", "Fish & Stockfish"]
  },
  {
    id: "d1",
    name: "Signature Chapman Mocktail",
    description: "The timeless Nigerian signature mocktail: bubbly, citrusy, and refreshing, infused with blackcurrant syrup and cucumber.",
    price: 2000,
    category: "Chilled Drinks",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=600",
    available: true
  },
  {
    id: "d2",
    name: "Sweet Bottled Palm Wine",
    description: "Freshly tapped, chilled sweet local palm wine, providing the perfect cooling match to spicy suya dishes.",
    price: 2500,
    category: "Chilled Drinks",
    image: "https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?auto=format&fit=crop&q=80&w=600",
    available: true
  }
];

export const QrDemo = () => {
  const navigate = useNavigate();

  // Navigation states
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeItem, setActiveItem] = useState<DemoMenuItem | null>(null);

  // Customization Options
  const [selectedOption, setSelectedOption] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [itemQty, setItemQty] = useState(1);

  // Cart States
  const [cart, setCart] = useState<DemoCartItem[]>([]);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [orderIntent, setOrderIntent] = useState<"dine-in" | "takeaway">("dine-in");

  // Simulated Tracker States
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderStep, setOrderStep] = useState<"pending" | "cooking" | "served">("pending");
  const [trackerTimer, setTrackerTimer] = useState(10); // Countdown for demo progress

  // Interactive Live Chat States
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<DemoMessage[]>([
    { id: "m1", sender: "staff", body: "Hello! Welcome to The Suya Spot demo kitchen. Chef Ada here! We have received your order details.", time: "Just now" }
  ]);
  const [staffTyping, setStaffTyping] = useState(false);
  const [userMsgCount, setUserMsgCount] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, staffTyping]);

  // Handle active item selection reset
  useEffect(() => {
    if (activeItem) {
      setSelectedOption(activeItem.options ? activeItem.options[0] : "");
      setCustomNotes("");
      setItemQty(1);
    }
  }, [activeItem]);

  // Order status progression simulation
  useEffect(() => {
    if (!orderPlaced) return;

    // Transition from Pending to Cooking in 4 seconds
    const step1 = setTimeout(() => {
      setOrderStep("cooking");
      setMessages(prev => [
        ...prev,
        { id: `sys-${Date.now()}`, sender: "staff", body: "🍳 Your Jollof Rice & Suya are now in the kitchen! Chef Ada is seasoning them fresh for you right now.", time: "2 min ago" }
      ]);
    }, 4500);

    // Transition from Cooking to Served in 15 seconds
    const step2 = setTimeout(() => {
      setOrderStep("served");
      setMessages(prev => [
        ...prev,
        { id: `sys-${Date.now()}`, sender: "staff", body: "🎉 Hot, steaming, and delicious! Your food has been served directly to Table 5. Bon appétit! 😋", time: "Just now" }
      ]);
    }, 16000);

    // Countdown timer for visualization
    const interval = setInterval(() => {
      setTrackerTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1500);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearInterval(interval);
    };
  }, [orderPlaced]);

  const handleAddToCart = () => {
    if (!activeItem) return;
    const newItem: DemoCartItem = {
      ...activeItem,
      qty: itemQty,
      selectedOption: selectedOption || undefined,
      notes: customNotes.trim() || undefined
    };

    setCart(prev => {
      const match = prev.find(
        i => i.id === newItem.id && i.selectedOption === newItem.selectedOption && i.notes === newItem.notes
      );
      if (match) {
        return prev.map(i => i === match ? { ...i, qty: i.qty + itemQty } : i);
      }
      return [...prev, newItem];
    });

    toast.success(`${itemQty}x ${activeItem.name} added to tray`);
    setActiveItem(null);
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    toast.message("Item removed from tray");
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i === index) {
        const newQty = item.qty + delta;
        return newQty <= 0 ? item : { ...item, qty: newQty };
      }
      return item;
    }).filter(i => i.qty > 0));
  };

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    setIsPlacingOrder(true);
    setTimeout(() => {
      setIsPlacingOrder(false);
      setOrderPlaced(true);
      setCartSheetOpen(false);
      toast.success("Mock Order placed successfully! View Live Tracker.");
    }, 1500);
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    
    // Add user message
    setMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: "customer", body: userMsg, time: "Just now" }]);
    setUserMsgCount(c => c + 1);

    // Simulate staff response
    setStaffTyping(true);
    const typingTime = 1500 + Math.random() * 1500;
    setTimeout(() => {
      setStaffTyping(false);
      let reply = "Coming right up! Anything else you need, please let me know.";
      const currentCount = userMsgCount + 1;
      
      if (currentCount === 1) {
        reply = "Absolutely! Suya is grilling fresh over the hot coals as we speak. I've also made sure the Chapman mocktail is perfectly chilled with extra cucumber blocks! 🧊";
      } else if (currentCount === 2) {
        reply = "Just double checked with the waitstaff, they are putting your trays together and heading over to Table 5 now! Under 2 minutes!";
      } else {
        reply = "My pleasure! We are always happy to help. Let us know how you enjoy the spices!";
      }

      setMessages(prev => [...prev, { id: `staff-${Date.now()}`, sender: "staff", body: reply, time: "Just now" }]);
    }, typingTime);
  };

  const totalNaira = cart.reduce((acc, i) => acc + i.price * i.qty, 0);

  const categories = ["All", "Suya Starters", "Main Dishes", "Chilled Drinks"];
  
  const filteredMenu = DEMO_MENU.filter(item => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-0 sm:p-6 lg:p-12 relative overflow-hidden">
      <Helmet>
        <title>Interactive QR Menu Simulator — PharmIQ Nigeria</title>
        <meta name="description" content="Experience the high-fidelity mock ordering flow of PharmIQ on a simulated customer device. Add dishes, test live order tracking, and chat with staff." />
      </Helmet>

      {/* Decorative blurred backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-pink-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-rose-600/15 rounded-full blur-[120px]" />

      {/* Main Container */}
      <div className="w-full max-w-6xl z-10 flex flex-col lg:flex-row gap-8 items-center justify-center">
        
        {/* Left Side: Explanatory Card */}
        <div className="lg:w-5/12 text-white space-y-6 px-4 md:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-colors text-sm font-semibold">
            ← Back to PharmIQ home
          </Link>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> Live Simulator
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Experience <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-500">QR Ordering</span> live
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              This interactive widget demonstrates exactly what a customer sees after scanning a PharmIQ QR code at their table. Explore the menu, build a custom meal tray, configure swallow/spice choices, and witness order progress with live-updating kitchen communication.
            </p>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-800 grid place-items-center text-rose-400 border border-slate-700">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Nigerian Culinary Catalog</h4>
                <p className="text-xs text-slate-400 mt-0.5">Custom items showcasing traditional food pairings, swallow selections, and authentic local spices.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-800 grid place-items-center text-rose-400 border border-slate-700">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Live Kitchen Tracking Simulator</h4>
                <p className="text-xs text-slate-400 mt-0.5">Automated updates mimicking real-time kitchen operations, taking you from raw prep to the table.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-800 grid place-items-center text-rose-400 border border-slate-700">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Automated Instant Messaging</h4>
                <p className="text-xs text-slate-400 mt-0.5">Experience the unique customer-waitstaff messaging panel, receiving dynamic instant assistance from Chef Ada.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: High-Fidelity Smartphone Mockup */}
        <div className="w-full sm:w-[410px] h-[780px] bg-slate-950 border-[6px] border-slate-800 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative shrink-0">
          
          {/* Phone top notch speaker camera bar */}
          <div className="absolute top-0 inset-x-0 h-6 bg-slate-800 flex justify-center items-center z-50">
            <div className="w-20 h-4 bg-slate-950 rounded-full flex justify-around items-center px-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />
              <span className="h-1 w-8 rounded-full bg-slate-800" />
            </div>
          </div>

          {/* Menu Catalog View */}
          {!orderPlaced ? (
            <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 pt-6 overflow-hidden relative">
              
              {/* Header Details */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-30">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/30 grid place-items-center text-rose-500">
                    <Coffee className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wide leading-none">THE SUYA SPOT</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <MapPin className="h-2 w-2 text-rose-500" /> Table 5 · Dine In
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Demo Mode</span>
                </div>
              </div>

              {/* Scrollable menu catalog */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 pb-20">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input 
                    placeholder="Search spicy Jollof, Suya..." 
                    className="pl-9 h-9 bg-slate-900 border-slate-800 text-xs rounded-xl focus-visible:ring-rose-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Categories filter */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 border transition-all ${
                        selectedCategory === cat 
                          ? "bg-rose-500 border-rose-600 text-white font-black shadow-md shadow-rose-500/20" 
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Food Listing */}
                <div className="space-y-3">
                  {filteredMenu.length > 0 ? (
                    filteredMenu.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setActiveItem(item)}
                        className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm hover:border-rose-500/30 transition-all cursor-pointer flex gap-3 p-2.5 active:scale-[0.98]"
                      >
                        <div className="h-16 w-16 rounded-lg bg-slate-800 shrink-0 overflow-hidden border border-slate-800 relative">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div>
                            <h4 className="font-bold text-xs leading-none line-clamp-1 hover:text-rose-400 transition-colors">{item.name}</h4>
                            <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">{item.description}</p>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-extrabold text-xs text-rose-400">{getCurrencySymbol()}{item.price.toLocaleString()}</span>
                            <div className="h-6 w-6 rounded-md bg-rose-500 text-white grid place-items-center shadow-sm">
                              <Plus className="h-3 w-3 stroke-[3]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No matching dishes found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Floating Bottom Cart Bar */}
              {cart.length > 0 && (
                <div className="absolute bottom-3 inset-x-3 bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-lg flex items-center justify-between z-35 animate-in slide-in-from-bottom duration-300">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 bg-rose-500 rounded-lg flex items-center justify-center text-white relative">
                      <ShoppingBag className="h-4.5 w-4.5" />
                      <span className="absolute -top-1.5 -right-1.5 bg-white text-rose-600 font-black text-[9px] h-4 w-4 rounded-full flex items-center justify-center border border-rose-500">
                        {cart.reduce((acc, i) => acc + i.qty, 0)}
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 leading-none">Tray Total</div>
                      <div className="text-xs font-black text-rose-400 mt-1">{getCurrencySymbol()}{totalNaira.toLocaleString()}</div>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    className="bg-rose-500 hover:bg-rose-600 text-[10px] font-black h-8 rounded-lg px-3.5 flex items-center gap-1.5 shadow-md shadow-rose-500/20"
                    onClick={() => setCartSheetOpen(true)}
                  >
                    View Tray <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            
            /* Order Tracker View */
            <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 pt-6 overflow-hidden relative">
              
              {/* Header details */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-30">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-rose-500/10 border border-rose-500/30 grid place-items-center text-rose-500">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wide leading-none">LIVE ORDER TRACKER</h3>
                    <p className="text-[9px] text-slate-400 mt-0.5">Order #ST-9952 · Table 5</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setChatOpen(true)} 
                    className="h-8 w-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white relative active:scale-95 transition-all"
                  >
                    <MessageSquareText className="h-4 w-4" />
                    {messages.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-rose-500 h-2 w-2 rounded-full" />
                    )}
                  </button>
                  <button 
                    onClick={() => {
                      setOrderPlaced(false);
                      setCart([]);
                    }} 
                    className="h-8 w-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Tracking Progression */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-20">
                
                {/* Visual state illustration card */}
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 text-center space-y-3 relative overflow-hidden">
                  
                  {/* Subtle pulsing color accent based on stage */}
                  <div className={`absolute top-0 inset-x-0 h-1 ${
                    orderStep === "pending" ? "bg-amber-500" : orderStep === "cooking" ? "bg-rose-500" : "bg-emerald-500"
                  }`} />

                  {orderStep === "pending" && (
                    <div className="space-y-2">
                      <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-500 grid place-items-center mx-auto animate-bounce">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                      <h4 className="font-extrabold text-xs">Waiting for Confirmation...</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed px-3">
                        Kitchen dashboard is acknowledging your order. Chef Ada is reviewing the details!
                      </p>
                    </div>
                  )}

                  {orderStep === "cooking" && (
                    <div className="space-y-2">
                      <div className="h-10 w-10 rounded-full bg-rose-500/10 text-rose-500 grid place-items-center mx-auto animate-pulse">
                        <Flame className="h-5 w-5 animate-pulse" />
                      </div>
                      <h4 className="font-extrabold text-xs">Chef Ada is cooking! 🍳</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed px-3">
                        Your Jollof feast is on the wood coals! Grilling and preparation in active progress.
                      </p>
                    </div>
                  )}

                  {orderStep === "served" && (
                    <div className="space-y-2 animate-in fade-in zoom-in duration-500">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-400 grid place-items-center mx-auto shadow-lg shadow-emerald-500/10">
                        <Check className="h-5 w-5 stroke-[3]" />
                      </div>
                      <h4 className="font-extrabold text-xs text-emerald-400">Deliciously Served! 🌶️</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed px-3">
                        All plates have been served hot at Table 5. Let us know if you need anything else!
                      </p>
                    </div>
                  )}

                  {/* Micro-Progress steps */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[8px] font-black tracking-widest text-slate-500 uppercase">
                    <span className={orderStep === "pending" ? "text-amber-500 font-extrabold" : "text-emerald-500"}>1. Confirm</span>
                    <ChevronRight className="h-2 w-2" />
                    <span className={orderStep === "cooking" ? "text-rose-400 font-extrabold" : orderStep === "served" ? "text-emerald-500" : ""}>2. Prepare</span>
                    <ChevronRight className="h-2 w-2" />
                    <span className={orderStep === "served" ? "text-emerald-400 font-extrabold" : ""}>3. Serve</span>
                  </div>
                </div>

                {/* Order Summary details */}
                <div className="space-y-2">
                  <div className="text-[9px] font-black tracking-widest text-slate-500 uppercase">Meal Details</div>
                  <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-3 space-y-2">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start text-xs border-b border-slate-900/60 pb-1.5 last:border-b-0 last:pb-0">
                        <div>
                          <span className="font-extrabold text-rose-400">{item.qty}x</span> {item.name}
                          {item.selectedOption && (
                            <div className="text-[9px] text-slate-400 mt-0.5">Choice: {item.selectedOption}</div>
                          )}
                          {item.notes && (
                            <div className="text-[9px] text-slate-400 italic mt-0.5">Note: "{item.notes}"</div>
                          )}
                        </div>
                        <span className="font-extrabold text-[10px]">{getCurrencySymbol()}{(item.price * item.qty).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-bold text-xs">
                      <span>Total Price</span>
                      <span className="text-rose-400 font-black">{getCurrencySymbol()}{totalNaira.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp simulated nudge notice */}
                <div className="bg-slate-900/10 border border-slate-900 rounded-xl p-3 flex gap-2.5 items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <div className="text-[10px] text-slate-400 leading-normal">
                    Real-time notifications are running. In production, kitchen alerts sync instantly via WhatsApp and WebPush.
                  </div>
                </div>
              </div>

              {/* Chat Helper Button */}
              <div className="absolute bottom-3 inset-x-3 z-30">
                <Button
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-black h-10 rounded-xl gap-2 shadow-lg shadow-rose-500/20"
                  onClick={() => setChatOpen(true)}
                >
                  <MessageSquareText className="h-4.5 w-4.5" />
                  Chat with Chef Ada
                </Button>
              </div>
            </div>
          )}

          {/* Detailed Customization Modal */}
          {activeItem && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-40 flex flex-col justify-end animate-in fade-in duration-300">
              <div className="bg-slate-900 border-t border-slate-800 rounded-t-[1.75rem] max-h-[85%] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                
                {/* Modal Header */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800">
                  <h3 className="font-extrabold text-xs text-white">Customize Dish</h3>
                  <button 
                    onClick={() => setActiveItem(null)}
                    className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Photo & Description */}
                  <div className="flex gap-3">
                    <div className="h-16 w-16 rounded-lg overflow-hidden shrink-0 border border-slate-800">
                      <img src={activeItem.image} alt={activeItem.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs leading-none">{activeItem.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">{activeItem.description}</p>
                    </div>
                  </div>

                  {/* Multi-option selection */}
                  {activeItem.options && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Select Customization</label>
                      <div className="grid gap-2">
                        {activeItem.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setSelectedOption(opt)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                              selectedOption === opt 
                                ? "bg-rose-500/10 border-rose-500 text-rose-400" 
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <span>{opt}</span>
                            {selectedOption === opt && <Check className="h-4 w-4 stroke-[3]" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes input */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Special Instructions</label>
                    <Textarea 
                      placeholder="e.g. Extra pepper, no onions, pack stew separately..."
                      className="bg-slate-900 border-slate-800 text-xs rounded-xl focus-visible:ring-rose-500 min-h-[60px]"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                    />
                  </div>

                  {/* Quantity selector */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs font-extrabold">Quantity</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setItemQty(q => q > 1 ? q - 1 : 1)}
                        className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-extrabold text-sm">{itemQty}</span>
                      <button 
                        onClick={() => setItemQty(q => q + 1)}
                        className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/50">
                  <div>
                    <div className="text-[9px] text-slate-400">Subtotal</div>
                    <div className="font-black text-rose-400 text-sm">{getCurrencySymbol()}{(activeItem.price * itemQty).toLocaleString()}</div>
                  </div>
                  <Button 
                    className="bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-xl h-10 px-5 shadow-lg shadow-rose-500/20"
                    onClick={handleAddToCart}
                  >
                    Add to Meal Tray
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Cart Bottom Sheet (Mock View Tray) */}
          {cartSheetOpen && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-40 flex flex-col justify-end animate-in fade-in duration-300">
              <div className="bg-slate-900 border-t border-slate-800 rounded-t-[1.75rem] max-h-[85%] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                
                {/* Sheet Header */}
                <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4 text-rose-500" />
                    <h3 className="font-extrabold text-xs text-white">Your Meal Tray</h3>
                  </div>
                  <button 
                    onClick={() => setCartSheetOpen(false)}
                    className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Sheet Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  
                  {/* Order Intent Toggle */}
                  <div className="bg-slate-950 p-1.5 rounded-xl flex gap-2">
                    <button
                      onClick={() => setOrderIntent("dine-in")}
                      className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${
                        orderIntent === "dine-in" 
                          ? "bg-rose-500 text-white font-black shadow-md shadow-rose-500/20" 
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      🍽️ Dine In Table 5
                    </button>
                    <button
                      onClick={() => setOrderIntent("takeaway")}
                      className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${
                        orderIntent === "takeaway" 
                          ? "bg-rose-500 text-white font-black shadow-md shadow-rose-500/20" 
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      🥡 Takeaway Box
                    </button>
                  </div>

                  {/* Cart Items List */}
                  <div className="space-y-3">
                    {cart.map((item, index) => (
                      <div key={index} className="bg-slate-950/40 border border-slate-900 rounded-xl p-3 flex gap-3 relative">
                        <button
                          onClick={() => handleRemoveFromCart(index)}
                          className="absolute top-2.5 right-2.5 h-6 w-6 text-slate-500 hover:text-rose-400 flex items-center justify-center transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        
                        <div className="h-12 w-12 rounded-lg bg-slate-800 overflow-hidden shrink-0 border border-slate-900">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0 pr-6 flex flex-col justify-between">
                          <div>
                            <h4 className="font-extrabold text-xs leading-none line-clamp-1">{item.name}</h4>
                            {item.selectedOption && (
                              <p className="text-[9px] text-slate-400 mt-1">Choice: {item.selectedOption}</p>
                            )}
                            {item.notes && (
                              <p className="text-[9px] text-slate-400 italic mt-0.5">" {item.notes} "</p>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-black text-rose-400 text-xs">{getCurrencySymbol()}{(item.price * item.qty).toLocaleString()}</span>
                            
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => updateCartQty(index, -1)}
                                className="h-6 w-6 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="font-extrabold text-xs min-w-[12px] text-center">{item.qty}</span>
                              <button 
                                onClick={() => updateCartQty(index, 1)}
                                className="h-6 w-6 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sheet Footer */}
                <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-900/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Price</span>
                    <span className="font-black text-rose-400 text-base">{getCurrencySymbol()}{totalNaira.toLocaleString()}</span>
                  </div>
                  <Button 
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-xl h-11 shadow-lg shadow-rose-500/20 gap-2"
                    onClick={handlePlaceOrder}
                    disabled={isPlacingOrder}
                  >
                    {isPlacingOrder ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Confirming with Kitchen...
                      </>
                    ) : (
                      <>
                        Confirm & Place Order <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Chat Window overlay */}
          {chatOpen && (
            <div className="absolute inset-0 bg-slate-950 z-50 flex flex-col animate-in slide-in-from-right duration-300">
              
              {/* Chat Header */}
              <div className="px-4 pt-6 pb-2.5 flex items-center justify-between border-b border-slate-900 bg-slate-950">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-rose-500/10 border border-rose-500/30 grid place-items-center text-rose-500">
                    <UtensilsCrossed className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black tracking-wide leading-none">Chef Ada</h3>
                    <p className="text-[8px] text-emerald-400 mt-0.5 flex items-center gap-1 font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active in Kitchen
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setChatOpen(false)}
                  className="h-7 w-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Chat Messages Log */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/20">
                {messages.map((m) => (
                  <div 
                    key={m.id} 
                    className={`flex flex-col max-w-[80%] ${m.sender === "customer" ? "ml-auto items-end" : "mr-auto items-start"}`}
                  >
                    <div className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                      m.sender === "customer" 
                        ? "bg-rose-500 text-white rounded-tr-none font-medium" 
                        : "bg-slate-900 text-slate-100 rounded-tl-none border border-slate-800"
                    }`}>
                      {m.body}
                    </div>
                    <span className="text-[8px] text-slate-500 mt-1 px-1">{m.time}</span>
                  </div>
                ))}

                {staffTyping && (
                  <div className="flex flex-col mr-auto max-w-[80%] items-start animate-pulse">
                    <div className="p-2.5 rounded-xl text-[10px] italic bg-slate-900 text-slate-400 rounded-tl-none border border-slate-800 flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-rose-500" /> Chef Ada is typing...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 border-t border-slate-900 bg-slate-950 flex gap-2">
                <Input
                  placeholder="Type a message for Chef Ada..."
                  className="bg-slate-900 border-slate-800 text-xs rounded-xl focus-visible:ring-rose-500"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <Button 
                  size="sm"
                  className="bg-rose-500 hover:bg-rose-600 h-9 w-9 rounded-xl shrink-0 p-0 flex items-center justify-center shadow-md shadow-rose-500/20"
                  onClick={handleSendMessage}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QrDemo;
