import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { Activity, ShieldCheck, ShieldAlert, Terminal, Lightbulb, Rocket } from "lucide-react";
import { useEffect } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: health, isError } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 10000 } });
  const [location] = useLocation();

  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo(0, 0);
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
          
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link 
              href="/breakthroughs" 
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
                location.startsWith('/breakthroughs') 
                  ? 'bg-secondary text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Lightbulb className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${location.startsWith('/breakthroughs') ? 'text-primary' : ''}`} />
              <span className="hidden sm:inline">Breakthroughs</span>
              <span className="sm:hidden">Aha!</span>
            </Link>

            <Link 
              href="/test-center" 
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
                location.startsWith('/test-center') 
                  ? 'bg-secondary text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Terminal className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${location.startsWith('/test-center') ? 'text-primary' : ''}`} />
              <span className="hidden sm:inline">Command Test Center</span>
              <span className="sm:hidden">Tests</span>
            </Link>

            <Link 
              href="/go-live" 
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 ${
                location.startsWith('/go-live') 
                  ? 'bg-secondary text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Rocket className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${location.startsWith('/go-live') ? 'text-primary' : ''}`} />
              <span className="hidden sm:inline">Go Live</span>
              <span className="sm:hidden">Live</span>
            </Link>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-white/5 text-xs font-medium ml-2 shadow-inner">
              {isError ? (
                <><ShieldAlert className="w-3.5 h-3.5 text-destructive" /> <span className="text-muted-foreground">Offline</span></>
              ) : health?.status === 'ok' ? (
                <><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-muted-foreground">Active</span></>
              ) : (
                <><Activity className="w-3.5 h-3.5 text-primary animate-pulse" /> <span className="text-muted-foreground">Connecting</span></>
              )}
            </div>
          </nav>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col min-h-0">
        {children}
      </main>

      <footer className="border-t border-white/5 py-8 mt-auto text-center text-sm text-muted-foreground/60 font-medium">
        <p>An open-source learning project by RUN Trading Systems (RTS.AI) LLC</p>
      </footer>
    </div>
  )
}
