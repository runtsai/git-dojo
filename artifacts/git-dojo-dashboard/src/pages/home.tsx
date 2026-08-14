import { useGetDojoOverview, useListLessons } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Terminal, ChevronRight, BookOpen, GitCommit, LayoutGrid, CheckCircle2 } from "lucide-react";

export function Home() {
  const { data: overview, isLoading: overviewLoading } = useGetDojoOverview();
  const { data: lessons, isLoading: lessonsLoading } = useListLessons();

  if (overviewLoading || lessonsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!overview?.dojoFound) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-24 h-24 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm">
          <Terminal className="w-12 h-12" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Welcome to Git Dojo</h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          It looks like your training ground hasn't been created yet.
        </p>
        <div className="bg-card border-2 border-primary/20 rounded-2xl p-8 text-left shadow-sm mt-10">
          <p className="font-semibold text-lg mb-4 text-foreground">To begin your journey, open your terminal and run:</p>
          <div className="bg-foreground text-background font-mono p-5 rounded-xl flex items-center gap-4 text-lg">
            <span className="text-primary font-bold">$</span>
            <span>bash setup.sh</span>
          </div>
          <p className="text-muted-foreground mt-5 leading-relaxed">
            This script will scaffold the practice repositories you need for the lessons. Come back to this dashboard once it finishes!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-end bg-card border rounded-3xl p-8 shadow-sm">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">Training Overview</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">Your visual companion for mastering Git. Run commands in the terminal, and watch your changes appear here in real time.</p>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
          <div className="flex-1 lg:flex-none bg-background border rounded-2xl px-6 py-5 shadow-sm flex items-center gap-5 min-w-[160px]">
            <div className="p-3.5 bg-primary/10 text-primary rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{overview.startedLessons} / {overview.totalLessons}</div>
              <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-1">Lessons Started</div>
            </div>
          </div>
          
          <div className="flex-1 lg:flex-none bg-background border rounded-2xl px-6 py-5 shadow-sm flex items-center gap-5 min-w-[160px]">
            <div className="p-3.5 bg-secondary/10 text-secondary rounded-xl">
              <GitCommit className="w-6 h-6" />
            </div>
            <div>
              <div className="text-3xl font-extrabold text-foreground">{overview.totalCommits}</div>
              <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Commits</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-muted rounded-lg text-foreground">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Curriculum</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons?.map((lesson) => (
            <Link key={lesson.id} href={`/lesson/${lesson.id}`} className="group relative bg-card border rounded-3xl p-7 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex flex-col h-full active:scale-[0.98]">
              <div className="flex justify-between items-start mb-5">
                <div className="text-sm font-bold text-primary tracking-widest uppercase">Lesson {lesson.number}</div>
                {lesson.commitCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Started
                  </div>
                )}
              </div>
              
              <h3 className="text-2xl font-bold mb-4 text-foreground group-hover:text-primary transition-colors">{lesson.title}</h3>
              
              <div className="mt-auto pt-8 flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-mono bg-muted px-3 py-1.5 rounded-lg text-foreground/80">
                  <Terminal className="w-4 h-4 text-primary" />
                  {lesson.folderName}
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
