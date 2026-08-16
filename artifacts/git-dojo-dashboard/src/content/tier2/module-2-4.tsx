import { useState } from "react";
import { useCompleteModule, getGetProgressQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  GitMerge,
  MessageSquare,
} from "lucide-react";
import {
  SimPrContainer,
  SimPrHeader,
  SimPrTabs,
  SimPrConversation,
  SimFilesChanged,
  SimReviewPanel,
  type SimReviewDecision,
  type SimDiffFile,
  type SimPrCommentData,
} from "@/components/sim/sim-pr";
import { contractorPr, prFiles, prConversation } from "./pr-data";
import { VisualModuleShell } from "@/components/visual-module-shell";

/** What the conversation looks like after Ruth's reply. */
const replyConversation: SimPrCommentData[] = [
  ...prConversation,
  {
    author: "Adam Cornelius",
    initials: "AC",
    role: "Owner",
    time: "1 day ago",
    color: "bg-primary/20 text-primary border-primary/30",
    body: (
      <span>
        <strong>Requested changes.</strong> Two blockers before this can
        merge:
        <br />
        1. <code className="bg-white/10 text-red-300 px-1 rounded text-xs font-mono">config.txt line 2</code>{" "}
        — live credential must be removed entirely. Keys belong in a secrets
        manager, never in the repo.
        <br />
        2. <code className="bg-white/10 text-red-300 px-1 rounded text-xs font-mono">config.txt line 4</code>{" "}
        — <code className="bg-white/10 text-yellow-200 px-1 rounded text-xs font-mono">upload_to_cloud=true</code> was
        not in scope. Revert to <code className="bg-white/10 text-green-300 px-1 rounded text-xs font-mono">false</code>.
        <br />
        The about page copy looks great. Fix these two lines and I'll approve.
      </span>
    ),
  },
  {
    author: "Ruth Osei",
    initials: "RO",
    role: "Contractor",
    time: "22 hours ago",
    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    body: (
      <span>
        Fixed both. Removed the key entirely (it's in the secrets manager now)
        and reverted <code className="bg-white/10 text-yellow-200 px-1 rounded text-xs font-mono">upload_to_cloud</code> to{" "}
        <code className="bg-white/10 text-green-300 px-1 rounded text-xs font-mono">false</code>.
        Ready for re-review.
      </span>
    ),
  },
];

/** The corrected diff after Ruth's fix commit. */
const fixedFiles: SimDiffFile[] = prFiles.map((f) => {
  if (f.file !== "config.txt") return f;
  return {
    ...f,
    lines: f.lines
      .filter(
        (l) =>
          !(
            l.type === "add" &&
            (l.text.includes("api_key") || l.text.includes("upload_to_cloud=true"))
          )
      )
      .map((l) =>
        l.type === "del" && l.text.includes("upload_to_cloud")
          ? { ...l, type: "ctx" as const }
          : l
      ),
  };
});

const ctxLines: Array<{ label: string; type: "cmd" | "out" | "ctx" }> = [
  { type: "cmd", label: "git add config.txt" },
  { type: "cmd", label: 'git commit -m "fix: remove key, revert upload flag"' },
  { type: "out", label: "[contractor-delivery abc1234] fix: remove key, revert upload flag" },
  { type: "ctx", label: "# credential removed from history via BFG" },
  { type: "ctx", label: "max_file_mb=100" },
];

type Tab = "conversation" | "files";

export function Module2_4() {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();
  const completeModule = useCompleteModule();

  const [tab, setTab] = useState<Tab>("conversation");
  const [decision, setDecision] = useState<SimReviewDecision | null>(null);
  const [summary, setSummary] = useState("");
  const [showError, setShowError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleNext = () => {
    setStep((s) => Math.min(s + 1, 3));
    window.scrollTo(0, 0);
  };
  const handlePrev = () => {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo(0, 0);
  };

  const handleSubmitReview = () => {
    if (!summary.trim()) {
      setShowError(
        "Add a short note to Ruth confirming the fixes look good — even a single sentence closes the loop."
      );
      return;
    }
    if (decision === "request_changes") {
      setShowError(
        "Ruth addressed both blockers: the credential is gone and upload_to_cloud is back to false. Requesting more changes would leave the PR in limbo with nothing left to fix."
      );
      return;
    }
    if (decision === "comment") {
      setShowError(
        "A comment doesn't lift the previous Request Changes. Only an Approve verdict clears the block and lets the work merge."
      );
      return;
    }
    setShowError(null);
    setSubmitting(true);
    completeModule.mutate(
      { data: { moduleId: "2.4", track: "visual" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProgressQueryKey() });
          setStep(4);
        },
        onSettled: () => setSubmitting(false),
      }
    );
  };

  const completionSlot = (
    <div className="p-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
      <SimPrContainer>
        <SimPrHeader
          {...contractorPr}
          commitCount={3}
          status="merged"
        />
      </SimPrContainer>

      <div className="w-24 h-24 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-full flex items-center justify-center mx-auto my-8 shadow-[0_0_30px_rgba(168,85,247,0.25)]">
        <GitMerge className="w-12 h-12" />
      </div>
      <h2 className="text-4xl font-extrabold text-foreground">Merged.</h2>
      <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
        You ran a complete review cycle: blocked a broken delivery, gave specific
        actionable feedback, verified the fix, and approved clean work. That's
        the full loop real teams live in.
      </p>
      <div className="pt-8 flex gap-4 justify-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(255,107,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Return to Ledger
        </Link>
      </div>
    </div>
  );

  return (
    <VisualModuleShell
      title="Ruth's fix: close the loop"
      step={step}
      totalDots={3}
      completionStep={4}
      completionSlot={completionSlot}
      onPrev={step > 1 ? handlePrev : undefined}
      onNext={step < 3 ? handleNext : undefined}
      nextLabel={
        step === 1 ? "See Ruth's reply" :
        step === 2 ? "Approve the fix" :
        "Continue"
      }
      // Step 3: submit is inside SimReviewPanel – only expose Back in the shell nav
      error={showError}
    >
      {/* ── Step 1: How the loop works ─────────────────────────────────── */}
      {step === 1 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">
            Part 1: The Loop
          </div>
          <h2 className="text-3xl font-bold">Request changes isn't the end</h2>
          <p className="text-muted-foreground reading-text text-lg">
            When you request changes, GitHub blocks the merge and records your verdict
            publicly. The contractor reads your notes, pushes a fix commit, and
            replies in the conversation — the PR stays open so all the history is in
            one place.
          </p>
          <p className="text-muted-foreground reading-text text-lg">
            Your job is to re-read the updated diff and confirm the fixes actually
            address the issues you raised. Once they do, you approve — and the loop
            closes.
          </p>
          <div className="mt-8 flex items-stretch gap-0 rounded-lg overflow-hidden border border-white/10 text-sm font-medium">
            {[
              { label: "Request\nchanges", cls: "bg-red-500/10 text-red-300 border-r border-white/10" },
              { label: "Contractor\nfixes", cls: "bg-white/5 text-white/70 border-r border-white/10" },
              { label: "Re-review\ndiff", cls: "bg-white/5 text-white/70 border-r border-white/10" },
              { label: "Approve\n& merge", cls: "bg-emerald-500/10 text-emerald-300" },
            ].map((s, i) => (
              <div key={i} className={`flex-1 flex flex-col items-center justify-center py-4 px-2 text-center whitespace-pre-line leading-snug ${s.cls}`}>
                {s.label}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Step 2: Read the updated PR ────────────────────────────────── */}
      {step === 2 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">
            Part 2: The Fix
          </div>
          <h2 className="text-3xl font-bold mb-1">Ruth replied and pushed a fix</h2>
          <p className="text-muted-foreground reading-text text-lg">
            Switch between the tabs below. The <strong className="text-foreground">Conversation</strong> tab
            shows Ruth's reply; <strong className="text-foreground">Files changed</strong> shows
            the updated diff — verify that both blockers are gone before you approve.
          </p>

          <SimPrContainer>
            <SimPrHeader
              {...contractorPr}
              commitCount={3}
              status="changes_requested"
            />
            <SimPrTabs
              active={tab}
              onSelect={setTab}
              conversationCount={replyConversation.length}
              filesCount={fixedFiles.length}
            />
            {tab === "conversation" ? (
              <SimPrConversation comments={replyConversation} />
            ) : (
              <SimFilesChanged files={fixedFiles} />
            )}
          </SimPrContainer>
        </>
      )}

      {/* ── Step 3: Interactive re-review ──────────────────────────────── */}
      {step === 3 && (
        <>
          <div className="inline-block px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-bold uppercase tracking-wider mb-2">
            Part 3: Close the Loop
          </div>
          <h2 className="text-3xl font-bold mb-1">Re-review and approve</h2>
          <p className="text-muted-foreground reading-text text-lg">
            Both blockers are resolved. Write Ruth a short confirmation and choose
            the verdict that lets the work merge.
          </p>

          <SimPrContainer>
            <SimPrHeader
              {...contractorPr}
              commitCount={3}
              status="changes_requested"
              callout={
                <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                  <MessageSquare className="w-3 h-3" /> Your changes requested — re-review needed
                </div>
              }
            />
            <SimPrTabs
              active={tab}
              onSelect={setTab}
              conversationCount={replyConversation.length}
              filesCount={fixedFiles.length}
            />
            {tab === "conversation" ? (
              <SimPrConversation comments={replyConversation} />
            ) : (
              <SimFilesChanged files={fixedFiles} />
            )}
            <div className="p-4 md:p-5 pt-0">
              <SimReviewPanel
                decision={decision}
                onDecide={(d) => {
                  setDecision(d);
                  setShowError(null);
                }}
                summary={summary}
                onSummaryChange={(s) => {
                  setSummary(s);
                  setShowError(null);
                }}
                onSubmit={handleSubmitReview}
                submitting={submitting || completeModule.isPending}
              />
            </div>
          </SimPrContainer>
        </>
      )}
    </VisualModuleShell>
  );
}

// Suppress unused import warning – ctxLines kept for future terminal preview feature
void ctxLines;
