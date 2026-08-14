import { useRunLessonCheck, getGetRepoStateQueryKey, getGetProgressQueryKey } from "@workspace/api-client-react";
import { Play, CheckCircle2, XCircle, Terminal, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function CheckRunner({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient();
  const runCheck = useRunLessonCheck();
  const [result, setResult] = useState<{ passed: boolean | null; output: string } | null>(null);

  const handleRun = () => {
    runCheck.mutate({ lessonId }, {
      onSuccess: (data) => {
        setResult({ passed: data.passed, output: data.output });
        queryClient.invalidateQueries({ queryKey: getGetRepoStateQueryKey(lessonId) });
        // The server records the badge itself when the grader passes —
        // just refresh the ledger.
        if (data.passed === true) {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
        }
      }
    });
  };

  return (
    <div className="surface-card overflow-hidden flex flex-col">
      <div className="p-6 border-b border-white/5 bg-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <h3 className="text-lg font-bold text-foreground mb-1">Grader</h3>
          <p className="text-sm font-medium text-muted-foreground">Verify your progress on this mission.</p>
        </div>
        <button
          onClick={handleRun}
          disabled={runCheck.isPending}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-lg transition-all active:scale-95 disabled:opacity-70 shadow-[0_0_15px_rgba(255,107,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {runCheck.isPending ? (
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : result?.passed === true ? (
            <Check className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          {runCheck.isPending ? "Running..." : result?.passed === true ? "Run Again" : "Run Checks"}
        </button>
      </div>
      
      {result && (
        <div className="p-6 enter-slide-up bg-background/50">
          <div className={`flex items-center gap-4 mb-6 p-4 rounded-xl border ${
            result.passed === true 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)] relative overflow-hidden' 
              : result.passed === false 
              ? 'bg-destructive/10 border-destructive/20 text-destructive'
              : 'bg-black/50 border-white/10 text-foreground'
          }`}>
            {result.passed === true && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            )}
            
            {result.passed === true ? (
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-in zoom-in-50 duration-300 ease-out">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
            ) : result.passed === false ? (
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center border border-destructive/30 animate-in zoom-in-90 duration-200">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <Terminal className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            
            <div className="relative z-10">
              <div className="text-sm font-bold uppercase tracking-wider mb-0.5">
                {result.passed === true ? 'Check Passed' : result.passed === false ? 'Check Failed' : 'Check Completed'}
              </div>
              <div className="text-xs font-medium opacity-80">
                {result.passed === true 
                  ? 'Great job! Badge earned. You can move to the next lesson.' 
                  : 'Review the output below and try again.'}
              </div>
            </div>
          </div>
          
          <div className="sim-window">
            <div className="sim-chrome">
              <div className="sim-chrome-dots">
                <div className="close"></div>
                <div className="min"></div>
                <div className="max"></div>
              </div>
              <div className="mx-auto text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest -ml-10">check.sh</div>
            </div>
            <pre className="p-4 text-[13px] font-mono text-emerald-400/90 overflow-x-auto whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed selection:bg-emerald-500/30">
              {result.output || "No output."}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
