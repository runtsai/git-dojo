import { useState } from "react";
import type { VisualModuleProps } from "@/types/visual-module";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, ChevronRight, AlertCircle, Eye, KeyRound } from "lucide-react";
import {
  SimPrContainer,
  SimPrHeader,
  SimPrTabs,
  SimFilesChanged,
  type SimInlineComment,
} from "@/components/sim/sim-pr";
import { contractorPr, prFiles, dangerLines } from "./pr-data";

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

  const handleNext = () => { const next = Math.min(step + 1, 5); setStep(next); onStepChange?.(next); window.scrollTo(0, 0); };
  const handlePrev = () => { const prev = Math.max(step - 1, 1); setStep(prev); onStepChange?.(prev); window.scrollTo(0, 0); };

  const handleAddComment = (file: string, lineIndex: number, body: string) => {
    setComments(prev => [...prev, { file, lineIndex, body, author: "Adam Cornelius", initials: "AC" }]);
    setShowError(null);
  };

  const handleSubmit = () => {
    if (!foundSecret && !foundBehavior) {
      setShowError("Read config.txt line by line. Two of the added lines should stop this merge cold — hover a line and press the plus button to comment on it.");
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
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Files changed: read every line</h1>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-primary scale-150' : i < step ? 'bg-primary/50' : 'bg-white/10'}`} />
          ))}
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        {step === 1 && (
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The Evidence</div>
            <h2 className="text-3xl font-bold">The tab that tells the truth</h2>
            <p className="text-muted-foreground reading-text text-lg">
              The Conversation tab is what people <em>say</em> about the work. The <strong className="text-foreground">Files changed</strong> tab is the work itself — every line added, every line removed, across every file in the proposal.
            </p>
            <p className="text-muted-foreground reading-text text-lg">
              Green lines with a <code className="text-emerald-400">+</code> are being added to your records. Red lines with a <code className="text-red-400">-</code> are being taken away. A review means reading all of them. Not skimming — reading.
            </p>
            <div className="pt-6 flex justify-end">
              <button onClick={handleNext} className={btnPrimary}>Continue <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 md:p-12 space-y-6">
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
              "Before any approval, on every pull request, no matter how much you trust the author: open Files changed and read until the last line. If a line worries you, pin a comment on it right there."
            </div>
            <div className="pt-10 flex justify-between">
              <button onClick={handlePrev} className={btnBack}>Back</button>
              <button onClick={handleNext} className={btnPrimary}>Begin the Review Task <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 5: Prove It</div>
            <h2 className="text-3xl font-bold mb-2">Find what's wrong</h2>
            <p className="text-muted-foreground text-lg reading-text">
              Ruth's delivery is below. Two of the added lines should stop this merge cold. <strong className="text-foreground">Find both and leave an inline comment on each</strong> — hover the line, press the plus, say what you see.
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

            {showError && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="font-medium text-sm">{showError}</p>
              </div>
            )}

            <div className="pt-6 flex justify-between">
              <button onClick={handlePrev} className={btnBack}>Back</button>
              <button
                onClick={handleSubmit}
                disabled={completeModule.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {completeModule.isPending ? "Grading..." : "Submit Findings"}
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
              You caught a live credential and a silent behavior flip — the two classic merge-stoppers. Now you deliver the verdict.
            </p>
            <div className="pt-8 flex gap-4 justify-center">
              <Link href="/learn/2-3" className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(255,107,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Next: The Verdict
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
