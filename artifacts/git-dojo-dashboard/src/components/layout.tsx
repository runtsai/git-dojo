import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { Activity, ShieldCheck, ShieldAlert, AlertTriangle, Terminal, Lightbulb, Rocket, Siren, Dumbbell, Map as MapIcon, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDrillStatus } from "@/hooks/use-drills";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: health, isError } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 10000 } });
  const [location] = useLocation();
  const { dueCount } = useDrillStatus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Scroll to top on navigation and close mobile menu
  useEffect(() => {
    window.scrollTo(0, 0);
    setMobileMenuOpen(false);
  }, [location]);
  
  return (
    <div className="min-h-[100dvh] flex flex-col font-sans selection:bg-primary/20 bg-background text-foreground">
      <header className="border-b border-white/5 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl group-hover:scale-105 group-active:scale-95 transition-transform shadow-lg shadow-primary/20">
              G
            </div>
            <span className="font-extrabold text-xl tracking-tight hidden sm:block">Git Dojo</span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            <Link 
              href="/map" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
                location.startsWith('/map') 
                  ? 'bg-secondary text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <MapIcon className={`w-4 h-4 ${location.startsWith('/map') ? 'text-primary' : ''}`} />
              <span>Map</span>
            </Link>

            <Link 
              href="/breakthroughs" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
                location.startsWith('/breakthroughs') 
                  ? 'bg-secondary text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Lightbulb className={`w-4 h-4 ${location.startsWith('/breakthroughs') ? 'text-primary' : ''}`} />
              <span>Breakthroughs</span>
            </Link>

            <Link 
              href="/test-center" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
                location.startsWith('/test-center') 
                  ? 'bg-secondary text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Terminal className={`w-4 h-4 ${location.startsWith('/test-center') ? 'text-primary' : ''}`} />
              <span>Test Center</span>
            </Link>

            <Link 
              href="/go-live" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
                location.startsWith('/go-live') 
                  ? 'bg-secondary text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Rocket className={`w-4 h-4 ${location.startsWith('/go-live') ? 'text-primary' : ''}`} />
              <span>Go Live</span>
            </Link>

            <Link 
              href="/crisis" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
                location.startsWith('/crisis') 
                  ? 'bg-secondary text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Siren className={`w-4 h-4 ${location.startsWith('/crisis') ? 'text-destructive' : ''}`} />
              <span>Crisis Room</span>
            </Link>

            <Link
              href="/warm-up"
              className={`relative flex items-center gap-2 px-3 py-2 rounded-md font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
                location.startsWith('/warm-up')
                  ? 'bg-secondary text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Dumbbell className={`w-4 h-4 ${location.startsWith('/warm-up') ? 'text-primary' : ''}`} />
              <span>Warm Up</span>
              {dueCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[1.25rem] h-[1.25rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow"
                  aria-label={`${dueCount} drills due`}
                >
                  {dueCount > 9 ? '9+' : dueCount}
                </span>
              )}
            </Link>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ml-2 shadow-inner ${
                    isError
                      ? 'bg-destructive/10 border-destructive/30'
                      : health?.status === 'degraded'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-secondary/50 border-white/5'
                  }`}>
                    {isError ? (
                      <><ShieldAlert className="w-3.5 h-3.5 text-destructive" /> <span className="text-muted-foreground">Offline</span></>
                    ) : health?.status === 'degraded' ? (
                      <><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> <span className="text-amber-500">Degraded</span></>
                    ) : health?.status === 'ok' ? (
                      <><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-muted-foreground">Active</span></>
                    ) : (
                      <><Activity className="w-3.5 h-3.5 text-primary animate-pulse" /> <span className="text-muted-foreground">Connecting</span></>
                    )}
                  </div>
                </TooltipTrigger>
                {health?.status === 'degraded' && (
                  <TooltipContent side="bottom">
                    {health.smokeCheckedAt
                      ? `Checked at ${new Date(health.smokeCheckedAt).toLocaleTimeString()}`
                      : 'Startup smoke check failed'}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </nav>

          {/* Mobile Navigation Controls */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              href="/warm-up"
              className={`relative flex items-center justify-center w-11 h-11 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
                location.startsWith('/warm-up')
                  ? 'bg-secondary text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
              aria-label="Warm Up"
            >
              <Dumbbell className="w-5 h-5" />
              {dueCount > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow ring-2 ring-background"
                >
                  {dueCount > 9 ? '9+' : dueCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center justify-center w-11 h-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-white/5 shadow-2xl p-4 flex flex-col gap-2 animate-in slide-in-from-top-2">
            <Link 
              href="/map" 
              className={`flex items-center gap-3 p-3 min-h-[44px] rounded-lg font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                location.startsWith('/map') 
                  ? 'bg-secondary text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <MapIcon className={`w-5 h-5 ${location.startsWith('/map') ? 'text-primary' : ''}`} />
              <span>The Map</span>
            </Link>

            <Link 
              href="/breakthroughs" 
              className={`flex items-center gap-3 p-3 min-h-[44px] rounded-lg font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                location.startsWith('/breakthroughs') 
                  ? 'bg-secondary text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Lightbulb className={`w-5 h-5 ${location.startsWith('/breakthroughs') ? 'text-primary' : ''}`} />
              <span>Breakthroughs</span>
            </Link>

            <Link 
              href="/test-center" 
              className={`flex items-center gap-3 p-3 min-h-[44px] rounded-lg font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                location.startsWith('/test-center') 
                  ? 'bg-secondary text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Terminal className={`w-5 h-5 ${location.startsWith('/test-center') ? 'text-primary' : ''}`} />
              <span>Command Test Center</span>
            </Link>

            <Link 
              href="/go-live" 
              className={`flex items-center gap-3 p-3 min-h-[44px] rounded-lg font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                location.startsWith('/go-live') 
                  ? 'bg-secondary text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Rocket className={`w-5 h-5 ${location.startsWith('/go-live') ? 'text-primary' : ''}`} />
              <span>Go Live</span>
            </Link>

            <Link 
              href="/crisis" 
              className={`flex items-center gap-3 p-3 min-h-[44px] rounded-lg font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                location.startsWith('/crisis') 
                  ? 'bg-secondary text-foreground' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Siren className={`w-5 h-5 ${location.startsWith('/crisis') ? 'text-destructive' : ''}`} />
              <span>Crisis Room</span>
            </Link>

            <Link
              href="/warm-up"
              className={`flex items-center justify-between p-3 min-h-[44px] rounded-lg font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                location.startsWith('/warm-up')
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Dumbbell className={`w-5 h-5 ${location.startsWith('/warm-up') ? 'text-primary' : ''}`} />
                <span>Warm Up</span>
              </div>
              {dueCount > 0 && (
                <span className="min-w-[1.5rem] h-[1.5rem] px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow">
                  {dueCount > 9 ? '9+' : dueCount}
                </span>
              )}
            </Link>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between px-3 text-sm font-medium">
              <span className="text-muted-foreground">System Status</span>
              {isError ? (
                <span className="flex items-center gap-2 text-destructive"><ShieldAlert className="w-4 h-4" /> Offline</span>
              ) : health?.status === 'degraded' ? (
                <span className="flex items-center gap-2 text-amber-500"><AlertTriangle className="w-4 h-4" /> Degraded</span>
              ) : health?.status === 'ok' ? (
                <span className="flex items-center gap-2 text-emerald-500"><ShieldCheck className="w-4 h-4" /> Active</span>
              ) : (
                <span className="flex items-center gap-2 text-primary animate-pulse"><Activity className="w-4 h-4" /> Connecting</span>
              )}
            </div>
          </div>
        )}
      </header>

      {health?.status === 'degraded' && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-amber-500 font-semibold">API degraded</span>
            <span className="text-amber-500/70">—</span>
            <span className="text-amber-500/80">
              Startup smoke check failed
              {health.smokeCheckedAt
                ? ` · checked ${new Date(health.smokeCheckedAt).toLocaleTimeString()}`
                : ''}
            </span>
          </div>
        </div>
      )}
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col min-h-0">
        {children}
      </main>

      <footer className="border-t border-white/5 py-10 mt-auto px-4">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <h2 className="text-sm font-bold text-foreground tracking-wide">Support the Dojo</h2>
          <p className="text-sm text-muted-foreground/80 leading-relaxed">
            If Git Dojo saved you time or helped it click, you can support the team building it.
            This isn&apos;t a donation &mdash; RTS.AI is a company, not a nonprofit &mdash; just a
            way to say thanks and help fund what we build next, open source and otherwise.
          </p>
          {/* Placeholder target: swap for the owner's Stripe Payment Link once created.
              Until then this points at GitHub Sponsors (activates when runtsai enrolls).
              Hard rules: outbound link only — never payment code, never the word "donate",
              never gate course content behind payment. */}
          <a
            href="https://github.com/sponsors/runtsai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block py-2.5 px-5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-bold text-sm rounded-lg transition-all active:scale-95"
          >
            Support this project &rarr;
          </a>
          <p className="text-sm text-muted-foreground/60 font-medium pt-2">
            An open-source learning project by RUN Trading Systems (RTS.AI) LLC
          </p>
        </div>
      </footer>
    </div>
  )
}
