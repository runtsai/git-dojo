import { RepoCommit, RepoBranch, RemoteBranch, SyncStatus } from "@workspace/api-client-react";
import { GitCommit as GitCommitIcon, Clock, User, Cloud, GitBranch, GitMerge } from "lucide-react";

/**
 * Parent-aware commit graph: real topology instead of a flat list.
 * Columns are assigned with a simple lane-tracking walk over the
 * date-ordered commit list; parent edges are drawn as SVG curves so
 * branches and merges are visible instead of implied.
 */

const ROW_H = 84;
const COL_W = 18;
const NODE_R = 5;

const LANE_COLORS = [
  "#ff6b00", // primary orange
  "#34d399", // emerald
  "#38bdf8", // sky
  "#a78bfa", // violet
  "#fbbf24", // amber
  "#fb7185", // rose
];

type LayoutRow = {
  commit: RepoCommit;
  col: number;
  color: string;
};

type Edge = { fromRow: number; fromCol: number; toRow: number; toCol: number; color: string };

export function layoutGraph(commits: RepoCommit[]): { rows: LayoutRow[]; edges: Edge[]; maxCol: number } {
  // lanes[i] = hash the lane is waiting for (the next expected commit), or null.
  const lanes: (string | null)[] = [];
  const laneColor: string[] = [];
  const rowIndexByHash = new Map(commits.map((c, i) => [c.hash, i]));
  const rows: LayoutRow[] = [];
  const edges: Edge[] = [];
  let colorCursor = 0;
  let maxCol = 0;

  const nextColor = () => LANE_COLORS[colorCursor++ % LANE_COLORS.length]!;

  commits.forEach((c, i) => {
    // Find every lane waiting for this commit; the leftmost becomes its column.
    const waiting: number[] = [];
    lanes.forEach((h, li) => {
      if (h === c.hash) waiting.push(li);
    });
    let col: number;
    if (waiting.length > 0) {
      col = waiting[0]!;
      // Other lanes waiting for the same hash collapse into this one (branch point).
      for (let w = 1; w < waiting.length; w++) lanes[waiting[w]!] = null;
    } else {
      // New tip: take the first free lane or open a new one.
      const free = lanes.indexOf(null);
      col = free >= 0 ? free : lanes.length;
      if (col === lanes.length) {
        lanes.push(null);
        laneColor.push(nextColor());
      } else if (!laneColor[col]) {
        laneColor[col] = nextColor();
      }
    }
    if (!laneColor[col]) laneColor[col] = nextColor();
    const color = laneColor[col]!;
    rows.push({ commit: c, col, color });
    maxCol = Math.max(maxCol, col);

    // First parent continues this lane; extra parents (merges) get their own.
    const parents = c.parents ?? [];
    lanes[col] = parents[0] ?? null;
    for (let p = 1; p < parents.length; p++) {
      const ph = parents[p]!;
      const existing = lanes.indexOf(ph);
      let pcol: number;
      if (existing >= 0) pcol = existing;
      else {
        const free = lanes.indexOf(null);
        pcol = free >= 0 ? free : lanes.length;
        if (pcol === lanes.length) {
          lanes.push(ph);
          laneColor.push(nextColor());
        } else lanes[pcol] = ph;
        if (!laneColor[pcol]) laneColor[pcol] = nextColor();
      }
      maxCol = Math.max(maxCol, pcol);
      const pRow = rowIndexByHash.get(ph);
      if (pRow !== undefined) {
        // Endpoint column is provisional (lanes can collapse at branch
        // points); resolve to the parent's final column after layout.
        edges.push({ fromRow: i, fromCol: col, toRow: pRow, toCol: -1, color: laneColor[pcol] ?? color });
      }
    }
    // Edge to first parent.
    const p0 = parents[0];
    if (p0) {
      const pRow = rowIndexByHash.get(p0);
      if (pRow !== undefined) {
        // The parent's final column is decided when it is laid out; we record
        // the child's column and fix the endpoint up afterwards.
        edges.push({ fromRow: i, fromCol: col, toRow: pRow, toCol: -1, color });
      }
    }
  });

  // Resolve deferred endpoints to the parent's actual column.
  for (const e of edges) {
    if (e.toCol === -1) {
      const target = rows[e.toRow];
      e.toCol = target ? target.col : e.fromCol;
    }
  }
  return { rows, edges, maxCol };
}

function edgePath(e: Edge): string {
  const x1 = e.fromCol * COL_W + COL_W / 2;
  const y1 = e.fromRow * ROW_H + ROW_H / 2;
  const x2 = e.toCol * COL_W + COL_W / 2;
  const y2 = e.toRow * ROW_H + ROW_H / 2;
  if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  // Stay in the child's column, then curve into the parent's column just above it.
  const bendY = y2 - ROW_H / 2;
  return `M ${x1} ${y1} L ${x1} ${bendY} C ${x1} ${bendY + ROW_H * 0.35}, ${x2} ${bendY + ROW_H * 0.15}, ${x2} ${y2}`;
}

interface Props {
  commits: RepoCommit[];
  branches?: RepoBranch[];
  remoteBranches?: RemoteBranch[];
  currentBranch?: string | null;
  syncStatus?: SyncStatus | null;
  /** When provided, clicking a commit reveals what it actually changed. */
  onCommitClick?: (commit: RepoCommit) => void;
}

export function CommitTimeline({ commits, branches = [], remoteBranches = [], currentBranch = null, syncStatus = null, onCommitClick }: Props) {
  if (commits.length === 0) {
    return (
      <div className="surface-card p-6 md:p-8">
        <h3 className="text-xl font-bold mb-6 text-foreground tracking-tight">Commit History</h3>
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-white/10 rounded-xl bg-black/40 shadow-inner">
          <GitCommitIcon className="w-10 h-10 mx-auto mb-4 opacity-30 text-white" />
          <p className="font-medium text-lg">No commits yet. Create your first snapshot!</p>
        </div>
      </div>
    );
  }

  const { rows, edges, maxCol } = layoutGraph(commits);
  const gutterW = (maxCol + 1) * COL_W;
  const height = rows.length * ROW_H;
  const localTips = new Map(branches.map((b) => [b.headHash, b] as const));
  const remoteTips = new Map<string, RemoteBranch[]>();
  for (const rb of remoteBranches) {
    const list = remoteTips.get(rb.headHash) ?? [];
    list.push(rb);
    remoteTips.set(rb.headHash, list);
  }

  return (
    <div className="surface-card p-6 md:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h3 className="text-xl font-bold text-foreground tracking-tight">Commit History</h3>
        {syncStatus && (syncStatus.ahead > 0 || syncStatus.behind > 0) && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1">
            {syncStatus.ahead > 0 && `${syncStatus.ahead} to push`}
            {syncStatus.ahead > 0 && syncStatus.behind > 0 && " · "}
            {syncStatus.behind > 0 && `${syncStatus.behind} to pull`}
          </span>
        )}
        {syncStatus && syncStatus.ahead === 0 && syncStatus.behind === 0 && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded px-2 py-1">
            in sync with {syncStatus.remoteBranch}
          </span>
        )}
      </div>

      <div className="flex overflow-x-auto">
        {/* Graph gutter: hidden on small screens to give rows full width */}
        <svg width={gutterW} height={height} className="hidden sm:block shrink-0" aria-hidden="true">
          {edges.map((e, i) => (
            <path key={i} d={edgePath(e)} fill="none" stroke={e.color} strokeWidth="2" opacity="0.65" />
          ))}
          {rows.map((r, i) => {
            const cx = r.col * COL_W + COL_W / 2;
            const cy = i * ROW_H + ROW_H / 2;
            const isMerge = (r.commit.parents?.length ?? 0) > 1;
            return (
              <g key={r.commit.hash}>
                <circle cx={cx} cy={cy} r={NODE_R + 3} fill="#0d1117" />
                <circle cx={cx} cy={cy} r={NODE_R} fill={isMerge ? "#0d1117" : r.color} stroke={r.color} strokeWidth="2.5" />
              </g>
            );
          })}
        </svg>

        {/* Rows */}
        <div className="flex-1 min-w-0">
          {rows.map((r) => {
            const c = r.commit;
            const tip = localTips.get(c.hash);
            const remotes = remoteTips.get(c.hash) ?? [];
            const isHead = !!tip && !!currentBranch && tip.name === currentBranch;
            const isMerge = (c.parents?.length ?? 0) > 1;
            const RowTag = onCommitClick ? "button" : "div";
            return (
              <RowTag
                key={c.hash}
                className={`flex items-center min-w-0 pl-3 group border-b border-white/[0.03] last:border-0 w-full text-left min-h-[84px] sm:h-[84px] ${
                  onCommitClick
                    ? "cursor-pointer rounded-md transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    : ""
                }`}
                {...(onCommitClick
                  ? { onClick: () => onCommitClick(c), title: "See what this snapshot changed", "data-testid": `commit-row-${c.shortHash}` }
                  : {})}
              >
                <div className="min-w-0 flex-1 py-2">
                  <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md border shadow-sm" style={{ color: r.color, borderColor: `${r.color}40`, backgroundColor: `${r.color}14` }}>
                      {c.shortHash}
                    </span>
                    {isMerge && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold tracking-widest text-violet-300 bg-violet-500/10 border border-violet-500/25 px-1.5 py-0.5 rounded-md">
                        <GitMerge className="w-3 h-3" /> merge
                      </span>
                    )}
                    {isHead && (
                      <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-primary-foreground bg-primary px-1.5 py-0.5 rounded-md shadow-[0_0_8px_rgba(255,107,0,0.4)]">
                        you are here
                      </span>
                    )}
                    {tip && (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold tracking-widest text-secondary-foreground bg-secondary border border-white/10 px-1.5 py-0.5 rounded-md shadow-inner">
                        <GitBranch className="w-3 h-3" /> {tip.name}
                      </span>
                    )}
                    {remotes.map((rb) => (
                      <span key={rb.name} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/25 px-1.5 py-0.5 rounded-md" title="Where GitHub's copy sits (as last seen)">
                        <Cloud className="w-3 h-3" /> {rb.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{c.subject}</p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                    <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> {c.authorName}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(c.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                </div>
                {onCommitClick && (
                  <span className="hidden sm:inline text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pr-3 shrink-0">
                    what changed?
                  </span>
                )}
              </RowTag>
            );
          })}
        </div>
      </div>
    </div>
  );
}
