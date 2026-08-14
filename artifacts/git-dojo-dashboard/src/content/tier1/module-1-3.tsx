import { useState } from "react";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, ChevronRight, AlertCircle, History, Clock, FileDiff } from "lucide-react";
import { SimRepoContainer } from "@/components/sim/sim-repo";
import { SimCommitList, SimDiffView } from "@/components/sim/sim-commits";

export function Module1_3() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();
  
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(null);

  const handleNext = () => setStep(s => Math.min(s + 1, 5));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const handleQuizSubmit = () => {
    if (!selectedCommit) {
      setShowError("You need to click on a commit to read its diff first.");
      return;
    }
    if (selectedCommit !== "c2") {
      setShowError("That's the wrong commit. We're looking for the one where the pricing policy was changed.");
      return;
    }
    if (!quizAnswer) {
      setShowError("Please select the old rate from the multiple choice options.");
      return;
    }
    if (quizAnswer !== "150") {
      setShowError("Incorrect. Look closely at the red line in the diff for pricing-policy.md. That shows what the rate was before the change.");
      return;
    }

    setShowError(null);
    completeModule.mutate(
      { data: { moduleId: "1.3", track: "visual" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
          setStep(6);
        }
      }
    );
  };

  const commits = [
    { id: "c1", author: "Admin", message: "Merge pull request #42 from contractor", time: "2 hours ago", hash: "a1b2c3d" },
    { id: "c2", author: "John (Contractor)", message: "Update Q3 vendor pricing rates", time: "1 day ago", initials: "J", color: "bg-emerald-500/20 text-emerald-400", hash: "f8e7d6c" },
    { id: "c3", author: "Sarah (Operations)", message: "Revert mistaken policy deletion", time: "3 days ago", initials: "S", color: "bg-amber-500/20 text-amber-400", hash: "b2n3m4p" },
    { id: "c4", author: "Admin", message: "Add new employee onboarding checklist", time: "last week", hash: "x9y8z7w" },
  ];

  const diffForCommit2 = [
    {
      file: "pricing-policy.md",
      unchanged: [
        "## Vendor Rates",
        "",
        "The standard hourly rate for external tooling vendors is:"
      ],
      removed: [
        "Standard Rate: $150/hr"
      ],
      added: [
        "Standard Rate: $185/hr"
      ]
    },
    {
      file: "approved-vendors.csv",
      unchanged: [
        "Vendor,Contact,Status"
      ],
      removed: [],
      added: [
        "Apex Machining,sales@apex.com,Approved"
      ]
    }
  ];

  const Callout = ({ num }: { num: number }) => (
    <div className="absolute -left-3 -top-3 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10">{num}</div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-colors uppercase tracking-wider bg-black/40 border border-white/5 px-3 py-1.5 rounded">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Reading history visually</h1>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div 
              key={i} 
              className={`w-2 h-2 rounded-full transition-all ${
                i === step ? 'bg-primary scale-150' : i < step ? 'bg-primary/50' : 'bg-white/10'
              }`} 
            />
          ))}
        </div>
      </div>

      <div className="bg-card border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        {step === 1 && (
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The Timeline</div>
            <h2 className="text-3xl font-bold">The Custody Trail</h2>
            
            <p className="text-muted-foreground leading-relaxed text-lg">
              Every time someone saves a snapshot of their work, it gets added to the commit history. This history isn't just a log of dates — it is a permanent, sealed record of exactly who changed what.
            </p>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Because it tracks changes line-by-line, you can easily prove what a document looked like three months ago, or find out exactly when a mistake was introduced.
            </p>
            
            <div className="pt-6 flex justify-end">
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded flex items-center gap-2 transition-colors">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 2: The Interface</div>
            <h2 className="text-3xl font-bold">Spot the Difference</h2>
            <p className="text-muted-foreground leading-relaxed text-lg max-w-2xl">
              When you click on a commit in the history list, you see a "diff". A diff highlights what was removed in red and what was added in green.
            </p>

            <div className="mt-8 relative">
              <SimRepoContainer>
                <div className="p-6">
                  <div className="relative border border-white/10 p-4 rounded-lg bg-[#161b22] mb-6">
                    <Callout num={1} />
                    <div className="flex items-center gap-3 text-white mb-2">
                      <div className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">J</div>
                      <span className="font-bold">John (Contractor)</span>
                      <span className="text-white/40 text-sm ml-auto">1 day ago</span>
                    </div>
                    <p className="text-white/80 text-sm font-medium">Update Q3 vendor pricing rates</p>
                  </div>

                  <div className="relative">
                    <Callout num={2} />
                    <div className="border border-white/10 rounded overflow-hidden text-left bg-[#0d1117] opacity-80 pointer-events-none">
                      <div className="bg-[#161b22] p-3 border-b border-white/10 flex items-center gap-2 text-sm text-white/80 font-mono">
                        pricing-policy.md
                      </div>
                      <div className="font-mono text-sm leading-relaxed overflow-x-auto">
                        <div className="flex px-4 py-1 text-white/60 bg-white/5"><span className="w-8 pr-4"></span>The standard hourly rate is:</div>
                        <div className="relative">
                          <div className="absolute -left-3 top-1 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10">3</div>
                          <div className="flex px-4 py-1 bg-red-950/30 text-red-200"><span className="w-8 pr-4">-</span>Standard Rate: $150/hr</div>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-3 top-1 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10">4</div>
                          <div className="flex px-4 py-1 bg-emerald-950/30 text-emerald-200"><span className="w-8 pr-4">+</span>Standard Rate: $185/hr</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </SimRepoContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">1. The Commit:</span> Who made the change, when, and their summary of why.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">2. The Diff:</span> A side-by-side comparison of what changed in a specific file.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">3. Removed (-):</span> The old text that was deleted or replaced, marked in red.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">4. Added (+):</span> The new text that was added, marked in green.
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-colors">Back</button>
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded flex items-center gap-2 transition-colors">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 3: The Point</div>
            <h2 className="text-3xl font-bold">Accountability is built in</h2>
            
            <div className="space-y-6 mt-8">
              <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
                <div className="bg-emerald-500/20 p-3 rounded-lg border border-emerald-500/30">
                  <FileDiff className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">No silent overwrites</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    If someone alters a critical aerospace compliance policy, they can't just quietly save over the file. The diff proves exactly which lines they touched.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
                <div className="bg-blue-500/20 p-3 rounded-lg border border-blue-500/30">
                  <History className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">The Undo Button</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Because the entire history is stored as a series of diffs, you can always safely rewind a file back to a previous state if a mistake was made.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-colors">Back</button>
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded flex items-center gap-2 transition-colors">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 4: The Trigger</div>
            <h2 className="text-3xl font-bold">When to reach for it</h2>
            
            <div className="bg-primary border border-primary-foreground/20 text-primary-foreground p-8 rounded-lg mt-8 text-xl font-bold leading-relaxed shadow-lg shadow-primary/20">
              "You reach for the commit history when something breaks, and you need to answer: 'Who touched this file last, and what exactly did they change?'"
            </div>

            <div className="pt-10 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-colors">Back</button>
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded flex items-center gap-2 transition-colors">
                Begin Hands-On Task <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="p-8 md:p-12 space-y-6 relative">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 5: Prove It</div>
            <h2 className="text-3xl font-bold mb-2">Audit the Invoice</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl">
              A vendor just sent an invoice with a $185 hourly rate. You remember it being lower.
              Find the commit that changed the pricing policy and identify what the old rate was.
            </p>

            <div className="mt-8">
              <SimRepoContainer>
                <div className="p-6">
                  {selectedCommit ? (
                    <SimDiffView 
                      commit={commits.find(c => c.id === selectedCommit)!} 
                      diffs={selectedCommit === "c2" ? diffForCommit2 : [
                        { file: "some-other-file.txt", unchanged: ["Content"], removed: [], added: ["New content"] }
                      ]}
                      onBack={() => setSelectedCommit(null)}
                    />
                  ) : (
                    <SimCommitList 
                      commits={commits} 
                      onCommitClick={setSelectedCommit}
                    />
                  )}
                </div>
              </SimRepoContainer>
            </div>

            <div className="mt-8 bg-black/30 border border-white/5 p-6 rounded-lg">
              <h3 className="font-bold text-foreground mb-4">Based on the diff in the history, what was the standard vendor rate before it was changed?</h3>
              <div className="space-y-3">
                {['120', '150', '185'].map((rate) => (
                  <label key={rate} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${quizAnswer === rate ? 'bg-primary/10 border-primary' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                    <input type="radio" name="quiz" value={rate} checked={quizAnswer === rate} onChange={(e) => setQuizAnswer(e.target.value)} className="accent-primary" />
                    <span>${rate}/hr</span>
                  </label>
                ))}
              </div>
            </div>

            {showError && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="font-medium text-sm">{showError}</p>
              </div>
            )}

            <div className="pt-6 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-colors">Back</button>
              <button 
                onClick={handleQuizSubmit}
                disabled={completeModule.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded flex items-center gap-2 transition-colors disabled:opacity-70"
              >
                {completeModule.isPending ? "Grading..." : "Submit Answer"}
              </button>
            </div>
            
            <p className="text-xs text-muted-foreground/60 text-center mt-6">
              To learn how to read this history in your terminal using <code>git log</code>, try the Command Test Center — Lesson 2. Optional, always.
            </p>
          </div>
        )}

        {step === 6 && (
          <div className="p-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-4xl font-extrabold text-foreground">Module Passed!</h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              You can now audit your company's records. You know how to find the exact moment a file changed and read the diff to see what was replaced.
            </p>
            <div className="pt-8 flex gap-4 justify-center">
              <Link href="/" className="inline-flex items-center justify-center bg-secondary hover:bg-secondary/80 text-foreground font-bold px-8 py-4 rounded-lg transition-colors border border-white/5">
                Return to Ledger
              </Link>
              <Link href="/learn/1-4" className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-lg transition-colors shadow-lg shadow-primary/20">
                Next: Repo Settings &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
