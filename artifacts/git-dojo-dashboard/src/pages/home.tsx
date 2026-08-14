import { useGetProgress, useListLessons } from "@workspace/api-client-react";
import { Link } from "wouter";
import { CheckCircle2, Lock, Terminal, Shield, Award, Trophy, Lightbulb } from "lucide-react";
import { tiers } from "@/content/tiers";

export function Home() {
  const { data: progress, isLoading: progressLoading } = useGetProgress();
  const { data: lessons, isLoading: lessonsLoading } = useListLessons();

  if (progressLoading || lessonsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const completedVisualModules = progress?.entries.filter(e => e.track === "visual").map(e => e.moduleId) || [];
  const completedCliLessons = progress?.entries.filter(e => e.track === "cli").map(e => e.moduleId) || [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-12">
      
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          The GitHub Mastery Path
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed">
          Learn how to trace, protect, and safely share the single source of truth for your company records. Two independent tracks. Zero gating.
        </p>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg shadow-primary/5">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" /> 
            Breakthroughs
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">
            Stuck on a concept? These nine interactive ideas are where Git usually clicks. Play with the toys until the misconception visibly breaks.
          </p>
        </div>
        <Link 
          href="/breakthroughs"
          className="bg-black/50 border border-white/10 hover:border-primary/50 text-foreground font-bold px-6 py-3 rounded-lg transition-colors whitespace-nowrap shadow-md hover:bg-secondary/50 flex-shrink-0"
        >
          Explore the Gallery
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Track A: Visual Mastery (Left side, takes 8 columns on desktop) */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <Shield className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Track A: The Main Course</h2>
          </div>
          
          <div className="space-y-6">
            {tiers.map((tier, idx) => {
              const isActive = tier.status === "active";
              
              const tierModules = tier.modules || [];
              const completedInTier = tierModules.filter(m => completedVisualModules.includes(m.id)).length;
              const isTierComplete = isActive && tierModules.length > 0 && completedInTier === tierModules.length;
              
              return (
                <div 
                  key={tier.id} 
                  className={`border rounded-xl p-6 md:p-8 transition-all ${
                    isActive 
                      ? isTierComplete
                        ? 'bg-[#161b22] border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)] relative overflow-hidden'
                        : 'bg-card border-white/10 shadow-lg shadow-black/50' 
                      : 'bg-background border-white/5 opacity-75 grayscale-[20%]'
                  }`}
                >
                  {isTierComplete && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
                  )}

                  <div className="flex items-start justify-between gap-4 mb-6 relative z-10">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <div className={`text-sm font-bold tracking-widest uppercase ${isTierComplete ? 'text-emerald-400' : 'text-primary'}`}>
                          Tier {idx + 1}
                        </div>
                        {isTierComplete && (
                          <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 border border-emerald-500/30">
                            <Trophy className="w-3 h-3" /> COMPLETED
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl font-bold text-foreground">{tier.title}</h3>
                      <p className="text-muted-foreground mt-2">{tier.description}</p>
                    </div>
                    {!isActive && (
                      <div className="bg-black/50 border border-white/10 text-muted-foreground px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5" /> Next Phase
                      </div>
                    )}
                  </div>
                  
                  {isActive && tier.modules && (
                    <div className="space-y-3 relative z-10">
                      {tier.modules.map(mod => {
                        const isCompleted = completedVisualModules.includes(mod.id);
                        return (
                          <Link 
                            key={mod.id} 
                            href={mod.path}
                            className={`group flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${
                              isCompleted 
                                ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/10'
                                : 'bg-black/40 border-white/5 hover:border-primary/50 hover:bg-secondary/50'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                isCompleted 
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                                  : 'bg-background border-muted-foreground/30 text-muted-foreground/50'
                              }`}>
                                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{mod.id}</span>}
                              </div>
                              <span className={`font-bold transition-colors ${
                                isCompleted ? 'text-white' : 'text-muted-foreground group-hover:text-primary'
                              }`}>
                                {mod.title}
                              </span>
                            </div>
                            <div className={`text-sm font-bold transition-colors ${
                              isCompleted ? 'text-emerald-500/70 group-hover:text-emerald-400' : 'text-muted-foreground group-hover:text-primary/80'
                            }`}>
                              {isCompleted ? 'Review' : 'Start'} &rarr;
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Track B: Command Test Center Badges (Right side, takes 4 columns) */}
        <div className="lg:col-span-4 space-y-8">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <Terminal className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Track B: Sandbox</h2>
          </div>
          
          <div className="bg-card border border-white/10 rounded-xl p-6 shadow-lg shadow-black/50">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-foreground">Command Test Center</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                The real commands in a sandbox that can't hurt anything. Complete lessons to earn badges.
              </p>
            </div>
            
            <div className="grid grid-cols-4 gap-3 mb-8">
              {lessons?.map((lesson, idx) => {
                const isEarned = completedCliLessons.includes(lesson.id);
                return (
                  <div 
                    key={lesson.id} 
                    title={lesson.title}
                    className={`aspect-square rounded-lg flex items-center justify-center border-2 transition-all ${
                      isEarned 
                        ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(255,107,0,0.2)]' 
                        : 'bg-black/50 border-white/5 text-white/10'
                    }`}
                  >
                    {isEarned ? <Award className="w-6 h-6" /> : <span className="font-mono text-xs font-bold">{idx + 1}</span>}
                  </div>
                );
              })}
              {/* Bonus Slot */}
              <div 
                title="Bonus Challenge"
                className="aspect-square rounded-lg flex items-center justify-center border-2 bg-black/50 border-white/5 text-white/10"
              >
                <Lock className="w-4 h-4" />
              </div>
            </div>
            
            <Link 
              href="/test-center"
              className="block w-full py-3 px-4 bg-secondary hover:bg-secondary/80 text-foreground text-center font-bold text-sm rounded-lg transition-colors border border-white/5"
            >
              Enter Test Center
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
