import { useRunLessonCheck, getGetRepoStateQueryKey, getGetProgressQueryKey } from "@workspace/api-client-react";
import { Play, CheckCircle2, XCircle, Terminal } from "lucide-react";
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
    <div className="bg-card border border-white/10 rounded-xl overflow-hidden shadow-lg flex flex-col">
      <div className="p-6 border-b border-white/5 bg-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <h3 className="text-lg font-bold text-foreground mb-1">Grader</h3>
          <p className="text-sm font-medium text-muted-foreground">Verify your progress on this mission.</p>
        </div>
        <button
          onClick={handleRun}
          disabled={runCheck.isPending}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded transition-all active:scale-95 disabled:opacity-70 shadow-lg shadow-primary/20"
        >
          {runCheck.isPending ? (
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          {runCheck.isPending ? "Running..." : "Run Checks"}
        </button>
      </div>
      
      {result && (
        <div className="p-6 animate-in slide-in-from-top-4 duration-500 bg-background/50">
          <div className={`flex items-center gap-4 mb-6 p-4 rounded-lg border ${
            result.passed === true 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : result.passed === false 
              ? 'bg-destructive/10 border-destructive/20 text-destructive'
              : 'bg-black/50 border-white/10 text-foreground'
          }`}>
            {result.passed === true ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            ) : result.passed === false ? (
              <XCircle className="w-8 h-8 text-destructive" />
            ) : (
              <Terminal className="w-8 h-8 text-muted-foreground" />
            )}
            
            <div>
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
          
          <div className="bg-black/80 rounded-lg overflow-hidden border border-white/10">
            <div className="flex items-center px-4 py-2 bg-black border-b border-white/10">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
              </div>
              <div className="mx-auto text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest">check.sh</div>
            </div>
            <pre className="p-4 text-xs font-mono text-emerald-400/90 overflow-x-auto whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
              {result.output || "No output."}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
