import { useState } from "react";
import { GitMerge, ArrowRight, Activity } from "lucide-react";
import { BreakthroughContext } from "@/components/breakthrough-context";

export function MergeReveals() {
  const [merged, setMerged] = useState(false);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-4xl mx-auto py-8">
      
      <button 
        onClick={() => setMerged(true)}
        disabled={merged}
        className="bg-primary hover:bg-primary/90 disabled:opacity-0 text-primary-foreground px-8 py-3 rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
      >
        <GitMerge className="w-5 h-5" /> Merge 'feature' into 'main'
      </button>

      {/* Graph Area */}
      <div className="w-full max-w-2xl bg-[#0d1117] border border-white/10 rounded-xl p-4 sm:p-8 flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 420 220" className="w-full h-auto overflow-visible font-sans max-w-[500px]">
          {/* Line A -> B */}
          <line x1="40" y1="140" x2="120" y2="140" className="stroke-white/20" strokeWidth="4" />
          {/* Line B -> E */}
          <line x1="120" y1="140" x2="240" y2="140" className="stroke-white/20" strokeWidth="4" />
          {/* Line B -> C */}
          <line x1="120" y1="140" x2="180" y2="80" className="stroke-white/20" strokeWidth="4" />
          {/* Line C -> D */}
          <line x1="180" y1="80" x2="280" y2="80" className={`transition-colors duration-1000 stroke-[4px] ${merged ? 'stroke-white/20' : 'stroke-white/5'}`} />
          
          {/* Line E -> F */}
          {merged && <line x1="240" y1="140" x2="380" y2="140" className="stroke-white/20 animate-in fade-in" strokeWidth="4" />}
          {/* Line D -> F */}
          {merged && <line x1="280" y1="80" x2="380" y2="140" className="stroke-white/20 animate-in fade-in" strokeWidth="4" />}

          {/* Nodes */}
          <circle cx="40" cy="140" r="16" className="fill-[#21262d] stroke-[#0d1117]" strokeWidth="4" />
          <circle cx="120" cy="140" r="16" className="fill-[#21262d] stroke-[#0d1117]" strokeWidth="4" />
          
          <circle cx="180" cy="80" r="16" className={`transition-colors duration-1000 stroke-[#0d1117] stroke-[4px] ${merged ? 'fill-[#21262d]' : 'fill-[#21262d]/30'}`} />
          
          <circle cx="280" cy="80" r="16" className={`transition-colors duration-1000 stroke-[#0d1117] stroke-[4px] ${merged ? 'fill-[#21262d]' : 'fill-[#21262d]/30'}`} />
          {/* Branch Label: feature */}
          <g>
            <rect x="252" y="40" width="56" height="22" rx="4" className="fill-blue-500/20" />
            <text x="280" y="55" className="fill-blue-400 text-[12px] font-bold" textAnchor="middle">feature</text>
          </g>

          <circle cx="240" cy="140" r="16" className="fill-[#21262d] stroke-[#0d1117]" strokeWidth="4" />
          {/* Branch Label: main (E) if not merged */}
          {!merged && (
            <g className="animate-in fade-in">
              <rect x="220" y="164" width="40" height="22" rx="4" className="fill-primary/20" />
              <text x="240" y="179" className="fill-primary text-[12px] font-bold" textAnchor="middle">main</text>
            </g>
          )}

          {/* F Node (Merge) */}
          {merged && (
            <g className="animate-in zoom-in-95 origin-center" style={{ transformOrigin: "380px 140px" }}>
              <circle cx="380" cy="140" r="16" className="fill-primary stroke-[#0d1117]" strokeWidth="4" />
              <circle cx="380" cy="140" r="20" className="fill-transparent stroke-primary" strokeWidth="2" />
              <rect x="360" y="168" width="40" height="22" rx="4" className="fill-primary/20" />
              <text x="380" y="183" className="fill-primary text-[12px] font-bold" textAnchor="middle">main</text>
            </g>
          )}
        </svg>
      </div>

      <div className="text-center max-w-lg">
        {merged ? (
          <p className="text-primary font-bold animate-in fade-in">
            Notice how commits C and D didn't move or duplicate. <br/>
            The new merge commit just tied their timeline into main's timeline.
          </p>
        ) : (
          <p className="text-muted-foreground">
            The 'feature' commits are grayed out because they are invisible to 'main'. Merging doesn't copy them over.
          </p>
        )}
      </div>

      {merged && (
        <button onClick={() => setMerged(false)} className="text-xs font-bold text-muted-foreground hover:text-foreground">Reset</button>
      )}

      <BreakthroughContext>
        <p>Merging often feels like a destructive action that rewrites history, but it is actually just drawing a new line between existing nodes. When a contractor finishes a proposal on their branch, their commits are already fully formed and sealed.</p>
        <p>Merging simply creates one final record that says, "Connect their timeline into our main timeline here." This preserves their exact original custody trail—you see exactly when they did the work, not just the moment you approved it.</p>
      </BreakthroughContext>
    </div>
  );
}
