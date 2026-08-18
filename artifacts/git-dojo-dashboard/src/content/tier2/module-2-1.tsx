import { useState } from "react";
import type { VisualModuleProps } from "@/types/visual-module";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";

import { visualModuleSteps as _steps } from "../visual-module-steps";
export const TOTAL_STEPS = _steps["2.1"];
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

/**
 * Called by the completion mutation's onSuccess callback.
 *
 * Exported so it can be tested without rendering the component:
 * a test can pass a mock QueryClient and spy that invalidateQueries
 * was called with the correct progress key.
 *
 * Removing or changing the invalidateQueries call here would immediately
 * break the module-2-1-completion tests.
 */
export function handleModule21Success(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  setStep: (n: number) => void,
  onStepChange?: (n: number) => void,
): void {
  queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
  setStep(6);
  onStepChange?.(6);
}
import { GitPullRequest, MessageSquare } from "lucide-react";
import {
  SimPrContainer,
  SimPrHeader,
  SimPrTabs,
  SimPrConversation,
} from "@/components/sim/sim-pr";
import { contractorPr, prConversation } from "./pr-data";
import { VisualModuleShell } from "@/components/visual-module-shell";

export function Module2_1({ onStepChange }: VisualModuleProps = {}) {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();

  const [answer, setAnswer] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(null);

  const handleNext = () => { const next = Math.min(step + 1, TOTAL_STEPS); setStep(next); onStepChange?.(next); window.scrollTo(0, 0); };
  const handlePrev = () => { const prev = Math.max(step - 1, 1); setStep(prev); onStepChange?.(prev); window.scrollTo(0, 0); };

  const handleQuizSubmit = () => {
    if (answer !== "b") {
      setShowError(
        answer === "a"
          ? "Not quite. Nothing has been copied anywhere yet — a pull request is a proposal. The work stays on Ruth's branch until you decide."
          : "Not quite. Read the header line again: it says exactly which branch wants to move into which."
      );
      return;
    }
    setShowError(null);
    completeModule.mutate(
      { data: { moduleId: "2.1", track: "visual" } },
      {
        onSuccess: () => handleModule21Success(queryClient, setStep, onStepChange),
      }
    );
  };

  return (
    <VisualModuleShell
      title="What a pull request really is"
      step={step}
      completionTitle="Module Complete"
      completionText="You know what a pull request is: a gated proposal with a paper trail. Next, you open the evidence — the Files changed tab."
      nextModuleHref="/learn/2-2"
      nextModuleLabel="Next: Files Changed"
      onPrev={step > 1 ? handlePrev : undefined}
      onNext={step < TOTAL_STEPS ? handleNext : undefined}
      nextLabel={step === 4 ? "Begin the Reading Task" : "Continue"}
      onSubmit={step === TOTAL_STEPS ? handleQuizSubmit : undefined}
      submitLabel="Submit Answer"
      isPending={completeModule.isPending}
      isSubmitDisabled={step === 5 ? !answer : false}
      error={showError}
      moduleId="2.1"
    >
      {step === 1 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The Proposal</div>
          <h2 className="text-3xl font-bold">Nothing merges itself</h2>
          <p className="text-muted-foreground reading-text text-lg">
            Your contractor, Ruth Osei, finished her work. But her commits are sitting on her own branch — a separate lane of history. She cannot move them into your <code className="text-primary">main</code> record on her own.
          </p>
          <p className="text-muted-foreground reading-text text-lg">
            So she opens a <strong className="text-foreground">pull request</strong>: a formal, public proposal that says "I request that my branch be pulled into yours." It is not a transfer. It is an <em>ask</em> — and it comes with a full conversation attached.
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 2: The Interface</div>
          <h2 className="text-3xl font-bold">Anatomy of the request</h2>
          <p className="text-muted-foreground reading-text text-lg max-w-2xl">
            Every pull request screen has the same three landmarks. Read them top to bottom:
          </p>

          <SimPrContainer>
            <SimPrHeader {...contractorPr} status="open" />
            <SimPrTabs active="conversation" conversationCount={prConversation.length} filesCount={2} />
            <SimPrConversation comments={prConversation} />
          </SimPrContainer>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
              <span className="text-primary font-bold mr-2">1. The header:</span> who is asking, and exactly which branch wants to move into which.
            </div>
            <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
              <span className="text-primary font-bold mr-2">2. The tabs:</span> Conversation is the discussion. Files changed is the evidence.
            </div>
            <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
              <span className="text-primary font-bold mr-2">3. The timeline:</span> every comment, forever attached to this exact piece of work.
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
              <div className="bg-emerald-500/20 p-3 rounded-lg border border-emerald-500/30">
                <GitPullRequest className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">The Gate You Control</h3>
                <p className="text-muted-foreground reading-text">
                  A pull request turns "someone changed my records" into "someone asked to change my records." Nothing enters main until the owner has read it and said yes. That gate is the entire safety model of team GitHub.
                </p>
              </div>
            </div>
            <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
              <div className="bg-blue-500/20 p-3 rounded-lg border border-blue-500/30">
                <MessageSquare className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">The Paper Trail</h3>
                <p className="text-muted-foreground reading-text">
                  Every question, objection, and approval is recorded on the request itself. Six months later, "why did we change the config?" has an answer with names and dates on it — not a lost email thread.
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
            "Any time work arrives from hands that aren't yours — a contractor, a teammate, even future-you on a side branch — it enters through a pull request, and you read it before it merges."
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 5: Prove It</div>
          <h2 className="text-3xl font-bold mb-2">Read the request</h2>
          <p className="text-muted-foreground text-lg reading-text">
            Ruth's pull request is below. Read the header carefully, then answer: <strong className="text-foreground">what exactly is being proposed?</strong>
          </p>

          <SimPrContainer>
            <SimPrHeader {...contractorPr} status="open" />
            <SimPrTabs active="conversation" conversationCount={prConversation.length} filesCount={2} />
            <SimPrConversation comments={prConversation} />
          </SimPrContainer>

          <div className="space-y-3 mt-6">
            {[
              { id: "a", text: "Ruth's work has already been added to main; this page is just notifying you." },
              { id: "b", text: "Ruth is asking permission to merge her contractor-delivery branch into main — nothing moves until you decide." },
              { id: "c", text: "Ruth is asking you to send her the main branch so she can keep working." },
            ].map(o => (
              <label key={o.id} className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${answer === o.id ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/30 bg-black/30'}`}>
                <input type="radio" name="q21" checked={answer === o.id} onChange={() => { setAnswer(o.id); setShowError(null); }} className="mt-1 accent-[#ff6b00]" />
                <span className="text-sm text-foreground leading-relaxed">{o.text}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </VisualModuleShell>
  );
}
