import { useParams, Link } from "wouter";
import { breakthroughs } from "@/content/breakthroughs";
import { ArrowLeft } from "lucide-react";
import NotFound from "./not-found";

import { TwoMachines } from "@/content/breakthroughs/two-machines";
import { SnapshotsNotDiffs } from "@/content/breakthroughs/snapshots-not-diffs";
import { BranchesAreStickers } from "@/content/breakthroughs/branches-are-stickers";
import { LoadingDock } from "@/content/breakthroughs/loading-dock";
import { FetchIsLooking } from "@/content/breakthroughs/fetch-is-looking";
import { MergeReveals } from "@/content/breakthroughs/merge-reveals";
import { DetachedHead } from "@/content/breakthroughs/detached-head";
import { ConflictsAreQuestions } from "@/content/breakthroughs/conflicts-are-questions";
import { NothingIsLost } from "@/content/breakthroughs/nothing-is-lost";

const toys: Record<string, React.ComponentType> = {
  "two-machines": TwoMachines,
  "snapshots-not-diffs": SnapshotsNotDiffs,
  "branches-are-stickers": BranchesAreStickers,
  "loading-dock": LoadingDock,
  "fetch-is-looking": FetchIsLooking,
  "merge-reveals": MergeReveals,
  "detached-head": DetachedHead,
  "conflicts-are-questions": ConflictsAreQuestions,
  "nothing-is-lost": NothingIsLost,
};

export function BreakthroughView() {
  const params = useParams();
  const id = params.id;
  
  if (!id || !toys[id]) {
    return <NotFound />;
  }
  
  const meta = breakthroughs.find(b => b.id === id);
  const Toy = toys[id];
  
  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 sm:pb-20 px-2 sm:px-0">
      <Link href="/breakthroughs" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-1 sm:mb-2 transition-colors uppercase tracking-wider bg-black/40 border border-white/5 px-3 py-1.5 rounded">
        <ArrowLeft className="w-3.5 h-3.5" /> Gallery
      </Link>
      
      <div className="bg-card border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-5 sm:p-6 md:p-8 bg-black/40 border-b border-white/5 space-y-2 sm:space-y-3 shrink-0">
          <div className="text-destructive font-bold text-xs sm:text-sm tracking-wide uppercase">Most people think...</div>
          <div className="text-lg sm:text-xl md:text-2xl font-medium text-foreground opacity-90 line-through decoration-destructive/50 decoration-2 leading-snug">
            "{meta?.misconception}"
          </div>
        </div>
        
        <div className="p-4 sm:p-6 md:p-8 flex-1 overflow-x-auto bg-[#0d1117]">
          <Toy />
        </div>
        
        <div className="p-5 sm:p-6 md:p-8 bg-primary/5 border-t border-primary/20 space-y-2 sm:space-y-3 shrink-0">
          <div className="text-primary font-bold text-xs sm:text-sm tracking-wide uppercase">The Breakthrough</div>
          <div className="text-lg sm:text-xl md:text-2xl font-bold text-foreground leading-snug">
            {meta?.breakthrough}
          </div>
        </div>
      </div>
    </div>
  );
}
