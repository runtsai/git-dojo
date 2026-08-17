import { useState } from "react";
import type { VisualModuleProps } from "@/types/visual-module";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";

import { visualModuleSteps as _steps } from "../visual-module-steps";
export const TOTAL_STEPS = _steps["2.3"];
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

/**
 * Called by the completion mutation's onSuccess callback.
 *
 * Exported so it can be tested without rendering the component:
 * a test can pass a mock QueryClient and spy that invalidateQueries
 * was called with the correct progress key.
 *
 * Removing or changing the invalidateQueries call here would immediately
 * break the module-2-4-unlock tests.
 */
export function handleModule23Success(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  setStep: (n: number) => void,
  onStepChange?: (n: number) => void,
): void {
  queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
  setStep(6);
  onStepChange?.(6);
}

import { Scale, ShieldAlert } from "lucide-react";
import {
  SimPrContainer,
  SimPrHeader,
  SimPrTabs,
  SimFilesChanged,
  SimReviewPanel,
  type SimReviewDecision,
} from "@/components/sim/sim-pr";
import { contractorPr, prFiles, ownerGuidelines } from "./pr-data";
import { VisualModuleShell } from "@/components/visual-module-shell";

export function Module2_3({ onStepChange }: VisualModuleProps = {}) {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();

  const [decision, setDecision] = useState<SimReviewDecision | null>(null);
  const [summary, setSummary] = useState("");
  const [showError, setShowError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleNext = () => { const next = Math.min(step + 1, TOTAL_STEPS); setStep(next); onStepChange?.(next); window.scrollTo(0, 0); };
  const handlePrev = () => { const prev = Math.max(step - 1, 1); setStep(prev); onStepChange?.(prev); window.scrollTo(0, 0); };

  const handleSubmitReview = () => {
    if (!summary.trim()) {
      setShowError("Write a short summary for Ruth first. A verdict without words is a door slammed — say what you found and what must change.");
      return;
    }
    if (decision === "approve") {
      setShowError("Check the owner guidelines again. This delivery contains a live credential and an unauthorized behavior change — approving would seal both into the record forever.");
      return;
    }
    if (decision === "comment") {
      setShowError("Comments alone don't block the merge. When the work violates a safety guideline, the review must formally request changes so nothing merges until it's fixed.");
      return;
    }
    setShowError(null);
    setSubmitted(true);
    completeModule.mutate(
      { data: { moduleId: "2.3", track: "visual" } },
      {
        onSuccess: () => handleModule23Success(queryClient, setStep, onStepChange),
        onSettled: () => setSubmitted(false),
      }
    );
  };

  return (
    <VisualModuleShell
      title="The verdict: approve or block"
      step={step}
      completionTitle="Changes requested."
      completionText="You blocked the merge with a courteous, specific verdict. Ruth just pushed a fix — the story isn't over yet."
      nextModuleHref="/learn/2-4"
      nextModuleLabel="See Ruth's reply"
      onPrev={step > 1 ? handlePrev : undefined}
      onNext={step < TOTAL_STEPS ? handleNext : undefined}
      nextLabel={step === 4 ? "Deliver Your Verdict" : "Continue"}
      // Step 5: submit is inside SimReviewPanel – only expose Back in the shell nav
      error={showError}
    >
      {step === 1 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The Ruling</div>
          <h2 className="text-3xl font-bold">Reviews end in a decision</h2>
          <p className="text-muted-foreground reading-text text-lg">
            Reading the diff and leaving comments is the investigation. A review isn't finished until you deliver one of three formal verdicts: <strong className="text-foreground">Comment</strong> (feedback, no ruling), <strong className="text-foreground">Approve</strong> (safe to merge), or <strong className="text-foreground">Request changes</strong> (the merge is blocked until fixed).
          </p>
          <p className="text-muted-foreground reading-text text-lg">
            The verdict is recorded with your name on it. When records go wrong, "who approved this?" always has an answer.
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 2: The Guidelines</div>
          <h2 className="text-3xl font-bold">Your house rules</h2>
          <p className="text-muted-foreground reading-text text-lg max-w-2xl">
            Good owners don't review on vibes. They review against written guidelines, the same way every time:
          </p>
          <div className="space-y-3 mt-6">
            {ownerGuidelines.map((g, i) => (
              <div key={i} className="flex items-start gap-3 bg-black/40 p-4 rounded-lg border border-white/5">
                <span className="w-6 h-6 shrink-0 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <p className="text-sm text-foreground leading-relaxed">{g}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 3: The Point</div>
          <h2 className="text-3xl font-bold">Why it matters</h2>
          <div className="space-y-6 mt-8">
            <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
              <div className="bg-red-500/20 p-3 rounded-lg border border-red-500/30">
                <ShieldAlert className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">Request Changes Is Not Rude</h3>
                <p className="text-muted-foreground reading-text">
                  Blocking a merge protects the contractor too — nobody wants their name on the commit that leaked a key. A specific, courteous "fix these two lines and I'll approve" is the most professional message on GitHub.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
              <div className="bg-emerald-500/20 p-3 rounded-lg border border-emerald-500/30">
                <Scale className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">Approval Means You Own It</h3>
                <p className="text-muted-foreground reading-text">
                  Approve is not a courtesy button. It means "I read every line and I stake my name on this being safe." If you didn't read it, you don't approve it.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 4: The Trigger</div>
          <h2 className="text-3xl font-bold">When to reach for each verdict</h2>
          <div className="bg-primary border border-primary-foreground/20 text-primary-foreground p-8 rounded-lg mt-8 text-xl font-bold leading-relaxed shadow-lg shadow-primary/20">
            "Safe and scoped? Approve. Unsafe or unscoped — a secret, a silent change, anything a guideline forbids? Request changes, point at the exact lines, and stay kind. Style opinions alone? Just comment."
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 5: Prove It</div>
          <h2 className="text-3xl font-bold mb-2">Finish the review</h2>
          <p className="text-muted-foreground text-lg reading-text">
            You've read Ruth's diff — it's below for reference, with a live credential and an unauthorized config flip in it. Against your house rules, write her a short summary and choose the correct verdict.
          </p>

          <SimPrContainer>
            <SimPrHeader {...contractorPr} status="open" />
            <SimPrTabs active="files" conversationCount={2} filesCount={prFiles.length} />
            <SimFilesChanged files={prFiles} />
            <div className="p-4 md:p-5 pt-0">
              <SimReviewPanel
                decision={decision}
                onDecide={(d) => { setDecision(d); setShowError(null); }}
                summary={summary}
                onSummaryChange={(s) => { setSummary(s); setShowError(null); }}
                onSubmit={handleSubmitReview}
                submitting={submitted || completeModule.isPending}
              />
            </div>
          </SimPrContainer>
        </>
      )}
    </VisualModuleShell>
  );
}
