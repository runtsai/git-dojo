import { ReactNode, useState } from "react";
import {
  GitPullRequest,
  GitMerge,
  MessageSquare,
  FileDiff,
  Plus,
  CheckCircle2,
  XCircle,
  MessageCircle,
} from "lucide-react";

/**
 * Reusable simulated pull-request screens: header, tabs, conversation
 * timeline, files-changed diff with inline commenting, and the review
 * decision panel. Purely simulated — no network, all state via props.
 */

export type SimPrStatus = "open" | "approved" | "changes_requested" | "merged";

export function SimPrContainer({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden text-left">
      {children}
    </div>
  );
}

export function SimPrHeader({
  title,
  number,
  author,
  sourceBranch,
  targetBranch,
  status,
  commitCount,
  callout,
}: {
  title: string;
  number: number;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  status: SimPrStatus;
  commitCount?: number;
  callout?: ReactNode;
}) {
  const badge =
    status === "merged"
      ? { text: "Merged", cls: "bg-purple-500/20 text-purple-300 border-purple-500/40", Icon: GitMerge }
      : status === "approved"
      ? { text: "Approved", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", Icon: CheckCircle2 }
      : status === "changes_requested"
      ? { text: "Changes requested", cls: "bg-red-500/20 text-red-300 border-red-500/40", Icon: XCircle }
      : { text: "Open", cls: "bg-emerald-600/20 text-emerald-400 border-emerald-600/40", Icon: GitPullRequest };
  return (
    <div className="relative p-4 md:p-5 border-b border-white/10 bg-[#161b22]">
      {callout}
      <h3 className="text-white font-bold text-lg leading-snug">
        {title} <span className="text-muted-foreground font-normal">#{number}</span>
      </h3>
      <div className="flex flex-wrap items-center gap-2 mt-3 text-sm">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold text-xs ${badge.cls}`}>
          <badge.Icon className="w-3.5 h-3.5" /> {badge.text}
        </span>
        <span className="text-muted-foreground">
          <span className="text-white/80 font-medium">{author}</span> wants to merge{" "}
          {commitCount != null && (
            <span className="text-white/80 font-medium">{commitCount} commit{commitCount === 1 ? "" : "s"} </span>
          )}
          from
        </span>
        <code className="bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono">{sourceBranch}</code>
        <span className="text-muted-foreground">into</span>
        <code className="bg-blue-500/10 text-blue-300 px-1.5 py-0.5 rounded text-xs font-mono">{targetBranch}</code>
      </div>
    </div>
  );
}

export function SimPrTabs({
  active,
  onSelect,
  conversationCount,
  filesCount,
  calloutConversation,
  calloutFiles,
}: {
  active: "conversation" | "files";
  onSelect?: (tab: "conversation" | "files") => void;
  conversationCount?: number;
  filesCount?: number;
  calloutConversation?: ReactNode;
  calloutFiles?: ReactNode;
}) {
  const tabCls = (isActive: boolean) =>
    `relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
      isActive
        ? "border-primary text-white"
        : "border-transparent text-muted-foreground hover:text-white"
    }`;
  return (
    <div className="flex items-center bg-[#161b22] border-b border-white/10 px-2 overflow-x-auto">
      <button className={tabCls(active === "conversation")} onClick={() => onSelect?.("conversation")}>
        {calloutConversation}
        <MessageSquare className="w-4 h-4" /> Conversation
        {conversationCount != null && (
          <span className="bg-white/10 text-white/70 text-xs px-1.5 py-0.5 rounded-full">{conversationCount}</span>
        )}
      </button>
      <button className={tabCls(active === "files")} onClick={() => onSelect?.("files")}>
        {calloutFiles}
        <FileDiff className="w-4 h-4" /> Files changed
        {filesCount != null && (
          <span className="bg-white/10 text-white/70 text-xs px-1.5 py-0.5 rounded-full">{filesCount}</span>
        )}
      </button>
    </div>
  );
}

export interface SimPrCommentData {
  author: string;
  initials: string;
  color?: string; // tailwind classes for the avatar chip
  time: string;
  body: ReactNode;
  role?: string; // e.g. "Owner", "Contractor"
}

export function SimPrComment({ comment, isDescription }: { comment: SimPrCommentData; isDescription?: boolean }) {
  return (
    <div className="flex gap-3">
      <div
        className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold border ${
          comment.color || "bg-blue-500/20 text-blue-300 border-blue-500/30"
        }`}
      >
        {comment.initials}
      </div>
      <div className="flex-1 min-w-0 border border-white/10 rounded-lg overflow-hidden">
        <div className="bg-[#161b22] px-3 py-2 text-sm flex flex-wrap items-center gap-2 border-b border-white/10">
          <span className="font-bold text-white">{comment.author}</span>
          {comment.role && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground border border-white/10 rounded px-1.5 py-0.5">
              {comment.role}
            </span>
          )}
          <span className="text-muted-foreground text-xs">
            {isDescription ? "opened this" : "commented"} {comment.time}
          </span>
        </div>
        <div className="p-3 text-sm text-white/80 leading-relaxed bg-[#0d1117]">{comment.body}</div>
      </div>
    </div>
  );
}

export function SimPrConversation({ comments, children }: { comments: SimPrCommentData[]; children?: ReactNode }) {
  return (
    <div className="p-4 md:p-5 space-y-4">
      {comments.map((c, i) => (
        <SimPrComment key={i} comment={c} isDescription={i === 0} />
      ))}
      {children}
    </div>
  );
}

/* ----------------------------- Files changed ----------------------------- */

export type SimDiffLineType = "add" | "del" | "ctx";

export interface SimDiffLine {
  type: SimDiffLineType;
  text: string;
}

export interface SimDiffFile {
  file: string;
  lines: SimDiffLine[];
}

export interface SimInlineComment {
  file: string;
  lineIndex: number;
  author: string;
  initials: string;
  body: string;
}

export function SimFilesChanged({
  files,
  comments = [],
  commentable = false,
  onAddComment,
  lineCallout,
}: {
  files: SimDiffFile[];
  comments?: SimInlineComment[];
  commentable?: boolean;
  onAddComment?: (file: string, lineIndex: number, body: string) => void;
  lineCallout?: { file: string; lineIndex: number; node: ReactNode };
}) {
  const [editing, setEditing] = useState<{ file: string; lineIndex: number } | null>(null);
  const [draft, setDraft] = useState("");

  const submitDraft = () => {
    if (!editing || !draft.trim()) return;
    onAddComment?.(editing.file, editing.lineIndex, draft.trim());
    setEditing(null);
    setDraft("");
  };

  return (
    <div className="p-4 md:p-5 space-y-4">
      {files.map((f) => (
        <div key={f.file} className="border border-white/10 rounded-lg overflow-hidden bg-[#0d1117]">
          <div className="bg-[#161b22] px-3 py-2 border-b border-white/10 text-sm text-white/80 font-mono flex items-center gap-2">
            <FileDiff className="w-4 h-4 text-muted-foreground shrink-0" /> {f.file}
          </div>
          <div className="font-mono text-[13px] leading-relaxed overflow-x-auto">
            {f.lines.map((line, i) => {
              const lineComments = comments.filter((c) => c.file === f.file && c.lineIndex === i);
              const isEditing = editing?.file === f.file && editing.lineIndex === i;
              const rowCls =
                line.type === "add"
                  ? "bg-emerald-950/40 text-emerald-200"
                  : line.type === "del"
                  ? "bg-red-950/40 text-red-200"
                  : "text-muted-foreground";
              const marker = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
              return (
                <div key={i}>
                  <div className={`group relative flex items-stretch ${rowCls}`}>
                    {lineCallout && lineCallout.file === f.file && lineCallout.lineIndex === i && lineCallout.node}
                    <span className="w-10 shrink-0 text-right text-white/30 select-none pr-2 py-0.5">{i + 1}</span>
                    {commentable ? (
                      <button
                        aria-label={`Comment on line ${i + 1} of ${f.file}`}
                        onClick={() => {
                          setEditing({ file: f.file, lineIndex: i });
                          setDraft("");
                        }}
                        className="w-6 shrink-0 flex items-center justify-center text-primary-foreground bg-primary rounded-sm my-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="w-2 shrink-0" />
                    )}
                    <span className="whitespace-pre px-2 py-0.5">
                      <span className="select-none inline-block w-4">{marker}</span>
                      {line.text}
                    </span>
                  </div>

                  {lineComments.map((c, j) => (
                    <div key={j} className="border-y border-white/10 bg-[#161b22] px-4 py-3 flex gap-3 font-sans">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary border border-primary/30 shrink-0 flex items-center justify-center text-[10px] font-bold">
                        {c.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs mb-1">
                          <span className="font-bold text-white">{c.author}</span>{" "}
                          <span className="text-muted-foreground">commented on line {c.lineIndex + 1}</span>
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  ))}

                  {isEditing && (
                    <div className="border-y border-primary/30 bg-[#161b22] p-3 font-sans space-y-2">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <MessageCircle className="w-3.5 h-3.5 text-primary" />
                        Comment on line {i + 1} of <span className="font-mono">{f.file}</span>
                      </div>
                      <textarea
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Say what you see, and what you need changed..."
                        rows={2}
                        className="w-full bg-[#0d1117] border border-white/10 rounded p-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditing(null)}
                          className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-white transition-colors rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={submitDraft}
                          disabled={!draft.trim()}
                          className="px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded disabled:opacity-50 transition-all active:scale-95"
                        >
                          Add comment
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------- Review decision ---------------------------- */

export type SimReviewDecision = "comment" | "approve" | "request_changes";

export function SimReviewPanel({
  decision,
  onDecide,
  summary,
  onSummaryChange,
  onSubmit,
  submitting,
}: {
  decision: SimReviewDecision | null;
  onDecide: (d: SimReviewDecision) => void;
  summary: string;
  onSummaryChange: (s: string) => void;
  onSubmit: () => void;
  submitting?: boolean;
}) {
  const options: { id: SimReviewDecision; title: string; desc: string; Icon: typeof CheckCircle2; cls: string }[] = [
    { id: "comment", title: "Comment", desc: "Feedback only, no verdict on merging.", Icon: MessageCircle, cls: "text-blue-300" },
    { id: "approve", title: "Approve", desc: "This work is safe to merge into the record.", Icon: CheckCircle2, cls: "text-emerald-400" },
    { id: "request_changes", title: "Request changes", desc: "The merge is blocked until these issues are fixed.", Icon: XCircle, cls: "text-red-400" },
  ];
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden bg-[#0d1117]">
      <div className="bg-[#161b22] px-4 py-3 border-b border-white/10 text-sm font-bold text-white">
        Finish your review
      </div>
      <div className="p-4 space-y-3">
        <textarea
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
          placeholder="Summarize your review for the contractor..."
          rows={3}
          className="w-full bg-[#161b22] border border-white/10 rounded p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
        />
        <div className="space-y-2">
          {options.map((o) => (
            <label
              key={o.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                decision === o.id ? "border-primary bg-primary/5" : "border-white/10 hover:border-white/30"
              }`}
            >
              <input
                type="radio"
                name="sim-review-decision"
                checked={decision === o.id}
                onChange={() => onDecide(o.id)}
                className="mt-1 accent-[#ff6b00]"
              />
              <div>
                <div className={`text-sm font-bold flex items-center gap-2 text-white`}>
                  <o.Icon className={`w-4 h-4 ${o.cls}`} /> {o.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{o.desc}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end pt-1">
          <button
            onClick={onSubmit}
            disabled={!decision || submitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 py-2.5 rounded-lg text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {submitting ? "Submitting..." : "Submit review"}
          </button>
        </div>
      </div>
    </div>
  );
}
