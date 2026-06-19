import { Link, NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Facebook, Linkedin, Instagram, Mail, Phone, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/lib/theme";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

export const PublicHeader = ({ overHero = false }: { overHero?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const isGenericPage = pathname === "/" || pathname === "/about" || pathname === "/contact" || pathname === "/terms" || pathname === "/privacy";
  const base = pathname.startsWith("/pharmacy") ? "/pharmacy" : pathname.startsWith("/events") ? "/events" : isGenericPage ? "" : "/restaurant";

  const links = isGenericPage ? [
    { to: "/#industries", label: "Solutions" },
    { to: "/about", label: "About Us" },
    { to: "/contact", label: "Contact" },
  ] : [
    { to: `${base}#features`, label: "Features" },
    { to: `${base}#how-it-works`, label: "How It Works" },
    { to: `${base}#why-us`, label: "Why Us" },
    { to: `${base}/pricing`, label: "Pricing" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleHashClick = (e: React.MouseEvent<HTMLAnchorElement>, to: string) => {
    if (to.includes("#")) {
      const [targetPath, targetHash] = to.split("#");
      // If we're already on the page that has the anchor (accounting for root path)
      if (pathname === targetPath || (pathname === "/" && targetPath === "")) {
        e.preventDefault();
        const el = document.getElementById(targetHash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
          window.history.pushState(null, "", to);
        }
      }
    }
  };

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isSolid = scrolled;
  const lightMode = overHero && !isSolid;

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isSolid
            ? "bg-background/95 backdrop-blur-lg border-b border-border shadow-soft"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="container flex h-16 items-center justify-between">
          <Logo size="md" variant={lightMode ? "light" : "default"} />

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={(e) => handleHashClick(e, l.to)}
                className={({ isActive }) => {
                  const isHashLink = l.to.includes("#");
                  const isLinkActive = isHashLink
                    ? window.location.hash === l.to.substring(l.to.indexOf("#"))
                    : isActive && window.location.hash === "";
                  return `text-sm font-medium transition-smooth ${
                    lightMode
                      ? isLinkActive ? "text-white" : "text-white/80 hover:text-white"
                      : isLinkActive ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`;
                }}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-2">
            <ThemeToggle light={lightMode} />
            {user ? (
              <>
                <Button variant={lightMode ? "outline" : "ghost"} asChild className={lightMode ? "bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white" : ""}>
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Button variant="hero" onClick={() => signOut()}>Log out</Button>
              </>
            ) : (
              <>
                <Button variant={lightMode ? "outline" : "ghost"} asChild className={lightMode ? "bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white" : ""}>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button variant="hero" asChild><Link to="/signup">Get Started</Link></Button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="lg:hidden flex items-center gap-1">
            <ThemeToggle light={lightMode} />
            <button
              className={`p-2 rounded-lg transition-colors ${lightMode ? "text-white hover:bg-white/10" : "text-foreground hover:bg-secondary"}`}
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[998] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Side Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-[999] w-[82%] max-w-[320px] bg-background flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-border/50 shrink-0">
          <Logo size="sm" />
          <button
            className="h-9 w-9 grid place-items-center rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={(e) => {
                setOpen(false);
                handleHashClick(e, l.to);
              }}
              className="flex items-center justify-between px-4 py-3.5 mb-1 rounded-xl text-[15px] font-semibold text-foreground hover:bg-primary/8 hover:text-primary active:scale-[0.98] transition-all"
            >
              {l.label}
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            </Link>
          ))}
        </nav>

        {/* Drawer Footer CTA */}
        <div className="shrink-0 px-5 py-6 border-t border-border/50 bg-muted/30 flex flex-col gap-3">
          {user ? (
            <>
              <Button variant="outline" size="lg" asChild className="w-full font-semibold" onClick={() => setOpen(false)}>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button variant="hero" size="lg" className="w-full font-semibold" onClick={() => { signOut(); setOpen(false); }}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="lg" asChild className="w-full font-semibold" onClick={() => setOpen(false)}>
                <Link to="/login">Log in</Link>
              </Button>
              <Button variant="hero" size="lg" asChild className="w-full font-semibold shadow-glow" onClick={() => setOpen(false)}>
                <Link to="/signup">Get Started Free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export const PublicFooter = () => {
  const { pathname } = useLocation();
  const isGenericPage = pathname === "/" || pathname === "/about" || pathname === "/contact" || pathname === "/terms" || pathname === "/privacy";
  const base = pathname.startsWith("/pharmacy") ? "/pharmacy" : pathname.startsWith("/events") ? "/events" : isGenericPage ? "" : "/restaurant";

  return (
  <footer className="mt-20 bg-[hsl(222_47%_7%)] text-white/80">
    <div className="container py-14 grid gap-10 md:grid-cols-4">
      <div className="md:col-span-1">
        <Logo size="sm" variant="light" />
        <p className="text-sm text-white/60 mt-3 leading-relaxed">
          {base === "/pharmacy" 
            ? "Secure POS, shift management, and inventory tracking for modern Nigerian pharmacies."
            : base === "/events"
            ? "Mass QR ordering and cashless payments for Nigerian event centers and clubs."
            : base === "/restaurant"
            ? "QR ordering, live kitchen sync and table-side payments — built for modern Nigerian pharmacies."
            : "The operating system for modern Nigerian businesses. Point of Sale, QR Ordering, and more."
          }
        </p>
        <div className="flex items-center gap-2 mt-4">
          <a href="https://www.facebook.com/share/1AnyYN9Dxu/" target="_blank" rel="noreferrer" aria-label="Facebook" className="h-9 w-9 grid place-items-center rounded-full bg-white/10 hover:bg-primary transition-smooth">
            <Facebook className="h-4 w-4" />
          </a>
          <a href="https://www.linkedin.com/company/lightorb-innovations" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="h-9 w-9 grid place-items-center rounded-full bg-white/10 hover:bg-primary transition-smooth">
            <Linkedin className="h-4 w-4" />
          </a>
          <a href="https://www.instagram.com/lightorb_innovations?utm_source=qr&igsh=MXd1cGNwdmcybnFocg==" target="_blank" rel="noreferrer" aria-label="Instagram" className="h-9 w-9 grid place-items-center rounded-full bg-white/10 hover:bg-primary transition-smooth">
            <Instagram className="h-4 w-4" />
          </a>
          <a href="mailto:hello@getpharmiq.com" aria-label="Email" className="h-9 w-9 grid place-items-center rounded-full bg-white/10 hover:bg-primary transition-smooth">
            <Mail className="h-4 w-4" />
          </a>
          <a href="tel:+2348025100844" aria-label="Phone" className="h-9 w-9 grid place-items-center rounded-full bg-white/10 hover:bg-primary transition-smooth">
            <Phone className="h-4 w-4" />
          </a>
        </div>
      </div>
      <div>
        <h4 className="font-display font-semibold mb-3 text-sm text-white">Product</h4>
        <ul className="space-y-2 text-sm">
          <li>{isGenericPage ? <a href="/#industries" className="text-white/60 hover:text-primary-glow">Pricing</a> : <Link to={`${base}/pricing`} className="text-white/60 hover:text-primary-glow">Pricing</Link>}</li>
          <li><Link to="/signup" className="text-white/60 hover:text-primary-glow">Sign up</Link></li>
          <li><Link to="/demo" className="text-white/60 hover:text-primary-glow">QR demo</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="font-display font-semibold mb-3 text-sm text-white">Company</h4>
        <ul className="space-y-2 text-sm">
          <li><Link to="/about" className="text-white/60 hover:text-primary-glow">About Us</Link></li>
          <li><Link to="/contact" className="text-white/60 hover:text-primary-glow">Contact</Link></li>
          <li><Link to="/terms" className="text-white/60 hover:text-primary-glow">Terms of Service</Link></li>
          <li><Link to="/privacy" className="text-white/60 hover:text-primary-glow">Privacy Policy</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="font-display font-semibold mb-3 text-sm text-white">Reach us</h4>
        <ul className="space-y-2 text-sm text-white/60">
          <li><a href="mailto:hello@getpharmiq.com" className="hover:text-primary-glow break-all">hello@getpharmiq.com</a></li>
          <li><a href="tel:+2348025100844" className="hover:text-primary-glow">+234 802 5100 844</a></li>
          <li>FCT, Abuja, Nigeria</li>
        </ul>
      </div>
    </div>
    <div className="border-t border-white/10 py-5 px-6 sm:px-8 text-center text-[9px] sm:text-xs text-white/50 leading-relaxed">
      © {new Date().getFullYear()} PharmIQ Nigeria. Powered by{" "}
      <a href="https://lightorbinnovations.netlify.app/" target="_blank" rel="noreferrer" className="text-primary-glow hover:underline font-semibold">LightOrb Innovations</a>
    </div>
  </footer>
  );
};
