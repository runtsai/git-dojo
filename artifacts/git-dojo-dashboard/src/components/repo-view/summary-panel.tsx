import { Info, GitBranch, AlertTriangle } from "lucide-react";

interface Props {
  summary: string;
  isDetached: boolean;
  currentBranch: string | null;
}

export function SummaryPanel({ summary, isDetached, currentBranch }: Props) {
  return (
    <div className={`relative overflow-hidden border rounded-xl p-5 sm:p-8 md:p-10 shadow-lg ${
      isDetached 
        ? 'bg-amber-500/10 border-amber-500/30' 
        : 'bg-primary/5 border-primary/20 shadow-[0_0_30px_rgba(255,107,0,0.05)]'
    }`}>
      <div className="absolute top-0 left-0 w-2 h-full bg-primary/80"></div>
      <div className="absolute -top-10 -right-10 p-8 opacity-[0.03] pointer-events-none">
        <Info className="w-64 h-64" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          {isDetached ? (
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30 text-sm font-bold uppercase tracking-widest shadow-inner">
              <AlertTriangle className="w-4 h-4" /> Detached HEAD
            </span>
          ) : currentBranch ? (
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded bg-primary/10 border border-primary/20 text-primary text-sm font-bold uppercase tracking-widest shadow-inner">
              <GitBranch className="w-4 h-4" /> Branch: {currentBranch}
            </span>
          ) : null}
        </div>
        
        <h2 className="text-xl sm:text-2xl md:text-3xl font-medium leading-relaxed text-foreground max-w-4xl tracking-tight">
          {summary}
        </h2>
      </div>
    </div>
  );
}
