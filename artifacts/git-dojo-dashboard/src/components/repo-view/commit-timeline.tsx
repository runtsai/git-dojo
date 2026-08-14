import { RepoCommit } from "@workspace/api-client-react";
import { GitCommit as GitCommitIcon, Clock, User } from "lucide-react";

export function CommitTimeline({ commits }: { commits: RepoCommit[] }) {
  if (commits.length === 0) {
    return (
      <div className="surface-card p-6 md:p-8">
        <h3 className="text-xl font-bold mb-6 text-foreground tracking-tight">Commit History</h3>
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-white/10 rounded-xl bg-black/40 shadow-inner">
          <GitCommitIcon className="w-10 h-10 mx-auto mb-4 opacity-30 text-white" />
          <p className="font-medium text-lg">No commits yet. Create your first snapshot!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card p-6 md:p-8">
      <h3 className="text-xl font-bold mb-8 text-foreground tracking-tight">Commit History</h3>
      
      <div className="ml-5 border-l-2 border-primary/20 pl-10 relative space-y-10">
        {commits.map((c, i) => (
          <div key={c.hash} className="relative group">
            {/* Timeline node */}
            <div className={`absolute -left-[51px] w-6 h-6 rounded-full border-4 border-card flex items-center justify-center
              ${i === 0 ? 'bg-primary shadow-[0_0_10px_rgba(255,107,0,0.5)]' : 'bg-muted-foreground/60'}
              transition-colors group-hover:bg-primary z-10
            `} />
            
            <div className="bg-black/40 border border-white/5 shadow-inner rounded-xl p-6 group-hover:border-primary/40 group-hover:bg-black/60 transition-all">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="font-mono text-sm font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md shadow-sm">
                  {c.shortHash}
                </span>
                
                {c.refs.map(r => (
                  <span key={r} className="font-mono text-[10px] uppercase font-bold tracking-widest text-secondary-foreground bg-secondary border border-white/10 px-2 py-1 rounded-md shadow-inner">
                    {r}
                  </span>
                ))}
              </div>
              
              <div className="text-xl font-medium text-foreground mb-4 leading-relaxed">
                {c.subject}
              </div>
              
              <div className="flex flex-wrap items-center gap-5 text-sm font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5"><User className="w-4 h-4 opacity-50" /> {c.authorName}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 opacity-50" /> {new Date(c.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
