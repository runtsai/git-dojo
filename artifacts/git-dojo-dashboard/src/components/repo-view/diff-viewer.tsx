import { useEffect } from "react";
import {
  useGetCommitDiff,
  useGetWorkingFileDiff,
  useGetCrisisCommitDiff,
  useGetCrisisFileDiff,
  FileDiff,
  DiffLine,
} from "@workspace/api-client-react";
import { X, FileText, User, Clock, GitMerge, Package, Wrench } from "lucide-react";

/**
 * Plain-language diff viewer: what a sealed snapshot actually changed, or how
 * a working-copy file differs from the last snapshot (split by staged vs
 * unstaged — the Loading Dock vs the Workbench, matching the Map vocabulary).
 */

export type DiffSelection =
  | { kind: "commit"; hash: string; shortHash: string }
  | { kind: "file"; path: string };

/**
 * Which API to fetch diffs from. "lesson" uses the dojo lesson endpoints;
 * "crisis" uses the crisis scenario endpoints (commit-only — no working-file diff).
 */
export type DiffSource =
  | { kind: "lesson"; id: string }
  | { kind: "crisis"; id: string };

function DiffLines({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto">
      {lines.map((line, i) =>
        line.kind === "hunk" ? (
          <div key={i} className="flex px-4 py-1 bg-sky-950/40 text-sky-300/80 border-y border-sky-500/10 select-none">
            <span className="w-6 shrink-0 text-right pr-3 text-sky-500/50">⋯</span>
            <span className="italic">skipping ahead{line.text ? ` to: ${line.text}` : ""}</span>
          </div>
        ) : line.kind === "added" ? (
          <div key={i} className="flex px-4 py-0.5 bg-emerald-950/30 text-emerald-200">
            <span className="w-6 shrink-0 text-right select-none pr-3 text-emerald-500/70">+</span>
            <span className="whitespace-pre">{line.text}</span>
          </div>
        ) : line.kind === "removed" ? (
          <div key={i} className="flex px-4 py-0.5 bg-red-950/30 text-red-200">
            <span className="w-6 shrink-0 text-right select-none pr-3 text-red-500/70">−</span>
            <span className="whitespace-pre">{line.text}</span>
          </div>
        ) : (
          <div key={i} className="flex px-4 py-0.5 text-muted-foreground">
            <span className="w-6 shrink-0 text-right select-none pr-3 text-white/20"> </span>
            <span className="whitespace-pre">{line.text}</span>
          </div>
        ),
      )}
    </div>
  );
}

export const CHANGE_LABEL: Record<FileDiff["changeKind"], { text: string; cls: string }> = {
  added: { text: "brand new", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
  modified: { text: "edited", cls: "text-amber-400 bg-amber-500/10 border-amber-500/25" },
  deleted: { text: "removed", cls: "text-red-400 bg-red-500/10 border-red-500/25" },
  renamed: { text: "renamed", cls: "text-sky-400 bg-sky-500/10 border-sky-500/25" },
  binary: { text: "binary — no line view", cls: "text-muted-foreground bg-white/5 border-white/10" },
};

/**
 * Returns the display data for a file diff header — the badge label text and
 * the path display (old path + new path for renames, just path otherwise).
 * Exported for unit-testing so we can assert rename/binary rendering without
 * a DOM environment.
 */
export function getFileDiffDisplay(diff: FileDiff): {
  labelText: string;
  /** Struck-through old path shown before the arrow on a rename; null otherwise */
  oldPath: string | null;
  /** The canonical (new) path displayed for the file */
  newPath: string;
  /** True when there are no diff lines to render (binary or pure rename) */
  hasLines: boolean;
} {
  return {
    labelText: CHANGE_LABEL[diff.changeKind].text,
    oldPath: diff.renamedFrom ?? null,
    newPath: diff.path,
    hasLines: diff.lines.length > 0,
  };
}

function FileDiffCard({ diff }: { diff: FileDiff }) {
  const { labelText, oldPath, newPath } = getFileDiffDisplay(diff);
  const label = CHANGE_LABEL[diff.changeKind];
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0d1117]" data-testid={`diff-file-${diff.path}`}>
      <div className="bg-[#161b22] px-4 py-2.5 border-b border-white/10 flex flex-wrap items-center gap-2 text-sm text-white/80 font-mono min-w-0">
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="truncate">
          {oldPath ? (
            <>
              <span className="text-white/50 line-through">{oldPath}</span>
              <span className="text-white/50"> → </span>
              {newPath}
            </>
          ) : (
            newPath
          )}
        </span>
        <span className={`text-[10px] uppercase font-bold tracking-widest border rounded px-1.5 py-0.5 ${label.cls}`}>
          {labelText}
        </span>
        <span className="ml-auto text-[11px] font-sans shrink-0">
          {diff.added > 0 && <span className="text-emerald-400 font-bold">+{diff.added}</span>}
          {diff.added > 0 && diff.removed > 0 && <span className="text-white/30"> / </span>}
          {diff.removed > 0 && <span className="text-red-400 font-bold">−{diff.removed}</span>}
        </span>
      </div>
      {diff.lines.length > 0 && <DiffLines lines={diff.lines} />}
      {diff.truncated && (
        <div className="px-4 py-2 text-[11px] text-muted-foreground bg-black/40 border-t border-white/5 italic">
          This file's changes are long — showing the first part only.
        </div>
      )}
    </div>
  );
}

function PanelShell({
  title,
  onClose,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 md:p-10 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      data-testid="diff-viewer"
    >
      <div
        className="surface-card w-full max-w-4xl max-h-full flex flex-col overflow-hidden border-white/15 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-4 sm:p-5 border-b border-white/10 bg-[#161b22]">
          <div className="flex-1 min-w-0">{title}</div>
          <button
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-white transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close diff viewer"
            data-testid="diff-viewer-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function CommitDiffPanel({ source, hash, onClose }: { source: DiffSource; hash: string; onClose: () => void }) {
  // Both hooks must be called unconditionally (Rules of Hooks). The inactive
  // one receives a sentinel ID so it will skip fetching (the generated guard
  // checks !== null && !== undefined; we pass null-cast to disable it cleanly).
  const lessonResult = useGetCommitDiff(
    source.kind === "lesson" ? source.id : (null as unknown as string),
    hash,
  );
  const crisisResult = useGetCrisisCommitDiff(
    source.kind === "crisis" ? source.id : (null as unknown as string),
    hash,
  );
  const { data, isLoading, isError } = source.kind === "crisis" ? crisisResult : lessonResult;
  return (
    <PanelShell
      onClose={onClose}
      title={
        data ? (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md border border-primary/30 bg-primary/10 text-primary">
                {data.shortHash}
              </span>
              {data.isMerge && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold tracking-widest text-violet-300 bg-violet-500/10 border border-violet-500/25 px-1.5 py-0.5 rounded-md">
                  <GitMerge className="w-3 h-3" /> merge
                </span>
              )}
            </div>
            <h3 className="font-bold text-white text-base sm:text-lg truncate">{data.subject}</h3>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mt-1">
              <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {data.authorName}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />{" "}
                {new Date(data.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ) : (
          <h3 className="font-bold text-white text-lg">What this snapshot changed</h3>
        )
      }
    >
      {isLoading && <Spinner />}
      {isError && (
        <p className="text-sm text-muted-foreground">
          Couldn't read that snapshot's changes — it may have been rewritten or garbage-collected. Try refreshing.
        </p>
      )}
      {data && (
        <>
          <p className="text-sm text-foreground/90 bg-primary/[0.06] border border-primary/20 rounded-lg px-4 py-3" data-testid="diff-summary">
            {data.summary}
          </p>
          {data.files.map((f) => (
            <FileDiffCard key={f.path} diff={f} />
          ))}
        </>
      )}
    </PanelShell>
  );
}

function WorkingDiffPanel({ source, path, onClose }: { source: DiffSource; path: string; onClose: () => void }) {
  // Both hooks must be called unconditionally (Rules of Hooks). The inactive
  // one receives a sentinel ID so it will skip fetching.
  const lessonResult = useGetWorkingFileDiff(
    source.kind === "lesson" ? source.id : (null as unknown as string),
    { filePath: path },
  );
  const crisisResult = useGetCrisisFileDiff(
    source.kind === "crisis" ? source.id : (null as unknown as string),
    { filePath: path },
  );
  const { data, isLoading, isError } = source.kind === "crisis" ? crisisResult : lessonResult;
  return (
    <PanelShell
      onClose={onClose}
      title={
        <div className="min-w-0">
          <h3 className="font-bold text-white text-base sm:text-lg font-mono truncate">{path}</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Working copy vs the last snapshot</p>
        </div>
      }
    >
      {isLoading && <Spinner />}
      {isError && (
        <p className="text-sm text-muted-foreground">
          Couldn't read this file's changes — it may have just been committed or reverted. Try refreshing.
        </p>
      )}
      {data && (
        <>
          <p className="text-sm text-foreground/90 bg-primary/[0.06] border border-primary/20 rounded-lg px-4 py-3" data-testid="diff-summary">
            {data.summary}
          </p>
          {data.staged && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Package className="w-4 h-4" /> On the Loading Dock — staged, ready to seal
              </h4>
              <FileDiffCard diff={data.staged} />
            </div>
          )}
          {data.unstaged && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Still on the Workbench — not staged yet
              </h4>
              <FileDiffCard diff={data.unstaged} />
            </div>
          )}
          {!data.staged && !data.unstaged && (
            <p className="text-sm text-muted-foreground italic">No line changes to show for this file.</p>
          )}
        </>
      )}
    </PanelShell>
  );
}

export function DiffViewer({
  source,
  selection,
  onClose,
}: {
  source: DiffSource;
  selection: DiffSelection | null;
  onClose: () => void;
}) {
  if (!selection) return null;
  return selection.kind === "commit" ? (
    <CommitDiffPanel source={source} hash={selection.hash} onClose={onClose} />
  ) : (
    <WorkingDiffPanel source={source} path={selection.path} onClose={onClose} />
  );
}
