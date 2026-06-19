import { PublicHeader, PublicFooter } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Helmet } from "react-helmet-async";
import { Mail, MessageCircle, Phone, MapPin, Clock, ArrowRight } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { sanitizeInput, isValidEmail } from "@/lib/sanitize";

const WEB3FORMS_KEY = "2aefb05d-d497-4c17-a5c6-e742212509e5";

const contactSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "name": "Contact PharmIQ Nigeria",
  "url": "https://getpharmiq.com/contact",
  "description": "Get in touch with PharmIQ Nigeria. Contact Olatunbosun Oluwafemi and the LightOrb Innovations team for demos, partnerships, and support.",
  "mainEntity": {
    "@type": "Organization",
    "name": "LightOrb Innovations / PharmIQ Nigeria",
    "founder": { "@type": "Person", "name": "Olatunbosun Oluwafemi" },
    "email": "hello@getpharmiq.com",
    "telephone": "+234-802-510-0844",
    "address": { "@type": "PostalAddress", "addressLocality": "Abuja", "addressCountry": "NG" }
  }
};

const contactCards = [
  {
    icon: Mail,
    label: "Email us",
    value: "hello@getpharmiq.com",
    href: "mailto:hello@getpharmiq.com",
    color: "bg-primary/10 text-primary",
    desc: "We reply within 24 hours",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "+234 802 5100 844",
    href: "https://wa.me/2348025100844",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    desc: "Chat with us instantly",
  },
  {
    icon: Phone,
    label: "Call us",
    value: "+234 802 5100 844",
    href: "tel:+2348025100844",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    desc: "Mon – Fri, 9am – 6pm WAT",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "FCT, Abuja, Nigeria",
    href: "#",
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    desc: "Serving pharmacies nationwide",
  },
];

const Contact = () => {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const NIGERIAN_PHONE_REGEX = /^(\+234|0)[0-9]{10}$/;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const email = fd.get("email") as string;
    const phone = (fd.get("phone") as string || "").replace(/\s/g, "");

    if (!isValidEmail(email)) return toast.error("Please enter a valid email address.");

    // Phone is optional but must be valid if provided
    if (phone && !NIGERIAN_PHONE_REGEX.test(phone)) {
      setPhoneError("Enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)");
      return;
    }
    setPhoneError("");

    fd.set("name", sanitizeInput(fd.get("name") as string));
    fd.set("message", sanitizeInput(fd.get("message") as string));
    fd.append("access_key", WEB3FORMS_KEY);
    fd.append("subject", "New PharmIQ contact message");
    fd.append("from_name", "PharmIQ Contact Form");
    setSubmitting(true);
    try {
      const res = await fetch("https://api.web3forms.com/submit", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to send");
      setSent(true);
      toast.success("Message sent! We'll reply within 24 hours.");
      form.reset();
      setTimeout(() => setSent(false), 4000);
    } catch (err: any) {
      toast.error(err.message || "Could not send message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>Contact PharmIQ Nigeria | Olatunbosun Oluwafemi — LightOrb Innovations</title>
        <meta name="description" content="Contact Olatunbosun Oluwafemi and the PharmIQ team for pharmacy POS and inventory demos, partnerships, and support. Email hello@getpharmiq.com or call +234 802 5100 844." />
        <meta name="keywords" content="contact PharmIQ Nigeria, Olatunbosun Oluwafemi contact, LightOrb Innovations contact, pharmacy POS demo Nigeria" />
        <link rel="canonical" href="https://getpharmiq.com/contact" />
        <meta property="og:title" content="Contact PharmIQ Nigeria — LightOrb Innovations" />
        <meta property="og:description" content="Get in touch with the PharmIQ team for demos, pricing, and partnerships." />
        <meta property="og:url" content="https://getpharmiq.com/contact" />
        <script type="application/ld+json">{JSON.stringify(contactSchema)}</script>
      </Helmet>

      <PublicHeader />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-hero text-primary-foreground pt-20 pb-28">
        <div className="pointer-events-none absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -bottom-12 -right-12 h-80 w-80 rounded-full bg-white/8 blur-3xl animate-blob-slow" />
        <div className="container relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-sm font-semibold mb-6 animate-fade-up">
            <Clock className="h-4 w-4" /> We respond within 24 hours
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-5 animate-fade-up delay-100">
            Let's Talk
          </h1>
          <p className="text-lg sm:text-xl text-white/85 max-w-xl mx-auto animate-fade-up delay-200">
            Questions, demos, partnerships — we'd love to hear from you. Reach the PharmIQ team directly.
          </p>
        </div>
      </section>

      {/* ── CONTACT CARDS ── */}
      <section className="py-14">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {contactCards.map((c, i) => (
              <a
                key={c.label}
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className={`flex flex-col gap-3 bg-card border border-border/60 rounded-2xl p-5 hover-lift card-shine animate-fade-up delay-${(i + 1) * 100} group`}
              >
                <div className={`h-11 w-11 rounded-xl ${c.color} grid place-items-center group-hover:scale-110 transition-transform duration-300`}>
                  <c.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5 font-medium">{c.label}</div>
                  <div className="text-sm font-semibold break-all">{c.value}</div>
                  <div className="text-xs text-muted-foreground/70 mt-1">{c.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── FORM ── */}
      <section className="pb-24">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="grid lg:grid-cols-5 gap-8 items-start">
            {/* Form */}
            <div className="lg:col-span-3 bg-card border border-border/60 rounded-3xl p-8 shadow-soft animate-slide-in-left">
              <h2 className="font-display text-2xl font-bold mb-1">Send a message</h2>
              <p className="text-muted-foreground text-sm mb-7">We read every message and respond personally.</p>

              <form onSubmit={submit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-name">Your name</Label>
                    <Input id="contact-name" name="name" required placeholder="Adaeze Okafor" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">Email address</Label>
                    <Input id="contact-email" name="email" required type="email" placeholder="you@email.com" className="h-11" />
                  </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="contact-phone">Phone number <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                    <Input
                      id="contact-phone"
                      name="phone"
                      type="tel"
                      placeholder="e.g. 08025100844"
                      className={`h-11 ${phoneError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      onChange={() => { if (phoneError) setPhoneError(""); }}
                    />
                    {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="contact-msg">Your message</Label>
                    <Textarea id="contact-msg" name="message" required rows={5} placeholder="Tell us how we can help — pricing, demo, partnership..." />
                  </div>
                {/* Honeypot */}
                <input type="checkbox" name="botcheck" className="hidden" tabIndex={-1} autoComplete="off" />
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full font-bold shadow-glow"
                  disabled={submitting}
                >
                  {submitting ? "Sending…" : sent ? "Message Sent ✓" : "Send Message"}
                  {!submitting && !sent && <ArrowRight className="h-4 w-4 ml-2" />}
                </Button>
              </form>
            </div>

            {/* Side info */}
            <div className="lg:col-span-2 space-y-5 animate-slide-in-right">
              <div className="bg-gradient-hero text-primary-foreground rounded-3xl p-7 shadow-glow relative overflow-hidden">
                <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/10 blur-xl animate-blob" />
                <div className="relative">
                  <h3 className="text-xl font-bold mb-2">Book a Live Demo</h3>
                  <p className="text-white/80 text-sm mb-5 leading-relaxed">
                    See PharmIQ live in action. We'll walk you through the full ordering flow — from QR scan to kitchen display.
                  </p>
                  <a
                    href="https://wa.me/2348025100844?text=Hi%2C%20I'd%20like%20to%20book%20a%20PharmIQ%20demo"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-white text-primary font-bold px-5 py-2.5 rounded-full text-sm hover:bg-white/90 hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <MessageCircle className="h-4 w-4" /> Book via WhatsApp
                  </a>
                </div>
              </div>

              <div className="bg-card border border-border/60 rounded-3xl p-6 hover-lift">
                <h4 className="font-bold mb-3">Office Hours</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between"><span>Monday – Friday</span><span className="font-medium text-foreground">9am – 6pm WAT</span></div>
                  <div className="flex justify-between"><span>Saturday</span><span className="font-medium text-foreground">10am – 3pm WAT</span></div>
                  <div className="flex justify-between"><span>Sunday</span><span className="font-medium text-foreground">WhatsApp only</span></div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-3xl p-5 border border-border/40 text-sm text-muted-foreground">
                <strong className="text-foreground block mb-1">Response time</strong>
                Emails are answered within 24 hours. WhatsApp messages are typically answered within 2 hours during office hours.
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};
export default Contact;
