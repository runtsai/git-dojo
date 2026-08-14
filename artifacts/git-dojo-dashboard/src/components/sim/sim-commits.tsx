import React, { ReactNode } from 'react';
import { ArrowLeft, User, FileText, Code, GitCommit } from 'lucide-react';

export function SimCommitList({ 
  commits, 
  onCommitClick,
  selectedId
}: { 
  commits: { id: string, author: string, message: string, time: string, initials?: string, color?: string }[],
  onCommitClick?: (id: string) => void,
  selectedId?: string
}) {
  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="flex items-center gap-3 mb-4 text-white">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <GitCommit className="w-5 h-5 text-white/50" /> Commit History
        </h3>
      </div>
      
      <div className="space-y-2 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
        {commits.map((c) => (
          <button 
            key={c.id}
            onClick={() => onCommitClick?.(c.id)}
            className={`w-full text-left bg-[#161b22] border rounded-lg p-4 transition-all ${
              selectedId === c.id 
                ? "border-primary shadow-[0_0_15px_rgba(255,107,0,0.2)]" 
                : "border-white/10 hover:border-white/30"
            } relative z-10 block mx-auto ${selectedId === c.id ? 'scale-[1.02]' : ''}`}
          >
            <div className="flex items-center gap-3 text-white mb-2">
              {c.initials ? (
                <div className={`w-5 h-5 rounded ${c.color || 'bg-blue-500/20 text-blue-400'} flex items-center justify-center text-xs font-bold`}>{c.initials}</div>
              ) : (
                <User className="w-4 h-4 text-white/50" />
              )}
              <span className="font-bold">{c.author}</span>
              <span className="text-white/40 text-sm ml-auto">{c.time}</span>
            </div>
            <p className="text-white/80 text-sm font-medium">{c.message}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SimDiffView({
  commit,
  diffs,
  onBack
}: {
  commit: { author: string, message: string, time: string, hash: string },
  diffs: { file: string, added: string[], removed: string[], unchanged: string[] }[],
  onBack?: () => void
}) {
  return (
    <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-start gap-4 bg-[#161b22] p-4 rounded border border-white/10">
        {onBack && (
          <button onClick={onBack} className="mt-1 text-white/50 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="flex-1">
          <h3 className="font-bold text-white text-lg">{commit.message}</h3>
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className="text-white/80 font-medium">{commit.author}</span>
            <span className="text-white/40">committed {commit.time}</span>
          </div>
        </div>
        <div className="text-white/40 font-mono text-sm bg-black/40 px-2 py-1 rounded">
          {commit.hash}
        </div>
      </div>

      <div className="space-y-4">
        {diffs.map((d, i) => (
          <div key={i} className="border border-white/10 rounded overflow-hidden text-left bg-[#0d1117]">
            <div className="bg-[#161b22] p-3 border-b border-white/10 flex items-center gap-2 text-sm text-white/80 font-mono">
              <FileText className="w-4 h-4 text-white/40" /> {d.file}
            </div>
            <div className="font-mono text-sm leading-relaxed overflow-x-auto">
              {d.unchanged.map((line, j) => (
                <div key={`u-${j}`} className="flex px-4 py-0.5 text-white/60 hover:bg-white/5">
                  <span className="w-8 text-right text-white/30 select-none pr-4"></span>
                  <span className="whitespace-pre">{line}</span>
                </div>
              ))}
              {d.removed.map((line, j) => (
                <div key={`r-${j}`} className="flex px-4 py-0.5 bg-red-950/30 text-red-200">
                  <span className="w-8 text-right select-none pr-4">-</span>
                  <span className="whitespace-pre">{line}</span>
                </div>
              ))}
              {d.added.map((line, j) => (
                <div key={`a-${j}`} className="flex px-4 py-0.5 bg-emerald-950/30 text-emerald-200">
                  <span className="w-8 text-right select-none pr-4">+</span>
                  <span className="whitespace-pre">{line}</span>
                </div>
              ))}
              <div className="flex px-4 py-0.5 text-white/60 hover:bg-white/5">
                <span className="w-8 text-right text-white/30 select-none pr-4"></span>
                <span className="whitespace-pre"> </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
