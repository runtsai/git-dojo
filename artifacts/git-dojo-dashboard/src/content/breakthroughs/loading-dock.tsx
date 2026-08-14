import { useState } from "react";
import { ArrowDown, Truck } from "lucide-react";
import { ComputerIcon, TrayIcon, SealedBoxIcon } from "@/components/git-icons";
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
    <div className="flex flex-col w-full max-w-2xl mx-auto py-4">
      <div className="flex flex-col gap-6 md:gap-8 min-h-[400px]">
        
        {/* Workbench */}
        <div className="bg-[#161b22] border border-white/10 rounded-xl flex flex-col relative z-10">
          <div className="bg-[#21262d] border-b border-white/10 p-4 text-center">
            <h3 className="font-bold text-foreground flex items-center justify-center gap-2">
              <ComputerIcon className="w-5 h-5 text-muted-foreground" /> Your Desk
            </h3>
            <div className="text-xs text-muted-foreground font-mono mt-1">Working Directory</div>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-2 min-h-[100px]">
            {files.filter(f => f.state === 'workbench').map(f => (
              <div key={f.id} className="bg-black/40 border border-white/5 p-3 rounded-lg flex items-center justify-between group animate-in slide-in-from-top-4 duration-300">
                <span className="font-mono text-sm text-white/80">{f.name}</span>
                <button 
                  onClick={() => moveFile(f.id, 'dock')}
                  className="bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground min-h-[44px] px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                  Stage &darr;
                </button>
              </div>
            ))}
            {files.filter(f => f.state === 'workbench').length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-4 opacity-50 italic flex items-center justify-center min-h-[44px]">Empty</div>
            )}
          </div>
        </div>

        {/* Arrow Down */}
        <div className="flex justify-center -my-6 relative z-0">
          <div className="bg-[#0d1117] p-3 rounded-full">
            <ArrowDown className="w-10 h-10 text-primary/40 motion-safe:animate-pulse" />
          </div>
        </div>

        {/* Loading Dock */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl flex flex-col relative shadow-[0_0_40px_rgba(255,107,0,0.1)] z-10">
          <div className="bg-primary/10 border-b border-primary/20 p-6 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-24"></div>
            <div>
              <h3 className="text-lg font-bold text-primary flex items-center justify-center gap-2">
                <TrayIcon className="w-6 h-6" /> Loading Dock
              </h3>
              <div className="text-sm text-primary/70 font-mono mt-1">Staging Area (git add)</div>
            </div>
            <div className="w-full sm:w-24 flex justify-end">
              <button 
                onClick={handleSeal}
                disabled={!files.some(f => f.state === 'dock')}
                className="w-full sm:w-auto min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed font-bold px-6 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary/20 text-sm whitespace-nowrap"
              >
                <Truck className="w-5 h-5" /> Seal
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-6 flex-1 flex flex-col gap-3 min-h-[120px]">
            {files.filter(f => f.state === 'dock').map(f => (
              <div key={f.id} className="bg-primary/10 border border-primary/30 p-4 rounded-xl flex items-center justify-between group animate-in slide-in-from-top-4 duration-300 shadow-sm">
                <span className="font-mono text-base text-primary-foreground">{f.name}</span>
                <button 
                  onClick={() => moveFile(f.id, 'workbench')}
                  className="text-muted-foreground hover:text-destructive min-h-[44px] px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                >
                  &uarr; Unstage
                </button>
              </div>
            ))}
            {files.filter(f => f.state === 'dock').length === 0 && (
              <div className="text-center text-primary/50 text-sm py-4 opacity-70 italic flex items-center justify-center min-h-[44px]">
                Move files here to prepare the next commit.
              </div>
            )}
          </div>
        </div>

        {/* Arrow Down */}
        <div className="flex justify-center -my-6 relative z-0">
          <div className="bg-[#0d1117] p-3 rounded-full">
            <ArrowDown className="w-10 h-10 text-emerald-500/40 motion-safe:animate-pulse" />
          </div>
        </div>

        {/* Sealed History */}
        <div className="bg-[#161b22] border border-white/10 rounded-2xl flex flex-col relative z-10 shadow-2xl">
          <div className="bg-[#21262d] border-b border-white/10 p-6 text-center">
            <h3 className="text-lg font-bold text-emerald-400 flex items-center justify-center gap-2">
              <SealedBoxIcon className="w-6 h-6" /> The Archive
            </h3>
            <div className="text-sm text-emerald-400/60 font-mono mt-1">Repository History</div>
          </div>
          <div className="p-4 sm:p-6 flex-1 flex flex-col gap-3 overflow-y-auto max-h-[300px]">
            {Array.from({ length: sealedCount }).map((_, i) => (
              <div key={i} className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-start gap-4 animate-in slide-in-from-top-4 duration-300">
                <SealedBoxIcon className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-base font-bold text-emerald-400">Sealed Box #{sealedCount - i}</div>
                  <div className="text-sm text-emerald-400/70 mt-1">Contains docked files</div>
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
