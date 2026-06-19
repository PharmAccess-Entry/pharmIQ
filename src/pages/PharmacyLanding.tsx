import { PublicHeader, PublicFooter } from "@/components/PublicLayout";
import pharmacyHeroImg from "@/assets/pharmacy_hero.png";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowRight, BarChart3, Bell, Check, X, Star, 
  History, Camera, UtensilsCrossed, CheckCircle2, AlertCircle, 
  TrendingUp, Users, ThumbsUp, DollarSign, Clock, Sparkles,
  Pill, ShieldCheck, Package, UserCheck, Receipt, AlertTriangle
} from "lucide-react";
import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { sanitizeInput } from "@/lib/sanitize";

const WEB3FORMS_KEY = "2aefb05d-d497-4c17-a5c6-e742212509e5";

const PharmacyLanding = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);

  // Lead Capture State
  const [demoForm, setDemoForm] = useState({ name: "", phone: "", restaurant: "" });
  const [submitting, setSubmitting] = useState(false);

  // Active Use Case tab
  const [activeTab, setActiveTab] = useState<"checkout" | "inventory" | "shift">("checkout");

  // Determine initial view from persisted preference
  const getInitialView = (): "customer" | "owner" => {
    const pref = localStorage.getItem("st.home_view") as "customer" | "owner" | null;
    if (pref) return pref;
    // First time: if they have scan history they're likely a customer
    const scanHistory = localStorage.getItem("st.scan_history");
    if (scanHistory) return "customer";
    return "owner";
  };

  const [view, setView] = useState<"customer" | "owner">(getInitialView);

  const switchView = (next: "customer" | "owner") => {
    localStorage.setItem("st.home_view", next);
    setView(next);
  };

  useEffect(() => {
    const saved = localStorage.getItem("st.scan_history");
    if (saved) {
      const parsed = JSON.parse(saved);
      setHistory(parsed.slice(0, 3));
    }
  }, []);

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoForm.name || !demoForm.phone || !demoForm.restaurant) {
      toast.error("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("access_key", WEB3FORMS_KEY);
      fd.append("subject", "New PharmIQ Live Demo Request");
      fd.append("from_name", "PharmIQ Live Demo Booking");
      fd.append("name", sanitizeInput(demoForm.name));
      fd.append("phone", sanitizeInput(demoForm.phone));
      fd.append("restaurant", sanitizeInput(demoForm.restaurant));
      
      const res = await fetch("https://api.web3forms.com/submit", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to send");
      
      toast.success("Demo request received! We will attend to you in under 10 minutes.");
      setDemoForm({ name: "", phone: "", restaurant: "" });
    } catch (err: any) {
      toast.error(err.message || "Could not submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Structured Data (JSON-LD) for SEO / AEO crawlers
  const jsonLdSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://getpharmiq.com/#organization",
        "name": "PharmIQ Nigeria",
        "alternateName": "LightOrb Innovations",
        "url": "https://getpharmiq.com/",
        "logo": "https://getpharmiq.com/favicon.svg",
        "email": "hello@getpharmiq.com",
        "telephone": "+234-802-510-0844",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Abuja",
          "addressCountry": "NG"
        },
        "founder": {
          "@type": "Person",
          "name": "Olatunbosun Oluwafemi",
          "url": "https://lightorbinnovations.netlify.app/",
          "jobTitle": "Founder & CEO",
          "sameAs": [
            "https://www.linkedin.com/company/lightorb-innovations",
            "https://www.instagram.com/lightorb_innovations",
            "https://www.facebook.com/share/1AnyYN9Dxu/"
          ]
        },
        "sameAs": [
          "https://www.facebook.com/share/1AnyYN9Dxu/",
          "https://www.linkedin.com/company/lightorb-innovations",
          "https://www.instagram.com/lightorb_innovations",
          "https://wa.me/2348025100844"
        ]
      },
      {
        "@type": "Person",
        "@id": "https://getpharmiq.com/#founder",
        "name": "Olatunbosun Oluwafemi",
        "url": "https://lightorbinnovations.netlify.app/",
        "jobTitle": "Founder & CEO",
        "description": "Olatunbosun Oluwafemi is the founder of LightOrb Innovations and creator of PharmIQ — Nigeria's leading pharmacy POS and management platform.",
        "worksFor": {
          "@type": "Organization",
          "name": "LightOrb Innovations"
        },
        "knowsAbout": ["Restaurant Technology", "QR Ordering Systems", "Business Growth", "Digital Innovation"],
        "sameAs": [
          "https://www.linkedin.com/company/lightorb-innovations",
          "https://www.instagram.com/lightorb_innovations",
          "https://lightorbinnovations.netlify.app/"
        ]
      },
      {
        "@type": "Product",
        "@id": "https://getpharmiq.com/#product",
        "name": "PharmIQ QR Ordering System",
        "description": "Premium QR code contactless ordering and table management system optimized for Nigerian pharmacies, lounges, and hotels. Created by Olatunbosun Oluwafemi of LightOrb Innovations.",
        "brand": {
          "@type": "Brand",
          "name": "PharmIQ by LightOrb Innovations"
        },
        "offers": {
          "@type": "AggregateOffer",
          "priceCurrency": "NGN",
          "lowPrice": "2000",
          "highPrice": "200000",
          "offerCount": "2"
        }
      },
      {
        "@type": "WebSite",
        "@id": "https://getpharmiq.com/#website",
        "url": "https://getpharmiq.com/",
        "name": "PharmIQ Nigeria",
        "description": "Nigeria's most affordable pharmacy POS system. Built by Olatunbosun Oluwafemi, LightOrb Innovations.",
        "publisher": { "@id": "https://getpharmiq.com/#organization" },
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://getpharmiq.com/?s={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://getpharmiq.com/#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is PharmIQ Nigeria?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "PharmIQ Nigeria is a premium, contactless QR code ordering and table management system designed specifically for Nigerian pharmacies, lounges, and hotels. It allows customers to scan a QR code to view digital menus and place orders without an app."
            }
          },
          {
            "@type": "Question",
            "name": "Who is the founder of PharmIQ Nigeria?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "PharmIQ Nigeria was founded and built by Olatunbosun Oluwafemi under his tech company, LightOrb Innovations."
            }
          },
          {
            "@type": "Question",
            "name": "How much does PharmIQ cost?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "PharmIQ pricing starts at an affordable ₦2,000 per table per month, making it highly accessible for food businesses in Nigeria."
            }
          }
        ]
      }
    ]
  };

  if (view === "customer") {
    return (
      <div className="min-h-screen flex flex-col bg-background p-6 max-w-2xl mx-auto">
        <Helmet>
          <title>Scan to Order — PharmIQ Nigeria</title>
        </Helmet>
        <main className="flex-1 flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-700">
          <div className="text-center space-y-4">
            <div className="h-20 w-20 rounded-[2.5rem] bg-primary shadow-glow grid place-items-center mx-auto mb-6">
              <UtensilsCrossed className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="font-display text-4xl font-black tracking-tight">Hungry? 😋</h1>
            <p className="text-muted-foreground font-medium">Scan the QR code on your table to browse the menu and order.</p>
          </div>

          <div className="w-full space-y-4">
            <Button size="xl" variant="hero" className="w-full h-20 rounded-[2rem] text-xl font-black gap-4 shadow-glow" onClick={() => { switchView("customer"); navigate("/scan"); }}>
              <Camera className="h-8 w-8" />
              SCAN TO ORDER
            </Button>
            
            {history.length > 0 && (
              <div className="pt-8 space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Recently Visited</h2>
                </div>
                <div className="grid gap-3">
                  {history.map((h, i) => (
                    <button 
                      key={i} 
                      onClick={() => navigate(`/menu/${h.table}?r=${h.restaurantId}`)}
                      className="w-full flex items-center justify-between p-5 rounded-[1.5rem] bg-card border border-border shadow-soft hover:border-primary/40 transition-all group"
                    >
                      <div className="text-left">
                        <div className="font-bold text-base group-hover:text-primary transition-colors">{h.restaurantName}</div>
                        <div className="text-xs text-muted-foreground">Table {h.table}</div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-12">
            <button 
              onClick={() => switchView("owner")}
              className="min-h-[44px] px-5 py-3 rounded-xl text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-primary hover:bg-primary/5 transition-all border border-transparent hover:border-primary/10"
            >
              Are you a Pharmacy Owner?
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col scroll-smooth">
      <Helmet>
        <title>PharmIQ Pharmacy POS — Track Sales & Stop Shortages</title>
        <meta name="description" content="PharmIQ is the #1 Pharmacy POS software in Nigeria. Designed for pharmacies and retail to track inventory and manage staff shifts." />
        <meta name="keywords" content="PharmIQ Pharmacy POS Nigeria, pharmacy software, shift management, drug inventory tracking" />
        <link rel="canonical" href="https://getpharmiq.com/pharmacy" />
        <meta property="og:title" content="PharmIQ Pharmacy POS — Shift Management & Inventory" />
        <meta property="og:description" content="Nigeria's most affordable Pharmacy POS. ₦5,000 flat monthly fee." />
        <meta property="og:url" content="https://getpharmiq.com/pharmacy" />
        <script type="application/ld+json">
          {JSON.stringify(jsonLdSchema)}
        </script>
      </Helmet>
      <PublicHeader overHero />

      {/* Hero Section — Pharmacy with image */}
      <section className="relative min-h-[100svh] max-h-[100svh] -mt-16 flex items-center overflow-hidden">
        <img
          src={pharmacyHeroImg}
          alt="Modern Nigerian pharmacy with sleek POS checkout counter"
          className="absolute inset-0 w-full h-full object-cover"
          fetchpriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a14]/60 via-[#0a1a14]/40 to-[#0a1a14]/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a1a14]/90 via-[#0a1a14]/50 to-transparent" />

        <div className="container relative z-10 pt-16 pb-10 md:py-24">
          <div className="max-w-3xl animate-fade-in space-y-4">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-[11px] sm:text-xs font-semibold mb-3 sm:mb-5">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              The #1 POS &amp; Shift Management Software for Pharmacies
            </span>
            <h1 className="font-display text-[2.25rem] leading-[1.05] sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white text-shadow-hero">
              Every checkout, completely <span className="text-emerald-400" style={{ textShadow: "0 2px 24px rgba(52, 211, 153, 0.6)" }}>accounted</span> for.
            </h1>
            <p className="mt-2.5 sm:mt-6 text-sm sm:text-lg md:text-xl text-white/95 max-w-2xl leading-relaxed text-shadow-hero">
              Stop cash shortages and track every drug sold. PharmIQ Pharmacy POS speeds up your checkout, manages drug inventory, and strictly tracks staff shifts to prevent theft and accounting errors.
            </p>
            
            <div className="mt-4 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Button variant="hero" size="xl" asChild className="w-full sm:w-auto shadow-glow">
                <Link to="/signup?type=pharmacy">Start Free 3-Day Trial <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button variant="outline" size="xl" asChild className="w-full sm:w-auto bg-white/10 backdrop-blur border-white/30 text-white hover:bg-white/20 hover:text-white">
                <Link to="/contact">Book a Live Demo</Link>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/90">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.15)] backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/20">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="font-semibold tracking-wide">No credit card required</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.15)] backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/20">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="font-semibold tracking-wide">Flat ₦5,000 per month</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating POS Live Card */}
        <div className="hidden lg:block absolute right-16 bottom-24 z-10 animate-float">
          <div className="glass border border-emerald-500/20 rounded-2xl p-5 shadow-elevated w-72 backdrop-blur-md bg-black/40">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 grid place-items-center text-emerald-400 shadow">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] text-white/50 uppercase font-bold tracking-widest">Live Shift · Morning</div>
                <div className="font-display font-black text-sm text-white">Amaka's Shift</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-white/60">Opening cash</span>
                <span className="text-white font-bold">₦50,000</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-white/60">Sales recorded</span>
                <span className="text-emerald-400 font-bold">₦124,500</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-white/60">Expected cash</span>
                <span className="text-white font-bold">₦174,500</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-emerald-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> Variance: ₦0</span>
              <span className="text-white/40">Clean shift ✓</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Credibility Section hidden for now */}
      
      {/* Problem vs. Solution Section */}
      <section className="py-20 md:py-28 bg-secondary/20">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <span className="text-xs font-black uppercase tracking-widest text-primary">The Pharmacy Dilemma</span>
            <h2 className="font-display text-3xl md:text-5xl font-black tracking-tight">Why Manual Checkouts are Costing You Money</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Traditional retail checkouts are prone to human error, staff theft, and inventory mismanagement.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-10 duration-1000 fill-mode-both delay-150">
            {/* The Old Way */}
            <div className="bg-card border border-destructive/20 rounded-3xl p-8 relative overflow-hidden shadow-soft">
              <div className="absolute top-0 right-0 h-16 w-16 bg-destructive/5 rounded-bl-full flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="font-display text-xl font-bold text-destructive mb-6 flex items-center gap-2">
                <span>The Manual Hassle (The Old Way)</span>
              </h3>
              <ul className="space-y-4">
                {[
                  { title: "Inventory Blind Spots", desc: "You have no idea which drugs are out of stock until a customer asks for it." },
                  { title: "Cash Shortages", desc: "At the end of the day, the cash in the drawer doesn't match the recorded sales." },
                  { title: "Staff Theft", desc: "Without strict shift tracking, it's easy for staff to sell drugs without recording the transaction." },
                  { title: "Slow Checkouts", desc: "Calculating totals manually leads to long queues during peak hours." }
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="h-5 w-5 rounded-full bg-destructive/10 text-destructive grid place-items-center shrink-0"><X className="h-3 w-3" /></span>
                    <div>
                      <strong className="block text-foreground text-sm font-semibold">{item.title}</strong>
                      <span className="text-xs text-muted-foreground leading-relaxed">{item.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* The PharmIQ Way */}
            <div className="bg-card border border-emerald-500/20 rounded-3xl p-8 relative overflow-hidden shadow-elevated">
              <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-bl-full flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <h3 className="font-display text-xl font-bold text-emerald-600 mb-6 flex items-center gap-2">
                <span>The PharmIQ Way</span>
              </h3>
              <ul className="space-y-4">
                {[
                  { title: "Real-time Drug Inventory", desc: "Know exactly what's in stock. Low stock alerts prevent you from ever running out of high-demand drugs." },
                  { title: "Shift Auditing", desc: "Staff must input opening cash. At closing, the system calculates expected cash, highlighting any variances immediately." },
                  { title: "Accountability", desc: "Every transaction is tagged to the staff member who processed it. See who your best performers are." },
                  { title: "Fast Digital POS", desc: "Scan or search for drugs in milliseconds. Calculate totals automatically to keep the checkout line moving." }
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0"><Check className="h-3 w-3" /></span>
                    <div>
                      <strong className="block text-foreground text-sm font-semibold">{item.title}</strong>
                      <span className="text-xs text-muted-foreground leading-relaxed">{item.desc}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Deep-Dive Section */}
      <section id="features" className="py-20 md:py-28">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Built for Pharmacies</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Every Tool Your Pharmacy Needs to Run Profitably</h2>
            <p className="text-muted-foreground">Purpose-built for Nigerian pharmacies and retail stores — not adapted from pharmacy software.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Receipt, title: "Fast Digital POS Checkout", color: "emerald", desc: "Search or scan drugs by name. The system calculates totals instantly. No manual arithmetic, no errors. Serve more customers during peak morning hours." },
              { icon: Package, title: "Real-time Drug Inventory", color: "emerald", desc: "Know exactly what's in stock at any moment. Get automatic low-stock alerts before you run out of high-demand drugs like antibiotics or pain relief medication." },
              { icon: UserCheck, title: "Strict Shift Management", color: "emerald", desc: "Staff record opening cash at shift start. The system calculates expected closing cash based on recorded sales, instantly flagging any variances or shortages." },
              { icon: ShieldCheck, title: "Staff Accountability", color: "emerald", desc: "Every sale is tagged to the staff member who processed it. See daily performance per employee and catch discrepancies before they escalate." },
              { icon: BarChart3, title: "Sales & Revenue Reports", color: "emerald", desc: "View daily, weekly, and monthly sales trends at a glance. Identify your best-selling drugs, peak hours, and revenue per staff member — in Naira." },
              { icon: AlertTriangle, title: "Shortage & Theft Prevention", color: "emerald", desc: "Shift variance reports automatically detect when physical cash doesn't match system records, protecting your pharmacy from internal theft and human error." }
            ].map((f, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-6 shadow-soft hover:shadow-elevated hover:border-emerald-500/30 transition-all duration-300">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center mb-5">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 bg-secondary/35 border-y border-border">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Three Simple Steps</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Up and Running in Under 30 Minutes</h2>
            <p className="text-muted-foreground">No hardware installations, no technicians. Just your phone or tablet and your existing drug list.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { step: "01", title: "Add Your Drug Catalogue", desc: "Import or manually enter your drugs by name and price. Set low-stock alert thresholds so the system warns you before you run out." },
              { step: "02", title: "Create Staff Accounts", desc: "Add each pharmacist or sales attendant as a staff member. They log in, enter their opening cash, and the system tracks their entire shift automatically." },
              { step: "03", title: "Start Selling & Auditing", desc: "Staff scan or search drugs, build the cart, and check out customers in seconds. At shift close, variance reports generate automatically." }
            ].map((item, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-8 relative shadow-soft">
                <div className="font-display text-6xl font-black text-emerald-500/10 absolute top-4 right-6 select-none">{item.step}</div>
                <h3 className="font-display text-lg font-bold mb-3 relative z-10">{item.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground relative z-10">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pharmacy Workflow Showcase (replaces restaurant tabs) */}
      <section className="py-20 md:py-28">
        <div className="container max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Live Workflow</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">See How a Shift Works in Real Time</h2>
            <p className="text-muted-foreground">From morning opening to evening close — every naira accounted for, every drug tracked.</p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 bg-secondary/40 p-1.5 rounded-2xl max-w-xl mx-auto">
            {[
              { id: "checkout", label: "POS Checkout" },
              { id: "inventory", label: "Inventory" },
              { id: "shift", label: "Shift Audit" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-emerald-600 text-white shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-soft">
            {activeTab === "checkout" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Serve Customers Faster at the Counter</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Search for any drug by name in milliseconds. Add it to the cart, apply any discount, and complete payment. The system records the sale, deducts inventory, and tags it to the staff member — all in one tap.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Smart drug search — name, brand, or generic</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Auto-calculates totals and change</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Supports cash, transfer, and card</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-emerald-500/5 border-b border-border px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">POS Checkout · Counter 1</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                      Live
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Amoxicillin 500mg × 2</div><div className="text-[10px] text-muted-foreground">Capsules</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">₦1,200</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Paracetamol 500mg × 1</div><div className="text-[10px] text-muted-foreground">Tablet strip</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">₦350</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-emerald-500/5">
                      <div className="text-xs font-black">Total</div>
                      <span className="text-xs font-black text-emerald-600">₦1,550</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "inventory" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Always Know What's in Stock</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every sale automatically deducts from inventory. When a drug drops below your minimum threshold, the system sends a low-stock alert instantly. No more running out of critical medications mid-day.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Auto-deduction on every sale</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Low-stock alerts before you run out</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Full stock history and audit trail</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-emerald-500/5 border-b border-border px-4 py-2.5 flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Inventory · Live Count</span>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Flagyl 400mg</div><div className="text-[10px] text-muted-foreground">48 strips remaining</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">In Stock</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Amoxicillin 500mg</div><div className="text-[10px] text-muted-foreground text-amber-600 font-bold">⚠ 3 strips remaining</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Low Stock</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Vitamin C 1000mg</div><div className="text-[10px] text-muted-foreground">120 tabs remaining</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">In Stock</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "shift" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Zero-Tolerance Shift Accountability</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Staff enter their opening cash when their shift begins. The system tracks every sale they record. At closing, it automatically calculates how much cash should be in the till — and shows any variance immediately.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Opening and closing cash reconciliation</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Variance detection to the naira</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Per-staff daily performance summary</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-emerald-500/5 border-b border-border px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Shift Audit · Closing Report</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <UserCheck className="h-3 w-3" /> Amaka
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Opening Cash</span><span className="font-bold">₦50,000</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total Sales Recorded</span><span className="font-bold text-emerald-600">₦124,500</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Expected Closing Cash</span><span className="font-bold">₦174,500</span></div>
                    <div className="flex justify-between text-xs border-t border-border pt-3">
                      <span className="font-black">Cash Variance</span>
                      <span className="font-black text-emerald-600">₦0.00 ✓ Clean</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Role-Based Benefits Section — Pharmacy */}
      <section className="py-20 bg-secondary/35 border-y border-border">
        <div className="container max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Team Accountability</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Built for Every Role in Your Pharmacy</h2>
            <p className="text-muted-foreground">From the owner to the front-desk attendant — everyone works with greater clarity and accountability.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { 
                icon: TrendingUp, 
                role: "For the Owner", 
                benefit: "See every naira in real time", 
                desc: "Check daily sales totals, per-staff performance, and inventory levels from anywhere. Know immediately if a shift had a variance before you even arrive at the pharmacy." 
              },
              { 
                icon: Users, 
                role: "For the Pharmacist", 
                benefit: "Close your shift with confidence", 
                desc: "Log opening cash at shift start, serve customers faster with digital POS, and close your shift knowing the system will verify your cash automatically. No more manual recounting stress." 
              },
              { 
                icon: ShieldCheck, 
                role: "For Accountability", 
                benefit: "Prevent theft before it starts", 
                desc: "When staff know every sale is tagged to their ID and their closing cash is auto-verified, they are far less likely to pocket sales. PharmIQ protects your margins passively." 
              }
            ].map((roleBenefit, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-6 relative shadow-soft">
                <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center mb-5">
                  <roleBenefit.icon className="h-5 w-5" />
                </div>
                <div className="text-xs font-black text-emerald-600 uppercase tracking-widest">{roleBenefit.role}</div>
                <h3 className="font-display font-bold text-base mt-1 mb-3">{roleBenefit.benefit}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{roleBenefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table — Pharmacy-specific */}
      <section id="why-us" className="py-20 md:py-28">
        <div className="container max-w-4xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Differentiation</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Why Nigerian Pharmacies Choose PharmIQ</h2>
            <p className="text-muted-foreground">Unlike expensive foreign POS systems billed in dollars, PharmIQ is purpose-built for Nigerian pharmacy operations.</p>
          </div>

          <div className="bg-card border border-border rounded-3xl overflow-x-auto shadow-soft">
            <table className="w-full min-w-[600px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/45 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="p-5">Feature Check</th>
                  <th className="p-5 text-emerald-600 bg-emerald-500/5">PharmIQ</th>
                  <th className="p-5">Old Manual / Foreign POS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { feature: "Monthly Cost", us: "₦5,000 flat/month (Pure Naira)", them: "$30–$100/mo or costly hardware" },
                  { feature: "Shift Cash Reconciliation", us: "Automatic variance detection", them: "Manual counting, prone to errors" },
                  { feature: "Drug Inventory Tracking", us: "Real-time with low-stock alerts", them: "Manual spreadsheets or none" },
                  { feature: "Staff Accountability", us: "Every sale tagged to a staff ID", them: "No individual tracking" },
                  { feature: "Setup & Hardware", us: "Zero. Runs on any phone/tablet", them: "Expensive POS terminals" }
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-secondary/10 transition-colors">
                    <td className="p-5 font-bold">{row.feature}</td>
                    <td className="p-5 bg-emerald-500/5 font-semibold text-emerald-600">{row.us}</td>
                    <td className="p-5 text-muted-foreground">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials — Pharmacy owners */}
      <section className="py-20 bg-secondary/35 border-y border-border">
        <div className="container max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Credibility & Trust</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Loved by Pharmacy Owners Across Nigeria</h2>
            <p className="text-muted-foreground">See how pharmacies eliminated cash shortages and took control of their inventory.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "Before PharmIQ, we had unexplained cash shortages almost every week. Since we started tracking shifts with their system, the shortages completely stopped. Every kobo is accounted for.",
                name: "Blessing Okafor",
                role: "Owner · HealthPlus Pharmacy Abuja",
                stars: 5
              },
              {
                quote: "The low-stock alert saved us twice already. We nearly ran out of a critical hypertension drug but the system flagged it the day before. Our customers didn't even notice.",
                name: "Dr. Emeka Nwosu",
                role: "Pharmacist · Medica Care Enugu",
                stars: 5
              },
              {
                quote: "Setup was so fast. I added our 200+ drugs over a weekend and by Monday my staff was using it. The shift audit report alone is worth the ₦5,000 monthly fee.",
                name: "Fatima Aliyu",
                role: "Proprietor · Al-Rahma Pharmacy Kano",
                stars: 5
              }
            ].map((t, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-6 shadow-soft flex flex-col justify-between">
                <div>
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-emerald-500 text-emerald-500" />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed italic">"{t.quote}"</p>
                </div>
                <div className="mt-6 pt-4 border-t border-border flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center font-display font-black text-xs">
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <div className="font-bold text-xs">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground font-semibold">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faqs" className="py-20">
        <div className="container max-w-3xl">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-primary">Frequently Asked</span>
            <h2 className="font-display text-3xl font-bold">Got Questions? We’ve Got Answers.</h2>
            <p className="text-muted-foreground">Everything you need to know about setting up PharmIQ at your establishment.</p>
          </div>

          <div className="space-y-4">
            {[
              { 
                q: "Do customers need to download an application?", 
                a: "Absolutely not. When a customer scans a table's QR stand, the responsive digital menu loads instantly inside their default browser (Safari, Chrome, etc.). The process is frictionless and fast." 
              },
              { 
                q: "How long does setup take and is it difficult?", 
                a: "Setup takes under 30 minutes! You simply register, type in or upload your menu details, generate your custom printed standee PDFs mapping QRs to table numbers, print them, and you are live." 
              },
              { 
                q: "What payment options does PharmIQ support?", 
                a: "In Nigeria, secure bank transfers and card checkouts are crucial. We integrate fully with Paystack so customers can complete payments directly from their tables using Cards, Bank Transfer, Apple Pay, or USSD." 
              },
              { 
                q: "Can I try PharmIQ for free first?", 
                a: "Yes! Every pharmacy starts with a 3-day zero-risk trial. Try it on a few tables first, test the chef and waiter dashboard screens, and only pay if it completely modernizes your operations." 
              },
              { 
                q: "How do out-of-stock items get handled?", 
                a: "Instantly. If a dish or beverage is out of stock, just click the toggle button next to it on your manager dashboard. The item will immediately show as out of stock on all guest menus to prevent ordering disappointments." 
              }
            ].map((faq, idx) => (
              <details key={idx} className="group bg-card border border-border rounded-2xl p-5 [&_summary::-webkit-details-marker]:hidden transition-all duration-300">
                <summary className="flex items-center justify-between cursor-pointer font-bold text-sm">
                  {faq.q}
                  <span className="ml-4 text-primary transition-transform group-open:rotate-45 text-lg leading-none">+</span>
                </summary>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Leads Capture / Demo Booking Section */}
      <section className="py-20 bg-secondary/35 border-t border-border">
        <div className="container max-w-5xl">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <span className="text-xs font-black uppercase tracking-widest text-primary">Interactive Demo</span>
              <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">Ready to Boost Your Margins?</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Schedule a quick live demonstration. Our representative will bring standard QR table stand samples, set up a temporary test menu on your tablet, and show your chef/waiters exactly how the system manages live orders in real time.
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center"><Clock className="h-5 w-5" /></div>
                <div>
                  <div className="font-bold text-xs">On-Site & Remote Support</div>
                  <div className="text-[10px] text-muted-foreground font-semibold">Immediate live onboarding available — we will attend to you</div>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-3xl p-8 shadow-soft">
              <h3 className="font-display font-bold text-lg mb-4">Request a Live Demo & Callback</h3>
              <form onSubmit={handleDemoSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1.5" htmlFor="name">Your Name</label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={demoForm.name}
                    onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                    className="w-full bg-secondary/40 border border-border rounded-xl p-3 text-xs focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                    placeholder="e.g. Femi Alao"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1.5" htmlFor="phone">Phone Number (WhatsApp preferred)</label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={demoForm.phone}
                    onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                    className="w-full bg-secondary/40 border border-border rounded-xl p-3 text-xs focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                    placeholder="e.g. 08025100844"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1.5" htmlFor="restaurant">Pharmacy Name</label>
                  <input
                    id="restaurant"
                    type="text"
                    required
                    value={demoForm.restaurant}
                    onChange={(e) => setDemoForm({ ...demoForm, restaurant: e.target.value })}
                    className="w-full bg-secondary/40 border border-border rounded-xl p-3 text-xs focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors"
                    placeholder="e.g. HealthPlus Pharmacy Lekki"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full h-11 rounded-xl text-xs font-black shadow-glow">
                  {submitting ? "Submitting..." : "Book On-site Consultation"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing/CTA Banner Section */}
      <section className="py-20">
        <div className="container">
          <div className="bg-gradient-hero rounded-3xl p-10 md:p-16 text-center shadow-elevated relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="relative space-y-4">
              <div className="flex justify-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-accent text-accent animate-pulse-soft" />)}
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-black text-primary-foreground max-w-2xl mx-auto">
                Stop manual inventory errors. Switch to PharmIQ POS today.
              </h2>
              <p className="text-primary-foreground/90 max-w-xl mx-auto text-xs sm:text-sm">Join modern Nigerian pharmacies protecting their margins and growing securely. We will attend to your needs.</p>
              <div className="pt-4 flex flex-wrap justify-center gap-3">
                <Button variant="accent" size="xl" asChild className="shadow-glow">
                  <Link to="/pharmacy/pricing">View Plan Pricing <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button variant="outline" size="xl" asChild className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
                  <Link to="/signup">Start Free 3-Day Trial</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default PharmacyLanding;
