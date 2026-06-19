import { DashboardLayout } from "@/components/DashboardLayout";
import { MessageCircle, Mail, Globe, ShieldCheck, HelpCircle, ExternalLink, Code2, Sparkles, CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Support = () => {
  const contactOptions = [
    {
      title: "Direct WhatsApp Support",
      desc: "Get instant live assistance for order tracking, kitchen display setup, or general dashboard troubleshooting.",
      icon: MessageCircle,
      action: "Start Chat",
      link: "https://wa.me/2348025100844",
      color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60",
      iconBg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    },
    {
      title: "Official Email Channel",
      desc: "Perfect for long-form inquiries, technical escalations, custom reporting, or account changes.",
      icon: Mail,
      action: "Send Message",
      link: "mailto:support@getpharmiq.com",
      color: "from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400 hover:border-blue-500/60",
      iconBg: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    },
  ];

  const capabilities = [
    "Custom Pharmacy POS Integrations",
    "Tailored Pharmacy Dashboard Analytics",
    "Dedicated Mobile Ordering Apps",
    "High-Performance Cloud Infrastructure",
  ];

  return (
    <DashboardLayout>
      {/* Top Header section */}
      <div className="mb-10 relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-secondary/80 to-secondary/30 p-8 sm:p-12 border border-border/40">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider mb-4 animate-pulse">
            <Sparkles className="h-3 w-3" /> Dedicated Assistance
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-foreground mb-4 leading-tight">
            Premium Support & <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Custom Builds</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed font-medium">
            We are dedicated to ensuring your business operations are seamless, high-performing, and built to scale. Get 24/7 technical help or discuss tailor-made system upgrades.
          </p>
        </div>
      </div>

      {/* Main Support Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {contactOptions.map((opt) => (
          <div 
            key={opt.title} 
            className={`relative overflow-hidden bg-gradient-to-br ${opt.color} border rounded-[2.5rem] p-8 shadow-soft hover:shadow-elevated transition-all duration-300 group flex flex-col justify-between`}
          >
            <div>
              <div className={`h-16 w-16 rounded-2xl ${opt.iconBg} grid place-items-center mb-6 transition-transform duration-300 group-hover:scale-110 shadow-sm`}>
                <opt.icon className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-black text-foreground mb-3">{opt.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8 font-medium">
                {opt.desc}
              </p>
            </div>
            <Button size="lg" className="w-full h-14 rounded-2xl font-bold uppercase tracking-widest gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md group-hover:translate-y-[-2px] transition-transform" asChild>
              <a href={opt.link} target="_blank" rel="noopener noreferrer">
                {opt.action} <ExternalLink className="h-4.5 w-4.5" />
              </a>
            </Button>
          </div>
        ))}
      </div>

      {/* Premium Developer custom builds showcase banner */}
      <div className="relative overflow-hidden bg-card border border-border rounded-[3rem] p-8 sm:p-10 shadow-2xl">
        {/* Glowing backgrounds */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="flex flex-col xl:flex-row items-stretch gap-8 xl:gap-10 relative z-10">
          {/* Text and Capabilities */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs font-black uppercase tracking-widest border border-purple-500/20 mb-6">
                <Code2 className="h-3 w-3" /> Enterprise Solutions
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-foreground mb-6 leading-tight">
                Want to build <br />
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Something Extraordinary?</span>
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed mb-8 font-medium">
                At <span className="text-foreground font-bold">LightOrb Innovations</span>, we develop state-of-the-art corporate web platforms, highly scalable databases, custom analytics dashboards, and interactive user interfaces meticulously aligned with your goals.
              </p>
            </div>

            {/* Capability Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-8">
              {capabilities.map((cap) => (
                <div key={cap} className="flex items-center gap-3 text-sm text-foreground font-semibold">
                  <CheckCircle className="h-5 w-5 text-purple-500 shrink-0" />
                  <span>{cap}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action box / CTA panel */}
          <div className="w-full xl:w-[340px] shrink-0 bg-secondary/50 border border-border rounded-[2.5rem] p-8 flex flex-col justify-between">
            <div>
              <h4 className="text-foreground font-black uppercase tracking-wider text-sm mb-2">Discuss Your Vision</h4>
              <p className="text-muted-foreground text-xs leading-relaxed font-semibold mb-6">
                Let's partner up to build your next game-changing platform or integrate custom workflows directly into your current dashboard.
              </p>
            </div>

            <div className="space-y-4">
              <Button size="lg" className="w-full h-14 rounded-2xl font-black uppercase tracking-wider gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]" asChild>
                <a href="https://wa.me/2348025100844" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" /> WhatsApp Brief
                </a>
              </Button>
              <Button size="lg" variant="outline" className="w-full h-14 rounded-2xl font-black uppercase tracking-wider gap-2 border-border text-foreground hover:bg-secondary hover:border-primary/40 transition-all" asChild>
                <a href="mailto:hello@getpharmiq.com">
                  <Mail className="h-5 w-5" /> Send Project RFC
                </a>
              </Button>
            </div>

            <div className="text-[10px] text-center text-muted-foreground font-bold uppercase tracking-widest mt-6">
              EST. RESPONSE TIME &lt; 2 HOURS
            </div>
          </div>
        </div>

        {/* Footer info inside banner */}
        <div className="border-t border-border mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-muted-foreground">
          <div className="flex items-center gap-2">
            <Globe className="h-4.5 w-4.5 text-purple-500" />
            <span>v1.5.0 Production Ready</span>
          </div>
          <div className="text-purple-500 uppercase tracking-widest">
            Powered by LightOrb Innovations
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Support;
