import { useSearchParams, useLocation, Navigate } from "react-router-dom";
import React from "react";

/**
 * Synchronous route guard for /menu/:table.
 * If the ?r= restaurant-id param is absent, show the Invalid QR screen
 * immediately — no DB call, no loading state.
 */
export const RequireMenuParam = ({ children }: { children: React.ReactNode }) => {
  const [params] = useSearchParams();
  const location = useLocation();

  if (!params.get("r")) {
    // If they scan a QR code or visit a link missing the restaurant ID,
    // redirect them to the Join page where they can enter the short code.
    const tablePath = location.pathname.split("/").pop();
    const tableParam = tablePath && tablePath !== "menu" && tablePath !== "menu-v2" ? `?table=${tablePath}` : "";
    return <Navigate to={`/join${tableParam}`} replace />;
  }

  // Force component remount when URL changes to prevent state recycling between tables
  return <React.Fragment key={location.pathname + location.search}>{children}</React.Fragment>;
};
