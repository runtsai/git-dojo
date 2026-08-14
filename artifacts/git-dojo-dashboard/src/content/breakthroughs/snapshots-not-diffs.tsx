import { useState } from "react";
import { FileText, Camera, FileDiff, ChevronLeft, ChevronRight } from "lucide-react";
import { BreakthroughContext } from "@/components/breakthrough-context";

const commits = [
  { id: 1, msg: "Initial commit", snapshot: { "index.html": "v1" }, diff: { "index.html": "+ Created file" } },
  { id: 2, msg: "Add styles", snapshot: { "index.html": "v1", "style.css": "v1" }, diff: { "style.css": "+ Created file" } },
  { id: 3, msg: "Update title", snapshot: { "index.html": "v2", "style.css": "v1" }, diff: { "index.html": "~ Changed title" } },
  { id: 4, msg: "Add script", snapshot: { "index.html": "v2", "style.css": "v1", "app.js": "v1" }, diff: { "app.js": "+ Created file" } },
  { id: 5, msg: "Fix bug", snapshot: { "index.html": "v2", "style.css": "v1", "app.js": "v2" }, diff: { "app.js": "~ Fixed typo" } }
];

export function SnapshotsNotDiffs() {
  const [activeCommit, setActiveCommit] = useState(0);
  const [viewMode, setViewMode] = useState<'snapshot' | 'diff'>('snapshot');

  const commit = commits[activeCommit];

  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl mx-auto py-4">
      
      {/* View Toggle */}
      <div className="flex justify-center">
        <div className="bg-black/40 p-1 rounded-xl border border-white/10 flex flex-col sm:flex-row w-full sm:w-auto shadow-inner">
          <button
            onClick={() => setViewMode('snapshot')}
            className={`min-h-[44px] flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-colors ${
              viewMode === 'snapshot' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Camera className="w-5 h-5" /> What Git actually stores
          </button>
          <button
            onClick={() => setViewMode('diff')}
            className={`min-h-[44px] flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-colors ${
              viewMode === 'diff' ? 'bg-secondary text-foreground border border-white/10 shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileDiff className="w-5 h-5" /> What Git shows you
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4">
        <div className="flex justify-between items-center relative mb-12">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 bg-white/10 rounded-full" />
          {commits.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setActiveCommit(i)}
              className={`relative z-10 w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all min-h-[44px] min-w-[44px] ${
                i === activeCommit 
                  ? 'bg-primary border-[#0d1117] ring-4 ring-primary/50 scale-110 shadow-lg shadow-primary/30' 
                  : 'bg-[#21262d] border-[#0d1117] text-muted-foreground hover:bg-white/20'
              }`}
            >
              {i === activeCommit && <div className="w-3 h-3 bg-[#0d1117] rounded-full" />}
            </button>
          ))}
        </div>
        
        <div className="text-center mb-8 h-10 text-lg">
          <span className="font-mono text-primary font-bold">Commit {commit.id}:</span>{" "}
          <span className="text-foreground">{commit.msg}</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden min-h-[300px] relative shadow-2xl">
        <div className="bg-[#161b22] border-b border-white/10 px-6 py-4 text-sm font-mono text-muted-foreground font-bold tracking-widest uppercase flex items-center justify-center gap-2">
          {viewMode === 'snapshot' ? <Camera className="w-4 h-4" /> : <FileDiff className="w-4 h-4" />}
          {viewMode === 'snapshot' ? 'Full Archive Box (Snapshot)' : 'Calculated On-the-fly (Diff)'}
        </div>
        
        <div className="p-8">
          {viewMode === 'snapshot' ? (
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(commit.snapshot).map(([file, version]) => (
                <div key={file} className="bg-black/40 border border-white/5 p-4 rounded-lg flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
                  <FileText className="w-8 h-8 text-primary/80" />
                  <div className="text-center">
                    <div className="text-sm font-bold text-foreground">{file}</div>
                    <div className="text-xs font-mono text-muted-foreground mt-1">{version}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 font-mono text-sm">
              {Object.entries(commit.diff).map(([file, change]) => {
                const isAdd = change.startsWith('+');
                return (
                  <div key={file} className={`p-3 rounded border animate-in slide-in-from-bottom-2 duration-200 ${
                    isAdd ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  }`}>
                    {file}: {change}
                  </div>
                );
              })}
              <div className="mt-8 text-center text-xs text-muted-foreground italic opacity-70">
                (Git calculates this by comparing Snapshot {commit.id} with Snapshot {Math.max(1, commit.id - 1)})
              </div>
            </div>
          )}
        </div>
      </div>

      <BreakthroughContext>
        <p>If Git only stored "what changed" line-by-line, rewinding to a version from three years ago would require calculating thousands of fragile diffs. Instead, Git takes a lightning-fast photograph of all your files every time you seal a record.</p>
        <p>For your business, this means the custody trail is bulletproof. When an auditor asks to see exactly what the handbook looked like in 2022, Git isn't guessing based on old changes—it is handing you the exact, perfectly preserved photograph from that day.</p>
      </BreakthroughContext>
    </div>
  );
}
