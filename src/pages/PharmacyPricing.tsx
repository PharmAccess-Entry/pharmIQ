import { PublicHeader, PublicFooter } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Zap, Shield, HeadphonesIcon, BarChart3, QrCode, ArrowRight, MessageCircle } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { formatNaira } from "@/lib/format";
import { EVENT_TIERS, monthlyPriceForTables } from "@/lib/restaurant";
import { useState } from "react";

type Cycle = "monthly" | "yearly";
type Mode = "restaurant" | "event";

const pricingSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "PharmIQ Nigeria Pricing — ₦2,000 per table/month",
  "url": "https://getpharmiq.com/pricing",
  "description": "Affordable pharmacy POS plans for Nigerian pharmacies and event centers. Starting from ₦2,000 per table per month. Created by Olatunbosun Oluwafemi, LightOrb Innovations.",
  "mainEntity": {
    "@type": "Product",
    "name": "PharmIQ QR Ordering System",
    "brand": { "@type": "Brand", "name": "PharmIQ by LightOrb Innovations" },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "NGN",
      "lowPrice": "2000",
      "highPrice": "200000",
      "offerCount": "2"
    }
  }
};

const features = [
  { icon: QrCode,          label: "Custom QR codes for every table" },
  { icon: Zap,             label: "Real-time kitchen sync" },
  { icon: BarChart3,       label: "Full analytics & insights" },
  { icon: Shield,          label: "Secure Paystack payments" },
  { icon: HeadphonesIcon,  label: "Priority support" },
  { icon: Check,           label: "No hidden fees, ever" },
];

const Pricing = () => {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  const priceFor = (monthly: number) => (cycle === "monthly" ? monthly : monthly * 10);
  const periodLabel = cycle === "monthly" ? "/month" : "/year";

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>PharmIQ Pharmacy POS Pricing | LightOrb Innovations</title>
        <meta name="description" content="Affordable Pharmacy POS pricing. Pay a flat ₦5,000 per month." />
        <meta name="keywords" content="PharmIQ pharmacy pricing Nigeria, POS system cost" />
        <link rel="canonical" href="https://getpharmiq.com/pharmacy/pricing" />
        <meta property="og:title" content="PharmIQ Pharmacy POS Pricing" />
        <meta property="og:description" content="Pay a flat ₦5,000 per month. No setup fees. 3-day free trial." />
        <meta property="og:url" content="https://getpharmiq.com/pharmacy/pricing" />
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
            Pay for What You Use
          </h1>
          <p className="text-lg sm:text-xl text-white/85 max-w-xl mx-auto mb-8 animate-fade-up delay-200">
            No contracts. No setup fees. No dollar-denominated surprises. Just pure Naira, built for Nigeria.
          </p>
        </div>
      </section>

      {/* ── PRICING CARD(S) ── */}
      <section className="pb-24 -mt-16">
        <div className="container max-w-4xl mx-auto px-4">

            <div className="animate-scale-in">
              {/* Cycle Toggle */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center bg-card border border-border rounded-full p-1 shadow-soft">
                  {(["monthly", "yearly"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCycle(c)}
                      className={`relative px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                        cycle === c ? "bg-gradient-hero text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c === "monthly" ? "Monthly" : "Yearly"}
                      {c === "yearly" && (
                        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                          cycle === c ? "bg-white/20 text-white" : "bg-success/15 text-success"
                        }`}>2 FREE</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Pricing Card */}
              <div className="relative bg-card rounded-3xl border-2 border-emerald-500 shadow-glow p-8 sm:p-12 max-w-2xl mx-auto hover-lift">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-hero text-primary-foreground text-xs font-bold px-5 py-2 rounded-full whitespace-nowrap shadow-glow">
                  ✦ Flat Rate Pricing
                </div>

                <div className="text-center mb-10">
                  <h2 className="font-display text-2xl font-bold mb-2">Pharmacy POS Plan</h2>
                  <p className="text-muted-foreground text-sm">Everything you need to track inventory and manage shifts.</p>
                </div>

                {/* Price display */}
                <div className="bg-gradient-soft rounded-2xl p-6 text-center border border-border mb-8">
                  <div className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-2">
                    Your {cycle === "monthly" ? "monthly" : "yearly"} total
                  </div>
                  <div className="flex items-baseline justify-center gap-1 flex-wrap">
                    <span className="font-display text-5xl sm:text-6xl font-black text-emerald-500 tabular-nums">
                      {formatNaira(priceFor(5000))}
                    </span>
                    <span className="text-muted-foreground font-medium">{periodLabel}</span>
                  </div>
                  {cycle === "yearly" && (
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-success/10 text-success font-bold text-sm px-4 py-2 rounded-full">
                      <Check className="h-4 w-4" />
                      Save {formatNaira(5000 * 2)} — 2 months free!
                    </div>
                  )}
                </div>

                <Button variant="hero" size="lg" className="w-full text-base font-bold shadow-glow mb-8" asChild>
                  <Link to="/signup?type=pharmacy">
                    Get Started Now
                    <ArrowRight className="h-5 w-5 ml-2" />
                  </Link>
                </Button>

                {/* Features grid */}
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { icon: Shield,          label: "Shift Management" },
                    { icon: Zap,             label: "Real-time POS checkout" },
                    { icon: BarChart3,       label: "Live Inventory Tracking" },
                    { icon: Shield,          label: "Secure Payments" },
                    { icon: HeadphonesIcon,  label: "Priority support" },
                    { icon: Check,           label: "No hidden fees, ever" },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-3 text-sm bg-secondary/40 rounded-xl px-4 py-3">
                      <f.icon className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="font-medium">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section className="py-12 bg-muted/30 border-y border-border/40">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "₦0", label: "Setup fee" },
              { value: "3-Day", label: "Free trial" },
              { value: "0%", label: "Commission on orders" },
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
