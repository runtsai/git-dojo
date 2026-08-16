import { useState } from "react";
import type { VisualModuleProps } from "@/types/visual-module";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  ArrowLeft, CheckCircle2, ChevronRight, FileText, 
  GitCommit, Clock, AlertCircle, Building2, User,
  GitBranch,
  ShieldAlert,
  Terminal,
  Play
} from "lucide-react";

export function Module1_1({ onStepChange }: VisualModuleProps = {}) {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();
  
  // Interactive state for Step 5
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(null);

  const handleNext = () => {
    const next = Math.min(step + 1, 5);
    setStep(next);
    onStepChange?.(next);
    window.scrollTo(0, 0);
  };
  const handlePrev = () => {
    const prev = Math.max(step - 1, 1);
    setStep(prev);
    onStepChange?.(prev);
    window.scrollTo(0, 0);
  };

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
          setStep(6); onStepChange?.(6); // Success screen
        }
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 enter-slide-up">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-all active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

      <div className="surface-card overflow-hidden">
        {step === 1 && (
          <div className="p-8 md:p-12 space-y-6 enter-fade">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The Difference</div>
            <h2 className="text-3xl font-bold tracking-tight">Git vs GitHub</h2>
            
            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <div className="bg-black/40 border border-white/5 p-6 rounded-xl shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
                <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
                  <Terminal className="w-5 h-5" /> Git
                </h3>
                <p className="text-muted-foreground reading-text">
                  Git is the invisible tool living <strong>on your computer</strong>. It runs in the terminal (like you saw in the Command Test Center) and locally tracks the sealed record of changes you make to your files.
                </p>
              </div>
              
              <div className="bg-primary/5 border border-primary/20 p-6 rounded-xl relative overflow-hidden shadow-sm">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/80"></div>
                <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" /> GitHub
                </h3>
                <p className="text-muted-foreground reading-text">
                  GitHub is a <strong>website</strong> that hosts a copy of that tracked history in the cloud. It adds a visual, social layer on top so a second person can look at the exact same CURRENT TRUTH you have.
                </p>
              </div>
            </div>
            
            <div className="pt-8 flex justify-end">
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 md:p-12 space-y-6 enter-fade">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 2: The Interface</div>
            <h2 className="text-3xl font-bold tracking-tight">The Visual Record</h2>
            <p className="text-muted-foreground reading-text text-lg">
              This is the same information <code>git log</code> and <code>git status</code> showed you in the terminal, drawn instead of typed. Let's look at a fictional repository for your company's records.
            </p>

            <div className="mt-8 sim-window">
              <div className="sim-chrome">
                <div className="sim-chrome-dots">
                  <div className="close"></div>
                  <div className="min"></div>
                  <div className="max"></div>
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm ml-2">
                  <span className="font-bold text-white">rts-records</span> <span className="text-muted-foreground">/</span> <span className="font-bold text-white">company-handbook</span>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 bg-[#0d1117]">
                <div className="md:col-span-3 space-y-4">
                  <div className="flex justify-between items-center bg-[#161b22] border border-white/10 p-3 rounded-lg shadow-inner">
                    <div className="flex items-center gap-2 relative">
                      <div className="absolute -left-3 -top-3 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10 ">1</div>
                      <span className="bg-[#21262d] text-white text-sm px-3 py-1.5 rounded border border-white/10 flex items-center gap-1.5 font-bold">
                        <GitBranch className="w-3.5 h-3.5 text-white/70" /> main
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/70 text-sm hover:text-primary transition-colors cursor-pointer relative bg-white/5 hover:bg-primary/20 px-3 py-1.5 rounded border border-white/10 hover:border-primary/50">
                      <div className="absolute -right-3 -top-3 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10 " style={{animationDelay: '100ms'}}>2</div>
                      <GitCommit className="w-4 h-4" /> <span className="font-bold">42</span> Commits
                    </div>
                  </div>
                  
                  <div className="border border-white/10 rounded-lg relative overflow-hidden">
                    <div className="absolute -left-3 top-2 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10 " style={{animationDelay: '200ms'}}>3</div>
                    <div className="bg-[#161b22] p-3 border-b border-white/10 flex items-center gap-3 text-sm">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shadow-inner">J</div>
                      <span className="font-bold text-white">John (Contractor)</span>
                      <span className="text-muted-foreground hidden sm:inline">Updated safety protocols for Q3</span>
                      <span className="text-muted-foreground ml-auto">2 days ago</span>
                    </div>
                    <div className="bg-[#0d1117] text-white/80 text-sm">
                      <div className="grid grid-cols-12 py-2.5 px-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                        <div className="col-span-12 sm:col-span-4 flex items-center gap-2 font-medium"><FileText className="w-4 h-4 text-muted-foreground" /> handbook.md</div>
                        <div className="col-span-12 sm:col-span-5 text-muted-foreground truncate pl-6 sm:pl-0 mt-1 sm:mt-0">Update standard operating procedures</div>
                        <div className="col-span-12 sm:col-span-3 text-left sm:text-right text-muted-foreground pl-6 sm:pl-0 mt-1 sm:mt-0">last month</div>
                      </div>
                      <div className="grid grid-cols-12 py-2.5 px-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                        <div className="col-span-12 sm:col-span-4 flex items-center gap-2 font-medium"><FileText className="w-4 h-4 text-muted-foreground" /> safety-protocols.pdf</div>
                        <div className="col-span-12 sm:col-span-5 text-muted-foreground truncate pl-6 sm:pl-0 mt-1 sm:mt-0">Updated safety protocols for Q3</div>
                        <div className="col-span-12 sm:col-span-3 text-left sm:text-right text-muted-foreground pl-6 sm:pl-0 mt-1 sm:mt-0">2 days ago</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="md:col-span-1 space-y-4">
                  <div className="border-b border-white/10 pb-4 relative">
                    <div className="absolute -right-3 -top-3 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10 " style={{animationDelay: '300ms'}}>4</div>
                    <h3 className="font-bold text-white mb-2">About</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      The official company record for RTS.AI standard operating procedures and aerospace compliance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-sm shadow-inner flex gap-3">
                <div className="w-6 h-6 shrink-0 bg-primary/20 text-primary font-bold rounded-full flex items-center justify-center text-xs mt-0.5">1</div>
                <div><span className="text-primary font-bold">Branch:</span> You are looking at the 'main' timeline—the CURRENT TRUTH.</div>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-sm shadow-inner flex gap-3">
                <div className="w-6 h-6 shrink-0 bg-primary/20 text-primary font-bold rounded-full flex items-center justify-center text-xs mt-0.5">2</div>
                <div><span className="text-primary font-bold">History:</span> Click this to see the full custody trail of exactly what changed when.</div>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-sm shadow-inner flex gap-3">
                <div className="w-6 h-6 shrink-0 bg-primary/20 text-primary font-bold rounded-full flex items-center justify-center text-xs mt-0.5">3</div>
                <div><span className="text-primary font-bold">File Tree:</span> The actual files, just like opening a folder on your Mac or PC.</div>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-sm shadow-inner flex gap-3">
                <div className="w-6 h-6 shrink-0 bg-primary/20 text-primary font-bold rounded-full flex items-center justify-center text-xs mt-0.5">4</div>
                <div><span className="text-primary font-bold">Description:</span> Context for anyone landing here for the first time.</div>
              </div>
            </div>

            <div className="pt-8 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">Back</button>
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 md:p-12 space-y-6 enter-fade">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 3: The Point</div>
            <h2 className="text-3xl font-bold tracking-tight">Why do we use this?</h2>
            
            <div className="space-y-6 mt-8">
              <div className="flex gap-5 items-start bg-black/40 p-6 rounded-xl border border-white/5 shadow-inner">
                <div className="bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-500/20 shadow-sm shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">One True Copy</h3>
                  <p className="text-muted-foreground reading-text">
                    No more <code>handbook_FINAL_v3.docx</code> emailed back and forth. GitHub holds the single authoritative version of your company records. If it's not here, it's not official.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-5 items-start bg-black/40 p-6 rounded-xl border border-white/5 shadow-inner">
                <div className="bg-blue-500/10 p-3.5 rounded-xl border border-blue-500/20 shadow-sm shrink-0">
                  <Clock className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">The Custody Trail</h3>
                  <p className="text-muted-foreground reading-text">
                    Because Git forces a sealed record for every change, you can click on any line of any document and see exactly who typed it, when, and what the justification was.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-5 items-start bg-black/40 p-6 rounded-xl border border-white/5 shadow-inner">
                <div className="bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20 shadow-sm shrink-0">
                  <ShieldAlert className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Safe Contractor Review</h3>
                  <p className="text-muted-foreground reading-text">
                    When a contractor updates your aerospace compliance documents, they don't overwrite your files directly. Their work arrives in a holding area (a Pull Request) for your review before it touches the real thing.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-8 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">Back</button>
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-8 md:p-12 space-y-6 enter-fade">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 4: The Trigger</div>
            <h2 className="text-3xl font-bold tracking-tight">When to reach for it</h2>
            
            <blockquote className="pull-quote">
              "You reach for GitHub the day a second person needs to see or change your files — or the day you need to prove what a file said last March."
            </blockquote>
            
            <p className="text-muted-foreground text-lg mt-6 reading-text">
              If it's just you, making quick scripts on your laptop, Git in the terminal is enough. 
              The moment you hire a contractor, share a manual with an employee, or prepare for an audit, you need GitHub.
            </p>

            <div className="pt-10 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">Back</button>
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Begin Hands-On Task <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="p-8 md:p-12 space-y-6 relative enter-fade">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 5: Prove It</div>
            <h2 className="text-3xl font-bold mb-2 tracking-tight">Trace the Record</h2>
            <p className="text-muted-foreground text-lg mb-8 reading-text">
              A contractor named John claims he already updated the safety protocols. 
              Prove it by finding his commit in the history.
            </p>

            <div className="sim-window">
              <div className="sim-chrome">
                <div className="sim-chrome-dots">
                  <div className="close"></div>
                  <div className="min"></div>
                  <div className="max"></div>
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm ml-2">
                  <span className="font-bold text-white">rts-records</span> <span className="text-muted-foreground">/</span> <span className="font-bold text-white">company-handbook</span>
                </div>
              </div>
              
              <div className="p-6">
                {!historyOpen ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-[#161b22] border border-white/10 p-3 rounded-lg shadow-inner">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#21262d] text-white text-sm px-3 py-1.5 rounded border border-white/10 flex items-center gap-1.5 font-bold">
                          <GitBranch className="w-3.5 h-3.5 text-white/70" /> main
                        </span>
                      </div>
                      <button 
                        onClick={() => setHistoryOpen(true)}
                        className="flex items-center gap-1.5 text-white text-sm hover:text-primary transition-all active:scale-95 cursor-pointer bg-white/5 hover:bg-primary/20 px-3 py-1.5 rounded border border-white/10 hover:border-primary/50  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Clock className="w-4 h-4" /> <span className="font-bold">42</span> Commits
                      </button>
                    </div>
                    
                    <div className="border border-white/10 rounded-lg opacity-50 pointer-events-none">
                      <div className="bg-[#0d1117] text-white/80 text-sm p-8 text-center border-b border-white/5">
                        [File Tree Content]
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 enter-fade">
                    <div className="flex items-center gap-3 mb-4 text-white">
                      <button onClick={() => setHistoryOpen(false)} className="text-muted-foreground hover:text-white transition-colors p-1 rounded hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft className="w-4 h-4" /></button>
                      <h3 className="font-bold text-lg tracking-tight">Commit History</h3>
                    </div>
                    
                    <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[1.4rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                      {/* Commit 1 */}
                      <button 
                        onClick={() => setSelectedCommit("commit-1")}
                        className={`w-full text-left bg-[#161b22] border rounded-xl p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative z-10 ${
                          selectedCommit === "commit-1" ? "border-primary shadow-[0_0_15px_rgba(255,107,0,0.2)] bg-primary/5" : "border-white/10 hover:border-white/30 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3 text-white mb-2">
                          <div className="w-6 h-6 rounded-full bg-white/10 text-white/70 flex items-center justify-center"><User className="w-3.5 h-3.5" /></div>
                          <span className="font-bold">Admin</span>
                          <span className="text-muted-foreground text-sm ml-auto">Just now</span>
                        </div>
                        <p className="text-white/80 text-sm font-medium pl-9">Merge pull request #14 from contractor</p>
                      </button>
                      
                      {/* Commit 2 (The Correct One) */}
                      <button 
                        onClick={() => setSelectedCommit("commit-2")}
                        className={`w-full text-left bg-[#161b22] border rounded-xl p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative z-10 ${
                          selectedCommit === "commit-2" ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] bg-emerald-500/5" : "border-white/10 hover:border-white/30 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3 text-white mb-2">
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">J</div>
                          <span className="font-bold">John (Contractor)</span>
                          <span className="text-muted-foreground text-sm ml-auto">2 days ago</span>
                        </div>
                        <p className="text-white/80 text-sm font-medium pl-9">Updated safety protocols for Q3</p>
                      </button>

                      {/* Commit 3 */}
                      <button 
                        onClick={() => setSelectedCommit("commit-3")}
                        className={`w-full text-left bg-[#161b22] border rounded-xl p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary relative z-10 ${
                          selectedCommit === "commit-3" ? "border-primary shadow-[0_0_15px_rgba(255,107,0,0.2)] bg-primary/5" : "border-white/10 hover:border-white/30 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3 text-white mb-2">
                          <div className="w-6 h-6 rounded-full bg-white/10 text-white/70 flex items-center justify-center"><User className="w-3.5 h-3.5" /></div>
                          <span className="font-bold">Admin</span>
                          <span className="text-muted-foreground text-sm ml-auto">Last month</span>
                        </div>
                        <p className="text-white/80 text-sm font-medium pl-9">Update standard operating procedures</p>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 bg-black/40 border border-white/5 p-6 rounded-xl shadow-inner">
              <h3 className="font-bold text-foreground mb-4">Your contractor says the handbook is wrong. Where do you look to see who changed it and when?</h3>
              <div className="space-y-3">
                <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${quizAnswer === 'local' ? 'bg-primary/10 border-primary shadow-sm' : 'bg-black/60 border-white/10 hover:border-white/30 hover:bg-white/5'}`}>
                  <input type="radio" name="quiz" value="local" checked={quizAnswer === 'local'} onChange={(e) => setQuizAnswer(e.target.value)} className="accent-primary w-4 h-4 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
                  <span className="font-medium">The local files on my laptop.</span>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${quizAnswer === 'history' ? 'bg-primary/10 border-primary shadow-sm' : 'bg-black/60 border-white/10 hover:border-white/30 hover:bg-white/5'}`}>
                  <input type="radio" name="quiz" value="history" checked={quizAnswer === 'history'} onChange={(e) => setQuizAnswer(e.target.value)} className="accent-primary w-4 h-4 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
                  <span className="font-medium">The GitHub commit history view.</span>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${quizAnswer === 'ask' ? 'bg-primary/10 border-primary shadow-sm' : 'bg-black/60 border-white/10 hover:border-white/30 hover:bg-white/5'}`}>
                  <input type="radio" name="quiz" value="ask" checked={quizAnswer === 'ask'} onChange={(e) => setQuizAnswer(e.target.value)} className="accent-primary w-4 h-4 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background" />
                  <span className="font-medium">I just email the contractor and ask.</span>
                </label>
              </div>
            </div>

            {showError && (
              <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-3 enter-fade">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="font-medium text-sm">{showError}</p>
              </div>
            )}

            <div className="pt-8 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">Back</button>
              <button 
                onClick={handleQuizSubmit}
                disabled={completeModule.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {completeModule.isPending ? "Grading..." : "Submit Answer"}
              </button>
            </div>
            
            <p className="text-xs text-muted-foreground/60 text-center mt-8 px-4">
              The commands behind this screen live in the Command Test Center — Lesson 1 and 2, whenever you're curious. Optional, always.
            </p>
          </div>
        )}

        {step === 6 && (
          <div className="p-12 text-center space-y-6 animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            
            <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-4xl font-extrabold text-foreground tracking-tight">Module Passed!</h2>
            <p className="text-lg text-muted-foreground reading-text mx-auto">
              You've completed the first step of the visual track. You now understand what GitHub is, and where the sealed record lives.
            </p>
            <div className="pt-8 relative z-10">
              <Link href="/" className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(255,107,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Return to Ledger
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
