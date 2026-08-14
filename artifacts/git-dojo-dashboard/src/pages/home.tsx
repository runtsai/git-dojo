import { useGetProgress, useListLessons } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, Lock, Terminal, Shield, Award, Trophy, Lightbulb, Play, Map, X, Rocket } from "lucide-react";
import { ComputerIcon, StickerIcon } from "@/components/git-icons";
import { tiers } from "@/content/tiers";
import { breakthroughs } from "@/content/breakthroughs";
import { useEffect, useState } from "react";

export function Home() {
  const [_, setLocation] = useLocation();
  const { data: progress, isLoading: progressLoading } = useGetProgress();
  const { data: lessons, isLoading: lessonsLoading } = useListLessons();
  const [showOrientation, setShowOrientation] = useState(false);

  useEffect(() => {
    document.title = "Git Dojo | The GitHub Mastery Path";
    const dismissed = localStorage.getItem("dojo-orientation-dismissed");
    if (!dismissed) {
      setShowOrientation(true);
    }
  }, []);

  const [showMobileNotice, setShowMobileNotice] = useState(false);

  useEffect(() => {
    const noticeDismissed = localStorage.getItem("dojo-mobile-notice-dismissed");
    if (!noticeDismissed) {
      setShowMobileNotice(true);
    }
  }, []);

  const dismissMobileNotice = () => {
    localStorage.setItem("dojo-mobile-notice-dismissed", "true");
    setShowMobileNotice(false);
  };

  const dismissOrientation = () => {
    localStorage.setItem("dojo-orientation-dismissed", "true");
    setShowOrientation(false);
  };

  const showOrientationPanel = () => {
    localStorage.removeItem("dojo-orientation-dismissed");
    setShowOrientation(true);
  };

  if (progressLoading || lessonsLoading) {
    return (
      <div className="flex justify-center items-center flex-1 h-full min-h-[300px]">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const completedVisualModules = progress?.entries.filter(e => e.track === "visual").map(e => e.moduleId) || [];
  const completedCliLessons = progress?.entries.filter(e => e.track === "cli").map(e => e.moduleId) || [];

  return (
    <div className="enter-slide-up max-w-7xl mx-auto space-y-12">
      
      {showMobileNotice && (
        <div className="block md:hidden bg-[#161b22] border border-white/10 p-5 rounded-xl shadow-lg relative animate-in fade-in">
          <button 
            onClick={dismissMobileNotice}
            className="absolute top-2 right-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex gap-3">
            <ComputerIcon className="w-6 h-6 text-primary shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed pr-6 text-muted-foreground">
              <span className="font-bold block mb-1 text-primary">A quick heads up:</span>
              The visual course, Breakthroughs, and Map all work great on your phone. For the full experience, including the Command Test Center, we recommend jumping on a computer.
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 max-w-3xl flex justify-between items-start">
        <div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl heading-tight text-foreground">
            The GitHub Mastery Path
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground reading-text mt-4">
            Learn how to trace, protect, and safely share the single source of truth for your company records. Two independent tracks. Zero gating.
          </p>
        </div>
        {!showOrientation && (
          <button 
            onClick={showOrientationPanel}
            className="hidden md:flex flex-shrink-0 items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors bg-secondary/30 px-3 py-1.5 rounded-lg border border-white/5 mt-2"
          >
            <Map className="w-4 h-4" /> How this works
          </button>
        )}
      </div>

      {showOrientation && (
        <div className="surface-card p-6 md:p-8 relative border-l-4 border-l-primary animate-in fade-in slide-in-from-top-4 duration-500">
          <button 
            onClick={dismissOrientation}
            className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground bg-black/20 hover:bg-black/40 rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-6">
            <Map className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Start here</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="space-y-2">
              <div className="font-bold text-foreground flex items-center gap-2">
                <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs"><ComputerIcon className="w-3.5 h-3.5" /></span>
                The Main Course
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Visual lessons, no typing. Start with "What GitHub actually is". This is the primary path.
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-bold text-foreground flex items-center gap-2">
                <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs"><StickerIcon className="w-3.5 h-3.5" /></span>
                Breakthroughs
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {breakthroughs.length} interactive playgrounds for when a concept won't click. Break things safely.
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-bold text-foreground flex items-center gap-2">
                <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs"><Terminal className="w-3.5 h-3.5" /></span>
                Command Test Center
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Optional. Real commands, needs a terminal. Practice without fear.
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => {
              dismissOrientation();
              setLocation('/learn/1-1');
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg transition-all active:scale-95 shadow-[0_0_20px_rgba(255,107,0,0.2)] inline-flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" /> Begin Module 1.1
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 md:p-8 flex flex-col justify-between gap-6 shadow-lg shadow-primary/5 transition-colors hover:bg-primary/10">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Map className="w-5 h-5 text-primary" /> 
              The Map
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed text-sm md:text-base">
              The zoomed-out forest view. See the entire Git territory in one interactive picture. Highly recommended before starting.
            </p>
          </div>
          <Link 
            href="/map"
            className="bg-primary hover:bg-primary/90 text-primary-foreground border border-transparent font-bold px-6 py-3 rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-md flex-shrink-0 text-center"
          >
            See the whole territory first
          </Link>
        </div>

        <div className="bg-[#161b22] border border-white/10 rounded-xl p-6 md:p-8 flex flex-col justify-between gap-6 shadow-lg shadow-black/50 transition-colors hover:bg-white/5">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-foreground" /> 
              Breakthroughs
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed text-sm md:text-base">
              Stuck on a concept? These interactive ideas are where Git usually clicks. Play with the toys until the misconception visibly breaks.
            </p>
          </div>
          <Link 
            href="/breakthroughs"
            className="bg-black/50 border border-white/10 hover:border-white/30 text-foreground font-bold px-6 py-3 rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-md flex-shrink-0 text-center"
          >
            Explore the Gallery
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Track A: Visual Mastery (Left side, takes 8 columns on desktop) */}
        <div className="lg:col-span-8 space-y-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Track A: The Main Course</h2>
            </div>
            {!showOrientation && (
              <button 
                onClick={showOrientationPanel}
                className="md:hidden flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors bg-secondary/30 px-2 py-1 rounded border border-white/5"
              >
                <Map className="w-3 h-3" /> Help
              </button>
            )}
          </div>
          
          <div className="space-y-6">
            {tiers.map((tier, idx) => {
              const isActive = tier.status === "active";
              
              const tierModules = tier.modules || [];
              const completedInTier = tierModules.filter(m => completedVisualModules.includes(m.id)).length;
              const isTierComplete = isActive && tierModules.length > 0 && completedInTier === tierModules.length;
              
              return (
                <div 
                  key={tier.id} 
                  className={`surface-card p-6 md:p-8 ${
                    isActive 
                      ? isTierComplete
                        ? 'bg-[#161b22] border-emerald-500/30 shadow-[0_4px_30px_rgba(16,185,129,0.05)] relative overflow-hidden'
                        : '' 
                      : 'opacity-50 grayscale hover:grayscale-0 transition-all duration-500'
                  }`}
                >
                  {isTierComplete && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -z-10 translate-x-8 -translate-y-8"></div>
                  )}
                  
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="text-xs font-bold tracking-widest uppercase mb-2 flex items-center gap-2">
                        <span className={isActive ? (isTierComplete ? 'text-emerald-500' : 'text-primary') : 'text-muted-foreground'}>Tier {idx + 1}</span>
                        {isTierComplete && <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px]">Complete</span>}
                        
                        {tier.status === "coming_soon" && <span className="bg-black/50 border border-white/10 px-2 py-0.5 rounded text-[10px] flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>}
                      </div>
                      <h3 className="text-2xl font-bold text-foreground">{tier.title}</h3>
                    </div>
                    {isTierComplete && (
                      <div className="hidden sm:flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <Trophy className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  
                  <p className="text-muted-foreground mb-8 text-sm md:text-base">{tier.description}</p>
                  
                  {tierModules.length > 0 && (
                    <div className="space-y-3">
                      {tierModules.map((mod, mIdx) => {
                        const isCompleted = completedVisualModules.includes(mod.id);
                        return (
                          <Link 
                            key={mod.id} 
                            href={isActive ? `/learn/${mod.id}` : '#'}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border transition-all ${
                              isActive
                                ? isCompleted
                                  ? 'bg-black/30 border-white/5 hover:border-emerald-500/30 group'
                                  : 'bg-black/50 border-white/10 hover:border-primary/50 hover:bg-black/80 cursor-pointer shadow-sm group hover:-translate-y-0.5'
                                : 'bg-black/20 border-white/5 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-start sm:items-center gap-4 mb-3 sm:mb-0">
                              <div className={`mt-0.5 sm:mt-0 flex-shrink-0 ${
                                isActive
                                  ? isCompleted ? 'text-emerald-500' : 'text-primary/50 group-hover:text-primary transition-colors'
                                  : 'text-muted-foreground/30'
                              }`}>
                                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-muted-foreground mb-1">Module {idx + 1}.{mIdx + 1}</div>
                                <div className={`font-bold ${isActive ? (isCompleted ? 'text-foreground/70' : 'text-foreground group-hover:text-primary transition-colors') : 'text-muted-foreground'}`}>
                                  {mod.title}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pl-9 sm:pl-0">
                              <div className="text-xs text-muted-foreground/70 flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-white/5">
                                
                              </div>
                              {isActive && !isCompleted && (
                                <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-primary/20">
                                  Start Module
                                </div>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Track B: Sandbox (Right side, takes 4 columns on desktop) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <Terminal className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Track B: Sandbox</h2>
          </div>
          
          <div className="surface-card p-6">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-foreground">Command Test Center</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                The real commands in a sandbox that can't hurt anything. Complete lessons to earn badges.
              </p>
            </div>
            
            <div className="grid grid-cols-4 gap-3 mb-8">
              {lessons?.map((lesson, idx) => {
                const isEarned = completedCliLessons.includes(lesson.id);
                return (
                  <div 
                    key={lesson.id} 
                    title={lesson.title}
                    className={`aspect-square rounded-lg flex items-center justify-center border-2 transition-all ${
                      isEarned 
                        ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(255,107,0,0.2)]' 
                        : 'bg-black/50 border-white/5 text-white/10'
                    }`}
                  >
                    {isEarned ? <Award className="w-6 h-6" /> : <span className="font-mono text-xs font-bold">{idx + 1}</span>}
                  </div>
                );
              })}
              {/* Bonus Slot */}
              <div 
                title="Bonus Challenge"
                className="aspect-square rounded-lg flex items-center justify-center border-2 bg-black/50 border-white/5 text-white/10 shadow-inner"
              >
                <Lock className="w-4 h-4 opacity-50" />
              </div>
            </div>
            
            <Link 
              href="/test-center"
              className="block w-full py-3 px-4 bg-secondary hover:bg-secondary/80 text-foreground text-center font-bold text-sm rounded-lg transition-all active:scale-95 border border-white/5 shadow-md"
            >
              Enter Test Center
            </Link>
          </div>

          <div className="surface-card p-6 border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Rocket className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">Go Live Capstone</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Optional final step: do it for real on your own GitHub account. Dojo creates a real
              repo, opens a real PR, and verifies every step against the live GitHub API.
            </p>
            <Link 
              href="/go-live"
              className="block w-full py-3 px-4 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary text-center font-bold text-sm rounded-lg transition-all active:scale-95"
            >
              Take it live &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
