import { Link } from "wouter";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
import { Activity, ShieldCheck, ShieldAlert } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: health, isError } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 10000 } });
  
  return (
    <div className="min-h-[100dvh] flex flex-col font-sans selection:bg-primary/20">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl group-hover:scale-105 transition-transform shadow-sm">
              G
            </div>
            <span className="font-bold text-2xl tracking-tight text-foreground">Git Dojo</span>
          </Link>
          
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border">
              {isError ? (
                <><ShieldAlert className="w-4 h-4 text-destructive" /> <span className="text-muted-foreground">Server Offline</span></>
              ) : health?.status === 'ok' ? (
                <><ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500" /> <span className="text-muted-foreground">Dojo Active</span></>
              ) : (
                <><Activity className="w-4 h-4 text-amber-600 dark:text-amber-500 animate-pulse" /> <span className="text-muted-foreground">Connecting...</span></>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 md:py-12">
        {children}
      </main>
    </div>
  )
}
