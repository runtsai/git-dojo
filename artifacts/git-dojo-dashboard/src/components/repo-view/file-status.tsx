import { RepoFile } from "@workspace/api-client-react";
import { File, FilePlus, FileEdit, FileMinus, AlertCircle, HelpCircle } from "lucide-react";

export function FileStatus({ files, onFileClick, dimmed = false }: { files: RepoFile[]; onFileClick?: (f: RepoFile) => void; dimmed?: boolean }) {
  if (files.length === 0) {
    return (
      <div className={`surface-card p-6 md:p-8 transition-opacity duration-500 ${dimmed ? "opacity-50 pointer-events-none select-none" : ""}`}>
        <h3 className="text-xl font-bold mb-6 text-foreground tracking-tight">Working Directory</h3>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-white/10 rounded-xl bg-black/40 shadow-inner">
          <File className="w-10 h-10 mb-4 opacity-30 text-white" />
          <p className="font-medium text-lg">Working tree clean. No modified or untracked files.</p>
        </div>
      </div>
    );
  }

  const staged = files.filter(f => f.status === 'staged' || f.status === 'staged_and_modified');
  const modified = files.filter(f => f.status === 'modified' || f.status === 'staged_and_modified');
  const untracked = files.filter(f => f.status === 'untracked');
  const deleted = files.filter(f => f.status === 'deleted');
  const conflicted = files.filter(f => f.status === 'conflicted');

  const Section = ({ title, items, icon: Icon, colorClass, bgClass, borderClass }: any) => {
    if (items.length === 0) return null;
    return (
      <div className={`border rounded-xl p-5 mb-5 last:mb-0 shadow-inner ${bgClass} ${borderClass}`}>
        <h4 className={`text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2 ${colorClass}`}>
          <Icon className="w-4 h-4" /> {title} ({items.length})
        </h4>
        <div className="space-y-2">
          {items.map((f: RepoFile) => {
            const clickable = !!onFileClick;
            const Tag = clickable ? 'button' : 'div';
            return (
              <Tag
                key={f.path}
                {...(clickable ? { onClick: () => onFileClick!(f), title: 'See what changed in this file', 'data-testid': `file-row-${f.path}` } : {})}
                className={`w-full font-mono text-sm px-4 py-3 bg-background border border-white/5 rounded-lg flex items-center justify-between shadow-sm text-left ${
                  clickable ? 'cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary' : ''
                }`}
              >
                <span className="text-foreground">{f.path}</span>
                <span className="flex items-center gap-2">
                  {f.status === 'staged_and_modified' && title.includes('Staged') && (
                    <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">Also Modified</span>
                  )}
                  {clickable && (
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-60">what changed?</span>
                  )}
                </span>
              </Tag>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`surface-card p-6 md:p-8 transition-opacity duration-500 ${dimmed ? "opacity-50 pointer-events-none select-none" : ""}`}>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h3 className="text-xl font-bold text-foreground tracking-tight">File Status</h3>
        {dimmed && <span className="ml-auto text-[11px] font-medium text-amber-400/80">last known state</span>}
      </div>
      
      <Section title="Staged (Ready to Commit)" items={staged} icon={FilePlus} colorClass="text-emerald-400" bgClass="bg-emerald-500/5" borderClass="border-emerald-500/20" />
      <Section title="Modified (Not Staged)" items={modified} icon={FileEdit} colorClass="text-amber-500" bgClass="bg-amber-500/5" borderClass="border-amber-500/20" />
      <Section title="Untracked" items={untracked} icon={HelpCircle} colorClass="text-muted-foreground" bgClass="bg-white/5" borderClass="border-white/10" />
      <Section title="Deleted" items={deleted} icon={FileMinus} colorClass="text-destructive" bgClass="bg-destructive/5" borderClass="border-destructive/20" />
      <Section title="Conflicted" items={conflicted} icon={AlertCircle} colorClass="text-destructive" bgClass="bg-destructive/10" borderClass="border-destructive/30" />
    </div>
  );
}
