import { useState, useEffect } from "react";
import { Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "st.audio_unlocked";

/**
 * AudioUnlockBanner
 *
 * Modern browsers block AudioContext playback until the user interacts with
 * the page (autoplay policy). This subtle banner prompts the user once per
 * session to "unlock" audio, ensuring order chimes play reliably.
 *
 * - Shows automatically when the AudioContext is in "suspended" state
 * - Dismissed permanently after the user clicks "Enable Sound"
 * - Remembers the preference in sessionStorage (disappears on logout/tab close)
 */
export const AudioUnlockBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already unlocked this session
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    // Check if AudioContext is available and would be blocked
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return; // Unsupported browser, don't show

    // Probe a temporary context to check its state
    try {
      const probe = new Ctx();
      if (probe.state === "suspended") {
        setVisible(true);
      } else {
        // Already unlocked (e.g. user previously interacted)
        sessionStorage.setItem(STORAGE_KEY, "1");
      }
      probe.close();
    } catch {
      // AudioContext creation failed — don't show banner
    }
  }, []);

  const unlock = () => {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      try {
        const ctx = new Ctx();
        ctx.resume().then(() => ctx.close());
      } catch { /* noop */ }
    }
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-sm animate-in slide-in-from-top duration-300"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Volume2 className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-amber-800 dark:text-amber-200 font-medium truncate">
          Enable sound alerts for new orders and requests.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          id="audio-unlock-btn"
          onClick={unlock}
          className="h-7 rounded-full px-3 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-none"
        >
          Enable Sound
        </Button>
        <button
          onClick={dismiss}
          aria-label="Dismiss sound alert"
          className="p-1 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
