import { PublicHeader, PublicFooter } from "@/components/PublicLayout";
import { ReactNode } from "react";
import { ScrollText, Shield } from "lucide-react";

type Section = { title: string; body: ReactNode };

const LegalPage = ({ title, intro, sections, kind }: { title: string; intro: string; sections: Section[]; kind: "terms" | "privacy" }) => {
  const Icon = kind === "terms" ? ScrollText : Shield;
  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <section className="bg-gradient-soft border-b border-border/60">
        <div className="container max-w-4xl py-14 md:py-20">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-12 w-12 grid place-items-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-glow">
              <Icon className="h-6 w-6" />
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-primary font-bold">Legal</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">{title}</h1>
          <p className="mt-3 text-base md:text-lg text-muted-foreground max-w-2xl">{intro}</p>
          <p className="mt-4 text-xs text-muted-foreground">Last updated: May 2026</p>
        </div>
      </section>

      <main className="flex-1">
        <div className="container max-w-4xl py-10 md:py-14 grid md:grid-cols-[200px_1fr] gap-10">
          {/* Sticky TOC */}
          <aside className="hidden md:block">
            <div className="sticky top-24">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Contents</p>
              <ol className="space-y-1.5 text-sm">
                {sections.map((s, i) => (
                  <li key={s.title}>
                    <a
                      href={`#sec-${i + 1}`}
                      className="text-muted-foreground hover:text-primary transition-smooth flex gap-2"
                    >
                      <span className="text-primary font-semibold tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <span className="line-clamp-2">{s.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <article className="space-y-8">
            {sections.map((s, i) => (
              <section
                key={s.title}
                id={`sec-${i + 1}`}
                className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-soft scroll-mt-24"
              >
                <div className="flex items-baseline gap-3 mb-3">
                  <span className="font-display text-3xl font-bold text-primary tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <h2 className="font-display text-xl sm:text-2xl font-bold">{s.title}</h2>
                </div>
                <div className="text-foreground/85 leading-relaxed space-y-3 text-sm sm:text-base">
                  {s.body}
                </div>
              </section>
            ))}

            <div className="rounded-2xl bg-gradient-hero p-6 sm:p-8 text-primary-foreground">
              <h3 className="font-display text-xl font-bold">Need to talk to a human?</h3>
              <p className="mt-1 text-sm text-primary-foreground/90">
                Reach our team at{" "}
                <a href="mailto:hello@getpharmiq.com" className="underline font-semibold">
                  hello@getpharmiq.com
                </a>{" "}
                — we usually reply within 24 hours.
              </p>
            </div>
          </article>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
};

export default LegalPage;
