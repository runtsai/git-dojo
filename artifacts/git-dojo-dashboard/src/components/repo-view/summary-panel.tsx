import { Info, GitBranch, AlertTriangle } from "lucide-react";

interface Props {
  summary: string;
  isDetached: boolean;
  currentBranch: string | null;
}

export function SummaryPanel({ summary, isDetached, currentBranch }: Props) {
  return (
    <div className={`relative overflow-hidden border-2 rounded-3xl p-8 sm:p-10 shadow-sm ${
      isDetached 
        ? 'bg-amber-500/10 border-amber-500/30' 
        : 'bg-primary/5 border-primary/20'
    }`}>
      <div className="absolute -top-10 -right-10 p-8 opacity-[0.03] pointer-events-none">
        <Info className="w-64 h-64" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          {isDetached ? (
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-500 text-sm font-bold uppercase tracking-widest">
              <AlertTriangle className="w-4 h-4" /> Detached HEAD
            </span>
          ) : currentBranch ? (
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-primary text-sm font-bold uppercase tracking-widest">
              <GitBranch className="w-4 h-4" /> Branch: {currentBranch}
            </span>
          ) : null}
        </div>
        
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-snug text-foreground max-w-4xl tracking-tight">
          {summary}
        </h2>
      </div>
    </div>
  );
}
