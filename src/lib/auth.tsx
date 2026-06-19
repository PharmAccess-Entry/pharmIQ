import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";


type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, restaurantName: string, businessType?: "restaurant" | "event" | "pharmacy") => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
};

const AuthCtx = createContext<Ctx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set listener BEFORE getSession (per Supabase guidance)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (event === "PASSWORD_RECOVERY") {
        window.location.href = "/reset-password";
      }
      // store last-known Pharmacy Name hint
      if (sess?.user?.user_metadata?.restaurant_name) {
        localStorage.setItem("st.restaurant_name_hint", sess.user.user_metadata.restaurant_name);
      }
    });
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!error) {
        setSession(session);
        setUser(session?.user ?? null);
      } else {
        // Stale/invalid token — treat as logged out
        console.warn('[auth] getSession error:', error.message);
        setSession(null);
        setUser(null);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('[auth] Unexpected getSession failure:', err);
      setSession(null);
      setUser(null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, restaurantName: string, businessType: "restaurant" | "event" | "pharmacy" = "restaurant") => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { restaurant_name: restaurantName, business_type: businessType },
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    // Immediately wipe local state so the user is signed out on-device
    // regardless of whether Supabase is reachable (handles network outages).
    try {
      localStorage.removeItem("smarttable_business_type");
      sessionStorage.removeItem("st.role");
    } catch { /* noop */ }

    // Attempt server-side sign-out with a 5-second timeout — never block the UI
    try {
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("signOut timeout")), 5000)
      );
      await Promise.race([supabase.auth.signOut(), timeout]);
    } catch (err) {
      // If it times out or fails, force the auth state to cleared locally
      console.warn("[auth] signOut network call failed — clearing session locally", err);
      setSession(null);
      setUser(null);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  return (
    <AuthCtx.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
};

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const loc = useLocation();

  // Safety valve: if loading takes more than 8s, force it to resolve
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-60" />
      </div>
    );
  }
  if (!user) {
    // Only encode relative paths to prevent open-redirect attacks
    const safePath = loc.pathname.startsWith("/") ? loc.pathname : "/dashboard";
    return <Navigate to={`/login?redirect=${encodeURIComponent(safePath)}`} replace />;
  }
  return <>{children}</>;
};




