import { Link } from "wouter";
import { breakthroughs } from "@/content/breakthroughs";
import { Lightbulb, ArrowRight, ArrowLeft } from "lucide-react";

export function BreakthroughsIndex() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-8 sm:space-y-12">
      <div className="space-y-4">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-2 transition-colors uppercase tracking-wider bg-black/40 border border-white/5 px-3 py-1.5 rounded w-max">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
        </Link>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground flex items-center gap-3 sm:gap-4">
          <Lightbulb className="w-8 h-8 sm:w-10 sm:h-10 text-primary" /> Breakthroughs
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl leading-relaxed">
          These are not graded lessons. They are interactive playgrounds for the nine most common Git misconceptions. 
          Play with them until the misconception visibly breaks.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {breakthroughs.map((b, i) => (
          <Link 
            key={b.id} 
            href={`/breakthroughs/${b.id}`}
            className="group bg-card border border-white/10 hover:border-primary/50 rounded-xl p-5 sm:p-6 transition-all hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5 relative overflow-hidden flex flex-col h-full"
          >
            <div className="absolute top-0 right-0 p-4 sm:p-6 text-7xl sm:text-9xl font-extrabold text-white/[0.02] group-hover:text-primary/[0.05] transition-colors leading-none select-none pointer-events-none -translate-y-2 sm:-translate-y-4 translate-x-2 sm:translate-x-4">
              {i + 1}
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 sm:mb-3 relative z-10 group-hover:text-primary transition-colors">{b.title}</h2>
            <p className="text-muted-foreground text-xs sm:text-sm font-medium mb-4 sm:mb-6 relative z-10 flex-1 leading-relaxed">{b.hook}</p>
            
            <div className="flex items-center text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-widest relative z-10 mt-auto">
              Explore <ArrowRight className="w-3.5 h-3.5 ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
