import { useState } from "react";
import { PackageOpen, Truck, ShieldCheck, ArrowRight, FileEdit, FileCheck2, Archive } from "lucide-react";
import { BreakthroughContext } from "@/components/breakthrough-context";

type FileState = 'workbench' | 'dock' | 'sealed';
interface MyFile { id: string; name: string; state: FileState; }

export function LoadingDock() {
  const [files, setFiles] = useState<MyFile[]>([
    { id: '1', name: 'report.pdf', state: 'workbench' },
    { id: '2', name: 'notes.txt', state: 'workbench' },
    { id: '3', name: 'budget.xlsx', state: 'workbench' },
  ]);
  const [sealedCount, setSealedCount] = useState(0);

  const moveFile = (id: string, newState: FileState) => {
    setFiles(files.map(f => f.id === id ? { ...f, state: newState } : f));
  };

  const handleSeal = () => {
    const hasDocked = files.some(f => f.state === 'dock');
    if (!hasDocked) return;
    
    // Move all dock files to sealed
    setFiles(files.map(f => f.state === 'dock' ? { ...f, state: 'sealed' } : f));
    setSealedCount(c => c + 1);
  };

  const handleReset = () => {
    setFiles(files.map(f => ({ ...f, state: 'workbench' })));
    setSealedCount(0);
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto py-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 min-h-[400px]">
        
        {/* Workbench */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl flex flex-col">
          <div className="bg-[#21262d] border-b border-white/10 p-4 text-center">
            <h3 className="font-bold text-foreground flex items-center justify-center gap-2">
              <FileEdit className="w-4 h-4 text-muted-foreground" /> Your Desk
            </h3>
            <div className="text-xs text-muted-foreground font-mono mt-1">Working Directory</div>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-2">
            {files.filter(f => f.state === 'workbench').map(f => (
              <div key={f.id} className="bg-black/40 border border-white/5 p-3 rounded-lg flex items-center justify-between group animate-in slide-in-from-left-2">
                <span className="font-mono text-sm text-white/80">{f.name}</span>
                <button 
                  onClick={() => moveFile(f.id, 'dock')}
                  className="bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground px-2 py-1 rounded text-xs font-bold transition-colors"
                >
                  Stage &rarr;
                </button>
              </div>
            ))}
            {files.filter(f => f.state === 'workbench').length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8 opacity-50 italic">Empty</div>
            )}
          </div>
        </div>

        {/* Loading Dock */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl flex flex-col relative shadow-[0_0_30px_rgba(255,107,0,0.05)]">
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 hidden md:block text-primary/30"><ArrowRight /></div>
          
          <div className="bg-primary/10 border-b border-primary/20 p-4 text-center">
            <h3 className="font-bold text-primary flex items-center justify-center gap-2">
              <PackageOpen className="w-4 h-4" /> Loading Dock
            </h3>
            <div className="text-xs text-primary/70 font-mono mt-1">Staging Area (git add)</div>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-2">
            {files.filter(f => f.state === 'dock').map(f => (
              <div key={f.id} className="bg-primary/10 border border-primary/30 p-3 rounded-lg flex items-center justify-between group animate-in slide-in-from-left-2">
                <span className="font-mono text-sm text-primary-foreground">{f.name}</span>
                <button 
                  onClick={() => moveFile(f.id, 'workbench')}
                  className="text-muted-foreground hover:text-destructive px-2 py-1 rounded text-xs font-bold transition-colors"
                >
                  &larr; Unstage
                </button>
              </div>
            ))}
            {files.filter(f => f.state === 'dock').length === 0 && (
              <div className="text-center text-primary/50 text-sm py-8 opacity-70 italic">
                Move files here to prepare the next commit.
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-primary/20 mt-auto">
            <button 
              onClick={handleSeal}
              disabled={!files.some(f => f.state === 'dock')}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed font-bold px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/20"
            >
              <Truck className="w-5 h-5" /> Seal Record (Commit)
            </button>
          </div>
        </div>

        {/* Sealed History */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl flex flex-col relative">
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 hidden md:block text-white/10"><ArrowRight /></div>

          <div className="bg-[#21262d] border-b border-white/10 p-4 text-center">
            <h3 className="font-bold text-emerald-400 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4" /> The Archive
            </h3>
            <div className="text-xs text-emerald-400/60 font-mono mt-1">Repository History</div>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto">
            {Array.from({ length: sealedCount }).map((_, i) => (
              <div key={i} className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-start gap-3 animate-in slide-in-from-bottom-2">
                <Archive className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-emerald-400">Sealed Box #{i + 1}</div>
                  <div className="text-xs text-emerald-400/70 mt-1">Contains docked files</div>
                </div>
              </div>
            ))}
            {sealedCount === 0 && (
              <div className="text-center text-muted-foreground text-sm py-8 opacity-50 italic">No commits yet</div>
            )}
          </div>
        </div>

      </div>

      {sealedCount > 0 && files.filter(f => f.state === 'workbench').length === 0 && (
        <div className="mt-8 text-center animate-in fade-in">
          <button onClick={handleReset} className="text-sm font-bold text-muted-foreground hover:text-foreground underline underline-offset-4">Reset Toy</button>
        </div>
      )}

      <BreakthroughContext>
        <p>Work is inherently messy—you might edit the budget spreadsheet, draft an email, and update a policy all at the same time. The loading dock (staging area) exists so you don't have to seal all that chaos into a single confusing record.</p>
        <p>You can put just the policy update on the dock and seal it, then put the budget on the dock and seal that. This forces your company's custody trail to remain clean and logical, ensuring every sealed record tells a single, clear story about what changed and why.</p>
      </BreakthroughContext>
    </div>
  );
}
