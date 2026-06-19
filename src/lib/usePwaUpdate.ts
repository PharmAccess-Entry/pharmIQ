import { useEffect, useState } from "react";

/**
 * Detects when a new version of the service worker is waiting to activate.
 * Returns `updateReady` (true when an update exists) and `applyUpdate` (fn to reload).
 */
export function usePwaUpdate() {
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleSWUpdate = (registration: ServiceWorkerRegistration) => {
      // A new SW is waiting — there's an update
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateReady(true);
        return;
      }

      // Listen for a new SW installing
      const handleStateChange = () => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateReady(true);
        }
      };

      if (registration.installing) {
        registration.installing.addEventListener("statechange", handleStateChange);
      }

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setUpdateReady(true);
            }
          });
        }
      });
    };

    // Check existing registration
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) handleSWUpdate(reg);
    });

    // Also listen for new registrations
    navigator.serviceWorker.ready.then(handleSWUpdate);

    // Listen for controller change (update applied)
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const applyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  };

  return { updateReady, applyUpdate };
}
