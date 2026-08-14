import { Building2 } from "lucide-react";

export function BreakthroughContext({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-12 bg-black/40 border border-white/5 p-6 sm:p-8 rounded-xl w-full shadow-inner relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/50"></div>
      <h3 className="font-bold text-lg text-foreground flex items-center gap-2 mb-4 tracking-tight">
        <Building2 className="w-5 h-5 text-primary" />
        Why this matters at your company
      </h3>
      <div className="space-y-4 text-sm sm:text-base text-muted-foreground reading-text">
        {children}
      </div>
    </div>
  );
}
