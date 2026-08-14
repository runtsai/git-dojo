import { useState } from "react";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, ChevronRight, AlertCircle, Compass, Home, BookOpen, Layers } from "lucide-react";
import { SimRepoContainer, SimRepoHeader, SimRepoPageLayout, SimRepoMain, SimRepoSidebar, SimRepoStats, SimFileTree, SimReadme, SimSidebarAbout } from "@/components/sim/sim-repo";

export function Module1_2() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();
  
  const [clickedReadme, setClickedReadme] = useState(false);
  const [clickedCommits, setClickedCommits] = useState(false);
  const [clickedBranch, setClickedBranch] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);

  const handleNext = () => { setStep(s => Math.min(s + 1, 5)); window.scrollTo(0, 0); };
  const handlePrev = () => { setStep(s => Math.max(s - 1, 1)); window.scrollTo(0, 0); };

  const handleQuizSubmit = () => {
    if (!clickedCommits || !clickedReadme || !clickedBranch) {
      setShowError("You haven't found all three items yet. Click around the simulated screen above to find the commit count, the file a stranger reads first, and the current branch.");
      return;
    }

    setShowError(null);
    completeModule.mutate(
      { data: { moduleId: "1.2", track: "visual" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
          setStep(6);
        }
      }
    );
  };

  const fakeFiles = [
    { name: "docs", message: "Update documentation folder", time: "3 days ago", isDir: true },
    { name: "handbook.md", message: "Update standard operating procedures", time: "last month" },
    { name: "onboarding.md", message: "Add new employee onboarding checklist", time: "2 months ago" },
    { name: "safety-protocols.pdf", message: "Updated safety protocols for Q3", time: "2 days ago" }
  ];

  const Callout = ({ num }: { num: number }) => (
    <div className="absolute -left-3 -top-3 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10">{num}</div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 enter-slide-up pb-20">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-all active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">The repository home screen</h1>
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
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The First Look</div>
            <h2 className="text-3xl font-bold">The Front Door</h2>
            
            <p className="text-muted-foreground reading-text text-lg">
              When a contractor or an employee opens your project on GitHub, they don't see a wall of code right away. They see the <strong>repository home screen</strong>.
            </p>
            <p className="text-muted-foreground reading-text text-lg">
              It is designed to give a stranger everything they need to understand what this project is, what state it's in, and where to find the files they need.
            </p>
            
            <div className="pt-6 flex justify-end">
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 2: The Interface</div>
            <h2 className="text-3xl font-bold">Reading the Room</h2>
            <p className="text-muted-foreground reading-text text-lg max-w-2xl">
              Let's look at the home screen for your company's records. It combines the file system you're used to with the context only a web page can provide.
            </p>

            <div className="mt-8">
              <SimRepoContainer>
                <SimRepoHeader />
                <SimRepoPageLayout>
                  <SimRepoMain>
                    <SimRepoStats 
                      branchCallout={<Callout num={1} />}
                      commitsCallout={<Callout num={2} />}
                    />
                    <SimFileTree 
                      files={fakeFiles}
                      topCallout={<Callout num={3} />}
                    />
                    <SimReadme 
                      content="<h1>Company Handbook</h1><p>Welcome to the RTS.AI operating manual. This repository contains the CURRENT TRUTH for all shop floor procedures.</p>" 
                      callout={<Callout num={4} />}
                    />
                  </SimRepoMain>
                  <SimRepoSidebar>
                    <SimSidebarAbout 
                      description="The official company record for RTS.AI standard operating procedures and aerospace compliance."
                      callout={<Callout num={5} />}
                    />
                  </SimRepoSidebar>
                </SimRepoPageLayout>
              </SimRepoContainer>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">1. Branch:</span> Shows which timeline you're viewing. Usually 'main'.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">2. Commits:</span> The running tally of every saved snapshot in history.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">3. File Tree:</span> The actual files and folders at this exact moment in time.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">4. README:</span> The introduction document, automatically rendered as a webpage.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm md:col-span-2">
                <span className="text-primary font-bold mr-2">5. About:</span> A quick summary of what this entire repository is for.
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">Back</button>
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-8 md:p-12 space-y-6">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 3: The Point</div>
            <h2 className="text-3xl font-bold">Why lay it out this way?</h2>
            
            <div className="space-y-6 mt-8">
              <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
                <div className="bg-emerald-500/20 p-3 rounded-lg border border-emerald-500/30">
                  <Compass className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Immediate Orientation</h3>
                  <p className="text-muted-foreground reading-text">
                    A new contractor doesn't have to ask you what files are important. The README file is automatically displayed front and center, acting as a welcome mat.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
                <div className="bg-blue-500/20 p-3 rounded-lg border border-blue-500/30">
                  <Layers className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Context Next to Content</h3>
                  <p className="text-muted-foreground reading-text">
                    You don't just see the file names; you see <em>who</em> last touched them, and <em>when</em>, right there in the file tree. The context lives directly next to the content.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">Back</button>
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
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
              "You reach for the repository home screen when you need a quick pulse-check: what is the current state of our files, and how active is this project right now?"
            </div>

            <div className="pt-10 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">Back</button>
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Begin Scavenger Hunt <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="p-8 md:p-12 space-y-6 relative">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 5: Prove It</div>
            <h2 className="text-3xl font-bold mb-2">Scavenger Hunt</h2>
            <p className="text-muted-foreground text-lg mb-8 reading-text">
              Find and click on these three things in the simulated screen below:
              <br/>1) The total commit count
              <br/>2) The file a stranger reads first (README)
              <br/>3) The current branch you are looking at
            </p>

            <div className="mt-8">
              <SimRepoContainer>
                <SimRepoHeader />
                <SimRepoPageLayout>
                  <SimRepoMain>
                    <div className="flex justify-between items-center bg-[#161b22] border border-white/10 p-3 rounded">
                      <button 
                        onClick={() => setClickedBranch(true)}
                        className={`bg-[#21262d] text-white text-sm px-3 py-1 rounded border flex items-center gap-1.5 font-bold hover:bg-white/10 cursor-pointer transition-all ${clickedBranch ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-white/10'}`}
                      >
                        main
                      </button>
                      <button 
                        onClick={() => setClickedCommits(true)}
                        className={`flex items-center gap-1.5 text-white/70 text-sm px-3 py-1.5 rounded border hover:bg-white/10 cursor-pointer transition-all ${clickedCommits ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] text-white' : 'border-white/10'}`}
                      >
                        <span className="font-bold">42</span> Commits
                      </button>
                    </div>
                    
                    <SimFileTree files={fakeFiles} />
                    
                    <div className="border border-white/10 rounded relative mt-4">
                      <button 
                        onClick={() => setClickedReadme(true)}
                        className={`w-full text-left bg-[#161b22] p-3 border-b flex items-center gap-2 text-sm font-bold text-white transition-all cursor-pointer hover:bg-white/5 ${clickedReadme ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-white/10'}`}
                      >
                        README.md
                      </button>
                      <div className="p-6 bg-[#0d1117] text-white/80 prose prose-invert max-w-none opacity-50">
                        <div dangerouslySetInnerHTML={{ __html: "<h1>Company Handbook</h1><p>Welcome to the RTS.AI operating manual. This repository contains the CURRENT TRUTH for all shop floor procedures.</p>" }} />
                      </div>
                    </div>
                  </SimRepoMain>
                  <SimRepoSidebar>
                    <SimSidebarAbout description="The official company record for RTS.AI standard operating procedures and aerospace compliance." />
                  </SimRepoSidebar>
                </SimRepoPageLayout>
              </SimRepoContainer>
            </div>

            <div className="mt-8 bg-black/30 border border-white/5 p-6 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`flex items-center gap-3 p-3 rounded border transition-colors ${clickedCommits ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/40 border-white/10 text-muted-foreground'}`}>
                <CheckCircle2 className={`w-5 h-5 ${clickedCommits ? 'opacity-100' : 'opacity-20'}`} />
                <span className="font-medium text-sm">Commit Count</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded border transition-colors ${clickedReadme ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/40 border-white/10 text-muted-foreground'}`}>
                <CheckCircle2 className={`w-5 h-5 ${clickedReadme ? 'opacity-100' : 'opacity-20'}`} />
                <span className="font-medium text-sm">README File</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded border transition-colors ${clickedBranch ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/40 border-white/10 text-muted-foreground'}`}>
                <CheckCircle2 className={`w-5 h-5 ${clickedBranch ? 'opacity-100' : 'opacity-20'}`} />
                <span className="font-medium text-sm">Current Branch</span>
              </div>
            </div>

            {showError && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="font-medium text-sm">{showError}</p>
              </div>
            )}

            <div className="pt-6 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">Back</button>
              <button 
                onClick={handleQuizSubmit}
                disabled={completeModule.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded flex items-center gap-2 transition-colors disabled:opacity-70"
              >
                {completeModule.isPending ? "Grading..." : "Complete Task"}
              </button>
            </div>
            
            <p className="text-xs text-muted-foreground/60 text-center mt-6">
              To learn how to create your first snapshot from the terminal, try the Command Test Center — Lesson 1. Optional, always.
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
              You know your way around the front door. You can instantly tell how active a project is and where to find its purpose.
            </p>
            <div className="pt-8 flex gap-4 justify-center">
              <Link href="/" className="inline-flex items-center justify-center bg-secondary hover:bg-secondary/80 text-foreground font-bold px-8 py-4 rounded-lg transition-colors border border-white/5">
                Return to Ledger
              </Link>
              <Link href="/learn/1-3" className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(255,107,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Next: Reading History &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
