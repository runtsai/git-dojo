import { Link } from "wouter";
import { breakthroughs } from "@/content/breakthroughs";
import { Lightbulb, ArrowRight, ArrowLeft } from "lucide-react";
import { useEffect } from "react";

export function BreakthroughsIndex() {
  useEffect(() => {
    document.title = "Breakthroughs | Git Dojo";
  }, []);

  return (
    <div className="enter-slide-up max-w-7xl mx-auto space-y-8 sm:space-y-12">
      <div className="space-y-4">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-2 transition-all active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded w-max focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
        </Link>
        <h1 className="text-3xl sm:text-4xl md:text-5xl heading-tight text-foreground flex items-center gap-3 sm:gap-4">
          <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-[0_0_20px_rgba(255,107,0,0.15)] border border-primary/20">
            <Lightbulb className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          Breakthroughs
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground reading-text">
          These are not graded lessons. They are interactive playgrounds for {breakthroughs.length} of the most common Git misconceptions. 
          Play with them until the misconception visibly breaks.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {breakthroughs.map((b, i) => (
          <Link 
            key={b.id} 
            href={`/breakthroughs/${b.id}`}
            className="group interactive-card p-5 sm:p-6 relative overflow-hidden flex flex-col h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="absolute top-0 right-0 p-4 sm:p-6 text-7xl sm:text-9xl font-extrabold text-white/[0.02] group-hover:text-primary/[0.05] transition-colors leading-none select-none pointer-events-none -translate-y-2 sm:-translate-y-4 translate-x-2 sm:translate-x-4">
              {i + 1}
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 sm:mb-3 relative z-10 group-hover:text-primary transition-colors tracking-tight">{b.title}</h2>
            <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-4 sm:mb-6 relative z-10 flex-1 leading-relaxed">{b.hook}</p>
            
            <div className="flex items-center text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-widest relative z-10 mt-auto bg-black/30 w-max px-3 py-1.5 rounded border border-white/5 group-hover:border-white/10 group-hover:bg-black/50 shadow-inner">
              Explore <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
