import { PublicHeader, PublicFooter } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowRight, QrCode, Smartphone, BarChart3, Bell, Check, X, Star, 
  History, Camera, UtensilsCrossed, CheckCircle2, AlertCircle, 
  TrendingUp, Users, ThumbsUp, DollarSign, Clock, ChevronDown, Sparkles
} from "lucide-react";
import heroImg from "@/assets/hero-food.jpg";
import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { sanitizeInput } from "@/lib/sanitize";
import { getCurrencySymbol } from "@/lib/format";

const WEB3FORMS_KEY = "2aefb05d-d497-4c17-a5c6-e742212509e5";

const Home = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);

  // Lead Capture State
  const [demoForm, setDemoForm] = useState({ name: "", phone: "", restaurant: "" });
  const [submitting, setSubmitting] = useState(false);

  // Active Use Case tab
  const [activeTab, setActiveTab] = useState<"qsr" | "dinein" | "lounge" | "events">("qsr");

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
        <title>PharmIQ Nigeria — pharmacy POS Made Simple</title>
        <meta name="description" content="PharmIQ is the #1 pharmacy POS and management software in Nigeria. Designed for food businesses, restaurants, and lounges to automate Order to Pay (OTP) operations. Built by Olatunbosun Oluwafemi, LightOrb Innovations." />
        <meta name="keywords" content="PharmIQ Nigeria, Smart Table NG, PharmIQ.com.ng, pharmacy POS Nigeria, food business technology, pharmacy tech startup, food tech Nigeria, Order to Pay, OTP ordering, pharmacy management software Nigeria, Olatunbosun Oluwafemi, LightOrb Innovations, QR code menu Nigeria, contactless ordering Nigeria, food business operations, digital menu Nigeria, pharmacy POS software, Nigerian food business tech" />
        <link rel="canonical" href="https://getpharmiq.com/" />
        <meta property="og:title" content="PharmIQ Nigeria — pharmacy POS Made Simple" />
        <meta property="og:description" content="Nigeria's most affordable QR ordering system. ₦2,000 per table. Built by Olatunbosun Oluwafemi of LightOrb Innovations." />
        <meta property="og:url" content="https://getpharmiq.com/" />
        <script type="application/ld+json">
          {JSON.stringify(jsonLdSchema)}
        </script>
      </Helmet>
      <PublicHeader overHero />

      {/* Hero Section */}
      <section className="relative min-h-[100svh] max-h-[100svh] -mt-16 flex items-center overflow-hidden">
        <img
          src={heroImg}
          alt="Premium Nigerian feast including jollof rice, suya, and fried plantain"
          className="absolute inset-0 w-full h-full object-cover"
          fetchpriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />

        <div className="container relative z-10 pt-16 pb-10 md:py-24">
          <div className="max-w-3xl animate-fade-in space-y-4">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-[11px] sm:text-xs font-semibold mb-3 sm:mb-5">
              <Sparkles className="h-3 w-3 text-amber-400" />
              The #1 QR Ordering Software for Nigerian Venues
            </span>
            <h1 className="font-display text-[2.25rem] leading-[1.05] sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white text-shadow-hero">
              Every table, a <span className="text-[hsl(351_95%_71%)]" style={{ textShadow: "0 2px 24px hsl(347 77% 50% / 0.6)" }}>smart</span> ordering station.
            </h1>
            <p className="mt-2.5 sm:mt-6 text-sm sm:text-lg md:text-xl text-white/95 max-w-2xl leading-relaxed text-shadow-hero">
              Let your guests scan, order, and pay directly from their tables. PharmIQ speeds up your service, stops kitchen mix-ups, and frees up your waitstaff to actually focus on hospitality.
            </p>
            
            <div className="mt-4 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Button variant="hero" size="xl" asChild className="w-full sm:w-auto shadow-glow">
                <Link to="/signup">Start Free 3-Day Trial <ArrowRight className="h-4 w-4" /></Link>
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
                <span className="font-semibold tracking-wide">Plans start at ₦2,000 per table</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Mini Live Order Status Card */}
        <div className="hidden lg:block absolute right-16 bottom-24 z-10 animate-float">
          <div className="glass border border-white/20 rounded-2xl p-5 shadow-elevated w-76 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-hero grid place-items-center text-primary-foreground shadow-glow">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Live Order · Table 7</div>
                <div className="font-display font-black text-sm text-foreground">2× Jollof + Suya + Chapman</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-emerald-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" /> Sent to Kitchen</span>
              <span className="text-muted-foreground">₦12,500</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Credibility Section hidden for now */}
      
      {/* Problem vs. Solution Section */}
      <section className="py-20 md:py-28 bg-secondary/20">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <span className="text-xs font-black uppercase tracking-widest text-primary">The Restaurant Dilemma</span>
            <h2 className="font-display text-3xl md:text-5xl font-black tracking-tight">Why Traditional Table Service is Costing You Money</h2>
            <p className="text-muted-foreground text-sm sm:text-base">Traditional table ordering is full of bottlenecks that reduce your margins, exhaust your staff, and frustrate your guests.</p>
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
                  { title: "Slow Order Speeds", desc: "Guests sit down and wait up to 15 minutes just to catch a waiter's attention and get a paper menu." },
                  { title: "Missing & Incorrect Items", desc: "Handwritten tickets lead to kitchen miscommunication. Wrong side orders or missing allergen notes occur regularly." },
                  { title: "Table turnover bottlenecks", desc: "Customers finish eating but wait another 10 minutes to request, review, split, and pay for their physical bill." },
                  { title: "Lost revenue during peak hours", desc: "Busy Friday nights result in overwhelmed waiters ignoring tables, missing high-margin drink top-ups." }
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
                  { title: "Instant QR Menus", desc: "Guests scan the table's unique QR code to instantly load your fast, image-rich menu right in their phone's browser." },
                  { title: "100% Order Accuracy", desc: "Customers customize their dishes directly (e.g. extra spicy, swap rice) sending the precise order right to the kitchen." },
                  { title: "Frictionless Payments", desc: "Inbuilt Paystack integration lets guests securely check out with card, transfer, or Apple Pay instantly right from the table." },
                  { title: "Automatic Revenue Boost", desc: "Beautiful dynamic checkout up-sells suggest drink pairings, mocktails, or desserts automatically, boosting ticket sizes by 22%." }
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
            <span className="text-xs font-black uppercase tracking-widest text-primary">Packed with Features</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Built Specifically for Modern Nigerian Operations</h2>
            <p className="text-muted-foreground">Every tool required to run your pharmacy seamlessly, integrated into one beautiful, lightning-fast dashboard.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: QrCode, title: "Zero-App QR Menu", desc: "No downloads, no logins. Customers just scan a high-quality printed QR code and your interactive menu opens in 1 second. Fast loading even on slow networks." },
              { icon: Bell, title: "Live Orders & Sound Alerts", desc: "Receive orders instantly on your phone or tablet dashboard. Loud, customizable sounds play instantly with every new ticket so no order is missed during loud peak hours." },
              { icon: Smartphone, title: "Mobile Waitstaff Sync", desc: "Waiters can view and assign orders directly from their phones. Avoid back-and-forth walks to the kitchen, giving them more time to focus on customer care." },
              { icon: BarChart3, title: "Naira Revenue Insights", desc: "Track cash, card, and transfer metrics at a glance. Identify your high-margin dishes, track busiest hours, and understand server performance instantly." },
              { icon: UtensilsCrossed, title: "Instant Live Menu Editor", desc: "Is a dish out-of-stock? Toggle it off instantly from your dashboard to prevent customer disappointment. Adjust prices or add weekly specials in 2 clicks." },
              { icon: DollarSign, title: "Integrated Paystack Payments", desc: "Fully integrated Paystack cashouts. Support card payments, bank transfers, and Apple Pay with automated transaction mapping to table numbers." }
            ].map((f, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-6 shadow-soft hover:shadow-elevated hover:border-primary/20 transition-all duration-300">
                <div className="h-12 w-12 rounded-xl bg-primary-soft text-primary grid place-items-center mb-5">
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
            <span className="text-xs font-black uppercase tracking-widest text-primary">Three Simple Steps</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Go Live in Under 30 Minutes</h2>
            <p className="text-muted-foreground">PharmIQ is built with zero configuration headaches. No technicians, servers, or expensive equipment needed.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { step: "01", title: "Upload Your Menu", desc: "Input your dishes, add descriptions and enticing photos. Set up specific categories (e.g. Appetizers, Grills, Cocktails) in minutes." },
              { step: "02", title: "Print & Place Table QRs", desc: "Generate a custom, print-ready PDF containing unique QR codes mapped to your specific tables. Print and place them on your tables, bars, or lounges." },
              { step: "03", title: "Receive Orders & Payments", desc: "Start receiving live orders on your dashboard screen instantly. Customers pay digitally via integrated secure bank transfers or card payments." }
            ].map((item, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-8 relative shadow-soft">
                <div className="font-display text-6xl font-black text-primary/10 absolute top-4 right-6 select-none">{item.step}</div>
                <h3 className="font-display text-lg font-bold mb-3 relative z-10">{item.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground relative z-10">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Use Cases Tabs */}
      <section className="py-20 md:py-28">
        <div className="container max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-primary">Flexible Configurations</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Tailored to Your Establishment Type</h2>
            <p className="text-muted-foreground">Every food business runs differently. PharmIQ shifts shape to fit your specific customer flow.</p>
          </div>

          {/* Tabs header */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 bg-secondary/40 p-1.5 rounded-2xl max-w-2xl mx-auto">
            {[
              { id: "qsr", label: "Bukkas & QSRs" },
              { id: "dinein", label: "Dine-In Restaurants" },
              { id: "lounge", label: "Lounges & Bars" },
              { id: "events", label: "Event Popups" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Tab Content */}
          <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-soft">
            {activeTab === "qsr" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Handle Massive Lunch Rushes Flawlessly</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Quick Service Restaurants (QSRs) and local Bukkas face high-volume checkout peaks. By displaying standees with QR codes, customers scan, order, and complete payment immediately, completely bypassing cashier order-entry queues.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Reduce long customer order queues</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Cashless Paystack transfers clear instantly</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Automated generation of kitchen ticket slips</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-primary/5 border-b border-border px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Live Order Queue</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                      Live
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Counter 1</div><div className="text-[10px] text-muted-foreground">Jollof Rice + Fried Chicken</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Preparing</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Counter 3</div><div className="text-[10px] text-muted-foreground">Pepper Soup + Malt</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Ready</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Counter 5</div><div className="text-[10px] text-muted-foreground">Shawarma × 2</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">New</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "dinein" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Dine-In Fine Dining & Lounge Coordination</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Dine-in guests require premium service. PharmIQ lets customers scan QR table stands, browse dynamic digital menu visuals, and customize order details seamlessly. Waiters are instantly notified of orders, allowing them to focus entirely on high-quality food delivery.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Let customers order Mocktail/Beer top-ups in 2 taps</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Waitstaff never spend time typing orders manually</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Spot-on allergen and ingredient custom edits</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-primary/5 border-b border-border px-4 py-2.5 flex items-center gap-2">
                    <QrCode className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Table 12 · Digital Menu</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div><div className="text-xs font-semibold">Grilled Chicken</div><div className="text-[9px] text-primary font-bold">Most Ordered</div></div>
                      <span className="text-xs font-black">₦4,500</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div><div className="text-xs font-semibold">Chapman (Large)</div><div className="text-[9px] text-primary font-bold">Top Seller</div></div>
                      <span className="text-xs font-black">₦1,800</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
                      <div className="text-[10px] font-bold text-muted-foreground">Pounded Yam + Egusi</div>
                      <span className="text-xs font-black">₦3,200</span>
                    </div>
                    <button className="w-full mt-1 py-2 rounded-xl bg-primary text-primary-foreground text-[10px] font-black tracking-wide shadow-glow">Add to Order →</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "lounge" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Lounges, Clubs & Busy Bars</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Noisy environments make taking manual verbal orders incredibly frustrating for staff. With PharmIQ, lounge and bar guests order directly from their phone, with tickets appearing instantly on the bar KDS tablet, eliminating order mishearing errors completely.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Zero order-mishearing errors due to high-decibel music</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Boost drink sales during late hours</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Direct billing mapping to private lounge booths</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-primary/5 border-b border-border px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Bar KDS · Booth Orders</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-primary">
                      <Bell className="h-3 w-3" /> 3 New
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="flex items-start justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Booth A · Hennessy XO</div><div className="text-[10px] text-muted-foreground">2 bottles · Extra ice</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary mt-0.5">₦48,000</span>
                    </div>
                    <div className="flex items-start justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Table 7 · Cocktail Mix</div><div className="text-[10px] text-muted-foreground">Mojito × 3 + Tequila Sunrise</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 mt-0.5">Preparing</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "events" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Event Popups & Temporary Catering</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hosting a weekend culinary popup or wedding caterer booth? Instead of wasting thousands printing paper menus, place standee QRs on tables. Update items dynamically in real time and easily coordinate temporary event operations without bulky registers.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Print standee QRs once, use at infinite events</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Instant live setup in under 15 minutes</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> Easy cashless remote settlements</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-primary/5 border-b border-border px-4 py-2.5 flex items-center gap-2">
                    <QrCode className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">Event Setup · Live</span>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                      <div className="text-lg font-black text-emerald-600">12</div>
                      <div className="text-[9px] text-muted-foreground font-semibold">Tables Active</div>
                    </div>
                    <div className="bg-primary/10 rounded-xl p-3 text-center">
                      <div className="text-lg font-black text-primary">47</div>
                      <div className="text-[9px] text-muted-foreground font-semibold">Orders Today</div>
                    </div>
                    <div className="bg-amber-500/10 rounded-xl p-3 text-center">
                      <div className="text-lg font-black text-amber-600">₦184k</div>
                      <div className="text-[9px] text-muted-foreground font-semibold">Revenue</div>
                    </div>
                    <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                      <div className="text-lg font-black text-blue-600">&lt;15m</div>
                      <div className="text-[9px] text-muted-foreground font-semibold">Setup Time</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Role-Based Benefits Section */}
      <section className="py-20 bg-secondary/35 border-y border-border">
        <div className="container max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-primary">Team Synchronization</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">How PharmIQ Optimizes Your Whole Staff</h2>
            <p className="text-muted-foreground">A unified system keeping every corner of your operations perfectly in tune.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { 
                icon: TrendingUp, 
                role: "For the Owner", 
                benefit: "Lower overhead & higher profit", 
                desc: "Reduce waitstaff counts by 20% while serving more customers. Increase average customer spending by 22% using automated desktop upsells. Get transparent live Naira metrics instantly." 
              },
              { 
                icon: Users, 
                role: "For the Waitstaff", 
                benefit: "Ditch handwritten pad worries", 
                desc: "Spend zero energy taking orders manually or writing illegible kitchen slips. Focus entirely on greeting guests, delivering steaming-hot meals, and keeping tables exceptionally clean." 
              },
              { 
                icon: ThumbsUp, 
                role: "For the Kitchen & Chef", 
                benefit: "100% order accuracy, zero confusion", 
                desc: "Every customized order detail appears clearly on the digital order dashboard. No deciphering handwritten notes or fighting with servers over missing instructions during friday peaks." 
              }
            ].map((roleBenefit, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-6 relative shadow-soft">
                <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary grid place-items-center mb-5">
                  <roleBenefit.icon className="h-5 w-5" />
                </div>
                <div className="text-xs font-black text-primary uppercase tracking-widest">{roleBenefit.role}</div>
                <h3 className="font-display font-bold text-base mt-1 mb-3">{roleBenefit.benefit}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{roleBenefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Us vs. Them Comparison Table */}
      <section id="why-us" className="py-20 md:py-28">
        <div className="container max-w-4xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-primary">Differentiation</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Why Leading Nigerian Venues Choose PharmIQ</h2>
            <p className="text-muted-foreground">Unlike complex foreign software billed in US dollars, PharmIQ is customized from ground up for Nigerian operations.</p>
          </div>

          <div className="bg-card border border-border rounded-3xl overflow-x-auto shadow-soft animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both delay-300">
            <table className="w-full min-w-[600px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/45 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="p-5">Feature Check</th>
                  <th className="p-5 text-primary bg-primary/5">PharmIQ</th>
                  <th className="p-5">Foreign SaaS / Old POS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { feature: "Billing & Cost Stability", us: "₦2,000 per table/mo (Pure Naira)", them: "$50 to $150/mo (Volatility risk)" },
                  { feature: "Integrated Payments", us: "Direct Paystack bank transfer/card", them: "Foreign gateways only (Dollar locks)" },
                  { feature: "Hardware Requirements", us: "Zero. Runs on standard phones/tablets", them: "Expensive custom terminal locks" },
                  { feature: "Customer Access", us: "Instant browser menu (Zero downloads)", them: "Forces app downloads or logins" },
                  { feature: "Operational Support", us: "24/7 Dedicated support (we will attend to you)", them: "Delayed timezone support tickets" }
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-secondary/10 transition-colors">
                    <td className="p-5 font-bold">{row.feature}</td>
                    <td className="p-5 bg-primary/5 font-semibold text-primary">{row.us}</td>
                    <td className="p-5 text-muted-foreground">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Styled Testimonials */}
      <section className="py-20 bg-secondary/35 border-y border-border">
        <div className="container max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-primary">Credibility & Trust</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Loved by Progressive Pharmacy Owners</h2>
            <p className="text-muted-foreground">See how pharmacies boosted their operations with us. We will attend to you wherever you are.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "On Friday nights, our waiters used to make order mistakes because of the noise. PharmIQ completely solved that. Our beverage sales alone grew by 25% because customers order drinks without waiting.",
                name: "Tunde Olanrewaju",
                role: "Director · Mama Cass",
                stars: 5
              },
              {
                quote: "We set up PharmIQ in under 20 minutes before lunch. By dinner, 80% of our guests were scanning and placing orders themselves. Customers absolutely love the transfer option; it clears instantly.",
                name: "Amara Nwachukwu",
                role: "Founder · Bukka Hut",
                stars: 5
              },
              {
                quote: "PharmIQ has cut our order turnaround time from 20 minutes to under 12 minutes. Waiters don't run back and forth with paper slips anymore. The staff is happy, and our guests are delighted.",
                name: "Femi Oyediran",
                role: "General Manager · The Yard",
                stars: 5
              }
            ].map((t, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-6 shadow-soft flex flex-col justify-between">
                <div>
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed italic">"{t.quote}"</p>
                </div>
                <div className="mt-6 pt-4 border-t border-border flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center font-display font-black text-xs">
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
                    className="w-full bg-secondary/40 border border-border rounded-xl p-3 text-xs focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
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
                    className="w-full bg-secondary/40 border border-border rounded-xl p-3 text-xs focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
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
                    className="w-full bg-secondary/40 border border-border rounded-xl p-3 text-xs focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    placeholder="e.g. Kilimanjaro Lekki"
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
                Ditch handwritten note mistakes. Switch to PharmIQ today.
              </h2>
              <p className="text-primary-foreground/90 max-w-xl mx-auto text-xs sm:text-sm">Join modern pharmacies getting more out of their dining room tables. We will attend to your needs.</p>
              <div className="pt-4 flex flex-wrap justify-center gap-3">
                <Button variant="accent" size="xl" asChild className="shadow-glow">
                  <Link to="/restaurant/pricing">View Plan Pricing <ArrowRight className="h-4 w-4" /></Link>
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

export default Home;
