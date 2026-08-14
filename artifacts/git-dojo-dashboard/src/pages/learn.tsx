import { useParams, Link } from "wouter";
import { Module1_1 } from "@/content/tier1/module-1-1";
import { Module1_2 } from "@/content/tier1/module-1-2";
import { Module1_3 } from "@/content/tier1/module-1-3";
import { Module1_4 } from "@/content/tier1/module-1-4";
import { Module1_5 } from "@/content/tier1/module-1-5";
import { ArrowLeft, Construction } from "lucide-react";

export function LearnModuleView() {
  const { moduleId } = useParams<{ moduleId: string }>();

  if (moduleId === "1-1") return <Module1_1 />;
  if (moduleId === "1-2") return <Module1_2 />;
  if (moduleId === "1-3") return <Module1_3 />;
  if (moduleId === "1-4") return <Module1_4 />;
  if (moduleId === "1-5") return <Module1_5 />;

  // Placeholder for others
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-colors uppercase tracking-wider bg-black/40 border border-white/5 px-3 py-1.5 rounded">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
      </Link>
      
      <div className="bg-card border border-white/10 rounded-xl p-12 text-center shadow-lg shadow-black/50">
        <div className="w-20 h-20 bg-secondary border border-white/10 text-muted-foreground rounded flex items-center justify-center mx-auto mb-6">
          <Construction className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold mb-4 text-foreground">Under Construction</h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
          Module {moduleId.replace('-', '.')} is scheduled for the next build phase.
        </p>
        <Link href="/" className="inline-block bg-secondary hover:bg-secondary/80 text-foreground font-bold px-6 py-3 rounded transition-colors border border-white/5">
          Return to Ledger
        </Link>
      </div>
    </div>
  );
}
