import { useEffect, useRef, useState } from "react";
import type { RepoState } from "@workspace/api-client-react";
import { ArrowRight, ArrowDown, FolderOpen } from "lucide-react";
import { ComputerIcon, TrayIcon, SealedBoxIcon, CloudIcon } from "@/components/git-icons";

/**
 * The live "territory strip": the Map's four places as lanes, populated from
 * the learner's ACTUAL repo state. When consecutive snapshots differ, the
 * strip narrates what moved (e.g. `git add` slides a file from the Workbench
 * to the Loading Dock) in plain language.
 */

type LaneId = "workbench" | "dock" | "sealed" | "shared";

const LANE_LABELS: Record<LaneId, string> = {
  workbench: "The Workbench",
  dock: "The Loading Dock",
  sealed: "Your Sealed Record",
  shared: "The Shared Record",
};

type MovementEvent = {
  id: number;
  from: LaneId | null;
  to: LaneId | null;
  text: string;
  /** Chip keys (file paths or commit hashes) to highlight in their new lane. */
  freshKeys: string[];
};

/** Files sitting (at least partly) on the Workbench: unstaged work. */
function workbenchFiles(repo: RepoState) {
  return repo.files.filter(
    (f) =>
      f.status === "modified" ||
      f.status === "untracked" ||
      f.status === "deleted" ||
      f.status === "staged_and_modified" ||
      f.status === "conflicted",
  );
}

/** Files boxed up on the Loading Dock: staged for the next commit. */
function dockFiles(repo: RepoState) {
  return repo.files.filter((f) => f.status === "staged" || f.status === "staged_and_modified");
}

function plural(n: number, one: string, many?: string) {
  return n === 1 ? one : (many ?? one + "s");
}

/** Compare two snapshots and narrate what moved between the Map's places. */
export function detectMovements(prev: RepoState, next: RepoState, counter: () => number): MovementEvent[] {
  const events: MovementEvent[] = [];
  const prevByPath = new Map(prev.files.map((f) => [f.path, f.status]));
  const nextByPath = new Map(next.files.map((f) => [f.path, f.status]));
  const prevHashes = new Set(prev.commits.map((c) => c.hash));
  const newCommits = next.commits.filter((c) => !prevHashes.has(c.hash));
  const prevStaged = new Set(dockFiles(prev).map((f) => f.path));
  // Remote-tracking heads changing means a fetch/pull/clone brought commits
  // in from the Shared Record — those must never be narrated as local seals.
  const remoteHeads = (r: RepoState) => r.remoteBranches.map((b) => `${b.name}@${b.headHash}`).sort().join("|");
  const remoteChanged = remoteHeads(prev) !== remoteHeads(next);
  const behindDecreased = !!(prev.syncStatus && next.syncStatus && next.syncStatus.behind < prev.syncStatus.behind && prev.syncStatus.behind > 0);
  const isLocalSeal = newCommits.length > 0 && (prevStaged.size > 0 || (!remoteChanged && !behindDecreased));

  // Files newly staged: Workbench -> Loading Dock
  const nowStaged = dockFiles(next)
    .map((f) => f.path)
    .filter((p) => !prevStaged.has(p));
  if (nowStaged.length > 0) {
    const names = nowStaged.slice(0, 3).join(", ") + (nowStaged.length > 3 ? ` and ${nowStaged.length - 3} more` : "");
    events.push({
      id: counter(),
      from: "workbench",
      to: "dock",
      text: `${names} ${nowStaged.length === 1 ? "is" : "are"} now on the Loading Dock — staged, but not yet sealed.`,
      freshKeys: nowStaged,
    });
  }

  // Files that left the dock without a new commit: unstaged back to the Workbench
  const leftDock = [...prevStaged].filter((p) => {
    const s = nextByPath.get(p);
    return s !== undefined && s !== "staged" && s !== "staged_and_modified";
  });
  if (newCommits.length === 0 && leftDock.length > 0) {
    const names = leftDock.slice(0, 3).join(", ");
    events.push({
      id: counter(),
      from: "dock",
      to: "workbench",
      text: `${names} moved back to the Workbench — unstaged, the edits themselves are untouched.`,
      freshKeys: leftDock,
    });
  }

  // New local commit(s): Loading Dock -> Sealed Record
  if (isLocalSeal) {
    const first = newCommits[0];
    if (first) {
      const isMerge = (first.parents?.length ?? 0) > 1;
      events.push({
        id: counter(),
        from: "dock",
        to: "sealed",
        text: isMerge
          ? `Sealed a merge: “${first.subject}” (${first.shortHash}) joined two timelines into your Sealed Record.`
          : `Sealed! “${first.subject}” is now snapshot ${first.shortHash} in your Sealed Record${newCommits.length > 1 ? ` (+${newCommits.length - 1} more)` : ""}.`,
        freshKeys: newCommits.map((c) => c.hash),
      });
    }
  }

  // Push / pull / fetch: compare ahead/behind
  const ps = prev.syncStatus;
  const ns = next.syncStatus;
  if (ps && ns) {
    // Compound local-seal + push: when a commit was just sealed locally AND
    // everything ended up synchronized (ahead===0), the new commit(s) traveled
    // to the Shared Record in the same cycle and must be counted too.
    const sealedAndPushedAll = isLocalSeal && ns.ahead === 0;

    if (ns.ahead < ps.ahead && ps.ahead > 0) {
      // Include newly sealed commits in the count when they went out in the same cycle.
      const sent = (ps.ahead - ns.ahead) + (sealedAndPushedAll ? newCommits.length : 0);
      events.push({
        id: counter(),
        from: "sealed",
        to: "shared",
        text: `Pushed — ${sent} ${plural(sent, "commit")} traveled to the Shared Record. GitHub now has ${ns.ahead === 0 ? "everything you have" : "more of your work"}.`,
        freshKeys: [],
      });
    } else if (sealedAndPushedAll && ps.ahead === 0 && newCommits.length > 0) {
      // Commit + immediate push: ahead was 0 before the commit too, so the
      // ahead delta alone is invisible — but the new commit is already in sync.
      const sent = newCommits.length;
      events.push({
        id: counter(),
        from: "sealed",
        to: "shared",
        text: `Pushed — ${sent} ${plural(sent, "commit")} traveled to the Shared Record. GitHub now has everything you have.`,
        freshKeys: [],
      });
    }
    if (ns.behind < ps.behind && ps.behind > 0) {
      const got = ps.behind - ns.behind;
      events.push({
        id: counter(),
        from: "shared",
        to: "sealed",
        text: `Brought down ${got} ${plural(got, "commit")} from the Shared Record into your Sealed Record.`,
        freshKeys: [],
      });
    }
    if (ns.behind > ps.behind) {
      events.push({
        id: counter(),
        from: "shared",
        to: "sealed",
        text: remoteChanged
          ? `Fetched — your map of the Shared Record updated: ${ns.behind} ${plural(ns.behind, "commit")} up there ${ns.behind === 1 ? "isn't" : "aren't"} in your working history yet.`
          : `The Shared Record moved ahead — ${ns.behind} ${plural(ns.behind, "commit")} up there ${ns.behind === 1 ? "isn't" : "aren't"} on your machine yet.`,
        freshKeys: [],
      });
    }
  } else if (!ps && ns && (ns.ahead > 0 || ns.behind > 0 || prev.remotes.length === 0) && next.remotes.length > 0 && prev.remotes.length === 0) {
    events.push({
      id: counter(),
      from: null,
      to: "shared",
      text: `A remote appeared — this repo is now connected to a Shared Record (${next.remotes.join(", ")}).`,
      freshKeys: [],
    });
  }

  // A pull without prior fetch: new commits arrived while the dock was
  // empty and remote heads moved, but ahead/behind never showed a gap.
  if (!isLocalSeal && newCommits.length > 0 && (remoteChanged || behindDecreased) && !events.some((e) => e.from === "shared")) {
    events.push({
      id: counter(),
      from: "shared",
      to: "sealed",
      text: `${newCommits.length} ${plural(newCommits.length, "commit")} arrived from the Shared Record into your local history.`,
      freshKeys: newCommits.map((c) => c.hash),
    });
  }

  // Branch switch / detached HEAD
  if (prev.currentBranch !== next.currentBranch || prev.detachedHead !== next.detachedHead) {
    if (next.detachedHead && !prev.detachedHead) {
      events.push({
        id: counter(),
        from: "sealed",
        to: "workbench",
        text: "You stepped off the timeline to inspect an old snapshot (detached HEAD) — the Workbench now shows that moment.",
        freshKeys: [],
      });
    } else if (next.currentBranch && next.currentBranch !== prev.currentBranch) {
      const isNew = !prev.branches.some((b) => b.name === next.currentBranch);
      events.push({
        id: counter(),
        from: "sealed",
        to: "workbench",
        text: isNew
          ? `New timeline: branch ${next.currentBranch} was created and your Workbench now follows it.`
          : `Switched to branch ${next.currentBranch} — the Workbench files jumped to that timeline.`,
        freshKeys: [],
      });
    }
  }

  // Merge state
  if (!prev.mergeInProgress && next.mergeInProgress) {
    events.push({
      id: counter(),
      from: null,
      to: "workbench",
      text: "A merge hit a conflict — Git stopped and is waiting for your ruling on the Workbench.",
      freshKeys: next.files.filter((f) => f.status === "conflicted").map((f) => f.path),
    });
  }

  // Brand-new files appearing on the Workbench (edits/creations)
  if (events.length === 0) {
    const appeared = next.files
      .filter((f) => !prevByPath.has(f.path) && (f.status === "untracked" || f.status === "modified"))
      .map((f) => f.path);
    const changed = next.files
      .filter((f) => {
        const was = prevByPath.get(f.path);
        return was !== undefined && was !== f.status && f.status === "modified";
      })
      .map((f) => f.path);
    const touched = [...appeared, ...changed];
    if (touched.length > 0) {
      const names = touched.slice(0, 3).join(", ");
      events.push({
        id: counter(),
        from: null,
        to: "workbench",
        text: `${names} ${touched.length === 1 ? "changed" : "changed"} on the Workbench — Git sees the edit, but nothing is staged or sealed yet.`,
        freshKeys: touched,
      });
    }
  }

  return events;
}

function Chip({ label, fresh, tone, onClick, testId }: { label: string; fresh: boolean; tone: "workbench" | "dock" | "sealed" | "shared"; onClick?: () => void; testId?: string }) {
  const toneClass =
    tone === "dock"
      ? "bg-primary/10 border-primary/25 text-primary"
      : tone === "sealed"
        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
        : tone === "shared"
          ? "bg-sky-500/10 border-sky-500/25 text-sky-400"
          : "bg-white/5 border-white/10 text-foreground/80";
  const cls = `inline-block max-w-full truncate font-mono text-xs px-2 py-1 rounded-md border ${toneClass} ${
    fresh ? "ring-2 ring-primary/60 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:slide-in-from-left-4 motion-safe:duration-500 shadow-[0_0_12px_rgba(255,107,0,0.25)]" : ""
  }`;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${cls} text-left cursor-pointer transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
        title={`${label} — see what changed`}
        data-testid={testId}
      >
        {label}
      </button>
    );
  }
  return (
    <span className={cls} title={label}>
      {label}
    </span>
  );
}

function Lane({
  id,
  icon: Icon,
  active,
  children,
  count,
  subtitle,
}: {
  id: LaneId;
  icon: React.ElementType;
  active: boolean;
  children: React.ReactNode;
  count?: string;
  subtitle: string;
}) {
  return (
    <div
      className={`relative flex-1 min-w-0 rounded-xl border p-4 motion-safe:transition-all motion-safe:duration-500 ${
        active
          ? "border-primary/40 bg-primary/[0.04] shadow-[0_0_18px_rgba(255,107,0,0.12)]"
          : "border-white/10 bg-black/30 shadow-inner"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
        <span className={`text-xs font-bold uppercase tracking-widest truncate ${active ? "text-primary" : "text-muted-foreground"}`}>
          {LANE_LABELS[id]}
        </span>
        {count !== undefined && (
          <span className="ml-auto text-xs font-mono font-bold text-foreground/70 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 shrink-0">
            {count}
          </span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 leading-snug">{subtitle}</p>
      <div className="flex flex-col gap-1.5 min-w-0">{children}</div>
    </div>
  );
}

function LaneArrow({ lit }: { lit: boolean }) {
  return (
    <div className="flex items-center justify-center shrink-0 self-stretch px-0.5" aria-hidden="true">
      <ArrowRight
        className={`hidden md:block w-4 h-4 transition-colors duration-500 ${lit ? "text-primary motion-safe:animate-pulse" : "text-white/20"}`}
      />
      <ArrowDown
        className={`md:hidden w-4 h-4 transition-colors duration-500 ${lit ? "text-primary motion-safe:animate-pulse" : "text-white/20"}`}
      />
    </div>
  );
}

const MAX_CHIPS = 4;
const MAX_EVENTS = 3;

// If more than this many milliseconds pass between two consecutive successful
// fetches, the API was likely down. Re-baseline without narrating the gap as
// movements. Exported so it can be unit-tested independently.
export const STALE_GAP_MS = 20_000;

/**
 * Returns true when the gap between two consecutive React Query `dataUpdatedAt`
 * timestamps exceeds the stale threshold — indicating the API was unreachable
 * and the previous snapshot should not be diffed against the recovered one.
 *
 * `prevFetchedAt` of 0 means no prior fetch has been recorded yet (first load),
 * which is not a stale gap.
 */
export function isStaleGap(prevFetchedAt: number, currentFetchedAt: number): boolean {
  return prevFetchedAt > 0 && currentFetchedAt - prevFetchedAt > STALE_GAP_MS;
}

export function TerritoryStrip({
  repo,
  lastFetchedAt,
  onFileClick,
  onCommitClick,
}: {
  repo: RepoState;
  /**
   * React Query's `dataUpdatedAt` for the repo-state query.  This value
   * advances on EVERY successful fetch — even when the response data is
   * reference-identical to the previous one — so it reliably tracks poll
   * cadence and lets the strip detect a connectivity gap.
   */
  lastFetchedAt: number;
  /** When provided, clicking a file chip reveals its working-copy changes. */
  onFileClick?: (path: string) => void;
  /** When provided, clicking a commit chip reveals what that snapshot changed. */
  onCommitClick?: (hash: string, shortHash: string) => void;
}) {
  const prevRef = useRef<RepoState | null>(null);
  const prevFetchedAtRef = useRef<number>(0);
  const idRef = useRef(0);
  const [events, setEvents] = useState<MovementEvent[]>([]);

  useEffect(() => {
    const prev = prevRef.current;
    // isStaleGap compares consecutive dataUpdatedAt timestamps.  Because
    // dataUpdatedAt advances even when data is reference-identical, this effect
    // runs (and prevFetchedAtRef advances) on every successful poll — not only
    // when repo data changes — so stable polls never accumulate a false gap.
    const stale = isStaleGap(prevFetchedAtRef.current, lastFetchedAt);

    // Only compare snapshots of the same lesson's initialized repo,
    // and skip the diff if the previous snapshot is stale (gap after API downtime).
    if (!stale && prev && prev.lessonId === repo.lessonId && prev.initialized && repo.initialized) {
      const found = detectMovements(prev, repo, () => ++idRef.current);
      if (found.length > 0) {
        setEvents((old) => [...found.reverse(), ...old].slice(0, MAX_EVENTS));
      }
    }

    prevRef.current = repo;
    prevFetchedAtRef.current = lastFetchedAt;
  }, [repo, lastFetchedAt]);

  const wb = workbenchFiles(repo);
  const dk = dockFiles(repo);
  const latest = events[0];
  const hasRemote = repo.remotes.length > 0;
  const sync = repo.syncStatus;
  const fresh = new Set(latest?.freshKeys ?? []);

  return (
    <div className="surface-card p-5 md:p-6 overflow-hidden" data-testid="territory-strip">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-base font-bold text-foreground tracking-tight">Where your work is right now</h3>
        {repo.repoFolder && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-sky-400 bg-sky-500/10 border border-sky-500/25 rounded px-2 py-1">
            <FolderOpen className="w-3.5 h-3.5" /> standing in: {repo.repoFolder}/
          </span>
        )}
        <span className="hidden sm:block ml-auto text-[11px] text-muted-foreground">same places as the Map</span>
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-stretch">
        <Lane
          id="workbench"
          icon={ComputerIcon}
          active={latest?.to === "workbench" || latest?.from === "workbench"}
          count={String(wb.length)}
          subtitle="Live files you can edit"
        >
          {wb.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">Clean — everything matches the latest snapshot.</span>
          ) : (
            <>
              {wb.slice(0, MAX_CHIPS).map((f) => (
                <Chip
                  key={f.path}
                  label={`${f.path}${f.status === "conflicted" ? " ⚠" : ""}`}
                  fresh={fresh.has(f.path) && (latest?.to === "workbench")}
                  tone="workbench"
                  onClick={onFileClick ? () => onFileClick(f.path) : undefined}
                  testId={`strip-workbench-${f.path}`}
                />
              ))}
              {wb.length > MAX_CHIPS && <span className="text-[11px] text-muted-foreground">+{wb.length - MAX_CHIPS} more</span>}
            </>
          )}
        </Lane>

        <LaneArrow lit={latest?.from === "workbench" && latest?.to === "dock"} />

        <Lane
          id="dock"
          icon={TrayIcon}
          active={latest?.to === "dock" || latest?.from === "dock"}
          count={String(dk.length)}
          subtitle="Staged — boxed up for the next seal"
        >
          {dk.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">Empty — nothing staged.</span>
          ) : (
            <>
              {dk.slice(0, MAX_CHIPS).map((f) => (
                <Chip
                  key={f.path}
                  label={f.path}
                  fresh={fresh.has(f.path) && latest?.to === "dock"}
                  tone="dock"
                  onClick={onFileClick ? () => onFileClick(f.path) : undefined}
                  testId={`strip-dock-${f.path}`}
                />
              ))}
              {dk.length > MAX_CHIPS && <span className="text-[11px] text-muted-foreground">+{dk.length - MAX_CHIPS} more</span>}
            </>
          )}
        </Lane>

        <LaneArrow lit={latest?.from === "dock" && latest?.to === "sealed"} />

        <Lane
          id="sealed"
          icon={SealedBoxIcon}
          active={latest?.to === "sealed" || latest?.from === "sealed"}
          count={String(repo.commits.length)}
          subtitle="Permanent snapshots on your machine"
        >
          {repo.commits.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">No commits yet — nothing sealed.</span>
          ) : (
            <>
              {repo.commits.slice(0, MAX_CHIPS - 1).map((c) => (
                <Chip
                  key={c.hash}
                  label={`${c.shortHash} ${c.subject}`}
                  fresh={fresh.has(c.hash)}
                  tone="sealed"
                  onClick={onCommitClick ? () => onCommitClick(c.hash, c.shortHash) : undefined}
                  testId={`strip-sealed-${c.shortHash}`}
                />
              ))}
              {repo.commits.length > MAX_CHIPS - 1 && (
                <span className="text-[11px] text-muted-foreground">+{repo.commits.length - (MAX_CHIPS - 1)} older</span>
              )}
            </>
          )}
        </Lane>

        <LaneArrow lit={(latest?.from === "sealed" && latest?.to === "shared") || (latest?.from === "shared" && latest?.to === "sealed")} />

        <Lane
          id="shared"
          icon={CloudIcon}
          active={latest?.to === "shared" || latest?.from === "shared"}
          subtitle={hasRemote ? "GitHub's copy of the record" : "No remote in this lesson"}
        >
          {!hasRemote ? (
            <span className="text-xs text-muted-foreground italic">This repo lives only on your machine.</span>
          ) : sync ? (
            <>
              {sync.ahead === 0 && sync.behind === 0 && (
                <span className="text-xs text-emerald-400 font-medium">In sync with {sync.remoteBranch}.</span>
              )}
              {sync.ahead > 0 && (
                <span className="text-xs text-amber-400 font-medium">
                  {sync.ahead} {plural(sync.ahead, "commit")} here {sync.ahead === 1 ? "hasn't" : "haven't"} been pushed yet.
                </span>
              )}
              {sync.behind > 0 && (
                <span className="text-xs text-sky-400 font-medium">
                  GitHub has {sync.behind} {plural(sync.behind, "commit")} you don't have yet.
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground italic">
              Connected ({repo.remotes.join(", ")}) — no comparison for this branch yet.
            </span>
          )}
        </Lane>
      </div>

      {events.length > 0 && (
        <div className="mt-4 space-y-1.5" aria-live="polite">
          {events.map((e, i) => (
            <div
              key={e.id}
              className={`flex flex-wrap items-center gap-2 text-sm rounded-lg border px-3 py-2 ${
                i === 0
                  ? "border-primary/30 bg-primary/[0.06] text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-500"
                  : "border-white/5 bg-black/20 text-muted-foreground"
              }`}
            >
              {e.from && e.to && (
                <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold tracking-wider rounded px-1.5 py-0.5 border ${i === 0 ? "text-primary border-primary/30 bg-primary/10" : "text-muted-foreground border-white/10 bg-white/5"}`}>
                  {LANE_LABELS[e.from].replace("The ", "").replace("Your ", "")}
                  <ArrowRight className="w-3 h-3" />
                  {LANE_LABELS[e.to].replace("The ", "").replace("Your ", "")}
                </span>
              )}
              <span className="min-w-0">{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
