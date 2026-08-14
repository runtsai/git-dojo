import { useState } from "react";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle2, ChevronRight, AlertCircle, Search, Bell, Map } from "lucide-react";
import { SimGlobalNav, SimSearchOverlay, SimNotificationsOverlay } from "@/components/sim/sim-nav";

export function Module1_5() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();
  
  // Interactive state
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const [foundFile, setFoundFile] = useState(false);
  const [checkedNotification, setCheckedNotification] = useState(false);
  
  const [showError, setShowError] = useState<string | null>(null);

  const handleNext = () => { setStep(s => Math.min(s + 1, 5)); window.scrollTo(0, 0); };
  const handlePrev = () => { setStep(s => Math.max(s - 1, 1)); window.scrollTo(0, 0); };

  const handleQuizSubmit = () => {
    if (!foundFile && !checkedNotification) {
      setShowError("You haven't completed the tasks yet. Use the top navigation bar to find the onboarding file and check your notifications.");
      return;
    }
    if (!foundFile) {
      setShowError("Almost there! You still need to find 'onboarding.md' using the search box.");
      return;
    }
    if (!checkedNotification) {
      setShowError("Almost there! You still need to read the unread notification about the handbook comment.");
      return;
    }

    setShowError(null);
    completeModule.mutate(
      { data: { moduleId: "1.5", track: "visual" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
          setStep(6);
        }
      }
    );
  };

  const Callout = ({ num }: { num: number }) => (
    <div className="absolute -left-2 -top-2 w-6 h-6 bg-primary text-primary-foreground font-bold rounded-full flex items-center justify-center text-xs shadow-[0_0_10px_rgba(255,107,0,0.5)] z-10 pointer-events-none">{num}</div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 enter-slide-up pb-20">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-all active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">The global nav</h1>
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
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 1: The Command Center</div>
            <h2 className="text-3xl font-bold">Always Above You</h2>
            
            <p className="text-muted-foreground reading-text text-lg">
              No matter where you are in GitHub — looking at a file, reading a commit, or configuring settings — the global navigation bar is always pinned to the top of the screen.
            </p>
            <p className="text-muted-foreground reading-text text-lg">
              It is your escape hatch. It's how you jump between entirely different projects, search across the whole company, and see when someone needs your attention.
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
            <h2 className="text-3xl font-bold">The Top Bar</h2>
            <p className="text-muted-foreground reading-text text-lg max-w-2xl">
              This layout pattern is ubiquitous in modern software. Let's look at the pieces that matter most when you're managing company records.
            </p>

            <div className="mt-8 relative">
              <div className="pointer-events-none opacity-90">
                <SimGlobalNav 
                  calloutMenu={<Callout num={1} />}
                  calloutBreadcrumbs={<Callout num={2} />}
                  calloutSearch={<Callout num={3} />}
                  calloutBell={<Callout num={4} />}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">1. Main Menu:</span> The hamburger icon opens your quick links to other repositories.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">2. Breadcrumbs:</span> Shows exactly where you are. E.g., Company / Repo / Folder.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">3. Unified Search:</span> Search for any file or commit across the entire company instantly.
              </div>
              <div className="bg-black/30 p-4 rounded border border-white/5 text-sm">
                <span className="text-primary font-bold mr-2">4. Notifications:</span> The inbox for when someone comments on your files or requests a review.
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
            <h2 className="text-3xl font-bold">Why it matters</h2>
            
            <div className="space-y-6 mt-8">
              <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
                <div className="bg-emerald-500/20 p-3 rounded-lg border border-emerald-500/30">
                  <Search className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Finding the Needle</h3>
                  <p className="text-muted-foreground reading-text">
                    You don't need to click through folders to find a document. The search box indexes every word in every file across all your repositories. You type "vendor rate", it takes you straight to the policy.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start bg-black/40 p-6 rounded-lg border border-white/5">
                <div className="bg-blue-500/20 p-3 rounded-lg border border-blue-500/30">
                  <Bell className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">The Collaboration Inbox</h3>
                  <p className="text-muted-foreground reading-text">
                    Instead of checking your email for contractor questions, GitHub routes all discussions about the files directly to your notification bell, keeping the conversation tied to the work.
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
              "You reach for the top nav when you're lost, when you need to find a specific file instantly, or when that little blue dot tells you someone is waiting on you."
            </div>

            <div className="pt-10 flex justify-between">
              <button onClick={handlePrev} className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">Back</button>
              <button onClick={handleNext} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                Begin Navigation Tasks <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="p-8 md:p-12 space-y-6 relative">
            <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">Part 5: Prove It</div>
            <h2 className="text-3xl font-bold mb-2">Navigate the Hub</h2>
            <p className="text-muted-foreground text-lg mb-8 reading-text">
              Complete these two tasks using the navigation bar below:
              <br/>1) You have an unread notification. Find out what John said about the handbook.
              <br/>2) Use the search box to jump directly to the <code>onboarding.md</code> file.
            </p>

            <div className="mt-8 relative">
              <SimGlobalNav 
                onSearchClick={() => { setSearchOpen(true); setNotificationsOpen(false); }}
                onBellClick={() => { setNotificationsOpen(true); setSearchOpen(false); }}
                onMenuClick={() => { setSearchOpen(false); setNotificationsOpen(false); }}
              />
              
              {searchOpen && (
                <SimSearchOverlay 
                  onClose={() => setSearchOpen(false)}
                  onSelect={(file) => {
                    if (file === 'onboarding.md') setFoundFile(true);
                    setSearchOpen(false);
                  }}
                />
              )}
              
              {notificationsOpen && (
                <SimNotificationsOverlay 
                  onClose={() => setNotificationsOpen(false)}
                  onSelect={() => {
                    setCheckedNotification(true);
                    setNotificationsOpen(false);
                  }}
                />
              )}
            </div>

            <div className="mt-8 bg-black/30 border border-white/5 p-6 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`flex items-center gap-3 p-3 rounded border transition-colors ${checkedNotification ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/40 border-white/10 text-muted-foreground'}`}>
                <CheckCircle2 className={`w-5 h-5 ${checkedNotification ? 'opacity-100' : 'opacity-20'}`} />
                <span className="font-medium text-sm">Read the notification</span>
              </div>
              <div className={`flex items-center gap-3 p-3 rounded border transition-colors ${foundFile ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-black/40 border-white/10 text-muted-foreground'}`}>
                <CheckCircle2 className={`w-5 h-5 ${foundFile ? 'opacity-100' : 'opacity-20'}`} />
                <span className="font-medium text-sm">Search for onboarding.md</span>
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
                disabled={completeModule.isPending || (!foundFile || !checkedNotification)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {completeModule.isPending ? "Grading..." : "Complete Tasks"}
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="p-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-4xl font-extrabold text-foreground">Tier 1 Complete!</h2>
            <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              You've mastered the GitHub interface. You can navigate, audit history, configure settings, and stay on top of notifications. The Ground Truth is yours.
            </p>
            <div className="pt-8 flex gap-4 justify-center">
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
