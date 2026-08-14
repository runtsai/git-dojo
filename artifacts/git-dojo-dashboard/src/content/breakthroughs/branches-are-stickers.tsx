import { useState } from "react";
import { GitCommit, MousePointer2 } from "lucide-react";
import { StickerIcon } from "@/components/git-icons";
import { BreakthroughContext } from "@/components/breakthrough-context";

export function BranchesAreStickers() {
  const [commits, setCommits] = useState([1, 2, 3]);
  const [head, setHead] = useState("feature-1");
  const [branches, setBranches] = useState<{name: string, commitIndex: number, color: string}[]>([
    { name: "main", commitIndex: 1, color: "text-emerald-400 border-emerald-500/50 bg-emerald-500/20" },
    { name: "feature-1", commitIndex: 2, color: "text-primary border-primary/50 bg-primary/20" }
  ]);
  const [ghost, setGhost] = useState<{name: string, commitIndex: number} | null>(null);
  const [byteCount, setByteCount] = useState(82); // 41 bytes * 2 branches

  const activeCommitIndex = branches.find(b => b.name === head)?.commitIndex ?? 0;

  const handleCreateBranch = () => {
    if (branches.length >= 4) return; // limit for UI
    const newName = `feature-${branches.length}`;
    const colors = ["text-blue-400 border-blue-500/50 bg-blue-500/20", "text-purple-400 border-purple-500/50 bg-purple-500/20"];
    const bColor = colors[(branches.length - 2) % colors.length];
    
    setBranches([...branches, { name: newName, commitIndex: activeCommitIndex, color: bColor }]);
    
    setGhost({ name: head, commitIndex: activeCommitIndex });
    setTimeout(() => setGhost(null), 1000);
    
    setHead(newName);
    setByteCount(b => b + 41);
  };

  const setHeadWithGhost = (newHead: string) => {
    const b = branches.find(br => br.name === head);
    if (b) {
      setGhost({ name: head, commitIndex: b.commitIndex });
      setTimeout(() => setGhost(null), 1000);
    }
    setHead(newHead);
  };

  const handleCommit = () => {
    const newCommitIndex = commits.length;
    setCommits([...commits, newCommitIndex + 1]);
    
    const b = branches.find(br => br.name === head);
    if (b) {
      setGhost({ name: head, commitIndex: b.commitIndex });
      setTimeout(() => setGhost(null), 1000);
    }
    
    // Move ONLY the active branch sticker
    setBranches(branches.map(b => 
      b.name === head ? { ...b, commitIndex: newCommitIndex } : b
    ));
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto py-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-black/40 p-4 rounded-xl border border-white/10">
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleCreateBranch}
            disabled={branches.length >= 4}
            className="bg-secondary hover:bg-secondary/80 text-foreground border border-white/10 px-4 py-2 rounded font-bold text-sm transition-colors disabled:opacity-50"
          >
            Create Branch
          </button>
          <button 
            onClick={handleCommit}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded font-bold text-sm transition-colors shadow-lg shadow-primary/20"
          >
            Commit on '{head}'
          </button>
        </div>
        <div className="text-sm font-mono text-muted-foreground flex flex-col sm:items-end w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-white/10 sm:border-0">
          <span>Project size: 1.4 MB</span>
          <span className="text-primary font-bold">Branch data added: {byteCount} bytes</span>
        </div>
      </div>

      <div className="relative pt-24 pb-12 w-full overflow-x-auto">
        <div className="min-w-max px-4 sm:px-8">
          <div className="flex items-center">
            {commits.map((c, i) => (
              <div key={c} className="flex items-center relative">
                {/* Connecting line to previous */}
                {i > 0 && <div className="h-1 w-16 bg-white/20" />}
                
                {/* The Commit Node */}
                <div className="relative">
                  {/* Branch Stickers above the node */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col-reverse gap-2 items-center">
                    {branches.filter(b => b.commitIndex === i).map((b, bi) => (
                      <button
                        key={b.name}
                        onClick={() => setHeadWithGhost(b.name)}
                        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-mono transition-all animate-in slide-in-from-top-4 cursor-pointer border-2 ${
                          head === b.name 
                            ? `${b.color} shadow-[0_4px_15px_rgba(0,0,0,0.3)] scale-110 z-10 relative` 
                            : 'bg-black/60 text-muted-foreground border-white/10 hover:border-white/30 hover:text-white'
                        }`}
                      >
                        <StickerIcon className="w-3.5 h-3.5" /> {b.name}
                        {head !== b.name && <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 bg-white/10 px-1 rounded text-[10px]">Switch</span>}
                        {/* Down arrow pointing to node */}
                        {head === b.name && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-current mt-0.5 opacity-50" />
                        )}
                      </button>
                    ))}
                    
                    {/* The Ghost Sticker */}
                    {ghost && ghost.commitIndex === i && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-mono border-2 border-dashed border-white/30 text-white/40 opacity-60 bg-transparent absolute animate-out fade-out slide-out-to-top-4 duration-1000 fill-mode-forwards pointer-events-none">
                        <StickerIcon className="w-3.5 h-3.5" /> {ghost.name}
                      </div>
                    )}
                  </div>

                  {/* Node Circle */}
                  <div className={`w-8 h-8 rounded-full border-4 flex items-center justify-center z-10 relative ${
                    i === activeCommitIndex ? 'bg-primary border-[#0d1117] ring-2 ring-primary' : 'bg-[#21262d] border-[#0d1117] text-white/20'
                  }`}>
                    <GitCommit className="w-4 h-4" />
                  </div>
                  
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 text-xs font-mono text-muted-foreground opacity-50">
                    {c}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Future dotted line */}
            <div className="h-1 w-16 bg-white/5 border-t-2 border-dashed border-white/10 ml-0.5" />
          </div>
        </div>
      </div>

      <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg flex items-start gap-4">
        <div className="mt-1"><MousePointer2 className="w-5 h-5 text-primary" /></div>
        <p className="text-sm text-foreground/90 leading-relaxed font-medium">
          Click a branch label to switch to it (move your <code className="bg-black/30 px-1 py-0.5 rounded">HEAD</code>). 
          Notice that when you commit, ONLY the active sticker moves forward. A branch is just a named pointer to a commit.
        </p>
      </div>

      <BreakthroughContext>
        <p>If creating a branch duplicated your entire project, starting a new task would be slow and waste massive amounts of disk space. Because a branch is just a tiny sticker pointing to a specific photograph, you can create hundreds of them instantly.</p>
        <p>In practice, this means whenever a contractor wants to try an experimental new policy, they just stick a new label on the current truth and start working from there. The main company timeline remains untouched and completely safe while they experiment on their branch.</p>
      </BreakthroughContext>
    </div>
  );
}
