import { RepoBranch } from "@workspace/api-client-react";
import { GitBranch, Check } from "lucide-react";

export function BranchList({ branches, dimmed = false }: { branches: RepoBranch[]; dimmed?: boolean }) {
  if (branches.length === 0) return null;

  return (
    <div className={`surface-card p-6 md:p-8 transition-opacity duration-500 ${dimmed ? "opacity-50 pointer-events-none select-none" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 mb-6">
      <h3 className="text-xl font-bold flex items-center gap-3 text-foreground tracking-tight">
        <div className="p-2 bg-black/40 rounded-xl shadow-inner border border-white/5">
          <GitBranch className="w-5 h-5 text-foreground" />
        </div>
        Branches
      </h3>
        {dimmed && <span className="ml-auto text-[11px] font-medium text-amber-400/80">last known state</span>}
      </div>
      
      <div className="space-y-3">
        {branches.map(b => (
          <div 
            key={b.name} 
            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
              b.isCurrent 
                ? 'bg-primary/5 border-primary/30 shadow-sm' 
                : 'bg-black/40 shadow-inner border-white/5 hover:bg-black/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${b.isCurrent ? 'bg-primary shadow-[0_0_10px_rgba(255,107,0,0.5)]' : 'bg-muted-foreground/30'}`} />
              <span className={`font-mono text-base ${b.isCurrent ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
                {b.name}
              </span>
            </div>
            
            {b.isCurrent && (
              <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-md shadow-sm">
                <Check className="w-3.5 h-3.5" /> Current
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
