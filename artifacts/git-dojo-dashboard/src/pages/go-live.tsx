import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCapstoneStatus,
  getGetCapstoneStatusQueryKey,
  useCreateCapstoneRepo,
  useDeleteCapstoneRepo,
  useVerifyCapstoneMission,
  type CapstoneStatus,
} from "@workspace/api-client-react";
import {
  Rocket,
  Github,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Loader2,
  Trash2,
  Trophy,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  ShieldAlert,
} from "lucide-react";

function CommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="bg-black/60 border border-white/10 rounded-lg p-3 pr-12 text-xs sm:text-sm font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap break-all shadow-inner">
        {command}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        aria-label="Copy command"
        className="absolute top-2 right-2 p-2 rounded-md bg-secondary/80 border border-white/10 text-muted-foreground hover:text-foreground transition-all active:scale-90"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

const MISSION_META: Record<
  string,
  { icon: typeof GitCommitHorizontal; briefing: string; commands: (s: CapstoneStatus) => string }
> = {
  "push-commit": {
    icon: GitCommitHorizontal,
    briefing:
      "Make any change in your local clone, seal it into a commit, and push it to GitHub. This is the everyday loop of real work.",
    commands: (s) =>
      `cd ${s.repo?.name ?? "dojo-live-capstone"}\necho "My first real push" >> notes.md\ngit add notes.md\ngit commit -m "Add my first note"\ngit push`,
  },
  "create-branch": {
    icon: GitBranch,
    briefing:
      "Create a branch of your own and push it up. Branches are how you work on ideas without touching the main line.",
    commands: () => `git switch -c my-experiment\ngit push -u origin my-experiment`,
  },
  "merge-pr": {
    icon: GitMerge,
    briefing:
      "Dojo opened a real pull request in your repo. Open it on GitHub, read the change, and press “Merge pull request”. No commands this time — this one happens on GitHub itself.",
    commands: () => "",
  },
};

interface MissionVerificationResult {
  verified: boolean;
  githubUnavailable: boolean;
  detail: string;
}

export function MissionVerificationNotice({
  result,
}: {
  result: MissionVerificationResult;
}) {
  return (
    <div
      role="status"
      className={`text-sm rounded-lg p-3 flex items-start gap-2 border ${
        result.verified
          ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
          : result.githubUnavailable
            ? "text-red-300 bg-red-500/10 border-red-500/20"
            : "text-amber-300 bg-amber-500/10 border-amber-500/20"
      }`}
    >
      {result.verified ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : result.githubUnavailable ? (
        <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      )}
      <span className="leading-relaxed">
        {result.githubUnavailable
          ? "Can’t reach GitHub right now — try checking your work again in a moment."
          : result.detail}
      </span>
    </div>
  );
}

export function GoLive() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useGetCapstoneStatus({
    query: { queryKey: getGetCapstoneStatusQueryKey() },
  });
  const [verifyResults, setVerifyResults] = useState<Record<string, MissionVerificationResult>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Go Live | Git Dojo";
  }, []);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetCapstoneStatusQueryKey() });

  const createRepo = useCreateCapstoneRepo({
    mutation: {
      onSuccess: () => {
        setActionError(null);
        invalidate();
      },
      onError: (err) => setActionError(err.data?.error ?? err.message ?? "Repo creation failed."),
    },
  });
  const deleteRepo = useDeleteCapstoneRepo({
    mutation: {
      onSuccess: () => {
        setActionError(null);
        setVerifyResults({});
        invalidate();
      },
      onError: (err) => {
        setActionError(err.data?.error ?? err.message ?? "Repo deletion failed.");
        // The server may have reset capstone state even when GitHub refused
        // the deletion — refetch so the UI reflects the truth.
        setVerifyResults({});
        invalidate();
      },
    },
  });
  const verify = useVerifyCapstoneMission({
    mutation: {
      onSuccess: (result) => {
        setVerifyResults((prev) => ({
          ...prev,
          [result.missionId]: {
            verified: result.verified,
            githubUnavailable: result.githubUnavailable,
            detail: result.detail,
          },
        }));
        setVerifyingId(null);
        if (!result.githubUnavailable) invalidate();
      },
      onError: (err, vars) => {
        setVerifyResults((prev) => ({
          ...prev,
          [vars.missionId]: {
            verified: false,
            githubUnavailable: false,
            detail: err.data?.error ?? err.message ?? "Verification request failed — try again.",
          },
        }));
        setVerifyingId(null);
      },
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center flex-1 min-h-[300px]">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const connected = status?.githubConnected ?? false;
  const repo = status?.repo ?? null;
  const badgeEarned = !!status?.badgeEarnedAt;
  const verifiedCount = status?.missions.filter((m) => m.verified).length ?? 0;

  return (
    <div className="enter-slide-up max-w-3xl mx-auto space-y-8 w-full">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-primary text-sm font-bold tracking-widest uppercase">
          <Rocket className="w-4 h-4" /> Capstone · Optional
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl heading-tight text-foreground">
          Go Live: do it for real
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground reading-text">
          Everything so far was a safe simulation. This capstone takes off the training wheels: Dojo
          creates a <span className="text-foreground font-semibold">real repository on your GitHub
          account</span>, opens a real pull request, and only grants the badge after checking your
          real repo through the GitHub API. It requires a GitHub account and is completely
          optional.
        </p>
      </div>

      {badgeEarned && (
        <div className="surface-card p-6 sm:p-8 border-emerald-500/40 bg-emerald-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Trophy className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Live Badge earned</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Every mission was verified against your real repository on GitHub — no simulation,
                no self-reporting. You have actually done it where it counts.
              </p>
            </div>
          </div>
        </div>
      )}

      {!connected ? (
        <div className="surface-card p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <Github className="w-6 h-6 text-muted-foreground" />
            <h2 className="text-xl font-bold text-foreground">GitHub not connected</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This capstone needs a connected GitHub account so Dojo can create your practice repo
            and verify your work through the GitHub API. Connect GitHub to this workspace through
            Replit's GitHub integration, then come back here — the rest of Git Dojo works fine
            without it.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70 bg-black/40 border border-white/5 rounded-lg p-3">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            Nothing is broken — this section simply waits until an account is connected.
          </div>
        </div>
      ) : (
        <>
          <div className="surface-card p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Github className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Step 1 · Your real practice repo</h2>
              </div>
              <span className="text-xs font-mono bg-secondary/60 border border-white/10 rounded-full px-3 py-1 text-muted-foreground">
                @{status?.githubLogin}
              </span>
            </div>

            {!repo ? (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Dojo will create a public repository named{" "}
                  <span className="font-mono text-foreground">dojo-live-capstone</span> on your
                  account (clearly dojo-prefixed, safe to delete at any time) and open a practice
                  pull request inside it.
                </p>
                <button
                  onClick={() => createRepo.mutate()}
                  disabled={createRepo.isPending}
                  className="w-full sm:w-auto bg-primary text-primary-foreground font-bold px-6 py-3 rounded-lg transition-all active:scale-95 hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {createRepo.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating on GitHub…</>
                  ) : (
                    <><Rocket className="w-4 h-4" /> Create my practice repo</>
                  )}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-primary hover:underline flex items-center gap-1.5 break-all"
                  >
                    {repo.fullName} <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Live on GitHub
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Clone it to your own machine:</p>
                <CommandBlock command={`git clone ${repo.cloneUrl}`} />
              </>
            )}
            {actionError && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {actionError}
              </div>
            )}
          </div>

          {repo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <h2 className="text-xl font-bold text-foreground">Step 2 · Missions</h2>
                <span className="text-xs font-bold text-muted-foreground">
                  {verifiedCount} / {status?.missions.length ?? 3} verified
                </span>
              </div>

              {status?.missions.map((mission, idx) => {
                const meta = MISSION_META[mission.id];
                const Icon = meta?.icon ?? GitCommitHorizontal;
                const result = verifyResults[mission.id];
                const commands = meta?.commands(status) ?? "";
                return (
                  <div
                    key={mission.id}
                    className={`surface-card p-5 sm:p-6 space-y-4 ${
                      mission.verified ? "border-emerald-500/30 bg-emerald-500/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                          mission.verified
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                            : "bg-background border-muted-foreground/30 text-muted-foreground"
                        }`}
                      >
                        {mission.verified ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold tracking-widest uppercase text-primary">
                          Mission {idx + 1}
                        </div>
                        <h3 className="font-bold text-foreground">{mission.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {meta?.briefing}
                        </p>
                      </div>
                    </div>

                    {commands && <CommandBlock command={commands} />}
                    {mission.id === "merge-pr" && status.prUrl && (
                      <a
                        href={status.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                      >
                        <GitMerge className="w-4 h-4" /> Open PR #{status.prNumber} on GitHub{" "}
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {result && <MissionVerificationNotice result={result} />}

                    <button
                      onClick={() => {
                        setVerifyingId(mission.id);
                        verify.mutate({ missionId: mission.id });
                      }}
                      disabled={verifyingId === mission.id}
                      className={`w-full sm:w-auto font-bold px-5 py-2.5 rounded-lg text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 border ${
                        mission.verified
                          ? "bg-black/30 border-white/10 text-muted-foreground hover:text-foreground"
                          : "bg-secondary border-white/10 text-foreground hover:bg-secondary/70 shadow-md"
                      }`}
                    >
                      {verifyingId === mission.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Asking GitHub…</>
                      ) : mission.verified ? (
                        "Re-check"
                      ) : (
                        "Check my work"
                      )}
                    </button>
                  </div>
                );
              })}

              <div className="surface-card p-5 sm:p-6 border-red-500/20 space-y-3">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-400" /> Done practicing?
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This resets the capstone and asks GitHub to delete{" "}
                  <span className="font-mono">{repo.fullName}</span>. Connected GitHub accounts
                  usually don't permit automatic deletion — if GitHub refuses, you'll get a link to
                  delete it yourself in{" "}
                  <a
                    href={`${repo.htmlUrl}/settings`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    the repo's settings
                  </a>
                  . Your earned badge stays either way.
                </p>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Reset the capstone and try to delete ${repo.fullName} from GitHub?`,
                      )
                    )
                      deleteRepo.mutate();
                  }}
                  disabled={deleteRepo.isPending}
                  className="text-sm font-bold px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  {deleteRepo.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Resetting…</>
                  ) : (
                    <>Reset capstone &amp; delete repo</>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
