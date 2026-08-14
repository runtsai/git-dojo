import { useState } from "react";
import { BreakthroughContext } from "@/components/breakthrough-context";
import { GitPullRequest, RotateCcw } from "lucide-react";

type Strategy = 'merge' | 'squash' | 'rebase';

export function ThreeWaysToMerge() {
  const [strategy, setStrategy] = useState<Strategy>('merge');
  const [landed, setLanded] = useState(false);

  const F_OPACITY = (strategy === 'squash' || strategy === 'rebase') ? (landed ? 0.1 : 0.3) : 1;
  const showMerge = strategy === 'merge';
  const showSquash = strategy === 'squash';
  const showRebase = strategy === 'rebase';
  
  const ringClass = strategy === 'merge' ? 'ring-primary/50 shadow-[0_0_40px_rgba(255,107,0,0.2)]' : 
                    strategy === 'squash' ? 'ring-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.2)]' : 
                    'ring-blue-500/50 shadow-[0_0_40px_rgba(59,130,246,0.2)]';

  return (
    <div className="flex flex-col gap-6 w-full max-w-3xl mx-auto py-4">
      
      <div className="flex flex-col md:flex-row gap-3 w-full">
        <button 
          onClick={() => setStrategy('merge')} 
          disabled={landed} 
          className={`flex-1 p-3 rounded-lg border text-sm font-bold transition-all ${
            strategy === 'merge' ? 'bg-primary/20 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-black/40 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Merge Commit
        </button>
        <button 
          onClick={() => setStrategy('squash')} 
          disabled={landed} 
          className={`flex-1 p-3 rounded-lg border text-sm font-bold transition-all ${
            strategy === 'squash' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10' : 'bg-black/40 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Squash & Merge
        </button>
        <button 
          onClick={() => setStrategy('rebase')} 
          disabled={landed} 
          className={`flex-1 p-3 rounded-lg border text-sm font-bold transition-all ${
            strategy === 'rebase' ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10' : 'bg-black/40 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Rebase & Merge
        </button>
      </div>

      <div className={`w-full bg-[#0d1117] border border-white/10 rounded-xl p-4 sm:p-8 flex items-center justify-center overflow-hidden transition-all duration-500 ${landed ? `scale-[1.02] ring-2 ${ringClass}` : ''}`}>
        <svg viewBox="0 0 400 200" className="w-full h-auto max-w-[500px] overflow-visible font-sans">
          {/* Lines */}
          <line x1="40" y1="60" x2="160" y2="60" className="stroke-white/20" strokeWidth="4" />
          <line x1="40" y1="60" x2="100" y2="140" className="stroke-white/20" strokeWidth="4" />
          <line x1="100" y1="140" x2="220" y2="140" className="stroke-white/20 transition-opacity duration-300" strokeWidth="4" style={{ opacity: F_OPACITY }} />

          {showMerge && (
            <g className={landed ? 'animate-in fade-in' : ''}>
              <line x1="160" y1="60" x2="280" y2="60" className="stroke-white/20" strokeWidth="4" />
              <line x1="220" y1="140" x2="280" y2="60" className="stroke-white/20" strokeWidth="4" />
            </g>
          )}
          {showSquash && (
            <g className={landed ? 'animate-in fade-in' : ''}>
              <line x1="160" y1="60" x2="220" y2="60" className="stroke-white/20" strokeWidth="4" />
            </g>
          )}
          {showRebase && (
            <g className={landed ? 'animate-in fade-in' : ''}>
              <line x1="160" y1="60" x2="340" y2="60" className="stroke-white/20" strokeWidth="4" />
            </g>
          )}

          {/* Base Nodes */}
          <circle cx="40" cy="60" r="12" className="fill-[#21262d] stroke-[#0d1117]" strokeWidth="4" />
          <circle cx="100" cy="60" r="12" className="fill-[#21262d] stroke-[#0d1117]" strokeWidth="4" />
          <circle cx="160" cy="60" r="12" className="fill-[#21262d] stroke-[#0d1117]" strokeWidth="4" />
          
          <rect x="140" y="24" width="40" height="20" rx="4" className="fill-white/10" />
          <text x="160" y="38" className="fill-white/50 text-[10px] font-bold" textAnchor="middle">main</text>

          {/* Feature Nodes */}
          <g style={{ opacity: F_OPACITY }} className="transition-opacity duration-300">
            <circle cx="100" cy="140" r="12" className="fill-blue-500/80 stroke-[#0d1117]" strokeWidth="4" />
            <circle cx="160" cy="140" r="12" className="fill-blue-500/80 stroke-[#0d1117]" strokeWidth="4" />
            <circle cx="220" cy="140" r="12" className="fill-blue-500/80 stroke-[#0d1117]" strokeWidth="4" />
            
            <rect x="195" y="164" width="50" height="20" rx="4" className="fill-blue-500/20" />
            <text x="220" y="178" className="fill-blue-400 text-[10px] font-bold" textAnchor="middle">feature</text>
          </g>

          {/* Conditional Nodes */}
          {showMerge && (
            <g className="animate-in zoom-in-95 origin-center" style={{ transformOrigin: "280px 60px" }}>
              <circle cx="280" cy="60" r="14" className="fill-primary stroke-[#0d1117]" strokeWidth="4" />
              <circle cx="280" cy="60" r="18" className="fill-transparent stroke-primary" strokeWidth="2" />
              <rect x="255" y="24" width="50" height="20" rx="4" className="fill-primary/20" />
              <text x="280" y="38" className="fill-primary text-[10px] font-bold" textAnchor="middle">merged</text>
            </g>
          )}

          {showSquash && (
            <g className="animate-in zoom-in-95 origin-center" style={{ transformOrigin: "220px 60px" }}>
              <circle cx="220" cy="60" r="14" className="fill-emerald-500 stroke-[#0d1117]" strokeWidth="4" />
              <rect x="190" y="24" width="60" height="20" rx="4" className="fill-emerald-500/20" />
              <text x="220" y="38" className="fill-emerald-400 text-[10px] font-bold" textAnchor="middle">squashed</text>
            </g>
          )}

          {showRebase && (
            <g>
              <circle cx="220" cy="60" r="12" className="fill-blue-500/80 stroke-[#0d1117] animate-in zoom-in-95 origin-center" style={{ transformOrigin: "220px 60px", animationDelay: '0ms' }} strokeWidth="4" />
              <circle cx="280" cy="60" r="12" className="fill-blue-500/80 stroke-[#0d1117] animate-in zoom-in-95 origin-center" style={{ transformOrigin: "280px 60px", animationDelay: '100ms' }} strokeWidth="4" />
              <circle cx="340" cy="60" r="12" className="fill-blue-500/80 stroke-[#0d1117] animate-in zoom-in-95 origin-center" style={{ transformOrigin: "340px 60px", animationDelay: '200ms' }} strokeWidth="4" />
              
              <g className="animate-in fade-in" style={{ animationDelay: '200ms' }}>
                <rect x="315" y="24" width="50" height="20" rx="4" className="fill-blue-500/20" />
                <text x="340" y="38" className="fill-blue-400 text-[10px] font-bold" textAnchor="middle">rebased</text>
              </g>
            </g>
          )}
        </svg>
      </div>

      <div className="bg-black/40 border border-white/10 p-6 rounded-lg min-h-[140px] flex items-center">
        {strategy === 'merge' && (
          <div className="animate-in fade-in">
            <h4 className="font-bold text-primary mb-2 text-base">Merge Commit (The True Shape)</h4>
            <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
              Preserves the exact history of the feature branch and creates a new merge node to tie it into main. 
              It shows the honest truth of how the work was done in parallel.
            </p>
          </div>
        )}
        {strategy === 'squash' && (
          <div className="animate-in fade-in">
            <h4 className="font-bold text-emerald-400 mb-2 text-base">Squash & Merge (The Tidy Line)</h4>
            <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
              Collapses all your messy draft commits into one single, clean polished commit on the main line. 
              The granular details stay in the pull request discussion, keeping the company ledger easy to read.
            </p>
          </div>
        )}
        {strategy === 'rebase' && (
          <div className="animate-in fade-in">
            <h4 className="font-bold text-blue-400 mb-2 text-base">Rebase & Merge (The Time Machine)</h4>
            <p className="text-sm sm:text-base text-foreground/90 leading-relaxed">
              Replays your branch's commits one by one onto the tip of main as brand new commits. 
              It creates a perfectly straight timeline, as if you waited until main was finished before you even started working.
            </p>
          </div>
        )}
      </div>

      <div className="mt-2">
        {!landed ? (
          <button 
            onClick={() => setLanded(true)} 
            className="w-full py-4 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-white/10 font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-black/50"
          >
            <GitPullRequest className="w-5 h-5 text-primary" /> Confirm & Land
          </button>
        ) : (
          <button 
            onClick={() => setLanded(false)} 
            className="w-full py-4 rounded-xl bg-transparent hover:bg-white/5 text-muted-foreground hover:text-foreground border border-white/10 font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-5 h-5" /> Try another way (Reset)
          </button>
        )}
      </div>

      <BreakthroughContext>
        <p>At a real company, the choice of merge strategy is often dictated by team policy. Some teams want to see every single work-in-progress commit to understand how a problem was solved (Merge Commit).</p>
        <p>Others prefer a perfectly clean ledger where each entry is a fully complete feature, hiding the trial-and-error (Squash). Rebase is popular for keeping a strictly linear history, avoiding the visual clutter of extra merge nodes. Knowing how these three work means you can confidently conform to any company's standard for their custody trail.</p>
      </BreakthroughContext>
    </div>
  );
}
