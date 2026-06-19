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

  if (!user) {
    const safePath = loc.pathname.startsWith("/") ? loc.pathname : "/dashboard";
    return <Navigate to={`/login?redirect=${encodeURIComponent(safePath)}`} replace />;
  }

  // If the user has a role and it's not allowed, redirect them.
  if (role && !allowed.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
