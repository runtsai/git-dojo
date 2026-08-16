import { useParams, Link } from "wouter";
import { Module1_1 } from "@/content/tier1/module-1-1";
import { Module1_2 } from "@/content/tier1/module-1-2";
import { Module1_3 } from "@/content/tier1/module-1-3";
import { Module1_4 } from "@/content/tier1/module-1-4";
import { Module1_5 } from "@/content/tier1/module-1-5";
import { Module2_1 } from "@/content/tier2/module-2-1";
import { Module2_2 } from "@/content/tier2/module-2-2";
import { Module2_3 } from "@/content/tier2/module-2-3";
import { Module2_4 } from "@/content/tier2/module-2-4";
import { ArrowLeft, Construction, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { WarmUpInterstitial } from "@/components/warm-up-interstitial";
import { MapPeek } from "@/components/map-peek";
import type { VisualModuleProps } from "@/types/visual-module";
import { useGetProgress } from "@workspace/api-client-react";
import { isPrereqLocked } from "@/lib/prereq";
import { tiers } from "@/content/tiers";

export type { VisualModuleProps };

import { LEARN_ROUTE_KEYS } from "@/pages/learn-route-keys";

/**
 * The canonical route-key → component map for every learn page.
 *
 * LEARN_ROUTE_KEYS (imported from learn-route-keys.ts) is the side-effect-free
 * source of truth for which keys must exist here.  Tests assert against that
 * list without importing React components.  If a key is present in
 * LEARN_ROUTE_KEYS but missing from this map TypeScript will flag it.
 */
export const learnModules: Record<
  (typeof LEARN_ROUTE_KEYS)[number],
  React.ComponentType<VisualModuleProps>
> = {
  "1-1": Module1_1,
  "1-2": Module1_2,
  "1-3": Module1_3,
  "1-4": Module1_4,
  "1-5": Module1_5,
  "2-1": Module2_1,
  "2-2": Module2_2,
  "2-3": Module2_3,
  "2-4": Module2_4,
};

export function LearnModuleView() {
  const { moduleId: rawModuleId } = useParams<{ moduleId: string }>();
  // Tolerate legacy/alternate forms like "module-1-1" or "1.1"
  const moduleId = rawModuleId?.replace(/^module-/, "").replace(".", "-");

  // Track the learner's current step so MapPeek can narrow its highlight.
  const [currentStep, setCurrentStep] = useState(1);

  // Progress is needed to enforce prerequisites; keep polling so unlocks are
  // reflected without a page reload (React Query default staleTime handles this).
  const { data: progress } = useGetProgress();

  useEffect(() => {
    if (moduleId) {
      document.title = `Module ${moduleId} | Git Dojo`;
      // Reset step counter whenever the module changes.
      setCurrentStep(1);
    }
  }, [moduleId]);

  const modules: Record<string, React.ComponentType<VisualModuleProps> | undefined> = learnModules;
  const ModuleComponent = moduleId ? modules[moduleId] : undefined;
  if (ModuleComponent && moduleId) {
    // Check whether this module has an unmet prerequisite.
    const dotId = moduleId.replace("-", ".");
    const moduleDef = tiers
      .flatMap(t => t.modules ?? [])
      .find(m => m.id === dotId);
    const completedVisualModules = progress?.entries
      .filter(e => e.track === "visual")
      .map(e => e.moduleId) ?? [];
    const prereq = moduleDef?.prerequisite;
    const prereqUnmet = isPrereqLocked(prereq, completedVisualModules);

    if (prereqUnmet && prereq != null) {
      return (
        <div className="max-w-4xl mx-auto space-y-8 enter-slide-up">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-all active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
          </Link>

          <div className="surface-card p-12 text-center py-20">
            <div className="w-20 h-20 bg-secondary/50 border border-white/10 shadow-inner text-muted-foreground rounded-xl flex items-center justify-center mx-auto mb-8">
              <Lock className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-extrabold mb-4 text-foreground tracking-tight">Module Locked</h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto reading-text">
              Complete module {prereq} before starting this one.
            </p>
            <Link
              href={`/learn/${prereq.replace(".", "-")}`}
              className="inline-block bg-primary hover:bg-primary/80 text-primary-foreground font-bold px-8 py-3 rounded-lg transition-all active:scale-95 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary mr-4"
            >
              Go to Module {prereq}
            </Link>
            <Link
              href="/"
              className="inline-block bg-secondary hover:bg-secondary/80 text-foreground font-bold px-8 py-3 rounded-lg transition-all active:scale-95 border border-white/5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Return to Ledger
            </Link>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Optional warm-up offer — never gates the module below it */}
        <WarmUpInterstitial />
        <ModuleComponent onStepChange={setCurrentStep} />
        <MapPeek
          locationId={moduleId.replace("-", ".")}
          variant="floating"
          stepIndex={currentStep}
        />
      </>
    );
  }

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
