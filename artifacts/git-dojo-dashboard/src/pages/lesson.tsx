import { useGetRepoState, getGetRepoStateQueryKey, useListLessons } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import NotFound from "@/pages/not-found";
import { isValidLessonId } from "@/content/lessons";
import { ArrowLeft, ChevronDown, ChevronUp, Map, RefreshCw, Terminal, GitBranch, Info } from "lucide-react";
import { SummaryPanel } from "@/components/repo-view/summary-panel";
import { FileStatus } from "@/components/repo-view/file-status";
import { CommitTimeline } from "@/components/repo-view/commit-timeline";
import { BranchList } from "@/components/repo-view/branch-list";
import { CheckRunner } from "@/components/repo-view/check-runner";
import { TeammateAction } from "@/components/repo-view/teammate-action";
import { useQueryClient } from "@tanstack/react-query";
import { CommandBlock } from "@/components/ui/command-block";
import { MapPeek } from "@/components/map-peek";
import { TerritoryStrip } from "@/components/repo-view/territory-strip";
import { DiffViewer, DiffSelection } from "@/components/repo-view/diff-viewer";
import { safeStorage } from "@/lib/safe-storage";
import { useEffect, useRef, useState } from "react";

function WayfindingPanel({ lessonId }: { lessonId: string }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const dismissed = safeStorage.getItem("dojo-terminal-info-dismissed");
    if (!dismissed) {
      setExpanded(true);
    }
  }, []);

  const togglePanel = () => {
    if (expanded) {
      safeStorage.setItem("dojo-terminal-info-dismissed", "true");
    }
    setExpanded(!expanded);
  };

  return (
    <div className="surface-card mb-8 border-primary/20 shadow-[0_0_15px_rgba(255,107,0,0.05)] overflow-hidden transition-all duration-300">
      <button 
        onClick={togglePanel}
        className="w-full flex items-center justify-between p-4 sm:p-5 bg-primary/5 hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 text-primary p-2 rounded-lg shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <span className="font-bold text-foreground text-left">Where do I type these commands?</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      
      {expanded && (
        <div className="p-5 sm:p-6 border-t border-white/5 bg-black/20 space-y-6 text-muted-foreground text-sm sm:text-base leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
          <p>
            These are real commands, typed into a terminal — the app watches the practice folder and updates this screen when you run them.
          </p>
          
          <ul className="space-y-2 list-disc pl-5">
            <li><strong className="text-foreground">On Replit:</strong> open the Shell tab in this workspace.</li>
            <li><strong className="text-foreground">On a computer:</strong> Terminal (Mac) or <strong className="text-foreground">Git Bash</strong> (Windows — not PowerShell). First time? Follow the <Link href="/getting-started" className="text-primary font-bold hover:underline">Getting Started checklist</Link>.</li>
          </ul>

          <div className="bg-secondary/30 border border-white/5 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-secondary-foreground shrink-0 mt-0.5" />
            <p className="text-sm">
              <strong className="text-foreground">Using Git Bash?</strong> Paste with <strong className="text-foreground">Shift+Insert</strong> or right-click — Ctrl+V doesn't paste there.
            </p>
          </div>

          <div className="space-y-3 min-w-0 w-full">
            <p className="break-words">The practice folder for this lesson lives at <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded break-all whitespace-pre-wrap">~/git-dojo/playground/{lessonId}</code>. Always navigate there first:</p>
            <CommandBlock command={`cd ~/git-dojo/playground/${lessonId}`} />
          </div>

          <div className="bg-secondary/30 border border-white/5 p-4 rounded-xl flex items-start gap-3 mt-4">
            <Info className="w-5 h-5 text-secondary-foreground shrink-0 mt-0.5" />
            <p className="text-sm">
              If you're on a phone without a terminal, this track isn't doable yet. <Link href="/" className="text-primary font-bold hover:underline">Track A (The Main Course)</Link> and <Link href="/breakthroughs" className="text-primary font-bold hover:underline">Breakthroughs</Link> need no typing at all.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper that validates the URL param against the manifest before mounting
 * the hook-heavy implementation.  This keeps all hooks in LessonContent so
 * the Rules of Hooks are never violated by the early-return guard.
 */
export function LessonView() {
  const { lessonId } = useParams<{ lessonId: string }>();

  // Guard: only serve lessons that are declared in the manifest.
  // An unknown id (typo, stale bookmark, removed lesson) gets a 404 instead of
  // a broken data-fetch loop.
  if (!lessonId || !isValidLessonId(lessonId)) {
    return <NotFound />;
  }

  return <LessonContent lessonId={lessonId} />;
}

function LessonContent({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient();
  const [diffSelection, setDiffSelection] = useState<DiffSelection | null>(null);

  const { data: lessons, isLoading: isLessonsLoading } = useListLessons();
  const currentLesson = lessons?.find((l) => l.id === lessonId);
  const folderName = currentLesson?.folderName;
  const lessonTitle = currentLesson?.title;

  useEffect(() => {
    if (lessonId) {
      const displayTitle = lessonTitle || lessonId;
      document.title = `${displayTitle} | Test Center`;
    }
  }, [lessonId, lessonTitle]);

  const { data: repo, isLoading, isFetching, isError, failureCount, dataUpdatedAt } = useGetRepoState(lessonId || '', {
    query: {
      enabled: !!lessonId,
      queryKey: getGetRepoStateQueryKey(lessonId || ''),
      refetchInterval: 4000
    }
  });

  // Persist the last successfully-fetched repo so the UI can stay visible
  // (dimmed) while the API is unreachable, instead of going blank.
  const lastKnownRepoRef = useRef<typeof repo>(undefined);
  if (repo) {
    lastKnownRepoRef.current = repo;
  }
  const displayRepo = repo ?? lastKnownRepoRef.current;

  // Show the strip as dimmed whenever we are retrying after a failure — React
  // Query keeps `repo` alive while the observer is mounted, so `!repo` alone
  // is not a reliable outage signal.  `lostContact` (isFetching + failureCount)
  // fires within ~4–8 s of the first missed poll and clears the moment a
  // successful fetch completes, giving a tight freeze/resume cycle.
  // The lastKnownRepoRef still guards against the rare case where the cache IS
  // evicted (e.g. query disabled or observer unmounted/remounted mid-outage).
  // Show a reconnecting banner as soon as the second poll cycle begins after a
  // failure: isFetching fires when the retry starts, failureCount >= 1 means at
  // least one attempt already failed.  Together they surface the banner within
  // ~4–8 s of the first missed poll — well before isError, which only becomes
  // true after all retries are exhausted (~30–60 s).
  // React Query resets failureCount to 0 on the next successful fetch, clearing it.
  const lostContact = isFetching && failureCount >= 1;

  const showingStale = lostContact;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetRepoStateQueryKey(lessonId || '') });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center flex-1 h-full min-h-[300px]">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!displayRepo) return null;

  return (
    <div className="space-y-8 pb-12 enter-slide-up max-w-7xl mx-auto w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 border-b border-white/10 pb-6">
        <div>
          <Link href="/test-center" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Test Center
          </Link>
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/10 rounded-md text-primary shadow-sm border border-primary/20 shrink-0">
                <Terminal className="w-6 h-6" />
              </div>
              <span className="min-w-0 break-words">{lessonTitle ? lessonTitle : lessonId}</span>
            </h1>
            {isFetching && <RefreshCw className="w-4 h-4 text-primary animate-spin opacity-50" />}
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
        {lessonId && <MapPeek locationId={lessonId} />}
        <button 
          onClick={handleRefresh}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground text-sm font-bold rounded-lg hover:bg-secondary/80 transition-all active:scale-95 border border-white/10 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Force Refresh
        </button>
        </div>
      </div>

      {lostContact && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
          Lost contact with the practice watcher — reconnecting…
        </div>
      )}

      {lessonId && <WayfindingPanel lessonId={lessonId} />}

      {!displayRepo.hasPlayground ? (
        <div className="surface-card p-10 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-black/50 border border-white/5 shadow-inner text-muted-foreground rounded-xl flex items-center justify-center mx-auto mb-6">
            <Terminal className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-foreground tracking-tight">Playground Not Found</h2>
          <p className="text-muted-foreground mb-8 reading-text mx-auto">You haven't generated the files for this mission yet. Each lesson builds its own practice folder — run this lesson's setup script:</p>
          {isLessonsLoading ? (
            <div className="max-w-md mx-auto flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : folderName ? (
            <div className="max-w-md mx-auto space-y-4 w-full min-w-0">
              <CommandBlock command={`cd ~/git-dojo/${folderName}`} step={1} />
              <CommandBlock command="bash setup.sh" step={2} />
            </div>
          ) : (
            <div className="max-w-md mx-auto space-y-4 w-full min-w-0">
              <p className="text-sm text-muted-foreground">Navigate into the <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">{lessonId}</code> folder inside <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">~/git-dojo/</code>, then run:</p>
              <CommandBlock command="bash setup.sh" />
            </div>
          )}
        </div>
      ) : !displayRepo.initialized ? (
        <div className="surface-card p-10 text-center max-w-2xl mx-auto border-primary/30 shadow-[0_0_30px_rgba(255,107,0,0.1)]">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-6 border border-primary/30 shadow-sm">
            <GitBranch className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-foreground tracking-tight">Initialize Repository</h2>
          <p className="text-muted-foreground mb-8 reading-text mx-auto">
            The folder exists, but it's not a Git repository yet. 
            Open your terminal, navigate to the lesson folder, and initialize it.
          </p>
          <div className="max-w-md mx-auto space-y-4 w-full min-w-0">
            <CommandBlock command={`cd ~/git-dojo/playground/${lessonId}`} step={1} />
            <CommandBlock command="git init" step={2} />
          </div>
        </div>
      ) : (
        <>
          <SummaryPanel summary={displayRepo.summary} isDetached={displayRepo.detachedHead} currentBranch={displayRepo.currentBranch} />

          <TerritoryStrip
            repo={displayRepo}
            lastFetchedAt={dataUpdatedAt}
            dimmed={showingStale}
            onFileClick={(path) => setDiffSelection({ kind: "file", path })}
            onCommitClick={(hash, shortHash) => setDiffSelection({ kind: "commit", hash, shortHash })}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <FileStatus
                files={displayRepo.files}
                onFileClick={(f) => setDiffSelection({ kind: "file", path: f.path })}
              />
              <CommitTimeline
                commits={displayRepo.commits}
                branches={displayRepo.branches}
                remoteBranches={displayRepo.remoteBranches}
                currentBranch={displayRepo.currentBranch}
                syncStatus={displayRepo.syncStatus}
                onCommitClick={(c) => setDiffSelection({ kind: "commit", hash: c.hash, shortHash: c.shortHash })}
              />
            </div>
            <div className="space-y-8">
              {displayRepo.hasBot && <TeammateAction lessonId={lessonId!} />}
              <CheckRunner lessonId={lessonId!} />
              <BranchList branches={displayRepo.branches} />
            </div>
          </div>
        </>
      )}

      {lessonId && (
        <DiffViewer source={{ kind: "lesson", id: lessonId }} selection={diffSelection} onClose={() => setDiffSelection(null)} />
      )}
    </div>
  );
}
