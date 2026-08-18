import { useState } from "react";
import type { VisualModuleProps } from "@/types/visual-module";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";

import { visualModuleSteps as _steps } from "../visual-module-steps";
export const TOTAL_STEPS = _steps["2.2"];
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

/**
 * Called by the completion mutation's onSuccess callback.
 *
 * Exported so it can be tested without rendering the component:
 * a test can pass a mock QueryClient and spy that invalidateQueries
 * was called with the correct progress key.
 *
 * Removing or changing the invalidateQueries call here would immediately
 * break the module-2-2-completion tests.
 */
export function handleModule22Success(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  setStep: (n: number) => void,
  onStepChange?: (n: number) => void,
): void {
  queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
  setStep(6);
  onStepChange?.(6);
}
import { CheckCircle2, Eye, KeyRound } from "lucide-react";
import {
  SimPrContainer,
  SimPrHeader,
  SimPrTabs,
  SimFilesChanged,
  type SimInlineComment,
} from "@/components/sim/sim-pr";
import { contractorPr, prFiles, dangerLines } from "./pr-data";
import { VisualModuleShell } from "@/components/visual-module-shell";

export function Module2_2({ onStepChange }: VisualModuleProps = {}) {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();

  const [comments, setComments] = useState<SimInlineComment[]>([]);
  const [showError, setShowError] = useState<string | null>(null);

  const commentedOn = (t: { file: string; lineIndex: number }) =>
    comments.some(c => c.file === t.file && c.lineIndex === t.lineIndex);
  const foundSecret = commentedOn(dangerLines.secret);
  const foundBehavior = commentedOn(dangerLines.behavior);

  const handleNext = () => { const next = Math.min(step + 1, TOTAL_STEPS); setStep(next); onStepChange?.(next); window.scrollTo(0, 0); };
  const handlePrev = () => { const prev = Math.max(step - 1, 1); setStep(prev); onStepChange?.(prev); window.scrollTo(0, 0); };

  const handleAddComment = (file: string, lineIndex: number, body: string) => {
    setComments(prev => [...prev, { file, lineIndex, body, author: "Adam Cornelius", initials: "AC" }]);
    setShowError(null);
  };

  const handleSubmit = () => {
    if (!foundSecret && !foundBehavior) {
      setShowError("Read config.txt line by line. Two of the added lines should stop this merge cold — tap or hover a line and press the + button to comment on it.");
      return;
    }
    if (!foundSecret) {
      setShowError("You caught one. There's still a line in config.txt that should never enter a repository — history is forever. Comment on it.");
      return;
    }
    if (!foundBehavior) {
      setShowError("You caught the credential. Now compare the removed line with the added one right below it — a behavior nobody authorized just flipped. Comment on it.");
      return;
    }
    setShowError(null);
    completeModule.mutate(
      { data: { moduleId: "2.2", track: "visual" } },
      {
        onSuccess: () => handleModule22Success(queryClient, setStep, onStepChange),
      }
    );
  };

  return (
    <VisualModuleShell
      title="Files changed: read every line"
      step={step}
      completionTitle="Module Complete"
      completionText="You caught a live credential and a silent behavior flip — the two classic merge-stoppers. Now you deliver the verdict."
      nextModuleHref="/learn/2-3"
      nextModuleLabel="Next: The Verdict"
      onPrev={step > 1 ? handlePrev : undefined}
      onNext={step < TOTAL_STEPS ? handleNext : undefined}
      nextLabel={step === 4 ? "Begin the Review Task" : "Continue"}
      onSubmit={step === TOTAL_STEPS ? handleSubmit : undefined}
      submitLabel="Submit Findings"
      isPending={completeModule.isPending}
      error={showError}
      moduleId="2.2"
    >
      {step === 1 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The Evidence</div>
          <h2 className="text-3xl font-bold">The tab that tells the truth</h2>
          <p className="text-muted-foreground reading-text text-lg">
            The Conversation tab is what people <em>say</em> about the work. The <strong className="text-foreground">Files changed</strong> tab is the work itself — every line added, every line removed, across every file in the proposal.
          </p>
          <p className="text-muted-foreground reading-text text-lg">
            Green lines with a <code className="text-emerald-400">+</code> are being added to your records. Red lines with a <code className="text-red-400">-</code> are being taken away. A review means reading all of them. Not skimming — reading.
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 2: The Interface</div>
          <h2 className="text-3xl font-bold">Inline comments</h2>
          <p className="text-muted-foreground reading-text text-lg max-w-2xl">
            Hover over any line of the diff and a <span className="inline-flex items-center justify-center w-5 h-5 bg-primary text-primary-foreground rounded-sm text-xs font-bold align-middle mx-1">+</span> button appears. Click it to attach a comment <em>to that exact line</em>. That's the difference between "something in the config worries me" and a pin stuck precisely in the problem.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
              <span className="text-primary font-bold mr-2">Anchored:</span> the comment stays welded to that line of that file, in the permanent record of the review.
            </div>
            <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
              <span className="text-primary font-bold mr-2">Actionable:</span> the contractor sees exactly which line you mean — no guessing, no back-and-forth.
            </div>
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
                <KeyRound className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">History Is Forever</h3>
                <p className="text-muted-foreground reading-text">
                  A password or API key that merges into the record stays in the record — even if someone deletes it in the next commit, it lives on in history. The Files changed tab is your last checkpoint before forever.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
              <div className="bg-blue-500/20 p-3 rounded-lg border border-blue-500/30">
                <Eye className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">Trust, but Read</h3>
                <p className="text-muted-foreground reading-text">
                  Most contractors are honest. Diffs don't care. The removed-and-added pair is where silent changes hide: a setting flipped, a limit raised, a promise quietly broken. You read the pair, every time.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 4: The Trigger</div>
          <h2 className="text-3xl font-bold">When to reach for it</h2>
          <div className="bg-primary border border-primary-foreground/20 text-primary-foreground p-8 rounded-lg mt-8 text-xl font-bold leading-relaxed shadow-lg shadow-primary/20">
            "Before any approval, on every pull request, no matter how much you trust the author: open Files changed and read until the last line. If a line worries you, pin a comment on it right there."
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 5: Prove It</div>
          <h2 className="text-3xl font-bold mb-2">Find what's wrong</h2>
          <p className="text-muted-foreground text-lg reading-text">
            Ruth's delivery is below. Two of the added lines should stop this merge cold. <strong className="text-foreground">Find both and leave an inline comment on each</strong> — tap or hover a line, press the <strong className="text-foreground">+</strong> button, say what you see.
          </p>

          <SimPrContainer>
            <SimPrHeader {...contractorPr} status="open" />
            <SimPrTabs active="files" conversationCount={2} filesCount={prFiles.length} />
            <SimFilesChanged
              files={prFiles}
              comments={comments}
              commentable
              onAddComment={handleAddComment}
            />
          </SimPrContainer>

          <div className="mt-6 bg-black/30 border border-white/5 p-6 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`flex items-center gap-3 p-3 rounded border transition-colors ${foundSecret ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/40 border-white/10 text-muted-foreground'}`}>
              <CheckCircle2 className={`w-5 h-5 ${foundSecret ? 'opacity-100' : 'opacity-20'}`} />
              <span className="font-medium text-sm">Flag the line that must never enter a repository</span>
            </div>
            <div className={`flex items-center gap-3 p-3 rounded border transition-colors ${foundBehavior ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/40 border-white/10 text-muted-foreground'}`}>
              <CheckCircle2 className={`w-5 h-5 ${foundBehavior ? 'opacity-100' : 'opacity-20'}`} />
              <span className="font-medium text-sm">Flag the unauthorized behavior change</span>
            </div>
          </div>
        </>
      )}
    </VisualModuleShell>
  );
}
