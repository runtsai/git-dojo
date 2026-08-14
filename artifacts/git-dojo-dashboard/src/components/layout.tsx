import { Link, useLocation } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { Activity, ShieldCheck, ShieldAlert, Terminal, Lightbulb } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: health, isError } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 10000 } });
  const [location] = useLocation();
  
  return (
    <div className="min-h-[100dvh] flex flex-col font-sans selection:bg-primary/20 bg-background text-foreground">
      <header className="border-b border-white/10 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform shadow-lg shadow-primary/20">
              G
            </div>
            <span className="font-extrabold text-xl tracking-tight hidden sm:block">Git Dojo</span>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Link 
              href="/breakthroughs" 
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm transition-colors ${
                location.startsWith('/breakthroughs') 
                  ? 'bg-secondary text-foreground border border-white/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Breakthroughs</span>
              <span className="sm:hidden">Aha!</span>
            </Link>

            <Link 
              href="/test-center" 
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md font-bold text-xs sm:text-sm transition-colors ${
                location.startsWith('/test-center') 
                  ? 'bg-secondary text-foreground border border-white/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Command Test Center</span>
              <span className="sm:hidden">Tests</span>
            </Link>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded bg-black/40 border border-white/5 text-xs font-medium ml-2">
              {isError ? (
                <><ShieldAlert className="w-3.5 h-3.5 text-destructive" /> <span className="text-muted-foreground">Offline</span></>
              ) : health?.status === 'ok' ? (
                <><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-muted-foreground">Active</span></>
              ) : (
                <><Activity className="w-3.5 h-3.5 text-primary animate-pulse" /> <span className="text-muted-foreground">Connecting...</span></>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-12">
        {children}
      </main>

      <footer className="border-t border-white/5 py-8 mt-12 text-center text-sm text-muted-foreground/60 font-medium">
        <p>An open-source learning project by RUN Trading Systems (RTS.AI) LLC</p>
      </footer>
    </div>
  )
}
