import { useGetDojoOverview, useListLessons } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Terminal, ChevronRight, BookOpen, GitCommit, LayoutGrid, CheckCircle2, ShieldAlert } from "lucide-react";
import { useEffect } from "react";

export function TestCenter() {
  const { data: overview, isLoading: overviewLoading } = useGetDojoOverview();
  const { data: lessons, isLoading: lessonsLoading } = useListLessons();

  useEffect(() => {
    document.title = "Test Center | Git Dojo";
  }, []);

  if (overviewLoading || lessonsLoading) {
    return (
      <div className="flex justify-center items-center flex-1 h-full min-h-[300px]">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!overview?.dojoFound) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center space-y-6 enter-slide-up">
        <div className="w-24 h-24 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(255,107,0,0.15)]">
          <Terminal className="w-12 h-12" />
        </div>
        <h1 className="text-4xl md:text-5xl heading-tight text-foreground">Command Test Center</h1>
        <p className="text-xl text-muted-foreground reading-text mx-auto">
          The practice arena hasn't been initialized yet.
        </p>
        <div className="surface-card p-8 text-left mt-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-primary shadow-[0_0_15px_rgba(255,107,0,0.5)]"></div>
          <p className="font-bold text-lg mb-4 text-foreground">To begin your journey, open your terminal and run:</p>
          <div className="bg-black/80 border border-white/10 font-mono p-5 rounded-lg flex items-center gap-4 text-lg shadow-inner">
            <span className="text-primary font-bold select-none">$</span>
            <span className="text-emerald-400">bash setup.sh</span>
          </div>
          <p className="text-muted-foreground mt-5 reading-text">
            This script will scaffold the sandbox repositories you need for the lessons. Come back to this dashboard once it finishes!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 enter-slide-up max-w-7xl mx-auto">
      
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl heading-tight text-foreground">Command Test Center</h1>
        <p className="text-lg md:text-xl text-muted-foreground reading-text">
          An optional practice arena. The real commands, in a sandbox that can't hurt anything. Run them in your terminal, and watch the results appear here.
        </p>
      </div>

      <section className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end surface-card p-8">
        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
          <div className="flex-1 lg:flex-none bg-black/40 border border-white/5 rounded-xl px-6 py-5 flex items-center gap-5 min-w-[200px] shadow-inner">
            <div className="p-3.5 bg-primary/10 text-primary rounded-xl border border-primary/20 shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{overview.startedLessons} <span className="text-xl text-muted-foreground font-normal">/ {overview.totalLessons}</span></div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Lessons Started</div>
            </div>
          </div>
          
          <div className="flex-1 lg:flex-none bg-black/40 border border-white/5 rounded-xl px-6 py-5 flex items-center gap-5 min-w-[200px] shadow-inner">
            <div className="p-3.5 bg-secondary text-secondary-foreground rounded-xl border border-white/10 shadow-sm">
              <GitCommit className="w-6 h-6" />
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{overview.totalCommits}</div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Commits</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-8">
          <Terminal className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Sandbox Missions</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons?.map((lesson) => (
            <Link key={lesson.id} href={`/test-center/${lesson.id}`} className="group interactive-card p-7 flex flex-col h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
              <div className="flex justify-between items-start mb-5">
                <div className="text-xs font-bold text-primary tracking-widest uppercase bg-primary/10 px-2 py-1 rounded border border-primary/20">
                  Mission {lesson.number}
                </div>
                {lesson.commitCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                  </div>
                )}
              </div>
              
              <h3 className="text-xl font-bold mb-4 text-foreground group-hover:text-primary transition-colors">{lesson.title}</h3>
              
              <div className="mt-auto pt-8 flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-mono bg-black/60 shadow-inner border border-white/5 px-3 py-1.5 rounded text-xs text-foreground/80">
                  {lesson.folderName}
                </div>
                <div className="w-8 h-8 rounded-full bg-secondary text-foreground flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all group-active:scale-95 shadow-sm">
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
