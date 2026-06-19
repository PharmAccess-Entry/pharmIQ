import { Link } from "react-router-dom";
import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export const AuthShell = ({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) => (
  <div className="min-h-screen bg-gradient-soft flex flex-col">
    <div className="px-4 sm:px-8 py-5 flex items-center justify-between">
      <Logo size="sm" />
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-smooth">
        <ArrowLeft className="h-4 w-4" /> Back to home
      </Link>
    </div>
    <main className="flex-1 grid place-items-center px-4 pb-12">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-elevated border border-border p-6 sm:p-8 animate-fade-in">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 text-sm text-center text-muted-foreground">{footer}</div>}
      </div>
    </main>
  </div>
);
