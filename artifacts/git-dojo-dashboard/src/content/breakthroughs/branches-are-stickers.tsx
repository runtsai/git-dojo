import { useState } from "react";
import { GitBranch, GitCommit, MoveRight, ArrowRight, MousePointer2 } from "lucide-react";
import { BreakthroughContext } from "@/components/breakthrough-context";

export function BranchesAreStickers() {
  const [commits, setCommits] = useState([1, 2, 3]);
  const [head, setHead] = useState("main");
  const [branches, setBranches] = useState<{name: string, commitIndex: number}[]>([
    { name: "main", commitIndex: 2 }
  ]);
  const [byteCount, setByteCount] = useState(41);

  const activeCommitIndex = branches.find(b => b.name === head)?.commitIndex ?? 0;

  const handleCreateBranch = () => {
    if (branches.length >= 3) return; // limit for UI
    const newName = `feature-${branches.length}`;
    setBranches([...branches, { name: newName, commitIndex: activeCommitIndex }]);
    setHead(newName);
    // Byte count increases slightly because a new ref file is created, but it's just 41 bytes.
    setByteCount(b => b + 41);
  };

  const handleCommit = () => {
    const newCommitIndex = commits.length;
    setCommits([...commits, newCommitIndex + 1]);
    
    // Move ONLY the active branch sticker
    setBranches(branches.map(b => 
      b.name === head ? { ...b, commitIndex: newCommitIndex } : b
    ));
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto py-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-black/40 p-4 rounded-xl border border-white/10">
        <div className="space-x-3">
          <button 
            onClick={handleCreateBranch}
            disabled={branches.length >= 3}
            className="bg-secondary hover:bg-secondary/80 text-foreground border border-white/10 px-4 py-2 rounded font-bold text-sm transition-colors disabled:opacity-50"
          >
            Create Branch
          </button>
          <button 
            onClick={handleCommit}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded font-bold text-sm transition-colors"
          >
            Commit on '{head}'
          </button>
        </div>
        <div className="text-sm font-mono text-muted-foreground flex flex-col items-end">
          <span>Project size: 1.4 MB</span>
          <span className="text-primary font-bold">Branch data added: {byteCount} bytes</span>
        </div>
      </div>

      <div className="relative pt-24 pb-12 overflow-x-auto">
        <div className="min-w-max px-8">
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
                        onClick={() => setHead(b.name)}
                        className={`group flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold font-mono transition-all animate-in slide-in-from-top-4 cursor-pointer border-2 ${
                          head === b.name 
                            ? 'bg-primary/20 text-primary border-primary shadow-[0_4px_15px_rgba(255,107,0,0.3)]' 
                            : 'bg-black/60 text-muted-foreground border-white/10 hover:border-white/30'
                        }`}
                      >
                        <GitBranch className="w-3 h-3" /> {b.name}
                        {head !== b.name && <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 bg-white/10 px-1 rounded text-[10px]">Switch</span>}
                        {/* Down arrow pointing to node */}
                        <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] mt-0.5 ${
                          head === b.name ? 'border-t-primary' : 'border-t-white/20'
                        }`} />
                      </button>
                    ))}
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
