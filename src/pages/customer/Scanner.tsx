import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode, History, ArrowRight, Camera, X, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

type ScanHistory = {
  restaurantId: string;
  restaurantName: string;
  table: string;
  timestamp: number;
};

const Scanner = () => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("st.scan_history");
    if (saved) setHistory(JSON.parse(saved).slice(0, 5));
  }, []);

  const startScanner = async () => {
    setError(null);
    setScanning(true);
    
    try {
      // 1. Explicitly request permission to trigger the OS prompt
      let stream;
      try {
        // Try back camera first
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch (e: any) {
        // Fallback to any camera if back camera not found (e.g. laptops)
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      
      // Stop the test stream, we just needed the permission granted
      stream.getTracks().forEach(track => track.stop());
      
      // 2. Start the scanner now that we have permission
      const scanner = new Html5Qrcode("scanner-viewport");
      scannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stopScanner();
          handleDecoded(decodedText);
        },
        (errorMessage) => {
          // ignore frame-level scan failures
        }
      ).catch(async (e) => {
        // Fallback if environment facing mode fails in html5-qrcode
        await scanner.start(
          { deviceId: { exact: undefined } } as any, // fallback to any camera
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            stopScanner();
            handleDecoded(decodedText);
          },
          () => {}
        );
      });
      
    } catch (err: any) {
      console.error("Camera access error:", err);
      setScanning(false);
      
      // 3. Provide highly specific instructions based on the OS/Browser error
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Camera access is blocked. Please tap the 'aA' or Lock icon in your address bar, go to Settings, and Allow camera access.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError("No camera was found on your device.");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError("Your camera is currently being used by another app (like WhatsApp or Zoom).");
      } else if (err.message && err.message.includes("in-app")) {
        setError("You might be using an in-app browser. Please open this link in Safari or Chrome directly.");
      } else {
        setError("Camera access failed. If you're in an app like WhatsApp or Instagram, please open the link directly in Chrome or Safari.");
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleDecoded = async (text: string) => {
    try {
      const url = new URL(text);
      if (url.pathname.includes("/menu/")) {
        const rid = url.searchParams.get("r");
        const tableStr = url.pathname.split("/").pop() || "";
        const tableNum = parseInt(tableStr, 10);
        
        if (rid && !isNaN(tableNum)) {
          setIsLookingUp(true);
          const { data } = await supabase.from("restaurants").select("name, table_count").eq("id", rid).maybeSingle();
          setIsLookingUp(false);
          
          if (data) {
            const max = data.table_count || 10;
            if (tableNum < 1 || tableNum > max) {
              return toast.error(`Invalid QR. '${data.name}' only has ${max} tables.`);
            }
            addToHistory(rid, data.name, tableStr);
          }
        }
        navigate(url.pathname + url.search);
      } else {
        toast.error("Not a valid PharmIQ QR code");
      }
    } catch {
      toast.error("Invalid QR code format");
    }
  };

  const addToHistory = (rid: string, name: string, table: string) => {
    const newEntry = { restaurantId: rid, restaurantName: name, table, timestamp: Date.now() };
    const updated = [newEntry, ...history.filter(h => h.restaurantId !== rid)].slice(0, 5);
    setHistory(updated);
    localStorage.setItem("st.scan_history", JSON.stringify(updated));
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = manualCode.trim().toUpperCase();
    if (raw.length < 2) return;

    // Flexible regex: 
    // 1. Optional whitespace/dashes
    // 2. Letters (2-6) for the restaurant short code
    // 3. Optional 'T' or 'TABLE' prefix for the table number
    // 4. The table number or staff code
    const match = raw.match(/^([A-Z]{2,6})[\s-]*T?(?:ABLE)?[\s-]*([A-Z0-9]+)$/i);
    
    if (!match) {
      return toast.error("Invalid format. Use something like 'MAMA 5' or 'MAMA JOHN'");
    }
    
    const [, shortCode, tableStr] = match;

    setIsLookingUp(true);
    const { data, error: err } = await supabase
      .from("restaurants")
      .select("id, name, table_count, staff_codes")
      .eq("short_code", shortCode.toUpperCase())
      .maybeSingle();
    setIsLookingUp(false);

    if (err || !data) {
      return toast.error(`Pharmacy '${shortCode}' not found. Please check the code.`);
    }

    const isStaff = data.staff_codes?.map((c: string) => c.toUpperCase()).includes(tableStr.toUpperCase());
    
    if (!isStaff) {
      const table = parseInt(tableStr, 10);
      const max = data.table_count || 0;
      if (isNaN(table) || table < 1 || table > max) {
        return toast.error(`Invalid table. '${data.name}' only has ${max} tables.`);
      }
    }

    navigate(`/menu/${tableStr.toUpperCase()}?r=${data.id}`);
    addToHistory(data.id, data.name, tableStr.toUpperCase());
  };

  return (
    <div className="h-screen bg-background flex flex-col p-6 max-w-md mx-auto overflow-hidden">
      <main className="flex-1 flex flex-col items-center justify-center py-8">
        {!scanning ? (
          <div className="w-full space-y-8 animate-fade-in">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Ready to order?</h1>
              <p className="text-muted-foreground text-sm">Scan the QR code on your table to see the menu.</p>
            </div>

            <button
              onClick={startScanner}
              className="w-full aspect-square max-w-[280px] mx-auto rounded-3xl bg-primary-soft border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-4 hover:bg-primary-soft/80 transition-smooth group"
            >
              <div className="h-20 w-20 rounded-full bg-primary text-white grid place-items-center shadow-glow group-hover:scale-110 transition-smooth">
                <Camera className="h-10 w-10" />
              </div>
              <span className="font-bold text-primary">Tap to Scan</span>
            </button>

            {error && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/5 text-destructive text-sm border border-destructive/10">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Or enter code manually</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter table code..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="rounded-xl"
                />
                <Button type="submit" variant="hero" size="icon" className="shrink-0 rounded-xl" disabled={isLookingUp}>
                  {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="p-6 flex items-center justify-between text-white relative z-10">
              <span className="font-bold">Scan QR Code</span>
              <button onClick={stopScanner} className="p-2 hover:bg-white/10 rounded-full">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div id="scanner-viewport" className="flex-1" />
            
            <div className="p-10 text-center text-white/70 text-sm relative z-10 bg-gradient-to-t from-black to-transparent">
              Align the QR code within the frame
            </div>
          </div>
        )}

        {history.length > 0 && !scanning && (
          <div className="w-full mt-12 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="flex items-center gap-2 mb-4">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Visited</h2>
            </div>
            <div className="space-y-3">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/menu/${h.table}?r=${h.restaurantId}`)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-card border border-border shadow-soft hover:border-primary/30 transition-smooth"
                >
                  <div className="text-left">
                    <div className="font-semibold">{h.restaurantName}</div>
                    <div className="text-xs text-muted-foreground">Table {h.table}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Scanner;
