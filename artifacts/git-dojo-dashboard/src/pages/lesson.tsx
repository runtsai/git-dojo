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
      refetchInterval: 3000
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
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground mb-4 transition-colors uppercase tracking-wider">
            <ArrowLeft className="w-4 h-4" /> Curriculum
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-extrabold text-foreground tracking-tight">
              {lessonId}
            </h1>
            {isFetching && <RefreshCw className="w-5 h-5 text-primary animate-spin" />}
          </div>
        </div>
        
        <button 
          onClick={handleRefresh}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/90 transition-colors active:scale-95 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Force Refresh
        </button>
      </div>

      {!repo.hasPlayground ? (
        <div className="bg-card border rounded-3xl p-10 text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-20 h-20 bg-muted text-muted-foreground rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Terminal className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-foreground">Playground Not Found</h2>
          <p className="text-lg text-muted-foreground mb-8">You haven't generated the files for this lesson yet.</p>
          <div className="bg-foreground text-background font-mono p-5 rounded-xl text-left text-lg">
            <span className="text-primary font-bold">$</span> bash setup.sh
          </div>
        </div>
      ) : !repo.initialized ? (
        <div className="bg-card border-2 border-primary/20 rounded-3xl p-10 text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <GitBranch className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-foreground">Initialize Repository</h2>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            The folder exists, but it's not a Git repository yet. 
            Open your terminal, navigate to the lesson folder, and initialize it.
          </p>
          <div className="bg-foreground text-background font-mono p-5 rounded-xl text-left text-lg inline-block w-full">
            <span className="text-primary font-bold">$</span> git init
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
