import {
  useGetCrisisRepoState,
  getGetCrisisRepoStateQueryKey,
  useSetupCrisisScenario,
  useListCrisisScenarios,
  getListCrisisScenariosQueryKey,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  RefreshCw,
  Siren,
  Lightbulb,
  ChevronDown,
  Flame,
  Award,
  Target,
} from "lucide-react";
import { SummaryPanel } from "@/components/repo-view/summary-panel";
import { FileStatus } from "@/components/repo-view/file-status";
import { CommitTimeline } from "@/components/repo-view/commit-timeline";
import { BranchList } from "@/components/repo-view/branch-list";
import { CrisisCheckRunner } from "@/components/repo-view/crisis-check-runner";
import { DiffViewer, DiffSelection } from "@/components/repo-view/diff-viewer";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { crises } from "@/content/crises";
import NotFound from "@/pages/not-found";
import { MapPeek } from "@/components/map-peek";

const HINT_STEPS = [
  { key: "nudge", label: "Hint 1 — A nudge" },
  { key: "concept", label: "Hint 2 — The concept" },
  { key: "command", label: "Hint 3 — The exact command" },
] as const;

export function CrisisView() {
  const { crisisId } = useParams<{ crisisId: string }>();
  const queryClient = useQueryClient();
  const crisis = crises.find((c) => c.id === crisisId);
  const [hintsOpen, setHintsOpen] = useState(0);
  const [justPassed, setJustPassed] = useState(false);
  const [diffSelection, setDiffSelection] = useState<DiffSelection | null>(null);

  useEffect(() => {
    if (crisis) document.title = `${crisis.title} | Crisis Room`;
  }, [crisis]);

  useEffect(() => {
    setHintsOpen(0);
  }, [crisisId]);

  const { data: scenarios } = useListCrisisScenarios();
  const setup = useSetupCrisisScenario();

  const { data: repo, isFetching } = useGetCrisisRepoState(crisisId || "", {
    query: {
      enabled: !!crisisId && !!crisis,
      queryKey: getGetCrisisRepoStateQueryKey(crisisId || ""),
      refetchInterval: 4000,
    },
  });

  if (!crisis) return <NotFound />;

  const status = scenarios?.find((s) => s.id === crisis.id);
  const solved = status?.solved ?? false;

  const handleSetup = () => {
    setJustPassed(false);
    setDiffSelection(null);
    setHintsOpen(0);
    setup.mutate(
      { crisisId: crisis.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCrisisRepoStateQueryKey(crisis.id) });
          queryClient.invalidateQueries({ queryKey: getListCrisisScenariosQueryKey() });
        },
      },
    );
  };

  const live = !!repo?.initialized;

  return (
    <div className="space-y-8 pb-12 enter-slide-up max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-white/10 pb-6">
        <div>
          <Link
            href="/crisis"
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Crisis Room
          </Link>
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-md text-destructive shadow-sm border border-destructive/20">
                <Siren className="w-6 h-6" />
              </div>
              {crisis.title}
            </h1>
            {solved && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                <Award className="w-3.5 h-3.5" /> Resolved
              </span>
            )}
            {isFetching && <RefreshCw className="w-4 h-4 text-primary animate-spin opacity-50 motion-reduce:animate-none" />}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
        <MapPeek locationId={crisis.id} stepIndex={hintsOpen} />
        <button
          onClick={handleSetup}
          disabled={setup.isPending}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-destructive/90 hover:bg-destructive text-white font-bold text-sm rounded-lg transition-all active:scale-95 disabled:opacity-70 shadow-[0_0_15px_rgba(239,68,68,0.2)] border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        >
          {setup.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
          ) : (
            <Flame className="w-4 h-4" />
          )}
          {setup.isPending ? "Breaking things..." : live ? "Reset the Disaster" : "Trigger the Disaster"}
        </button>
        </div>
      </div>

      {/* Briefing */}
      <div className="surface-card p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-destructive/80"></div>
        <div className="text-xs font-bold text-destructive tracking-widest uppercase mb-4">
          Incident Briefing
        </div>
        <div className="space-y-4 max-w-3xl">
          {crisis.briefing.map((p, i) => (
            <p key={i} className="text-muted-foreground reading-text leading-relaxed">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-6 flex items-start gap-3 bg-black/40 border border-white/5 rounded-lg p-4 max-w-3xl">
          <Target className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Recovery goal</div>
            <p className="text-sm text-foreground leading-relaxed">{crisis.goal}</p>
          </div>
        </div>
        {live && repo && (
          <div className="mt-6 max-w-3xl">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Work here in your terminal
            </div>
            <div className="bg-black/80 border border-white/10 shadow-inner font-mono p-4 rounded-lg flex gap-3 text-sm overflow-x-auto">
              <span className="text-primary font-bold select-none">$</span>
              <span className="text-emerald-400">cd {status?.path ?? `~/git-dojo/playground/${crisis.id}`}</span>
            </div>
          </div>
        )}
      </div>

      {!live ? (
        <div className="surface-card p-10 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl flex items-center justify-center mx-auto mb-6">
            <Flame className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-foreground tracking-tight">The disaster hasn't happened yet</h2>
          <p className="text-muted-foreground reading-text mx-auto">
            Press <span className="text-foreground font-bold">Trigger the Disaster</span> above. A real practice
            repository will be built and then genuinely broken — safely, inside its own sandbox folder.
          </p>
        </div>
      ) : (
        <>
          <SummaryPanel
            summary={repo!.summary}
            isDetached={repo!.detachedHead}
            currentBranch={repo!.currentBranch}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <FileStatus
                files={repo!.files}
                onFileClick={(f) => setDiffSelection({ kind: "file", path: f.path })}
              />
              <CommitTimeline
                commits={repo!.commits}
                onCommitClick={(c) => setDiffSelection({ kind: "commit", hash: c.hash, shortHash: c.shortHash })}
              />
            </div>
            <div className="space-y-8">
              <CrisisCheckRunner crisisId={crisis.id} onPass={() => setJustPassed(true)} />

              {/* Hints ladder */}
              <div className="surface-card overflow-hidden">
                <div className="p-6 border-b border-white/5 bg-black/20">
                  <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-primary" /> Hints
                  </h3>
                  <p className="text-sm font-medium text-muted-foreground">
                    Reveal one rung at a time. Try before you peek.
                  </p>
                </div>
                <div className="divide-y divide-white/5">
                  {HINT_STEPS.map((step, idx) => {
                    const revealed = hintsOpen > idx;
                    return (
                      <div key={step.key}>
                        <button
                          onClick={() => setHintsOpen(revealed ? idx : idx + 1)}
                          disabled={!revealed && idx > hintsOpen}
                          className="w-full flex items-center justify-between px-6 py-4 text-left text-sm font-bold text-foreground hover:bg-secondary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {step.label}
                          <ChevronDown
                            className={`w-4 h-4 text-muted-foreground transition-transform motion-reduce:transition-none ${revealed ? "rotate-180" : ""}`}
                          />
                        </button>
                        {revealed && (
                          <p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed font-mono bg-black/30">
                            {crisis.hints[step.key]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Debrief on pass */}
          {(justPassed || solved) && (
            <div className="surface-card p-6 md:p-8 border-emerald-500/30 relative overflow-hidden enter-slide-up">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
              <div className="text-xs font-bold text-emerald-400 tracking-widest uppercase mb-3 flex items-center gap-2">
                <Award className="w-4 h-4" /> Debrief
              </div>
              <p className="text-foreground reading-text leading-relaxed max-w-3xl">{crisis.debrief}</p>
              <Link
                href={`/breakthroughs/${crisis.breakthroughId}`}
                className="inline-flex items-center gap-2 mt-6 px-4 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-sm rounded-lg transition-all active:scale-95 border border-white/10"
              >
                <Lightbulb className="w-4 h-4 text-primary" />
                Explore the idea: {crisis.breakthroughTitle}
              </Link>
            </div>
          )}

          {/* Cross-link even before passing */}
          {!justPassed && !solved && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Lightbulb className="w-4 h-4 text-primary flex-shrink-0" />
              <span>
                Stuck on the idea itself?{" "}
                <Link
                  href={`/breakthroughs/${crisis.breakthroughId}`}
                  className="text-primary font-bold hover:underline"
                >
                  Play with the {crisis.breakthroughTitle} breakthrough
                </Link>{" "}
                and come back.
              </span>
            </div>
          )}
        </>
      )}

      <DiffViewer
        source={{ kind: "crisis", id: crisis.id }}
        selection={diffSelection}
        onClose={() => setDiffSelection(null)}
      />
    </div>
  );
}
