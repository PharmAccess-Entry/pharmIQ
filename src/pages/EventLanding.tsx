import { PublicHeader, PublicFooter } from "@/components/PublicLayout";
import heroFoodImg from "@/assets/hero-food.jpg";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  ArrowRight, QrCode, Smartphone, BarChart3, Bell, Check, X, Star, 
  Ticket, CheckCircle2, AlertCircle, TrendingUp, Users, Music, 
  DollarSign, Clock, Sparkles, PartyPopper, CalendarDays, ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { sanitizeInput } from "@/lib/sanitize";

const WEB3FORMS_KEY = "2aefb05d-d497-4c17-a5c6-e742212509e5";

const EventLanding = () => {
  // Lead Capture State
  const [demoForm, setDemoForm] = useState({ name: "", phone: "", venue: "" });
  const [submitting, setSubmitting] = useState(false);

  // Active Use Case tab
  const [activeTab, setActiveTab] = useState<"concerts" | "weddings" | "nightclubs" | "popups">("concerts");

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoForm.name || !demoForm.phone || !demoForm.venue) {
      toast.error("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("access_key", WEB3FORMS_KEY);
      fd.append("subject", "New PharmIQ Live Demo Request (Events)");
      fd.append("from_name", "PharmIQ Live Demo Booking");
      fd.append("name", sanitizeInput(demoForm.name));
      fd.append("phone", sanitizeInput(demoForm.phone));
      fd.append("venue", sanitizeInput(demoForm.venue));
      
      const res = await fetch("https://api.web3forms.com/submit", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to send");
      
      toast.success("Demo request received! We will attend to you in under 10 minutes.");
      setDemoForm({ name: "", phone: "", venue: "" });
    } catch (err: any) {
      toast.error(err.message || "Could not submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col scroll-smooth">
      <Helmet>
        <title>PharmIQ Events — High Volume QR Ordering for Event Centers</title>
        <meta name="description" content="PharmIQ is the #1 QR ordering software for Nigerian event centers. Manage mass ordering, digital payments, and dynamic capacities easily." />
      </Helmet>
      <PublicHeader overHero />

      {/* Hero Section */}
      <section className="relative min-h-[100svh] max-h-[100svh] -mt-16 flex items-center overflow-hidden bg-slate-950">
        <img
          src={heroFoodImg}
          alt="High-energy Nigerian event center with tables full of guests"
          className="absolute inset-0 w-full h-full object-cover"
          fetchpriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0b2e]/90 via-[#3b1257]/70 to-[#120524]/85" />
        
        {/* Animated Orbs */}
        <div className="absolute top-1/4 left-1/4 w-[30vw] h-[30vw] bg-purple-500/15 rounded-full blur-[100px] animate-pulse-soft" />
        <div className="absolute bottom-1/4 right-1/4 w-[25vw] h-[25vw] bg-pink-500/15 rounded-full blur-[120px] animate-pulse-soft" style={{ animationDelay: '2s' }} />

        <div className="container relative z-10 pt-16 pb-10 md:py-24">
          <div className="max-w-3xl animate-fade-in space-y-4">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-[11px] sm:text-xs font-semibold mb-3 sm:mb-5">
              <Sparkles className="h-3 w-3 text-purple-400" />
              The #1 Ordering System for Nigerian Event Centers
            </span>
            <h1 className="font-display text-[2.25rem] leading-[1.05] sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white text-shadow-hero">
              Handle massive crowds without breaking a <span className="text-purple-400" style={{ textShadow: "0 2px 24px rgba(168, 85, 247, 0.6)" }}>sweat</span>.
            </h1>
            <p className="mt-2.5 sm:mt-6 text-sm sm:text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed">
              Equip every VIP table or bar section with a dynamic QR code. Let hundreds of guests order and pay simultaneously during peak events without swamping your bartenders or waiters.
            </p>
            
            <div className="mt-4 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Button variant="hero" size="xl" asChild className="w-full sm:w-auto shadow-[0_0_40px_-10px_rgba(168,85,247,0.5)] bg-purple-600 hover:bg-purple-700 text-white">
                <Link to="/signup">Start Free 3-Day Trial <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button variant="outline" size="xl" asChild className="w-full sm:w-auto bg-white/10 backdrop-blur border-white/30 text-white hover:bg-white/20 hover:text-white">
                <Link to="/contact">Book a Live Demo</Link>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/90">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.15)] backdrop-blur-md">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="font-semibold tracking-wide">No credit card required</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.15)] backdrop-blur-md">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500/20 text-pink-400">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="font-semibold tracking-wide">Pay only for active tables</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Mini Live Order Status Card */}
        <div className="hidden lg:block absolute right-16 bottom-24 z-10 animate-float">
          <div className="bg-[#1e1030]/80 border border-purple-500/20 rounded-2xl p-5 shadow-elevated w-76 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center text-white shadow-glow">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] text-purple-300 uppercase font-bold tracking-widest">Live Order · VIP Section B</div>
                <div className="font-display font-black text-sm text-white">2× Chapman + Virgin Mojito</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs font-semibold text-emerald-400">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Payment Verified</span>
              <span className="text-white">₦150,000</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem vs. Solution Section */}
      <section className="py-20 md:py-28 bg-secondary/20">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <span className="text-xs font-black uppercase tracking-widest text-purple-600">The Event Dilemma</span>
            <h2 className="font-display text-3xl md:text-5xl font-black tracking-tight">Why Manual Ordering Fails at Scale</h2>
            <p className="text-muted-foreground text-sm sm:text-base">During busy events, traditional bar service creates massive bottlenecks, frustrating guests and limiting your revenue potential.</p>
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
                  { title: "Bar Bottlenecks", desc: "Guests abandon the idea of ordering a second drink because the bar queue is too long." },
                  { title: "Lost Payment Context", desc: "Bartenders scramble to verify bank transfer screenshots amidst the loud music." },
                  { title: "Waiter Fatigue", desc: "Waiters are overwhelmed trying to memorize orders for VIP tables of 10+ people." },
                  { title: "Menu Printing Costs", desc: "Printing hundreds of menus that get ruined by spilled drinks every night." }
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
            <div className="bg-card border border-purple-500/20 rounded-3xl p-8 relative overflow-hidden shadow-elevated">
              <div className="absolute top-0 right-0 h-16 w-16 bg-purple-500/5 rounded-bl-full flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-display text-xl font-bold text-purple-600 mb-6 flex items-center gap-2">
                <span>The PharmIQ Way</span>
              </h3>
              <ul className="space-y-4">
                {[
                  { title: "Mass Concurrent Ordering", desc: "Hundreds of guests can scan and order at the exact same second without crashing your workflow." },
                  { title: "Instant Payment Verification", desc: "Paystack instantly verifies the transfer, freeing your staff from checking fake screenshots." },
                  { title: "Dynamic Capacities", desc: "Only pay for the tables you actually activate for specific events, optimizing your software costs." },
                  { title: "Effortless Fulfillment", desc: "Bartenders simply prepare drinks based on the digital ticket and hand them to runners for delivery." }
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="h-5 w-5 rounded-full bg-purple-500/10 text-purple-600 grid place-items-center shrink-0"><Check className="h-3 w-3" /></span>
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
            <span className="text-xs font-black uppercase tracking-widest text-purple-600">Packed with Features</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Built Specifically for High-Volume Events</h2>
            <p className="text-muted-foreground">Everything you need to run mass-scale operations seamlessly, integrated into one beautiful dashboard.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: QrCode, title: "Zero-App QR Menu", desc: "No downloads, no logins. Customers just scan a high-quality printed QR code and your interactive menu opens in 1 second. Fast loading even on slow event networks." },
              { icon: Bell, title: "Live Orders & Sound Alerts", desc: "Receive orders instantly on your tablet dashboard. Loud, customizable sounds play instantly with every new ticket so no order is missed amidst the loud music." },
              { icon: Smartphone, title: "Runner & Waitstaff Sync", desc: "Runners can view and assign orders directly from their phones. Avoid back-and-forth walks to the bar, giving them more time to focus on VIP guests." },
              { icon: BarChart3, title: "Live Event Revenue Insights", desc: "Track cash, card, and transfer metrics at a glance. Identify your high-margin drinks, track busiest hours, and understand server performance instantly." },
              { icon: CalendarDays, title: "Dynamic Table Setup", desc: "Creating a new event? Generate a fresh batch of table QRs in minutes. Deactivate them after the event is over to save costs." },
              { icon: DollarSign, title: "Integrated Paystack Payments", desc: "Fully integrated Paystack cashouts. Support card payments, bank transfers, and Apple Pay with automated transaction mapping to specific VIP booths." }
            ].map((f, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-6 shadow-soft hover:shadow-elevated hover:border-purple-500/20 transition-all duration-300 group">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-600 grid place-items-center mb-5 group-hover:scale-110 transition-transform">
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
            <span className="text-xs font-black uppercase tracking-widest text-purple-600">Three Simple Steps</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Go Live in Under 30 Minutes</h2>
            <p className="text-muted-foreground">PharmIQ is built with zero configuration headaches. No technicians, servers, or expensive equipment needed.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { step: "01", title: "Upload Your Bar Menu", desc: "Input your drinks, add descriptions and enticing photos. Set up specific categories (e.g. Cocktails, Spirits, Mixers) in minutes." },
              { step: "02", title: "Print & Place Table QRs", desc: "Generate a custom, print-ready PDF containing unique QR codes mapped to your specific VIP tables and general areas. Print and place them." },
              { step: "03", title: "Receive Orders & Payments", desc: "Start receiving live orders on your bar's dashboard screen instantly. Guests pay digitally via integrated secure bank transfers." }
            ].map((item, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-8 relative shadow-soft">
                <div className="font-display text-6xl font-black text-purple-500/10 absolute top-4 right-6 select-none">{item.step}</div>
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
            <span className="text-xs font-black uppercase tracking-widest text-purple-600">Flexible Configurations</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Tailored to Your Event Type</h2>
            <p className="text-muted-foreground">Every event runs differently. PharmIQ shifts shape to fit your specific guest flow.</p>
          </div>

          {/* Tabs header */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 bg-secondary/40 p-1.5 rounded-2xl max-w-2xl mx-auto">
            {[
              { id: "concerts", label: "Concerts & Shows" },
              { id: "nightclubs", label: "Nightclubs & VIP" },
              { id: "weddings", label: "Weddings & Banquets" },
              { id: "popups", label: "Food Pop-ups" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? "bg-purple-600 text-white shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Tab Content */}
          <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-soft">
            {activeTab === "concerts" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Handle Massive Concert Rushes Flawlessly</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    At live shows, the bar queue can get discouragingly long. By displaying standees with QR codes around the venue or on VIP tables, guests scan, order, and complete payment immediately, bypassing the bar queue completely.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Reduce long bar queues</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Cashless Paystack transfers clear instantly</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Automated generation of bar ticket slips</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-purple-500/5 border-b border-border px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-600">Live Order Queue</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                      Live
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="flex items-center justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">VIP Section 1</div><div className="text-[10px] text-muted-foreground">Moët & Chandon + Sparklers</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Preparing</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">General Bar</div><div className="text-[10px] text-muted-foreground">Heineken × 4</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "nightclubs" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Nightclubs & High-End VIP Booths</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Noisy environments make taking manual verbal orders incredibly frustrating. With PharmIQ, club guests order directly from their phone, with tickets appearing instantly on the bar KDS tablet, eliminating order mishearing errors completely.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Zero order-mishearing errors due to high-decibel music</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Boost drink sales during late hours</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Direct billing mapping to private booths</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-purple-500/5 border-b border-border px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-600">Bar KDS · Booth Orders</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-purple-600">
                      <Bell className="h-3 w-3" /> 3 New
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    <div className="flex items-start justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Booth A · Hennessy XO</div><div className="text-[10px] text-muted-foreground">2 bottles · Extra ice</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 mt-0.5">₦480,000</span>
                    </div>
                    <div className="flex items-start justify-between px-4 py-3">
                      <div><div className="text-xs font-bold">Table 7 · Cocktail Mix</div><div className="text-[10px] text-muted-foreground">Mojito × 3 + Tequila Sunrise</div></div>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 mt-0.5">Preparing</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "weddings" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Weddings & High-Class Banquets</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Dine-in guests require premium service. PharmIQ lets attendees scan QR table stands, browse dynamic digital menu visuals (like 'Jollof & Small Chops'), and request items directly to their table seamlessly. Waiters are instantly notified of table requests, allowing them to focus entirely on high-quality delivery.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Let guests request drink top-ups in 2 taps</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Waitstaff never spend time walking aimlessly</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Elegant digital menus replace flimsy paper</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-purple-500/5 border-b border-border px-4 py-2.5 flex items-center gap-2">
                    <QrCode className="h-3.5 w-3.5 text-purple-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-600">Table 12 · Digital Menu</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div><div className="text-xs font-semibold">Special Jollof + Chicken</div><div className="text-[9px] text-purple-600 font-bold">Most Requested</div></div>
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
                      <div className="text-[10px] font-bold text-muted-foreground">Request Server for Refill</div>
                    </div>
                    <button className="w-full mt-1 py-2 rounded-xl bg-purple-600 text-white text-[10px] font-black tracking-wide shadow-glow">Request →</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "popups" && (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <h3 className="font-display text-2xl font-bold">Event Popups & Temporary Catering</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hosting a weekend culinary popup or festival booth? Instead of wasting thousands printing paper menus, place standee QRs on tables. Update items dynamically in real time and easily coordinate temporary event operations without bulky registers.
                  </p>
                  <ul className="space-y-2 text-xs font-semibold text-foreground">
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Print standee QRs once, use at infinite events</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Instant live setup in under 15 minutes</li>
                    <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-purple-500 shrink-0" /> Easy cashless remote settlements</li>
                  </ul>
                </div>
                <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
                  <div className="bg-purple-500/5 border-b border-border px-4 py-2.5 flex items-center gap-2">
                    <QrCode className="h-3.5 w-3.5 text-purple-600" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-600">Event Setup · Live</span>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                      <div className="text-lg font-black text-emerald-600">12</div>
                      <div className="text-[9px] text-muted-foreground font-semibold">Tables Active</div>
                    </div>
                    <div className="bg-purple-500/10 rounded-xl p-3 text-center">
                      <div className="text-lg font-black text-purple-600">47</div>
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
            <span className="text-xs font-black uppercase tracking-widest text-purple-600">Team Synchronization</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">How PharmIQ Optimizes Your Event Staff</h2>
            <p className="text-muted-foreground">A unified system keeping every corner of your operations perfectly in tune.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { 
                icon: TrendingUp, 
                role: "For the Promoter/Owner", 
                benefit: "Lower overhead & higher profit", 
                desc: "Reduce waitstaff counts by 20% while serving more customers. Increase average customer spending by 22% using automated digital upsells. Get transparent live Naira metrics instantly." 
              },
              { 
                icon: Users, 
                role: "For the Host/Runner", 
                benefit: "Ditch handwritten pad worries", 
                desc: "Spend zero energy taking orders manually or writing illegible bar slips. Focus entirely on greeting guests, delivering drinks, and ensuring VIPs are well catered to." 
              },
              { 
                icon: Music, 
                role: "For the Bartender", 
                benefit: "100% order accuracy, zero confusion", 
                desc: "Every customized order detail appears clearly on the digital order dashboard. No deciphering handwritten notes or fighting with servers over missing instructions during loud sets." 
              }
            ].map((roleBenefit, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-6 relative shadow-soft hover:shadow-elevated transition-shadow">
                <div className="h-11 w-11 rounded-xl bg-purple-500/10 text-purple-600 grid place-items-center mb-5">
                  <roleBenefit.icon className="h-5 w-5" />
                </div>
                <div className="text-xs font-black text-purple-600 uppercase tracking-widest">{roleBenefit.role}</div>
                <h3 className="font-display font-bold text-base mt-1 mb-3">{roleBenefit.benefit}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{roleBenefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Styled Testimonials */}
      <section className="py-20 bg-secondary/35 border-y border-border">
        <div className="container max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-black uppercase tracking-widest text-purple-600">Credibility & Trust</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Loved by Leading Event Organizers</h2>
            <p className="text-muted-foreground">See how venues boosted their operations with us. We will attend to you wherever you are.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "During our latest Afrobeats festival, the bar queues were a nightmare until we deployed PharmIQ. Beverage sales increased immediately because customers didn't have to wait in line anymore.",
                name: "Tunde Olanrewaju",
                role: "Event Director",
                stars: 5
              },
              {
                quote: "We set up PharmIQ in under 20 minutes before a major wedding. By reception time, 80% of our guests were scanning and placing drink orders themselves. The transfer option clears instantly.",
                name: "Amara Nwachukwu",
                role: "Wedding Planner",
                stars: 5
              },
              {
                quote: "PharmIQ cut our VIP booth order turnaround time by half. Hostesses don't run back and forth with paper slips anymore. The staff is less stressed, and the VIPs feel well attended to.",
                name: "Femi Oyediran",
                role: "Club Manager",
                stars: 5
              }
            ].map((t, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-6 shadow-soft flex flex-col justify-between hover:border-purple-500/20 transition-colors">
                <div>
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-purple-500 text-purple-500" />
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed italic">"{t.quote}"</p>
                </div>
                <div className="mt-6 pt-4 border-t border-border flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-purple-500/10 text-purple-600 grid place-items-center font-display font-black text-xs">
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
            <span className="text-xs font-black uppercase tracking-widest text-purple-600">Frequently Asked</span>
            <h2 className="font-display text-3xl font-bold">Got Questions? We’ve Got Answers.</h2>
            <p className="text-muted-foreground">Everything you need to know about setting up PharmIQ for your events.</p>
          </div>

          <div className="space-y-4">
            {[
              { 
                q: "Do guests need to download an application?", 
                a: "Absolutely not. When a guest scans a VIP table's QR stand, the responsive digital menu loads instantly inside their default browser. The process is frictionless and fast." 
              },
              { 
                q: "How long does setup take?", 
                a: "Setup takes under 30 minutes! You simply register, type in your bar menu details, generate your custom printed standee PDFs mapping QRs to sections, print them, and you are live." 
              },
              { 
                q: "What payment options does PharmIQ support?", 
                a: "In Nigeria, secure bank transfers and card checkouts are crucial. We integrate fully with Paystack so guests can complete payments directly using Cards, Bank Transfer, Apple Pay, or USSD." 
              },
              { 
                q: "Can I manage multiple events concurrently?", 
                a: "Yes! You can set up dynamic table groups for different events happening simultaneously, activating and deactivating them as needed." 
              }
            ].map((faq, idx) => (
              <details key={idx} className="group bg-card border border-border rounded-2xl p-5 [&_summary::-webkit-details-marker]:hidden transition-all duration-300 hover:border-purple-500/30">
                <summary className="flex items-center justify-between cursor-pointer font-bold text-sm">
                  {faq.q}
                  <span className="ml-4 text-purple-600 transition-transform group-open:rotate-45 text-lg leading-none">+</span>
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
              <span className="text-xs font-black uppercase tracking-widest text-purple-600">Interactive Demo</span>
              <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">Ready to Boost Your Event Margins?</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Schedule a quick live demonstration. Our representative will bring standard QR table stand samples, set up a temporary test menu on your tablet, and show your team exactly how the system manages live mass orders in real time.
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 grid place-items-center"><Clock className="h-5 w-5" /></div>
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
                    className="w-full bg-secondary/40 border border-border rounded-xl p-3 text-xs focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-colors"
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
                    className="w-full bg-secondary/40 border border-border rounded-xl p-3 text-xs focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-colors"
                    placeholder="e.g. 08025100844"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-muted-foreground mb-1.5" htmlFor="venue">Venue / Event Company Name</label>
                  <input
                    id="venue"
                    type="text"
                    required
                    value={demoForm.venue}
                    onChange={(e) => setDemoForm({ ...demoForm, venue: e.target.value })}
                    className="w-full bg-secondary/40 border border-border rounded-xl p-3 text-xs focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-colors"
                    placeholder="e.g. The Grand Venue Lagos"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full h-11 rounded-xl text-xs font-black shadow-glow bg-purple-600 hover:bg-purple-700 text-white">
                  {submitting ? "Submitting..." : "Book Consultation"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing/CTA Banner Section */}
      <section className="py-20">
        <div className="container">
          <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-10 md:p-16 text-center shadow-elevated relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="relative space-y-4">
              <div className="flex justify-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-purple-400 text-purple-400 animate-pulse-soft" />)}
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-black text-white max-w-2xl mx-auto">
                Stop losing sales to bar queues. Switch to PharmIQ Events.
              </h2>
              <p className="text-white/80 max-w-xl mx-auto text-xs sm:text-sm">Join modern event centers getting more out of their massive crowds. We will attend to your needs.</p>
              <div className="pt-4 flex flex-wrap justify-center gap-3">
                <Button variant="accent" size="xl" asChild className="shadow-glow bg-white text-purple-900 hover:bg-white/90">
                  <Link to="/events/pricing">View Plan Pricing <ArrowRight className="h-4 w-4" /></Link>
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

export default EventLanding;
