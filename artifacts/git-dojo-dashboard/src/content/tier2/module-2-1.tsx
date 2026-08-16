import { useState } from "react";
import type { VisualModuleProps } from "@/types/visual-module";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, ChevronRight, AlertCircle, GitPullRequest, MessageSquare } from "lucide-react";
import {
  SimPrContainer,
  SimPrHeader,
  SimPrTabs,
  SimPrConversation,
} from "@/components/sim/sim-pr";
import { contractorPr, prConversation } from "./pr-data";

export function Module2_1({ onStepChange }: VisualModuleProps = {}) {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();

  const [answer, setAnswer] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(null);

  const handleNext = () => { const next = Math.min(step + 1, 5); setStep(next); onStepChange?.(next); window.scrollTo(0, 0); };
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
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
          setStep(6); onStepChange?.(6);
        }
      }
    );
  };

  const btnPrimary = "bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const btnBack = "text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded";

  return (
    <div className="max-w-4xl mx-auto space-y-8 enter-slide-up pb-20">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-all active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">What a pull request really is</h1>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-primary scale-150' : i < step ? 'bg-primary/50' : 'bg-white/10'}`} />
          ))}
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        {step === 1 && (
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The Proposal</div>
            <h2 className="text-3xl font-bold">Nothing merges itself</h2>
            <p className="text-muted-foreground reading-text text-lg">
              Your contractor, Ruth Osei, finished her work. But her commits are sitting on her own branch — a separate lane of history. She cannot move them into your <code className="text-primary">main</code> record on her own.
            </p>
            <p className="text-muted-foreground reading-text text-lg">
              So she opens a <strong className="text-foreground">pull request</strong>: a formal, public proposal that says "I request that my branch be pulled into yours." It is not a transfer. It is an <em>ask</em> — and it comes with a full conversation attached.
            </p>
            <div className="pt-6 flex justify-end">
              <button onClick={handleNext} className={btnPrimary}>Continue <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 md:p-12 space-y-6">
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

            <div className="pt-4 flex justify-between">
              <button onClick={handlePrev} className={btnBack}>Back</button>
              <button onClick={handleNext} className={btnPrimary}>Continue <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 md:p-12 space-y-6">
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
            <div className="pt-6 flex justify-between">
              <button onClick={handlePrev} className={btnBack}>Back</button>
              <button onClick={handleNext} className={btnPrimary}>Continue <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 4: The Trigger</div>
            <h2 className="text-3xl font-bold">When to reach for it</h2>
            <div className="bg-primary border border-primary-foreground/20 text-primary-foreground p-8 rounded-lg mt-8 text-xl font-bold leading-relaxed shadow-lg shadow-primary/20">
              "Any time work arrives from hands that aren't yours — a contractor, a teammate, even future-you on a side branch — it enters through a pull request, and you read it before it merges."
            </div>
            <div className="pt-10 flex justify-between">
              <button onClick={handlePrev} className={btnBack}>Back</button>
              <button onClick={handleNext} className={btnPrimary}>Begin the Reading Task <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="p-8 md:p-12 space-y-6">
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

            {showError && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="font-medium text-sm">{showError}</p>
              </div>
            )}

            <div className="pt-6 flex justify-between">
              <button onClick={handlePrev} className={btnBack}>Back</button>
              <button
                onClick={handleQuizSubmit}
                disabled={completeModule.isPending || !answer}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {completeModule.isPending ? "Grading..." : "Submit Answer"}
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="p-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-4xl font-extrabold text-foreground">Module Complete</h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              You know what a pull request is: a gated proposal with a paper trail. Next, you open the evidence — the Files changed tab.
            </p>
            <div className="pt-8 flex gap-4 justify-center">
              <Link href="/learn/2-2" className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(255,107,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Next: Files Changed
              </Link>
              <Link href="/" className="inline-flex items-center justify-center bg-secondary hover:bg-secondary/80 text-foreground font-bold px-8 py-4 rounded-lg transition-all active:scale-95 border border-white/5">
                Return to Ledger
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
