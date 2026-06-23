import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import { useRestaurant } from "./restaurant";
import { Loader2 } from "lucide-react";

export const RequireOwner = ({ children }: { children: ReactNode }) => {
  return <RequireRoleGuard allowed={["owner"]}>{children}</RequireRoleGuard>;
};

export const RequireOwnerOrManager = ({ children }: { children: ReactNode }) => {
  return <RequireRoleGuard allowed={["owner", "manager"]}>{children}</RequireRoleGuard>;
};

const RequireRoleGuard = ({ children, allowed }: { children: ReactNode; allowed: string[] }) => {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: restLoading } = useRestaurant();
  const loc = useLocation();

  // Safety valve: if loading takes more than 8s, force it to resolve
  // to prevent permanent "Loading…" states from hanging API calls.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!authLoading && !restLoading) return;
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [authLoading, restLoading]);

  const isLoading = (authLoading || restLoading) && !timedOut;

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-60" />
      </div>
    );
  }

  // No authenticated user at all → send to login
  if (!user) {
    const safePath = loc.pathname.startsWith("/") ? loc.pathname : "/dashboard";
    return <Navigate to={`/login?redirect=${encodeURIComponent(safePath)}`} replace />;
  }

  // Role is still resolving (null) even after loading flags cleared — keep showing
  // the page rather than incorrectly redirecting. Role null + user present = context
  // may still be settling from cache.
  if (role === null) {
    return <>{children}</>;
  }

  // Role is known and not in the allowed list → redirect to dashboard
  if (!allowed.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

