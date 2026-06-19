import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Download, X, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaUpdate } from "@/lib/usePwaUpdate";

/**
 * PWA install banner — shown only:
 * 1. On mobile viewports
 * 2. To authenticated users
 * 3. On /dashboard pages (never on /menu/:table or public pages)
 * 4. When the browser fires `beforeinstallprompt` (not yet installed)
 *
 * Also shows a PWA update banner when a new version is waiting.
 */
export const PwaInstallBanner = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const { updateReady, applyUpdate } = usePwaUpdate();
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const isDashboard = pathname.startsWith("/dashboard");
  const isCustomerRoute = pathname.startsWith("/scan") || pathname.includes("/menu/");

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  // Show or hide based on conditions (handles late-resolving user auth)
  useEffect(() => {
    if (!promptEvent || sessionStorage.getItem("pwa-banner-dismissed")) {
      return;
    }

    const dashboardEligible = user && isDashboard && isMobile;
    const customerEligible = isCustomerRoute && isMobile;

    let timeout: NodeJS.Timeout;
    if (dashboardEligible || customerEligible) {
      if (customerEligible) {
        timeout = setTimeout(() => setVisible(true), 2000);
      } else {
        setVisible(true);
      }
    } else {
      setVisible(false);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [user, isDashboard, isCustomerRoute, isMobile, promptEvent]);

  const install = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setPromptEvent(null);
    setVisible(false);
  };

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  useEffect(() => {
    if (sessionStorage.getItem("pwa-banner-dismissed")) setVisible(false);
  }, []);

  // Show update banner for all authenticated dashboard users (not just mobile)
  if (updateReady && !updateDismissed && isDashboard) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="fixed bottom-[5.5rem] inset-x-3 z-50 lg:bottom-6 animate-slide-up"
      >
        <div className="glass border border-green-500/40 bg-green-500/10 rounded-2xl shadow-elevated px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-green-500 text-white grid place-items-center shrink-0 shadow-lg">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight text-green-700 dark:text-green-400">Update available!</p>
            <p className="text-xs text-muted-foreground mt-0.5">A new version of PharmIQ is ready.</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-green-500 hover:bg-green-600 text-white gap-1.5"
              onClick={() => { setUpdateDismissed(true); applyUpdate(); }}
            >
              <RefreshCw className="h-3 w-3" />
              Update App
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setUpdateDismissed(true)}
              aria-label="Dismiss update banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!visible) return null;

  const content = isDashboard ? {
    title: "Add to Home Screen",
    desc: "Manage orders without the browser",
    button: "Install Dashboard"
  } : {
    title: "Install Scanner App",
    desc: "Scan QR codes and access menus faster",
    button: "Get App"
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-[5.5rem] inset-x-3 z-50 lg:hidden animate-slide-up"
    >
      <div className="glass border border-primary/30 rounded-2xl shadow-elevated px-4 py-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-hero text-primary-foreground grid place-items-center shrink-0 shadow-glow">
          <Download className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{content.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{content.desc}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="hero" className="h-8 px-3 text-xs" onClick={install}>
            {content.button}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            onClick={dismiss}
            aria-label="Dismiss install banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
