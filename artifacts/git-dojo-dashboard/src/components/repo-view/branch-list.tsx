import { RepoBranch } from "@workspace/api-client-react";
import { GitBranch, Check } from "lucide-react";

export function BranchList({ branches }: { branches: RepoBranch[] }) {
  if (branches.length === 0) return null;

  return (
    <div className="bg-card border rounded-3xl p-8 shadow-sm">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-foreground">
        <div className="p-2 bg-muted rounded-lg">
          <GitBranch className="w-5 h-5 text-foreground" />
        </div>
        Branches
      </h3>
      
      <div className="space-y-3">
        {branches.map(b => (
          <div 
            key={b.name} 
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
              b.isCurrent 
                ? 'bg-primary/5 border-primary/30 shadow-sm' 
                : 'bg-background hover:bg-muted/50 border-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${b.isCurrent ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
              <span className={`font-mono text-base ${b.isCurrent ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
                {b.name}
              </span>
            </div>
            
            {b.isCurrent && (
              <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-md">
                <Check className="w-3.5 h-3.5" /> Current
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
