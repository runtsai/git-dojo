import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 animate-in fade-in duration-500">
      <h1 className="text-8xl font-extrabold text-primary mb-6">404</h1>
      <h2 className="text-3xl font-bold mb-6 text-foreground">Page Not Found</h2>
      <p className="text-lg text-muted-foreground mb-10 max-w-md">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link href="/" className="px-8 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-2xl hover:bg-primary/90 transition-all shadow-sm active:scale-95">
        Return to Curriculum
      </Link>
    </div>
  );
}
