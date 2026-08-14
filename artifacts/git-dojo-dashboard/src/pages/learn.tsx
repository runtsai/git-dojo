import { useParams, Link } from "wouter";
import { Module1_1 } from "@/content/tier1/module-1-1";
import { Module1_2 } from "@/content/tier1/module-1-2";
import { Module1_3 } from "@/content/tier1/module-1-3";
import { Module1_4 } from "@/content/tier1/module-1-4";
import { Module1_5 } from "@/content/tier1/module-1-5";
import { ArrowLeft, Construction } from "lucide-react";
import { useEffect } from "react";

export function LearnModuleView() {
  const { moduleId } = useParams<{ moduleId: string }>();

  useEffect(() => {
    if (moduleId) {
      document.title = `Module ${moduleId} | Git Dojo`;
    }
  }, [moduleId]);

  if (moduleId === "1-1") return <Module1_1 />;
  if (moduleId === "1-2") return <Module1_2 />;
  if (moduleId === "1-3") return <Module1_3 />;
  if (moduleId === "1-4") return <Module1_4 />;
  if (moduleId === "1-5") return <Module1_5 />;

  // Placeholder for others
  return (
    <div className="max-w-4xl mx-auto space-y-8 enter-slide-up">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-all active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
      </Link>
      
      <div className="surface-card p-12 text-center py-20">
        <div className="w-20 h-20 bg-secondary/50 border border-white/10 shadow-inner text-muted-foreground rounded-xl flex items-center justify-center mx-auto mb-8">
          <Construction className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-extrabold mb-4 text-foreground tracking-tight">Under Construction</h2>
        <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto reading-text">
          Module {moduleId?.replace('-', '.')} is scheduled for the next build phase.
        </p>
        <Link href="/" className="inline-block bg-secondary hover:bg-secondary/80 text-foreground font-bold px-8 py-3 rounded-lg transition-all active:scale-95 border border-white/5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Return to Ledger
        </Link>
      </div>
    </div>
  );
}
