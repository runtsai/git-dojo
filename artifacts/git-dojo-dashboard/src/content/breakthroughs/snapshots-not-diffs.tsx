import { useState } from "react";
import { FileText, Camera, FileDiff, ChevronLeft, ChevronRight } from "lucide-react";

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
        <div className="bg-black/40 p-1 rounded-lg border border-white/10 flex flex-col sm:flex-row w-full sm:w-auto">
          <button
            onClick={() => setViewMode('snapshot')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-colors ${
              viewMode === 'snapshot' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Camera className="w-4 h-4" /> What Git actually stores
          </button>
          <button
            onClick={() => setViewMode('diff')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-colors ${
              viewMode === 'diff' ? 'bg-secondary text-foreground border-white/10' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileDiff className="w-4 h-4" /> What Git shows you
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4">
        <div className="flex justify-between items-center relative mb-8">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-white/10 rounded-full" />
          {commits.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setActiveCommit(i)}
              className={`relative z-10 w-8 h-8 rounded-full border-4 flex items-center justify-center transition-all ${
                i === activeCommit 
                  ? 'bg-primary border-[#0d1117] ring-2 ring-primary scale-125' 
                  : 'bg-[#21262d] border-[#0d1117] text-muted-foreground hover:bg-white/20'
              }`}
            >
              {i === activeCommit && <div className="w-2 h-2 bg-[#0d1117] rounded-full" />}
            </button>
          ))}
        </div>
        
        <div className="text-center mb-6 h-8">
          <span className="font-mono text-primary font-bold">Commit {commit.id}:</span>{" "}
          <span className="text-foreground">{commit.msg}</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden min-h-[250px] relative">
        <div className="bg-[#21262d] border-b border-white/10 px-4 py-2 text-xs font-mono text-muted-foreground font-bold tracking-widest uppercase">
          {viewMode === 'snapshot' ? 'Full Archive Box (Snapshot)' : 'Calculated On-the-fly (Diff)'}
        </div>
        
        <div className="p-6">
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

    </div>
  );
}
