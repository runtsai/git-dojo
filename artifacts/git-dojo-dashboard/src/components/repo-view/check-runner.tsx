import { useRunLessonCheck, getGetRepoStateQueryKey } from "@workspace/api-client-react";
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
      }
    });
  };

  return (
    <div className="bg-card border rounded-3xl overflow-hidden shadow-sm flex flex-col">
      <div className="p-8 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <h3 className="text-xl font-bold text-foreground mb-1">Grader</h3>
          <p className="text-sm font-medium text-muted-foreground">Verify your progress on this lesson.</p>
        </div>
        <button
          onClick={handleRun}
          disabled={runCheck.isPending}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-primary text-primary-foreground font-bold text-lg rounded-2xl hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-70 shadow-sm"
        >
          {runCheck.isPending ? (
            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            <Play className="w-5 h-5 fill-current" />
          )}
          {runCheck.isPending ? "Running..." : "Run Checks"}
        </button>
      </div>
      
      {result && (
        <div className="p-8 animate-in slide-in-from-top-4 duration-500 bg-background">
          <div className={`flex items-center gap-4 mb-6 p-5 rounded-2xl border-2 ${
            result.passed === true 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-500' 
              : result.passed === false 
              ? 'bg-destructive/10 border-destructive/20 text-destructive'
              : 'bg-muted border-border text-foreground'
          }`}>
            {result.passed === true ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-500" />
            ) : result.passed === false ? (
              <XCircle className="w-10 h-10 text-destructive" />
            ) : (
              <Terminal className="w-10 h-10 text-muted-foreground" />
            )}
            
            <div>
              <div className="text-xl font-extrabold uppercase tracking-wider mb-1">
                {result.passed === true ? 'Check Passed' : result.passed === false ? 'Check Failed' : 'Check Completed'}
              </div>
              <div className="text-sm font-medium opacity-90">
                {result.passed === true 
                  ? 'Great job! You can move to the next lesson.' 
                  : 'Review the output below and try again.'}
              </div>
            </div>
          </div>
          
          <div className="bg-[#1e1e1e] rounded-2xl overflow-hidden shadow-inner border border-black/20">
            <div className="flex items-center px-5 py-3 bg-black/50 border-b border-white/5">
              <div className="flex gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-red-500/80"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-amber-500/80"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/80"></div>
              </div>
              <div className="mx-auto text-[11px] font-mono font-bold text-white/30 uppercase tracking-widest">check.sh</div>
            </div>
            <pre className="p-5 text-sm font-mono text-emerald-400/90 overflow-x-auto whitespace-pre-wrap max-h-[350px] overflow-y-auto leading-relaxed">
              {result.output || "No output."}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
