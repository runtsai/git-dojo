import { useState } from "react";
import { Trash2, AlertOctagon, RotateCcw, Eye, Search, FileSignature } from "lucide-react";

interface LogEntry {
  hash: string;
  msg: string;
  visible: boolean;
}

export function NothingIsLost() {
  const [commits, setCommits] = useState<LogEntry[]>([
    { hash: "a1b2c3d", msg: "Add brilliant new feature", visible: true },
    { hash: "f9e8d7c", msg: "Update dependencies", visible: true },
    { hash: "1a2b3c4", msg: "Initial commit", visible: true },
  ]);
  const [showReflog, setShowReflog] = useState(false);

  const simulateDisaster = () => {
    // "Lose" the top commit (e.g. hard reset or deleted unmerged branch)
    setCommits(prev => prev.map((c, i) => i === 0 ? { ...c, visible: false } : c));
  };

  const restore = () => {
    setCommits(prev => prev.map(c => ({ ...c, visible: true })));
    setShowReflog(false);
  };

  const isDisaster = commits.some(c => !c.visible);

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto py-4">
      
      {/* Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-black/40 p-4 rounded-xl border border-white/10">
        <button 
          onClick={simulateDisaster}
          disabled={isDisaster}
          className="bg-destructive/20 hover:bg-destructive/40 text-destructive border border-destructive/50 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2 rounded font-bold text-sm transition-colors flex items-center gap-2 w-full md:w-auto justify-center"
        >
          <Trash2 className="w-4 h-4" /> Simulate Disaster (git reset --hard)
        </button>
        
        <button 
          onClick={() => setShowReflog(!showReflog)}
          className={`px-4 py-2 rounded font-bold text-sm transition-colors flex items-center gap-2 w-full md:w-auto justify-center ${
            showReflog ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/80 border border-white/10'
          }`}
        >
          <Eye className="w-4 h-4" /> {showReflog ? 'Hide Ledger' : 'View Reflog (Hidden Ledger)'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        
        {/* Visible History */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden flex flex-col">
          <div className="bg-[#21262d] border-b border-white/10 p-4 flex items-center gap-3">
            <Search className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-bold text-foreground">Visible History (git log)</h3>
          </div>
          <div className="p-6 flex-1 space-y-4">
            {commits.map((c, i) => (
              <div 
                key={c.hash} 
                className={`transition-all duration-500 overflow-hidden ${
                  c.visible ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 m-0 border-0 p-0'
                }`}
              >
                <div className="bg-black/40 border border-white/5 p-3 rounded-lg flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <div className="font-mono text-xs text-primary">{c.hash}</div>
                  <div className="text-sm font-medium">{c.msg}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reflog */}
        {showReflog ? (
          <div className="bg-[#161b22] border border-primary/50 rounded-xl overflow-hidden flex flex-col shadow-[0_0_30px_rgba(255,107,0,0.1)] animate-in slide-in-from-right-8">
            <div className="bg-primary/10 border-b border-primary/20 p-4 flex items-center gap-3">
              <FileSignature className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-primary">The True Ledger (git reflog)</h3>
            </div>
            <div className="p-6 flex-1 space-y-4 relative">
              
              <div className="absolute right-6 top-6 z-10">
                {isDisaster && (
                  <button onClick={restore} className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow-lg animate-bounce">
                    <RotateCcw className="w-3 h-3" /> Restore Lost Commit
                  </button>
                )}
              </div>

              {/* Reverse loop for reflog feel (newest actions at top, though we'll just show all) */}
              <div className="font-mono text-xs space-y-2 opacity-80">
                {isDisaster && (
                  <div className="text-destructive font-bold mb-4 pb-2 border-b border-destructive/20">
                    a1b2c3d HEAD@{`{0}`}: reset: moving to f9e8d7c
                  </div>
                )}
                <div className={`${!commits[0].visible ? 'text-primary bg-primary/10 p-2 -mx-2 rounded border border-primary/20' : 'text-white/70'}`}>
                  a1b2c3d HEAD@{`{${isDisaster ? 1 : 0}}`}: commit: Add brilliant new feature
                </div>
                <div className="text-white/70">
                  f9e8d7c HEAD@{`{${isDisaster ? 2 : 1}}`}: commit: Update dependencies
                </div>
                <div className="text-white/70">
                  1a2b3c4 HEAD@{`{${isDisaster ? 3 : 2}}`}: commit (initial): Initial commit
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-[#161b22]/50 border border-white/5 border-dashed rounded-xl flex items-center justify-center p-8 text-center text-muted-foreground">
            <div className="max-w-xs">
              <AlertOctagon className="w-8 h-8 mx-auto mb-4 opacity-20" />
              <p className="text-sm">Behind the scenes, Git records every single time a commit is sealed or moved. It stays here for ~90 days.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
