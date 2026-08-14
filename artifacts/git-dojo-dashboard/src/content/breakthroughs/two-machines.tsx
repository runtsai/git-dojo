import { useState } from "react";
import { Wifi, WifiOff, Upload, Download, Plus, CloudOff, AlertCircle } from "lucide-react";
import { BreakthroughContext } from "@/components/breakthrough-context";
import { ComputerIcon, CloudIcon } from "@/components/git-icons";

export function TwoMachines() {
  const [online, setOnline] = useState(true);
  const [localCommits, setLocalCommits] = useState<number[]>([1, 2]);
  const [remoteCommits, setRemoteCommits] = useState<number[]>([1, 2]); 
  const [fetchedCommits, setFetchedCommits] = useState<number[]>([]);
  const [nextId, setNextId] = useState(3);
  const [pushError, setPushError] = useState<string | null>(null);
  
  const handleLocalCommit = () => {
    setLocalCommits(prev => [...prev, nextId]);
    setNextId(n => n + 1);
    setPushError(null);
  };
  
  const handleRemoteCommit = () => {
    setRemoteCommits(prev => [...prev, nextId]);
    setNextId(n => n + 1);
    setPushError(null);
  };

  const handlePush = () => {
    if (!online) return;
    
    // Check if remote has extra commits local doesn't know about
    const remoteHasExtra = remoteCommits.some(c => !localCommits.includes(c));
    if (remoteHasExtra) {
      setPushError("Push Rejected: The website's copy has records you don't have yet — fetch first, then combine.");
      return;
    }
    
    // Fast-forward
    setRemoteCommits([...localCommits]);
    setPushError(null);
  };

  const handleFetch = () => {
    if (!online) return;
    
    // Download missing commits
    const newFetched = remoteCommits.filter(c => !localCommits.includes(c));
    setFetchedCommits(Array.from(new Set([...fetchedCommits, ...newFetched])));
    setPushError(null);
  };

  const allLocalKnowledge = Array.from(new Set([...localCommits, ...fetchedCommits])).sort((a,b) => a - b);

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-3xl mx-auto py-4">
      {/* Network Switch */}
      <div className="flex items-center gap-4 bg-black/40 p-2 rounded-xl border border-white/10 shadow-inner">
        <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-2">Internet</span>
        <button 
          onClick={() => setOnline(!online)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            online ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm' : 'bg-destructive/20 text-destructive border border-destructive/30 shadow-sm'
          }`}
        >
          {online ? <><Wifi className="w-4 h-4" /> Connected</> : <><WifiOff className="w-4 h-4" /> Unplugged</>}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
        {/* Local Machine */}
        <div className="sim-window border-white/10 flex flex-col h-full bg-[#161b22]">
          <div className="sim-chrome px-4 justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <ComputerIcon className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground">Your Computer</h3>
            </div>
            <span className="text-xs font-mono text-muted-foreground bg-black/50 px-2 py-1 rounded shadow-inner">Local Repo</span>
          </div>
          
          <div className="p-6 flex-1 flex flex-col gap-6 bg-[#0d1117]">
            <div className="flex flex-col gap-2 min-h-[160px]">
              {allLocalKnowledge.map(c => {
                const isLocal = localCommits.includes(c);
                const isGhosted = fetchedCommits.includes(c) && !isLocal;
                const isLocalHead = isLocal && c === localCommits[localCommits.length - 1];
                const isRemoteHead = isGhosted && c === Math.max(...fetchedCommits);

                return (
                  <div key={c} className="flex flex-wrap items-center gap-2 sm:gap-3 enter-fade">
                    {isLocal ? (
                      <div className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20 shrink-0 shadow-[0_0_10px_rgba(255,107,0,0.5)]" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-transparent border-2 border-white/30 border-dashed shrink-0" />
                    )}
                    <div className={`h-0.5 w-2 sm:w-4 hidden sm:block ${isLocal ? 'bg-primary/20' : 'bg-white/10 border-t-2 border-dashed border-transparent'}`} />
                    <div className={`border px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-mono shadow-inner ${isLocal ? 'bg-black/40 border-white/5 text-muted-foreground' : 'bg-white/5 border-white/10 text-muted-foreground'}`}>
                      commit-{c}
                    </div>
                    {isLocalHead && (
                      <span className="bg-primary/20 text-primary text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded ml-auto sm:ml-0 shadow-sm border border-primary/20">main</span>
                    )}
                    {isRemoteHead && (
                      <span className="bg-white/10 text-muted-foreground border border-white/10 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded ml-auto sm:ml-0 shadow-sm">origin/main</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-auto space-y-3 pt-6 border-t border-white/10 flex flex-col">
              {pushError && (
                <div className="text-xs text-amber-400 font-bold bg-amber-500/10 p-3 rounded-md border border-amber-500/20 enter-fade flex items-start gap-2 leading-relaxed shadow-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{pushError}</span>
                </div>
              )}

              <button 
                onClick={handleLocalCommit}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              >
                <Plus className="w-4 h-4" /> Save Work (Commit)
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handlePush}
                  className={`px-3 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    online 
                      ? 'bg-black/50 border-white/10 hover:border-primary/50 hover:bg-white/5 text-foreground active:scale-95 shadow-sm' 
                      : 'bg-black/20 border-white/5 text-muted-foreground/50 cursor-not-allowed shadow-inner'
                  }`}
                >
                  <Upload className="w-4 h-4" /> Push
                </button>
                <button 
                  onClick={handleFetch}
                  className={`px-3 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    online 
                      ? 'bg-black/50 border-white/10 hover:border-primary/50 hover:bg-white/5 text-foreground active:scale-95 shadow-sm' 
                      : 'bg-black/20 border-white/5 text-muted-foreground/50 cursor-not-allowed shadow-inner'
                  }`}
                >
                  <Download className="w-4 h-4" /> Fetch
                </button>
              </div>
              {!online && (
                <div className="text-center text-xs text-destructive/80 font-bold flex items-center justify-center gap-1 mt-1">
                  <CloudOff className="w-3 h-3" /> Cannot sync while offline
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Remote Server */}
        <div className="sim-window border-white/10 flex flex-col h-full bg-[#161b22]">
          <div className="sim-chrome px-4 justify-between border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              <CloudIcon className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-foreground">GitHub</h3>
            </div>
            <span className="text-xs font-mono text-muted-foreground bg-black/50 px-2 py-1 rounded shadow-inner">Remote Repo</span>
          </div>
          
          <div className="p-6 flex-1 flex flex-col gap-6 bg-[#0d1117]">
            <div className="flex flex-col gap-2 min-h-[160px]">
              {remoteCommits.map(c => (
                <div key={c} className="flex items-center gap-2 sm:gap-3 enter-fade">
                  <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20 shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  <div className="h-0.5 bg-blue-500/20 w-2 sm:w-4 hidden sm:block" />
                  <div className="bg-black/40 border border-white/5 shadow-inner px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-mono text-muted-foreground">
                    commit-{c}
                  </div>
                  {c === remoteCommits[remoteCommits.length - 1] && (
                    <span className="bg-blue-500/20 text-blue-400 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded ml-auto shadow-sm border border-blue-500/20">main</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-white/10 space-y-3 flex flex-col justify-end h-full min-h-[142px]">
              <div className="text-xs text-muted-foreground text-center mb-2 px-4 reading-text">
                GitHub is just a server hosting a copy. Coworkers can push to it.
              </div>
              <button 
                onClick={handleRemoteCommit}
                className="w-full bg-black/50 hover:bg-black/80 hover:bg-white/5 border border-white/10 hover:border-blue-500/50 text-foreground font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1117]"
              >
                <Plus className="w-4 h-4 text-blue-400" /> Coworker pushes a commit
              </button>
            </div>
          </div>
        </div>
      </div>

      <BreakthroughContext>
        <p>Git was built so developers could work independently without a constant internet connection.</p>
        <p>For your company, this means when a contractor is writing a new chapter of the compliance manual, they aren't directly editing the live files on the server. They work in their own independent copy locally, taking their time to seal records. When they are ready, they push their finished work up to GitHub. GitHub is simply the central meeting point where everyone's local copies are safely combined into the official company truth.</p>
      </BreakthroughContext>
    </div>
  );
}
