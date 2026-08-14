import { useGetRepoState, getGetRepoStateQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, RefreshCw, Terminal, GitBranch } from "lucide-react";
import { SummaryPanel } from "@/components/repo-view/summary-panel";
import { FileStatus } from "@/components/repo-view/file-status";
import { CommitTimeline } from "@/components/repo-view/commit-timeline";
import { BranchList } from "@/components/repo-view/branch-list";
import { CheckRunner } from "@/components/repo-view/check-runner";
import { useQueryClient } from "@tanstack/react-query";

export function LessonView() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const queryClient = useQueryClient();
  
  const { data: repo, isLoading, isFetching } = useGetRepoState(lessonId || '', {
    query: {
      enabled: !!lessonId,
      queryKey: getGetRepoStateQueryKey(lessonId || ''),
      refetchInterval: 4000
    }
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetRepoStateQueryKey(lessonId || '') });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!repo) return null;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 border-b border-white/10 pb-6">
        <div>
          <Link href="/test-center" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-colors uppercase tracking-wider bg-black/40 border border-white/5 px-3 py-1.5 rounded">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Test Center
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
              <Terminal className="w-6 h-6 text-primary" />
              {lessonId}
            </h1>
            {isFetching && <RefreshCw className="w-4 h-4 text-primary animate-spin" />}
          </div>
        </div>
        
        <button 
          onClick={handleRefresh}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground text-sm font-bold rounded hover:bg-secondary/80 transition-colors border border-white/10"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Force Refresh
        </button>
      </div>

      {!repo.hasPlayground ? (
        <div className="bg-card border border-white/10 rounded-xl p-10 text-center max-w-2xl mx-auto shadow-lg">
          <div className="w-16 h-16 bg-black/50 border border-white/5 text-muted-foreground rounded flex items-center justify-center mx-auto mb-6">
            <Terminal className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-foreground">Playground Not Found</h2>
          <p className="text-muted-foreground mb-8">You haven't generated the files for this mission yet.</p>
          <div className="bg-black/60 border border-white/5 font-mono p-5 rounded-lg text-left text-lg">
            <span className="text-primary font-bold">$</span> <span className="text-emerald-400">bash setup.sh</span>
          </div>
        </div>
      ) : !repo.initialized ? (
        <div className="bg-card border border-primary/20 rounded-xl p-10 text-center max-w-2xl mx-auto shadow-lg shadow-primary/5">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded flex items-center justify-center mx-auto mb-6 border border-primary/20">
            <GitBranch className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-foreground">Initialize Repository</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            The folder exists, but it's not a Git repository yet. 
            Open your terminal, navigate to the lesson folder, and initialize it.
          </p>
          <div className="bg-black/60 border border-white/5 font-mono p-5 rounded-lg text-left text-lg inline-block w-full">
            <span className="text-primary font-bold">$</span> <span className="text-emerald-400">git init</span>
          </div>
        </div>
      ) : (
        <>
          <SummaryPanel summary={repo.summary} isDetached={repo.detachedHead} currentBranch={repo.currentBranch} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <FileStatus files={repo.files} />
              <CommitTimeline commits={repo.commits} />
            </div>
            <div className="space-y-8">
              <CheckRunner lessonId={lessonId!} />
              <BranchList branches={repo.branches} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
