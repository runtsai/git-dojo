import { Building2 } from "lucide-react";

export function BreakthroughContext({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 bg-[#161b22]/50 border border-white/10 p-6 sm:p-8 rounded-xl w-full">
      <h3 className="font-bold text-lg text-foreground flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-primary" />
        Why this matters at your company
      </h3>
      <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}
