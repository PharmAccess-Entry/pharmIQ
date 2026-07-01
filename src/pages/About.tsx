import { Helmet } from "react-helmet-async";
import { PublicHeader, PublicFooter } from "@/components/PublicLayout";
import { Link } from "react-router-dom";
import { ArrowRight, Lightbulb, TrendingUp, Users, ExternalLink, CheckCircle2, Star } from "lucide-react";
import { getCurrencySymbol } from "@/lib/format";

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Olatunbosun Oluwafemi",
  "url": "https://lightorbinnovations.netlify.app/",
  "jobTitle": "Founder & CEO",
  "worksFor": {
    "@type": "Organization",
    "name": "LightOrb Innovations",
    "url": "https://lightorbinnovations.netlify.app/"
  },
  "knowsAbout": ["Pharmacy Technology", "QR Ordering Systems", "Business Growth", "Digital Innovation", "Software Development"],
  "sameAs": [
    "https://www.linkedin.com/company/lightorb-innovations",
    "https://www.instagram.com/lightorb_innovations",
    "https://www.facebook.com/share/1AnyYN9Dxu/"
  ],
  "description": "Olatunbosun Oluwafemi is the founder of LightOrb Innovations and creator of PharmIQ, Nigeria's leading QR-based pharmacy ordering platform."
};

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "LightOrb Innovations",
  "founder": {
    "@type": "Person",
    "name": "Olatunbosun Oluwafemi"
  },
  "url": "https://lightorbinnovations.netlify.app/",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+234-802-510-0844",
    "email": "hello@getpharmiq.com",
    "contactType": "customer support"
  },
  "sameAs": [
    "https://www.linkedin.com/company/lightorb-innovations",
    "https://www.instagram.com/lightorb_innovations"
  ]
};

export default function About() {
  const values = [
    { icon: TrendingUp, title: "Our Mission", text: "To empower businesses and communities through tailored innovation, becoming a trusted catalyst for lasting impact and smarter growth." },
    { icon: Lightbulb, title: "What We Do", text: "We empower businesses to identify challenges, seize opportunities, and implement intelligent solutions that drive tangible, transformative results." },
    { icon: Users, title: "Our Core Values", text: "Clarity, collaboration, innovation, integrity, and impact — ensuring every solution is precise, ethical, and deeply growth-driven." },
  ];

  const achievements = [
    { label: "Years Building", value: "3+" },
    { label: "Businesses Served", value: "50+" },
    { label: "Products Shipped", value: "10+" },
    { label: "Countries Reached", value: "2+" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>About Olatunbosun Oluwafemi — Founder of LightOrb Innovations | PharmIQ Nigeria</title>
        <meta name="description" content="Meet Olatunbosun Oluwafemi, founder of LightOrb Innovations and creator of PharmIQ — Nigeria's smartest pharmacy POS and inventory system. Empowering hospitality businesses with smart digital solutions." />
        <meta name="keywords" content="Olatunbosun Oluwafemi, LightOrb Innovations, PharmIQ Nigeria, pharmacy POS and inventory, Nigerian pharmacy technology, Abuja tech founder" />
        <link rel="canonical" href="https://getpharmiq.com/about" />
        <meta property="og:title" content="About Olatunbosun Oluwafemi — Founder of LightOrb & PharmIQ Nigeria" />
        <meta property="og:description" content="Learn about the visionary founder behind PharmIQ and LightOrb Innovations — transforming Nigerian hospitality with smart QR ordering technology." />
        <meta property="og:url" content="https://getpharmiq.com/about" />
        <meta property="og:type" content="profile" />
        <meta name="twitter:title" content="About Olatunbosun Oluwafemi — Founder, LightOrb Innovations" />
        <meta name="twitter:description" content="Meet the founder of PharmIQ Nigeria — Olatunbosun Oluwafemi, building smart solutions for Nigerian pharmacies." />
        <script type="application/ld+json">{JSON.stringify(personSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(orgSchema)}</script>
      </Helmet>

      <PublicHeader />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-hero pt-20 pb-28 text-primary-foreground">
        {/* Animated blobs */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-96 w-96 rounded-full bg-white/8 blur-3xl animate-blob-slow" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-white/5 blur-2xl animate-blob" style={{ animationDelay: "3s" }} />

        <div className="container relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-semibold mb-6 animate-fade-up border border-white/20">
            <Star className="h-4 w-4 fill-white text-white" />
            Built by LightOrb Innovations · FCT, Abuja
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 animate-fade-up delay-100">
            Meet the Mind<br className="hidden sm:block" /> Behind PharmIQ
          </h1>
          <p className="text-lg sm:text-xl text-white/85 max-w-2xl mx-auto mb-10 animate-fade-up delay-200">
            A catalyst for smarter business growth in Nigeria's hospitality industry — one QR code at a time.
          </p>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto animate-fade-up delay-300">
            {achievements.map((a) => (
              <div key={a.label} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl py-4 px-3 hover-lift card-shine">
                <div className="text-3xl font-black">{a.value}</div>
                <div className="text-xs text-white/70 mt-1 font-medium">{a.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOUNDER ── */}
      <section className="py-20 md:py-28">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Photo */}
            <div className="flex justify-center animate-slide-in-left">
              <div className="relative group">
                {/* Glow ring */}
                <div className="absolute -inset-3 rounded-3xl bg-gradient-hero opacity-20 blur-2xl group-hover:opacity-35 transition-opacity duration-500" />
                {/* Badge */}
                <div className="absolute -bottom-4 -right-4 z-10 bg-gradient-hero rounded-2xl px-4 py-2.5 shadow-glow animate-pop-in">
                  <div className="text-white font-black text-xs">Founder & CEO</div>
                  <div className="text-white/80 text-[10px]">LightOrb Innovations</div>
                </div>
                <img
                  src="/founder.jpg"
                  alt="Olatunbosun Oluwafemi — Founder of LightOrb Innovations and PharmIQ Nigeria"
                  className="relative rounded-3xl shadow-elevated w-full max-w-sm object-cover aspect-[3/4] group-hover:scale-[1.02] transition-transform duration-500"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="animate-slide-in-right">
              <div className="inline-flex items-center gap-2 text-primary text-sm font-bold tracking-wider uppercase mb-4 bg-primary/8 px-3 py-1.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                The Founder
              </div>
              <h2 className="text-4xl font-extrabold mb-2 tracking-tight">Olatunbosun Oluwafemi</h2>
              <p className="text-primary font-semibold text-lg mb-6">Founder, LightOrb Innovations</p>

              <p className="text-muted-foreground leading-relaxed mb-5">
                Hi, I'm Olatunbosun — a builder, strategist, and founder obsessed with creating solutions that
                actually move the needle. My passion is helping businesses identify their real challenges, seize
                the right opportunities, and implement intelligent systems that drive lasting, transformative results.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                PharmIQ was born from a simple observation: Nigerian pharmacies are losing revenue and
                customers to slow, manual ordering. I built PharmIQ to fix that — a tailored, affordable,
                and powerful pharmacy POS system built specifically for the Nigerian market.
              </p>

              <div className="flex flex-wrap gap-3">
                <a
                  href="https://lightorbinnovations.netlify.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gradient-hero text-white font-semibold px-5 py-2.5 rounded-full shadow-glow hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5"
                >
                  Visit LightOrb <ExternalLink className="h-4 w-4" />
                </a>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 border border-border font-semibold px-5 py-2.5 rounded-full hover:bg-secondary transition-all duration-300 hover:-translate-y-0.5"
                >
                  Get in Touch <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center mb-14 animate-fade-up">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">What Drives Us</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Every decision we make is guided by these core principles.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((v, i) => (
              <div
                key={v.title}
                className={`bg-card p-7 rounded-3xl border border-border/50 hover-lift card-shine animate-fade-up delay-${(i + 1) * 100}`}
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-hero flex items-center justify-center text-white shadow-glow mb-5">
                  <v.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">{v.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT WE'VE BUILT ── */}
      <section className="py-20">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="text-center mb-14 animate-fade-up">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Why PharmIQ?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Built specifically to solve Nigerian pharmacy problems.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              "₦5,000/month flat rate — most affordable in Nigeria",
              "No expensive hardware — runs on any device",
              "Real-time inventory & shift tracking",
              "Strict shift cash reconciliation",
              "Built in Naira — zero exchange rate risk",
              "3-day free trial — no credit card required",
              "Full analytics — know your best selling drugs",
              "Low stock alerts before you run out",
            ].map((feat, i) => (
              <div
                key={feat}
                className={`flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/50 hover-lift card-shine animate-fade-up delay-${Math.min((i + 1) * 100, 600)}`}
              >
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <span className="font-medium text-sm">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto">
          <div className="relative overflow-hidden bg-gradient-hero text-primary-foreground p-10 sm:p-16 rounded-3xl text-center shadow-glow animate-scale-in">
            <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl animate-blob" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/8 blur-2xl animate-blob-slow" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Ready to Grow Smarter?</h2>
              <p className="text-white/85 mb-10 max-w-xl mx-auto text-lg">
                Join pharmacys and event centers across Nigeria using PharmIQ to modernize their service and boost revenue.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/signup"
                  className="bg-white text-primary font-bold px-8 py-3.5 rounded-full shadow-lg hover:bg-white/90 hover:-translate-y-0.5 transition-all duration-300"
                >
                  Start Your 3-Day Free Trial
                </Link>
                <Link
                  to="/contact"
                  className="bg-white/15 backdrop-blur border border-white/25 text-white font-bold px-8 py-3.5 rounded-full hover:bg-white/25 hover:-translate-y-0.5 transition-all duration-300"
                >
                  Book a Live Demo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
