import { useState } from "react";
import { AlertTriangle, MapPin, CheckCircle2, RotateCcw } from "lucide-react";
import { BreakthroughContext } from "@/components/breakthrough-context";

export function DetachedHead() {
  const [headPos, setHeadPos] = useState(5); // 1 to 5. 5 is attached to main.
  const [showWarning, setShowWarning] = useState(false);

  const handleNodeClick = (id: number) => {
    setHeadPos(id);
    setShowWarning(id !== 5);
  };

  const handleReattach = () => {
    setHeadPos(5);
    setShowWarning(false);
  };

  const isDetached = headPos !== 5;

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-3xl mx-auto py-4">
      
      <div className="bg-[#161b22] border border-white/10 w-full rounded-xl p-8 overflow-x-auto relative">
        {/* The Timeline */}
        <div className="min-w-max flex justify-center py-12 px-8">
          <div className="flex items-center relative">
            {[1, 2, 3, 4, 5].map((id, i) => (
              <div key={id} className="flex items-center relative group">
                {i > 0 && <div className="h-1 w-16 bg-white/20 -ml-1" />}
                
                <div className="relative">
                  {/* Branch label only on 5 */}
                  {id === 5 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-white/10 text-muted-foreground text-xs font-bold px-3 py-1 rounded font-mono border border-white/5">
                      main
                    </div>
                  )}

                  {/* HEAD Pointer */}
                  {headPos === id && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 flex flex-col items-center animate-in slide-in-from-top-2">
                      <div className={`w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] mb-1 ${isDetached ? 'border-b-amber-500' : 'border-b-primary'}`} />
                      <div className={`text-xs font-bold px-3 py-1.5 rounded-full font-mono shadow-lg whitespace-nowrap flex items-center gap-2 ${
                        isDetached ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-primary/20 text-primary border border-primary/30'
                      }`}>
                        <MapPin className="w-3 h-3" /> YOU ARE HERE (HEAD)
                      </div>
                    </div>
                  )}

                  {/* Node Button */}
                  <button 
                    onClick={() => handleNodeClick(id)}
                    className={`w-10 h-10 rounded-full border-4 flex items-center justify-center relative z-10 transition-all cursor-pointer ${
                      headPos === id 
                        ? (isDetached ? 'bg-amber-500 border-[#0d1117] ring-2 ring-amber-500' : 'bg-primary border-[#0d1117] ring-2 ring-primary') 
                        : 'bg-[#21262d] border-[#0d1117] hover:bg-white/20'
                    }`}
                  >
                    <span className="sr-only">Commit {id}</span>
                  </button>
                  
                  {/* Hover hint */}
                  {headPos !== id && (
                    <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground whitespace-nowrap pointer-events-none">
                      Checkout
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="w-full bg-black/60 border border-white/10 rounded-lg font-mono text-sm overflow-hidden min-h-[160px]">
        <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/50" />
        </div>
        <div className="p-4">
          {showWarning ? (
            <div className="space-y-3 animate-in fade-in">
              <div className="text-amber-400">
                You are in 'detached HEAD' state. You can look around, make experimental changes and commit them, and you can discard any commits you make in this state without impacting any branches by switching back to a branch.
              </div>
              <div className="text-muted-foreground">
                <span className="text-primary font-bold">Translation:</span> You've walked away from your stickers to look at an old photograph. Git is just warning you that if you take a new photo right here, you'll need to write a new sticker for it, or it will be hard to find later.
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" /> HEAD is attached to 'main'.
            </div>
          )}
        </div>
      </div>

      {isDetached && (
        <button 
          onClick={handleReattach}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all animate-in slide-in-from-bottom-4 shadow-lg shadow-primary/20"
        >
          <RotateCcw className="w-4 h-4" /> git checkout main
        </button>
      )}

      <BreakthroughContext>
        <p>Sometimes you need to prove exactly what a document said on a specific day last year. When you jump back to that old commit, your "HEAD" (where you are standing) detaches from the moving branch stickers. You are simply standing in the archive room.</p>
        <p>It is designed this way so you can safely audit old records, run tests, or copy text without accidentally overwriting the past. When you are done looking, you just walk back to your branch sticker, and everything is exactly as you left it.</p>
      </BreakthroughContext>
    </div>
  );
}
