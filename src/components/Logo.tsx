import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

type Props = { className?: string; size?: "sm" | "md" | "lg"; to?: string; variant?: "default" | "light" };

export const Logo = ({ className = "", size = "md", to = "/", variant = "default" }: Props) => {
  const sizes = {
    sm: { text: "text-lg", mark: "h-6 w-6" },
    md: { text: "text-xl", mark: "h-8 w-8" },
    lg: { text: "text-2xl", mark: "h-10 w-10" },
  }[size];

  return (
    <Link 
      to={to} 
      className={`inline-flex items-center gap-2 select-none ${className}`} 
      aria-label="PharmIQ"
      onClick={() => {
        if (window.location.pathname === to || (to === "/" && window.location.pathname === "")) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
    >
      <div className={`${sizes.mark} rounded-md bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center shadow-sm`}>
        <Activity className="h-2/3 w-2/3 stroke-[2.5]" />
      </div>
      <span
        className={`${sizes.text} font-extrabold tracking-tight ${variant === "light" ? "text-white" : "text-foreground"}`}
        style={{ fontFamily: "'Sora', 'Inter', sans-serif", letterSpacing: "-0.025em" }}
      >
        Pharm<span className="text-primary">IQ</span>
      </span>
    </Link>
  );
};
