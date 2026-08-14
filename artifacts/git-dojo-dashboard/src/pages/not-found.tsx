import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 enter-fade">
      <div className="w-24 h-24 bg-primary/10 border border-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(255,107,0,0.15)]">
        <AlertCircle className="w-12 h-12" />
      </div>
      <h1 className="text-8xl font-extrabold text-foreground mb-4 tracking-tight">404</h1>
      <h2 className="text-3xl font-bold mb-6 text-foreground tracking-tight">Page Not Found</h2>
      <p className="text-lg text-muted-foreground mb-10 max-w-md reading-text">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link href="/" className="px-8 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(255,107,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        Return to Ledger
      </Link>
    </div>
  );
}
