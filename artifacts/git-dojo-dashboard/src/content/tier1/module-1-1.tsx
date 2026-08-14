import { useState } from "react";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  ArrowLeft, CheckCircle2, ChevronRight, FileText, 
  GitCommit, Clock, AlertCircle, Building2, User,
  GitBranch,
  ShieldAlert,
  Terminal
} from "lucide-react";

export function Module1_1() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();
  
  // Interactive state for Step 5
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(null);

  const handleNext = () => setStep(s => Math.min(s + 1, 5));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const handleQuizSubmit = () => {
    if (!historyOpen) {
      setShowError("You need to click the commit count (42 Commits) first to open the history.");
      return;
    }
    if (!selectedCommit) {
      setShowError("You need to click on a commit in the history view to see who changed what.");
      return;
    }
    if (selectedCommit !== "commit-2") {
      setShowError("That's the wrong commit. We're looking for the one where the contractor updated the handbook.");
      return;
    }
    if (!quizAnswer) {
      setShowError("Please select an answer to the question.");
      return;
    }
    if (quizAnswer !== "history") {
      setShowError("Not quite. The history view is the sealed record of exactly who changed what and when.");
      return;
    }

    // All correct!
    setShowError(null);
    completeModule.mutate(
      { data: { moduleId: "1.1", track: "visual" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
          setStep(6); // Success screen
        }
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-colors uppercase tracking-wider bg-black/40 border border-white/5 px-3 py-1.5 rounded">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">What GitHub actually is</h1>
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
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The Difference</div>
            <h2 className="text-3xl font-bold">Git vs GitHub</h2>
            
            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <div className="bg-black/40 border border-white/5 p-6 rounded-lg">
                <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                  <Terminal className="w-5 h-5" /> Git
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Git is the invisible tool living <strong>on your computer</strong>. It runs in the terminal (like you saw in the Command Test Center) and locally tracks the sealed record of changes you make to your files.
                </p>
              </div>
              
              <div className="bg-primary/5 border border-primary/20 p-6 rounded-lg">
                <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" /> GitHub
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  GitHub is a <strong>website</strong> that hosts a copy of that tracked history in the cloud. It adds a visual, social layer on top so a second person can look at the exact same CURRENT TRUTH you have.
                </p>
              </div>
            </div>
            
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
            <h2 className="text-3xl font-bold">The Visual Record</h2>
            <p className="text-muted-foreground leading-relaxed text-lg max-w-2xl">
              This is the same information <code>git log</code> and <code>git status</code> showed you in the terminal, drawn instead of typed. Let's look at a fictional repository for your company's records.
            </p>

            <div className="mt-8 border-2 border-white/10 rounded-lg overflow-hidden bg-[#0d1117] font-sans relative">
              {/* Fake GitHub Repo UI */}
              <div className="bg-[#161b22] px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/80">
                  <span className="font-bold text-white">rts-records</span> <span className="text-white/40">/</span> <span className="font-bold text-white">company-handbook</span>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3 space-y-4">
                  <div className="flex justify-between items-center bg-[#161b22] border border-white/10 p-3 rounded">
                    <div className="flex items-center gap-2 relative">
                      <div className="absolute -left-3 -top-3 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10">1</div>
                      <span className="bg-[#21262d] text-white text-sm px-3 py-1 rounded border border-white/10 flex items-center gap-1.5 font-bold">
                        <GitBranch className="w-3.5 h-3.5" /> main
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/70 text-sm hover:text-primary transition-colors cursor-pointer relative">
                      <div className="absolute -right-3 -top-3 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10">2</div>
                      <GitCommit className="w-4 h-4" /> <span className="font-bold">42</span> Commits
                    </div>
                  </div>
                  
                  <div className="border border-white/10 rounded relative">
                    <div className="absolute -left-3 top-2 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10">3</div>
                    <div className="bg-[#161b22] p-3 border-b border-white/10 flex items-center gap-3 text-sm">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">J</div>
                      <span className="font-bold text-white">John (Contractor)</span>
                      <span className="text-white/60">Updated safety protocols for Q3</span>
                      <span className="text-white/40 ml-auto">2 days ago</span>
                    </div>
                    <div className="bg-[#0d1117] text-white/80 text-sm">
                      <div className="grid grid-cols-12 py-2 px-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                        <div className="col-span-3 flex items-center gap-2"><FileText className="w-4 h-4 text-white/40" /> handbook.md</div>
                        <div className="col-span-6 text-white/50 truncate">Update standard operating procedures</div>
                        <div className="col-span-3 text-right text-white/40">last month</div>
                      </div>
                      <div className="grid grid-cols-12 py-2 px-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                        <div className="col-span-3 flex items-center gap-2"><FileText className="w-4 h-4 text-white/40" /> safety-protocols.pdf</div>
                        <div className="col-span-6 text-white/50 truncate">Updated safety protocols for Q3</div>
                        <div className="col-span-3 text-right text-white/40">2 days ago</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-1 space-y-4">
                  <div className="border-b border-white/10 pb-4 relative">
                    <div className="absolute -right-3 -top-3 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10">4</div>
                    <h3 className="font-bold text-white mb-2">About</h3>
                    <p className="text-white/60 text-sm leading-relaxed">
                      The official company record for RTS.AI standard operating procedures and aerospace compliance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">1. Branch:</span> You are looking at the 'main' timeline—the CURRENT TRUTH.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">2. History:</span> Click this to see the full custody trail of exactly what changed when.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">3. File Tree:</span> The actual files, just like opening a folder on your Mac or PC.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">4. Description:</span> Context for anyone landing here for the first time.
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
            <h2 className="text-3xl font-bold">Why do we use this?</h2>
            
            <div className="space-y-6 mt-8">
              <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
                <div className="bg-emerald-500/20 p-3 rounded-lg border border-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">One True Copy</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    No more <code>handbook_FINAL_v3.docx</code> emailed back and forth. GitHub holds the single authoritative version of your company records. If it's not here, it's not official.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
                <div className="bg-blue-500/20 p-3 rounded-lg border border-blue-500/30">
                  <Clock className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">The Custody Trail</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Because Git forces a sealed record for every change, you can click on any line of any document and see exactly who typed it, when, and what the justification was.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
                <div className="bg-amber-500/20 p-3 rounded-lg border border-amber-500/30">
                  <ShieldAlert className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Safe Contractor Review</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    When a contractor updates your aerospace compliance documents, they don't overwrite your files directly. Their work arrives in a holding area (a Pull Request) for your review before it touches the real thing.
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
              "You reach for GitHub the day a second person needs to see or change your files — or the day you need to prove what a file said last March."
            </div>
            
            <p className="text-muted-foreground text-lg mt-6 leading-relaxed">
              If it's just you, making quick scripts on your laptop, Git in the terminal is enough. 
              The moment you hire a contractor, share a manual with an employee, or prepare for an audit, you need GitHub.
            </p>

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
            <h2 className="text-3xl font-bold mb-2">Trace the Record</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl">
              A contractor named John claims he already updated the safety protocols. 
              Prove it by finding his commit in the history.
            </p>

            <div className="bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden font-sans shadow-xl">
              {/* Fake UI Header */}
              <div className="bg-[#161b22] px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white/80">
                  <span className="font-bold text-white">rts-records</span> <span className="text-white/40">/</span> <span className="font-bold text-white">company-handbook</span>
                </div>
              </div>
              
              <div className="p-6">
                {!historyOpen ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-[#161b22] border border-white/10 p-3 rounded">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#21262d] text-white text-sm px-3 py-1 rounded border border-white/10 flex items-center gap-1.5 font-bold">
                          <GitBranch className="w-3.5 h-3.5" /> main
                        </span>
                      </div>
                      <button 
                        onClick={() => setHistoryOpen(true)}
                        className="flex items-center gap-1.5 text-white text-sm hover:text-primary transition-colors cursor-pointer bg-white/5 hover:bg-primary/20 px-3 py-1.5 rounded border border-white/10 hover:border-primary/50 animate-pulse"
                      >
                        <Clock className="w-4 h-4" /> <span className="font-bold">42</span> Commits
                      </button>
                    </div>
                    
                    <div className="border border-white/10 rounded opacity-50 pointer-events-none">
                      <div className="bg-[#0d1117] text-white/80 text-sm p-8 text-center">
                        [File Tree Content]
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex items-center gap-3 mb-4 text-white">
                      <button onClick={() => setHistoryOpen(false)} className="text-white/50 hover:text-white"><ArrowLeft className="w-4 h-4" /></button>
                      <h3 className="font-bold text-lg">Commit History</h3>
                    </div>
                    
                    <div className="space-y-2 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                      {/* Commit 1 */}
                      <button 
                        onClick={() => setSelectedCommit("commit-1")}
                        className={`w-full text-left bg-[#161b22] border rounded-lg p-4 transition-all ${
                          selectedCommit === "commit-1" ? "border-primary shadow-[0_0_15px_rgba(255,107,0,0.2)]" : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <div className="flex items-center gap-3 text-white mb-2">
                          <User className="w-4 h-4 text-white/50" />
                          <span className="font-bold">Admin</span>
                          <span className="text-white/40 text-sm ml-auto">Just now</span>
                        </div>
                        <p className="text-white/80 text-sm font-medium">Merge pull request #14 from contractor</p>
                      </button>
                      
                      {/* Commit 2 (The Correct One) */}
                      <button 
                        onClick={() => setSelectedCommit("commit-2")}
                        className={`w-full text-left bg-[#161b22] border rounded-lg p-4 transition-all ${
                          selectedCommit === "commit-2" ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <div className="flex items-center gap-3 text-white mb-2">
                          <div className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">J</div>
                          <span className="font-bold">John (Contractor)</span>
                          <span className="text-white/40 text-sm ml-auto">2 days ago</span>
                        </div>
                        <p className="text-white/80 text-sm font-medium">Updated safety protocols for Q3</p>
                      </button>

                      {/* Commit 3 */}
                      <button 
                        onClick={() => setSelectedCommit("commit-3")}
                        className={`w-full text-left bg-[#161b22] border rounded-lg p-4 transition-all ${
                          selectedCommit === "commit-3" ? "border-primary shadow-[0_0_15px_rgba(255,107,0,0.2)]" : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <div className="flex items-center gap-3 text-white mb-2">
                          <User className="w-4 h-4 text-white/50" />
                          <span className="font-bold">Admin</span>
                          <span className="text-white/40 text-sm ml-auto">Last month</span>
                        </div>
                        <p className="text-white/80 text-sm font-medium">Update standard operating procedures</p>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 bg-black/30 border border-white/5 p-6 rounded-lg">
              <h3 className="font-bold text-foreground mb-4">Your contractor says the handbook is wrong. Where do you look to see who changed it and when?</h3>
              <div className="space-y-3">
                <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${quizAnswer === 'local' ? 'bg-primary/10 border-primary' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                  <input type="radio" name="quiz" value="local" checked={quizAnswer === 'local'} onChange={(e) => setQuizAnswer(e.target.value)} className="accent-primary" />
                  <span>The local files on my laptop.</span>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${quizAnswer === 'history' ? 'bg-primary/10 border-primary' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                  <input type="radio" name="quiz" value="history" checked={quizAnswer === 'history'} onChange={(e) => setQuizAnswer(e.target.value)} className="accent-primary" />
                  <span>The GitHub commit history view.</span>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${quizAnswer === 'ask' ? 'bg-primary/10 border-primary' : 'bg-black/40 border-white/10 hover:border-white/30'}`}>
                  <input type="radio" name="quiz" value="ask" checked={quizAnswer === 'ask'} onChange={(e) => setQuizAnswer(e.target.value)} className="accent-primary" />
                  <span>I just email the contractor and ask.</span>
                </label>
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
              The commands behind this screen live in the Command Test Center — Lesson 1 and 2, whenever you're curious. Optional, always.
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
              You've completed the first step of the visual track. You now understand what GitHub is, and where the sealed record lives.
            </p>
            <div className="pt-8">
              <Link href="/" className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-lg transition-colors shadow-lg shadow-primary/20">
                Return to Ledger
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
