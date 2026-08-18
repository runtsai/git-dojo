import { useState, type ReactNode } from "react";
import type { VisualModuleProps } from "@/types/visual-module";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";

import { visualModuleSteps as _steps } from "../visual-module-steps";
export const TOTAL_STEPS = _steps["1.2"];
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Compass, Layers } from "lucide-react";
import { SimRepoContainer, SimRepoHeader, SimRepoPageLayout, SimRepoMain, SimRepoSidebar, SimRepoStats, SimFileTree, SimReadme, SimSidebarAbout } from "@/components/sim/sim-repo";
import { VisualModuleShell } from "@/components/visual-module-shell";

export function Module1_2({ onStepChange }: VisualModuleProps = {}) {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();
  
  const [clickedReadme, setClickedReadme] = useState(false);
  const [clickedCommits, setClickedCommits] = useState(false);
  const [clickedBranch, setClickedBranch] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);

  const handleNext = () => { const next = Math.min(step + 1, TOTAL_STEPS); setStep(next); onStepChange?.(next); window.scrollTo(0, 0); };
  const handlePrev = () => { const prev = Math.max(step - 1, 1); setStep(prev); onStepChange?.(prev); window.scrollTo(0, 0); };

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
          setStep(6); onStepChange?.(6);
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

  const stepHints: Record<number, ReactNode> = {
    1: (
      <span>
        <strong className="text-foreground">Concept:</strong> Before navigating any buttons, we establish what a stranger sees the moment they land on your project's page.
      </span>
    ),
    2: (
      <span>
        <strong className="text-foreground">Interface location →</strong>{" "}
        <span className="inline-flex items-center gap-1 font-mono text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded">github.com</span>
        {" / "}
        <span className="inline-flex items-center gap-1 font-mono text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded">owner / repo</span>
        {" "}— this is the <strong className="text-foreground">repository home page</strong>. Five numbered callouts mark every zone you need to know.
      </span>
    ),
    3: (
      <span>
        <strong className="text-foreground">Concept:</strong> Two design principles explain why GitHub lays information out the way it does — no navigation required.
      </span>
    ),
    4: (
      <span>
        <strong className="text-foreground">Concept:</strong> The decision rule — reach for the home screen any time you need a quick pulse-check on a project's state.
      </span>
    ),
    5: (
      <span>
        <strong className="text-foreground">Hands-on location →</strong>{" "}
        <span className="inline-flex items-center gap-1 font-mono text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded">repo home page</span>
        {" "}— click the{" "}
        <span className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded">main branch</span>
        {", "}
        <span className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded">42 Commits</span>
        {", and "}
        <span className="inline-flex items-center gap-1 font-mono text-xs bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded">README.md</span>
        {" "}in the sim above to complete the scavenger hunt.
      </span>
    ),
  };

  return (
    <VisualModuleShell
      title="The repository home screen"
      step={step}
      completionTitle="Module Passed!"
      completionText="You know your way around the front door. You can instantly tell how active a project is and where to find its purpose."
      nextModuleHref="/learn/1-3"
      nextModuleLabel="Next: Reading History →"
      onPrev={step > 1 ? handlePrev : undefined}
      onNext={step < TOTAL_STEPS ? handleNext : undefined}
      nextLabel={step === 4 ? "Begin Scavenger Hunt" : "Continue"}
      onSubmit={step === TOTAL_STEPS ? handleQuizSubmit : undefined}
      submitLabel="Complete Task"
      isPending={completeModule.isPending}
      error={showError}
      stepHints={stepHints}
      moduleId="1.2"
    >
      {step === 1 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The First Look</div>
          <h2 className="text-3xl font-bold">The Front Door</h2>
          
          <p className="text-muted-foreground reading-text text-lg">
            When a contractor or an employee opens your project on GitHub, they don't see a wall of code right away. They see the <strong>repository home screen</strong>.
          </p>
          <p className="text-muted-foreground reading-text text-lg">
            It is designed to give a stranger everything they need to understand what this project is, what state it's in, and where to find the files they need.
          </p>
        </>
      )}

      {step === 2 && (
        <>
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
        </>
      )}

      {step === 3 && (
        <>
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
        </>
      )}

      {step === 4 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 4: The Trigger</div>
          <h2 className="text-3xl font-bold">When to reach for it</h2>
          
          <div className="bg-primary border border-primary-foreground/20 text-primary-foreground p-8 rounded-lg mt-8 text-xl font-bold leading-relaxed shadow-lg shadow-primary/20">
            "You reach for the repository home screen when you need a quick pulse-check: what is the current state of our files, and how active is this project right now?"
          </div>
        </>
      )}

      {step === 5 && (
        <>
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

          <p className="text-xs text-muted-foreground/60 text-center mt-6">
            To learn how to create your first snapshot from the terminal, try the Command Test Center — Lesson 1. Optional, always.
          </p>
        </>
      )}
    </VisualModuleShell>
  );
}
