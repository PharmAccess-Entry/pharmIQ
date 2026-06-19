import { CartProvider } from "@/lib/cart";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import { RequireOwner, RequireOwnerOrManager } from "@/lib/guards";
import { RestaurantProvider } from "@/lib/restaurant";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollToTop } from "@/components/ScrollToTop";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Payment from "./pages/Payment";
import StaffInvite from "./pages/StaffInvite";
import Contact from "./pages/Contact";
import About from "./pages/About";

import Dashboard from "./pages/dashboard/Dashboard";
import MenuManagement from "./pages/dashboard/MenuManagement";
import Orders from "./pages/dashboard/Orders";
import { OrderDetail } from "./pages/dashboard/OrderDetail";
import DashSettings from "./pages/dashboard/DashSettings";
import Inventory from "./pages/dashboard/Inventory";
import Notifications from "./pages/dashboard/Notifications";
import Analytics from "./pages/dashboard/Analytics";
import Patients from "./pages/dashboard/Patients";
import Support from "./pages/dashboard/Support";
import PosMode from "./pages/dashboard/PosMode";
import Suppliers from "./pages/dashboard/Suppliers";
import PurchaseHistory from "./pages/dashboard/PurchaseHistory";
import Reconciliation from "./pages/dashboard/Reconciliation";
import SuperAdmin from "./pages/SuperAdmin";
import NotFound from "./pages/NotFound.tsx";
import Expenses from "./pages/dashboard/Expenses";
import AuditLogs from "./pages/dashboard/AuditLogs";
import SyncStatus from "./pages/dashboard/SyncStatus";
import Reports from "./pages/dashboard/Reports";

const queryClient = new QueryClient();

const DynamicManifest = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const isDashboard = pathname.startsWith('/dashboard');
    const manifestUrl = isDashboard ? '/dashboard-manifest.json' : '/manifest.webmanifest';
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (link && link.getAttribute('href') !== manifestUrl) {
      link.setAttribute('href', manifestUrl);
    }
  }, [pathname]);

  return null;
};

const guard = (el: JSX.Element) => <RequireAuth>{el}</RequireAuth>;
const ownerGuard = (el: JSX.Element) => <RequireOwner>{el}</RequireOwner>;
const managerGuard = (el: JSX.Element) => <RequireOwnerOrManager>{el}</RequireOwnerOrManager>;

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <RestaurantProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <DynamicManifest />
                <PwaInstallBanner />
                <CartProvider>
                  <ScrollToTop />
                  <Routes>
                    {/* Public */}
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/payment" element={guard(<Payment />)} />
                    <Route path="/invite" element={<StaffInvite />} />

                    {/* Dashboard */}
                    <Route path="/dashboard" element={guard(<Dashboard />)} />
                    <Route path="/dashboard/products" element={managerGuard(<MenuManagement />)} />
                    <Route path="/dashboard/menu" element={managerGuard(<MenuManagement />)} />
                    <Route path="/dashboard/pos" element={guard(<PosMode />)} />
                    <Route path="/dashboard/expenses" element={<Expenses />} />
                    <Route path="/dashboard/sales" element={guard(<Orders />)} />
                    <Route path="/dashboard/sales/:id" element={guard(<OrderDetail />)} />
                    <Route path="/dashboard/orders" element={guard(<Orders />)} />
                    <Route path="/dashboard/orders/:id" element={guard(<OrderDetail />)} />
                    <Route path="/dashboard/inventory" element={managerGuard(<Inventory />)} />
                    <Route path="/dashboard/analytics" element={managerGuard(<Analytics />)} />
                    <Route path="/dashboard/patients" element={guard(<Patients />)} />
                    <Route path="/dashboard/suppliers" element={managerGuard(<Suppliers />)} />
                    <Route path="/dashboard/purchases" element={managerGuard(<PurchaseHistory />)} />
                    <Route path="/dashboard/reconciliation" element={managerGuard(<Reconciliation />)} />
                    <Route path="/dashboard/settings" element={ownerGuard(<DashSettings />)} />
                    <Route path="/dashboard/audit" element={ownerGuard(<AuditLogs />)} />
                    <Route path="/dashboard/reports" element={managerGuard(<Reports />)} />
                    <Route path="/dashboard/sync" element={managerGuard(<SyncStatus />)} />
                    <Route path="/dashboard/notifications" element={managerGuard(<Notifications />)} />
                    <Route path="/dashboard/support" element={guard(<Support />)} />

                    <Route path="/super-admin" element={<SuperAdmin />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </CartProvider>
              </TooltipProvider>
            </RestaurantProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
