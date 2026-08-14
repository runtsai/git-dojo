import { useState } from "react";
import { Download, Merge, Search, Server, Laptop, GitCommit, GitBranch } from "lucide-react";

export function FetchIsLooking() {
  // State: 
  // 'initial' = Local has 1,2. Remote has 1,2,3,4.
  // 'fetched' = Local has 1,2. Remote's 3,4 are visible locally but ghosted (origin/main).
  // 'pulled' = Local has merged 3,4.
  const [phase, setPhase] = useState<'initial' | 'fetched' | 'pulled'>('initial');

  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl mx-auto py-4">
      
      <div className="flex justify-center gap-4">
        <button 
          onClick={() => setPhase('fetched')}
          disabled={phase !== 'initial'}
          className="bg-secondary hover:bg-secondary/80 disabled:opacity-50 text-foreground border border-white/10 px-6 py-3 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
        >
          <Search className="w-4 h-4" /> 1. Fetch (Look)
        </button>
        <button 
          onClick={() => setPhase('pulled')}
          disabled={phase !== 'fetched'}
          className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-6 py-3 rounded-lg font-bold text-sm transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
        >
          <Merge className="w-4 h-4" /> 2. Pull (Merge)
        </button>
        {phase === 'pulled' && (
          <button onClick={() => setPhase('initial')} className="ml-4 text-xs font-bold text-muted-foreground hover:text-foreground">Reset</button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full relative">
        
        {/* Remote */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
          <div className="bg-[#21262d] border-b border-white/10 p-4 flex items-center gap-3">
            <Server className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-foreground">GitHub (Remote)</h3>
          </div>
          <div className="p-6 flex flex-col gap-4 items-center">
            {[4, 3, 2, 1].map(c => (
              <div key={c} className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-4 bg-blue-500/20 border-blue-500 flex items-center justify-center relative">
                  {c === 4 && <span className="absolute left-full ml-4 whitespace-nowrap bg-blue-500/20 text-blue-400 text-xs font-bold px-2 py-1 rounded">main</span>}
                </div>
                {c > 1 && <div className="w-1 h-6 bg-blue-500/30" />}
              </div>
            ))}
          </div>
        </div>

        {/* Local */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden relative">
          {/* Arrow showing transfer */}
          {phase === 'fetched' && (
            <div className="absolute top-1/4 -left-10 text-primary animate-pulse z-20 hidden md:block">
              <Download className="w-6 h-6 rotate-90 md:rotate-0" />
            </div>
          )}

          <div className="bg-[#21262d] border-b border-white/10 p-4 flex items-center gap-3">
            <Laptop className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Your Laptop</h3>
          </div>
          <div className="p-6 flex flex-col gap-4 items-center relative">
            
            {/* New Commits Area */}
            <div className="min-h-[96px] flex flex-col items-center justify-end w-full">
              {phase === 'initial' && (
                <div className="text-xs text-muted-foreground italic opacity-50 py-4">Unaware of new commits</div>
              )}
              
              {phase === 'fetched' && (
                <div className="flex flex-col items-center animate-in slide-in-from-top-4 w-full">
                  <div className="w-8 h-8 rounded-full border-4 border-dashed bg-transparent border-white/30 flex items-center justify-center relative">
                    <span className="absolute left-full ml-4 whitespace-nowrap bg-white/10 text-white/50 text-xs font-bold px-2 py-1 rounded border border-white/10">origin/main</span>
                    <div className="absolute right-full mr-4 text-xs text-muted-foreground whitespace-nowrap hidden sm:block">Ghosted (Safe)</div>
                  </div>
                  <div className="w-1 h-6 bg-white/10 border-r-2 border-dashed border-transparent" />
                  <div className="w-8 h-8 rounded-full border-4 border-dashed bg-transparent border-white/30 flex items-center justify-center relative">
                  </div>
                  <div className="w-1 h-6 bg-white/10 border-r-2 border-dashed border-transparent" />
                </div>
              )}

              {phase === 'pulled' && (
                <div className="flex flex-col items-center animate-in zoom-in-95 w-full">
                  <div className="w-8 h-8 rounded-full border-4 bg-primary border-[#0d1117] ring-2 ring-primary flex items-center justify-center relative">
                    <span className="absolute left-full ml-4 whitespace-nowrap bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded">main</span>
                  </div>
                  <div className="w-1 h-6 bg-primary/30" />
                  <div className="w-8 h-8 rounded-full border-4 bg-[#21262d] border-[#0d1117] flex items-center justify-center relative">
                  </div>
                  <div className="w-1 h-6 bg-white/20" />
                </div>
              )}
            </div>

            {/* Old Commits */}
            {[2, 1].map(c => (
              <div key={c} className="flex flex-col items-center w-full relative">
                <div className="w-8 h-8 rounded-full border-4 bg-[#21262d] border-[#0d1117] flex items-center justify-center relative">
                  {c === 2 && phase !== 'pulled' && (
                    <span className="absolute left-full ml-4 whitespace-nowrap bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded">main</span>
                  )}
                </div>
                {c > 1 && <div className="w-1 h-6 bg-white/20" />}
              </div>
            ))}

          </div>
        </div>
      </div>
      
      <div className="bg-black/40 border border-white/10 p-4 rounded-lg text-sm text-muted-foreground leading-relaxed text-center">
        Pulling is just two commands duct-taped together: <code>git fetch</code> (look around and download new boxes without opening them) + <code>git merge</code> (force them into your current line). If you're scared, just fetch. It touches nothing.
      </div>
    </div>
  );
}
