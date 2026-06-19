import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <div className="mx-auto h-24 w-24 rounded-[2.5rem] bg-primary-soft text-primary grid place-items-center mb-6 text-5xl">
          🔍
        </div>
        <h1 className="font-display text-6xl font-black text-primary mb-2">404</h1>
        <p className="font-display text-xl font-bold mb-2">Page not found</p>
        <p className="text-muted-foreground text-sm mb-8">
          The page you're looking for doesn't exist, or may have been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-smooth"
          >
            Go to Home
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-border font-semibold text-sm hover:bg-secondary transition-smooth"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
