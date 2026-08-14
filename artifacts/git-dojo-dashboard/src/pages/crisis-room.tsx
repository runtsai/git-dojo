import { useListCrisisScenarios } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Siren, ChevronRight, Award, Flame } from "lucide-react";
import { useEffect } from "react";
import { crises } from "@/content/crises";

export function CrisisRoom() {
  const { data: scenarios, isLoading } = useListCrisisScenarios();

  useEffect(() => {
    document.title = "Crisis Room | Git Dojo";
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center flex-1 h-full min-h-[300px]">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin motion-reduce:animate-none"></div>
      </div>
    );
  }

  const byId = new Map(scenarios?.map((s) => [s.id, s]));
  const solvedCount = scenarios?.filter((s) => s.solved).length ?? 0;

  return (
    <div className="space-y-12 enter-slide-up max-w-7xl mx-auto">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold uppercase tracking-widest">
          <Siren className="w-4 h-4" /> Live disasters
        </div>
        <h1 className="text-4xl md:text-5xl heading-tight text-foreground">Crisis Room</h1>
        <p className="text-lg md:text-xl text-muted-foreground reading-text">
          The happy path teaches commands. Escaping a disaster teaches confidence. Each scenario drops a real
          practice repository into a genuinely broken state — you diagnose it in your terminal and fix it for
          real. The grader can't be fooled.
        </p>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          {solvedCount} of {crises.length} crises resolved
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {crises.map((crisis) => {
          const status = byId.get(crisis.id);
          const solved = status?.solved ?? false;
          const started = status?.hasPlayground ?? false;
          return (
            <Link
              key={crisis.id}
              href={`/crisis/${crisis.id}`}
              className="group interactive-card p-7 flex flex-col h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
            >
              <div className="flex justify-between items-start mb-5">
                <div className="text-xs font-bold text-destructive tracking-widest uppercase bg-destructive/10 px-2 py-1 rounded border border-destructive/20">
                  Crisis {crisis.number}
                </div>
                {solved ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                    <Award className="w-3.5 h-3.5" /> Resolved
                  </div>
                ) : started ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                    <Flame className="w-3.5 h-3.5" /> Live
                  </div>
                ) : null}
              </div>

              <h3 className="text-xl font-bold mb-3 text-foreground group-hover:text-primary transition-colors">
                {crisis.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{crisis.tagline}</p>

              <div className="mt-auto pt-8 flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-mono bg-black/60 shadow-inner border border-white/5 px-3 py-1.5 rounded text-xs text-foreground/80">
                  {crisis.id}
                </div>
                <div className="w-8 h-8 rounded-full bg-secondary text-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all group-active:scale-95 shadow-sm">
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
