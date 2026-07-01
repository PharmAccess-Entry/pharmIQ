import { PublicHeader, PublicFooter } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Check, Zap, Shield, HeadphonesIcon, BarChart3, Users, ArrowRight, MessageCircle, Star } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { formatNaira } from "@/lib/format";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { getCurrencySymbol } from "@/lib/format";

type Cycle = "monthly" | "yearly";

const pricingSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "PharmIQ Nigeria Pricing — Starter, Growth & Business Plans",
  "url": "https://pharmiq.site/pharmacy/pricing",
  "description": "Affordable pharmacy POS subscription plans for Nigerian pharmacies. Starting from ₦5,000/month. Created by LightOrb Innovations.",
  "mainEntity": {
    "@type": "Product",
    "name": "PharmIQ Pharmacy POS",
    "brand": { "@type": "Brand", "name": "PharmIQ by LightOrb Innovations" },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "NGN",
      "lowPrice": "5000",
      "highPrice": "250000",
      "offerCount": "3"
    }
  }
};

const PLANS = [
  {
    id: "Starter",
    label: "Starter",
    monthly: 5000,
    annual: 50000,
    users: "Up to 4 Users",
    userLimit: 4,
    desc: "Perfect for small pharmacies just getting started.",
    highlighted: false,
    badge: null,
  },
  {
    id: "Growth",
    label: "Growth",
    monthly: 10000,
    annual: 100000,
    users: "Up to 11 Users",
    userLimit: 11,
    desc: "Ideal for growing pharmacies with multiple staff members.",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    id: "Business",
    label: "Business",
    monthly: 25000,
    annual: 250000,
    users: "Unlimited Users",
    userLimit: null,
    desc: "For large pharmacy chains with no user restrictions.",
    highlighted: false,
    badge: null,
  },
];

const ALL_FEATURES = [
  "Dashboard & Analytics",
  "Products & Inventory",
  "POS & Barcode Scanning",
  "Shift Management & Reconciliation",
  "Patients, Suppliers & Purchases",
  "Expenses & Audit Logs",
  "Sales Reports",
  "Telegram Notifications",
  "Offline Mode & Sync",
  "Printing & Barcode",
  "Priority Support",
];

const Pricing = () => {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const { user } = useAuth();
  const navigate = useNavigate();

  const getPlanLink = (planId: string) => {
    const period = cycle === "yearly" ? "annual" : "monthly";
    if (user) {
      return `/payment?kind=pharmacy&plan=${planId}&period=${period}`;
    }
    return `/signup?type=pharmacy&plan=${planId}&period=${period}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>PharmIQ Pricing — Starter, Growth & Business | LightOrb Innovations</title>
        <meta name="description" content="Affordable Pharmacy POS pricing. Plans start from ₦5,000/month. All features included. Only user limits differ." />
        <meta name="keywords" content="PharmIQ pharmacy pricing Nigeria, POS system cost, pharmacy software plans" />
        <link rel="canonical" href="https://pharmiq.site/pharmacy/pricing" />
        <meta property="og:title" content="PharmIQ Pharmacy POS Pricing" />
        <meta property="og:description" content="Starter from ₦5,000/month. Growth from ₦10,000/month. Business from ₦25,000/month." />
        <meta property="og:url" content="https://pharmiq.site/pharmacy/pricing" />
        <script type="application/ld+json">{JSON.stringify(pricingSchema)}</script>
      </Helmet>

      <PublicHeader />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground pt-20 pb-32">
        <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -bottom-16 right-0 h-96 w-96 rounded-full bg-white/8 blur-3xl animate-blob-slow" />
        <div className="container relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-sm font-semibold mb-6 animate-fade-up">
            <Zap className="h-4 w-4 fill-white" /> Simple, transparent pricing
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-5 animate-fade-up delay-100">
            Plans Built for Every Pharmacy
          </h1>
          <p className="text-lg sm:text-xl text-white/85 max-w-xl mx-auto mb-8 animate-fade-up delay-200">
            Every plan includes every feature. The only difference is how many users you can add.
          </p>
        </div>
      </section>

      {/* ── PRICING CARDS ── */}
      <section className="pb-24 -mt-16">
        <div className="container max-w-6xl mx-auto px-4">
          {/* Billing Toggle */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center bg-card border border-border rounded-full p-1 shadow-soft">
              {(["monthly", "yearly"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={`relative px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                    cycle === c ? "bg-gradient-hero text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c === "monthly" ? "Monthly" : "Yearly"}
                  {c === "yearly" && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      cycle === c ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-600"
                    }`}>SAVE 2 MONTHS</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 3-Column Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
            {PLANS.map((plan) => {
              const price = cycle === "monthly" ? plan.monthly : plan.annual;
              const periodLabel = cycle === "monthly" ? "/month" : "/year";
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-3xl border-2 shadow-soft p-6 sm:p-8 transition-all duration-300 hover:-translate-y-1 ${
                    plan.highlighted
                      ? "border-emerald-500 bg-card shadow-glow"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-hero text-primary-foreground text-xs font-bold px-5 py-2 rounded-full whitespace-nowrap shadow-glow flex items-center gap-1.5">
                      <Star className="h-3 w-3 fill-white" /> {plan.badge}
                    </div>
                  )}

                  <div className={`mb-6 ${plan.badge ? "mt-2" : ""}`}>
                    <h2 className="font-display text-xl font-bold mb-1">{plan.label}</h2>
                    <p className="text-sm text-muted-foreground">{plan.desc}</p>
                  </div>

                  {/* Price */}
                  <div className={`rounded-2xl p-5 text-center border mb-6 ${
                    plan.highlighted ? "bg-emerald-500/8 border-emerald-500/20" : "bg-secondary/40 border-border"
                  }`}>
                    <div className="flex items-baseline justify-center gap-1 flex-wrap">
                      <span className={`font-display text-4xl font-black tabular-nums ${plan.highlighted ? "text-emerald-500" : ""}`}>
                        {formatNaira(price)}
                      </span>
                      <span className="text-muted-foreground font-medium text-sm">{periodLabel}</span>
                    </div>
                    {cycle === "yearly" && (
                      <div className="mt-2 text-xs text-emerald-600 font-semibold">
                        {formatNaira(plan.monthly * 10)} billed annually
                      </div>
                    )}
                    <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
                      plan.highlighted
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-primary/10 text-primary"
                    }`}>
                      <Users className="h-3.5 w-3.5" /> {plan.users}
                    </div>
                  </div>

                  {/* CTA */}
                  <Button
                    variant={plan.highlighted ? "hero" : "outline"}
                    size="lg"
                    className={`w-full font-bold mb-6 ${plan.highlighted ? "shadow-glow" : ""}`}
                    asChild
                  >
                    <Link to={getPlanLink(plan.id)}>
                      {user ? "Subscribe Now" : "Get Started"}
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Link>
                  </Button>

                  {/* Features */}
                  <div className="space-y-2.5 mt-auto">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">All Features Included</div>
                    {ALL_FEATURES.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <Check className={`h-3.5 w-3.5 shrink-0 ${plan.highlighted ? "text-emerald-500" : "text-primary"}`} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature note */}
          <p className="text-center text-sm text-muted-foreground mt-8">
            ✓ All plans include identical features &nbsp;·&nbsp; Only user limits differ &nbsp;·&nbsp; Upgrade anytime
          </p>
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="py-12 bg-muted/30 border-y border-border/40">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "${getCurrencySymbol()}0", label: "Setup fee" },
              { value: "3-Day", label: "Free trial" },
              { value: "0%", label: "Commission on sales" },
              { value: "Cancel", label: "Anytime, no lock-in" },
            ].map((s) => (
              <div key={s.label} className="animate-fade-up hover-lift">
                <div className="text-3xl font-black gradient-text">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-24 px-4">
        <div className="container max-w-2xl mx-auto text-center">
          <div className="relative overflow-hidden bg-gradient-hero text-primary-foreground rounded-3xl p-10 shadow-glow animate-scale-in">
            <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-2xl animate-blob" />
            <div className="relative">
              <h2 className="text-3xl font-extrabold mb-4">Still have questions?</h2>
              <p className="text-white/85 mb-8">Our team is happy to walk you through pricing and set up a live demo.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-bold rounded-full">
                  <Link to="/signup">Start Free Trial <ArrowRight className="h-4 w-4 ml-1.5" /></Link>
                </Button>
                <a
                  href="https://wa.me/2348025100844?text=Hi%2C%20I%20have%20a%20question%20about%20PharmIQ%20pricing"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white/15 backdrop-blur border border-white/25 text-white font-bold px-6 py-3 rounded-full hover:bg-white/25 transition-all duration-300 hover:-translate-y-0.5"
                >
                  <MessageCircle className="h-4 w-4" /> Chat with us
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};
export default Pricing;
