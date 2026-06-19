import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, KeyRound, MapPin, Loader2, ArrowLeft, NavigationOff, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandedLoader } from "@/components/LoadingState";

const Join = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const searchParams = new URLSearchParams(window.location.search);
  const [table, setTable] = useState(searchParams.get("table") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [restaurantData, setRestaurantData] = useState<{ 
    id: string; 
    name: string; 
    table_count: number;
    geofencing_enabled?: boolean;
    geofencing_radius?: number;
    latitude?: number;
    longitude?: number;
    staff_codes?: string[];
  } | null>(null);
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [checkingLocation, setCheckingLocation] = useState(false);

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

  const addToHistory = (rid: string, name: string, table: string) => {
    try {
      const saved = localStorage.getItem("st.scan_history");
      const history = saved ? JSON.parse(saved) : [];
      const newEntry = { restaurantId: rid, restaurantName: name, table, timestamp: Date.now() };
      const updated = [newEntry, ...history.filter((h: any) => h.restaurantId !== rid)].slice(0, 5);
      localStorage.setItem("st.scan_history", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const checkGeofencing = async (res: any): Promise<boolean> => {
    if (!res.geofencing_enabled || !res.latitude || !res.longitude) return true;

    setCheckingLocation(true);
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.error("Location is required to join this restaurant.");
        setIsOutOfRange(true);
        setCheckingLocation(false);
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const d = calculateDistance(pos.coords.latitude, pos.coords.longitude, res.latitude, res.longitude);
          setDistance(Math.round(d));
          setCheckingLocation(false);
          if (d > (res.geofencing_radius || 300)) {
            setIsOutOfRange(true);
            resolve(false);
          } else {
            setIsOutOfRange(false);
            resolve(true);
          }
        },
        (err) => {
          toast.error("Please enable location to join this restaurant.");
          setIsOutOfRange(true);
          setCheckingLocation(false);
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = code.trim().toUpperCase();
    if (raw.length < 2) return toast.error("Please enter a valid code");

    let shortCode = raw;
    let tableOrStaff = "";

    // If there's a space, e.g. "FEY 1" or "FEY JOHN"
    if (raw.includes(" ")) {
      const parts = raw.split(/\s+/);
      shortCode = parts[0];
      tableOrStaff = parts.slice(1).join(" ").replace(/^T(?:ABLE)?\s*/i, "");
    } else {
      // If no space, check if it's letters followed by numbers e.g. "FEY1"
      const numMatch = raw.match(/^([A-Z]{3,6})T?(\d+)$/i);
      if (numMatch) {
        shortCode = numMatch[1];
        tableOrStaff = numMatch[2];
      }
    }

    if (shortCode && tableOrStaff) {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, table_count, geofencing_enabled, geofencing_radius, latitude, longitude, staff_codes")
        .eq("short_code", shortCode)
        .maybeSingle();

      if (error || !data) {
        setIsLoading(false);
        return toast.error(`Business '${shortCode}' not found.`);
      }

      const canJoin = await checkGeofencing(data);
      setIsLoading(false);
      if (!canJoin) return;
      
      const isStaff = data.staff_codes?.map((c: string) => c.toUpperCase()).includes(tableOrStaff.toUpperCase());
      
      // Validate table count if it's not a staff code
      if (!isStaff) {
        const num = parseInt(tableOrStaff);
        const max = data.table_count || 0;
        if (isNaN(num) || num < 1 || num > max) {
          return toast.error(`Invalid table. '${data.name}' only has ${max} tables.`);
        }
      }
      
      // Found both! Redirect immediately
      addToHistory(data.id, data.name, tableOrStaff.toUpperCase());
      navigate(`/menu/${tableOrStaff.toUpperCase()}?r=${data.id}`);
      return;
    }

    // Otherwise, treat as just the code and move to Step 2
    setIsLoading(true);
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, table_count, geofencing_enabled, geofencing_radius, latitude, longitude, staff_codes")
      .eq("short_code", raw)
      .maybeSingle();

    if (error || !data) {
      setIsLoading(false);
      return toast.error("Invalid Code. Please check and try again.");
    }

    const canJoin = await checkGeofencing(data);
    setIsLoading(false);
    if (!canJoin) return;

    setRestaurantData(data);
    
    if (table) {
      const isStaff = data.staff_codes?.map((c: string) => c.toUpperCase()).includes(table.toUpperCase());
      if (!isStaff) {
        const num = parseInt(table);
        const max = data.table_count || 0;
        if (!isNaN(num) && num >= 1 && num <= max) {
          addToHistory(data.id, data.name, table.toUpperCase());
          navigate(`/menu/${table.toUpperCase()}?r=${data.id}`);
          return;
        }
      } else {
        addToHistory(data.id, data.name, table.toUpperCase());
        navigate(`/menu/${table.toUpperCase()}?r=${data.id}`);
        return;
      }
    }
    
    setStep(2);
  };

  const handleTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTable = table.trim();
    if (!cleanTable) return toast.error("Please enter your table number");

    if (restaurantData) {
      const isStaff = restaurantData.staff_codes?.map((c: string) => c.toUpperCase()).includes(cleanTable.toUpperCase());
      
      if (!isStaff) {
        const num = parseInt(cleanTable);
        const max = restaurantData.table_count || 0;
        if (isNaN(num) || num < 1 || num > max) {
          return toast.error(`Invalid table. '${restaurantData.name}' only has ${max} tables.`);
        }
      }
      
      addToHistory(restaurantData.id, restaurantData.name, cleanTable.toUpperCase());
      navigate(`/menu/${cleanTable.toUpperCase()}?r=${restaurantData.id}`);
    }
  };

  if (isOutOfRange && restaurantData?.geofencing_enabled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Helmet><title>Out of Range | PharmIQ</title></Helmet>
        <div className="max-w-sm">
          <div className="h-20 w-20 mx-auto bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center mb-6 shadow-soft">
            <NavigationOff className="h-10 w-10" />
          </div>
          <h1 className="font-display font-black text-2xl mb-3">Out of Range</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You must be at <strong>{restaurantData.name}</strong> to join a table and place orders.
          </p>
          <div className="mt-8 pt-6 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Estimated distance</p>
            <p className="text-2xl font-black text-primary mt-1">{distance ? `${(distance / 1000).toFixed(1)}km` : '---'}</p>
          </div>
          <Button variant="outline" className="mt-8 rounded-xl w-full" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || checkingLocation) {
    return <BrandedLoader fullscreen message={checkingLocation ? "Verifying location..." : "Verifying code..."} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Helmet>
        <title>Join Table | PharmIQ</title>
        <meta property="og:title" content="Join Your Table | PharmIQ" />
        <meta property="og:description" content="Enter your table code to view the menu and place your order instantly." />
        <meta property="og:image" content="https://smarttable.com.ng/og-image.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      <div className="w-full max-w-sm">
        
        {/* Logo Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="h-16 w-16 mx-auto bg-primary rounded-2xl flex items-center justify-center shadow-glow mb-4">
            <KeyRound className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display font-black text-3xl">Smart Join</h1>
          <p className="text-muted-foreground mt-2 font-medium">Connect directly to your table</p>
        </div>

        {/* Wizard Container */}
        <div className="bg-card border border-border shadow-soft rounded-[2.5rem] p-6 relative overflow-hidden min-h-[250px]">
          
          {step === 1 && (
            <div className="animate-in slide-in-from-right-4 fade-in duration-500 h-full flex flex-col justify-center">
              <div className="text-center mb-6">
                <h2 className="font-display text-xl font-bold">{table ? `Table ${table} • Enter Code` : "Enter Code"}</h2>
                <p className="text-xs text-muted-foreground mt-1">Found on your table tent or screen</p>
              </div>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <input
                  type="text"
                  placeholder="e.g. GALA24"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full h-16 text-center text-2xl font-black tracking-widest bg-secondary/50 border-2 border-border focus:border-primary focus:bg-card rounded-2xl outline-none transition-all uppercase"
                  autoFocus
                />
                <Button 
                  type="submit" 
                  className="w-full h-14 rounded-xl font-black text-lg gap-2" 
                  disabled={isLoading || code.length < 2}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"} <ArrowRight className="h-5 w-5" />
                </Button>
                <Link
                  to="/scan"
                  className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all font-bold text-sm"
                >
                  <QrCode className="h-4 w-4" />
                  Scan QR Code instead
                </Link>
                <p className="text-[10px] text-center font-bold text-muted-foreground/50 uppercase tracking-widest mt-2">
                  Tip: Enter code &amp; table together (e.g. FEY 1)
                </p>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in slide-in-from-right-4 fade-in duration-500 h-full flex flex-col justify-center">
              <button 
                onClick={() => setStep(1)}
                className="absolute top-6 left-6 p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              
              <div className="text-center mb-6 mt-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest mb-3 max-w-full">
                  <MapPin className="h-3 w-3 shrink-0" /> 
                  <span className="truncate">{restaurantData?.name}</span>
                </div>
                <h2 className="font-display text-xl font-bold">Which Table?</h2>
                <p className="text-xs text-muted-foreground mt-1">Enter your assigned table number</p>
              </div>
              <form onSubmit={handleTableSubmit} className="space-y-4">
                <input
                  type="text"
                  placeholder="e.g. 5"
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                  className="w-full h-16 text-center text-3xl font-black bg-secondary/50 border-2 border-border focus:border-primary focus:bg-card rounded-2xl outline-none transition-all"
                  min={1}
                  autoFocus
                />
                <Button 
                  type="submit" 
                  className="w-full h-14 rounded-xl font-black text-lg gap-2" 
                  disabled={!table}
                >
                  Join Now <ArrowRight className="h-5 w-5" />
                </Button>
              </form>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default Join;
