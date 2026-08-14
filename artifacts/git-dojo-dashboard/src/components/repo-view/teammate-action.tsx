import { useRunBotAction, getGetRepoStateQueryKey } from "@workspace/api-client-react";
import { Clock, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/**
 * "Time passes" — triggers the lesson's scripted teammate beat on the server.
 * The teammate (Ruth Osei, a contractor with push access) commits to the
 * shared remote, so the learner's next push genuinely gets rejected.
 */
export function TeammateAction({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient();
  const runBot = useRunBotAction();
  const [output, setOutput] = useState<string | null>(null);

  const handleRun = () => {
    runBot.mutate(
      { lessonId },
      {
        onSuccess: (data) => {
          setOutput(data.output);
          queryClient.invalidateQueries({ queryKey: getGetRepoStateQueryKey(lessonId) });
        },
      },
    );
  };

  return (
    <div className="surface-card overflow-hidden flex flex-col border-blue-500/20">
      <div className="p-6 border-b border-white/5 bg-blue-500/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
            RO
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground leading-tight">Ruth Osei</h3>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400/80 flex items-center gap-1.5">
              <UserRound className="w-3 h-3" /> Contractor · push access
            </p>
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-5">
          You're not alone in this repository. When you're ready, let time pass — Ruth will do her work on the shared remote.
        </p>
        <button
          onClick={handleRun}
          disabled={runBot.isPending}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-lg transition-all active:scale-95 disabled:opacity-70 shadow-[0_0_15px_rgba(59,130,246,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {runBot.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Clock className="w-4 h-4" />
          )}
          {runBot.isPending ? "Time is passing..." : "Time passes"}
        </button>
      </div>

      {output && (
        <div className="p-4 enter-slide-up bg-background/50">
          <div className="sim-window">
            <div className="sim-chrome">
              <div className="sim-chrome-dots">
                <div className="close"></div>
                <div className="min"></div>
                <div className="max"></div>
              </div>
              <div className="mx-auto text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest -ml-10">
                remote activity
              </div>
            </div>
            <pre className="p-4 text-[13px] font-mono text-blue-300/90 overflow-x-auto whitespace-pre-wrap max-h-[240px] overflow-y-auto leading-relaxed selection:bg-blue-500/30">
              {output}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
