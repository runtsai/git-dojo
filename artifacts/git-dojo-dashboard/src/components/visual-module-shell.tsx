import { type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";

/**
 * Props for the shared visual-module outer shell.
 *
 * The shell owns:
 *   - the max-w-4xl wrapper + enter-slide-up animation
 *   - the "Back to Ledger" link
 *   - the title + progress-dot row
 *   - the surface-card container
 *   - the completion screen (standard or custom)
 *   - the error banner
 *   - the Back / Continue / Submit nav row
 *
 * Each module passes only its step content as `children`.
 */
export type VisualModuleShellProps = {
  /** Module title shown in the h1. */
  title: string;
  /** Current 1-based step number. */
  step: number;
  /** Number of progress dots rendered (default 5). */
  totalDots?: number;
  /** Step value that triggers the completion screen (default 6). */
  completionStep?: number;
  /** Heading on the standard completion screen (default "Module Complete"). */
  completionTitle?: string;
  /** Body paragraph on the standard completion screen. */
  completionText?: string;
  /** If provided, a "Next →" button appears on the completion screen. */
  nextModuleHref?: string;
  nextModuleLabel?: string;
  /**
   * Custom completion screen – replaces the standard CheckCircle screen.
   * Use when the final screen is visually distinct (e.g. a merged-PR animation).
   */
  completionSlot?: ReactNode;
  /** Back handler. Omit to hide the Back button on this step. */
  onPrev?: () => void;
  /** Primary forward handler (normal steps). */
  onNext?: () => void;
  /** Label for the forward button (default "Continue"). */
  nextLabel?: string;
  /**
   * When provided, renders as the primary button instead of onNext.
   * Use for the graded-submission step.
   */
  onSubmit?: () => void;
  /** Label for the submit button (default "Complete Task"). */
  submitLabel?: string;
  /** Shows "Grading…" and disables the button while the mutation is in-flight. */
  isPending?: boolean;
  /** Extra disabled condition for the submit button beyond isPending. */
  isSubmitDisabled?: boolean;
  /** Error message rendered above the nav row. */
  error?: string | null;
  /**
   * Per-step map hints. Keyed by 1-based step number.
   * When a hint is present for the current step it renders in a collapsible
   * panel between the title/dots row and the surface-card, giving learners a
   * spatial anchor for where in the GitHub UI the lesson lives.
   */
  stepHints?: Record<number, ReactNode>;
  /**
   * Step content – everything except the outer padding wrapper, nav row,
   * error banner, and completion screen.
   */
  children: ReactNode;
};

export function VisualModuleShell({
  title,
  step,
  totalDots = 5,
  completionStep,
  completionTitle = "Module Complete",
  completionText,
  nextModuleHref,
  nextModuleLabel,
  completionSlot,
  onPrev,
  onNext,
  nextLabel = "Continue",
  onSubmit,
  submitLabel = "Complete Task",
  isPending = false,
  isSubmitDisabled = false,
  error,
  stepHints,
  children,
}: VisualModuleShellProps) {
  // Derive completionStep from totalDots when the prop is omitted, so the
  // default is always correct regardless of how many dots a module uses.
  const effectiveCompletionStep = completionStep ?? totalDots + 1;

  if (process.env.NODE_ENV !== "production") {
    if (effectiveCompletionStep <= totalDots) {
      console.warn(
        `[VisualModuleShell] completionStep (${effectiveCompletionStep}) is <= totalDots (${totalDots}). ` +
          `The completion screen would appear mid-module. Set completionStep > totalDots.`
      );
    }
    if (effectiveCompletionStep > totalDots + 2) {
      console.warn(
        `[VisualModuleShell] completionStep (${effectiveCompletionStep}) is > totalDots+2 (${totalDots + 2}). ` +
          `The completion screen may never be reachable. Check totalDots and completionStep.`
      );
    }
  }

  const isCompletion = step === effectiveCompletionStep;
  const hasNav = Boolean(onPrev || onNext || onSubmit);
  const primaryDisabled = isPending || isSubmitDisabled;

  return (
    <div className="max-w-4xl mx-auto space-y-8 enter-slide-up pb-20">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-all active:scale-95 uppercase tracking-wider bg-black/40 border border-white/5 shadow-inner px-3 py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Ledger
      </Link>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight">{title}</h1>
        <div className="flex gap-2 shrink-0 pt-1">
          {Array.from({ length: totalDots }, (_, i) => i + 1).map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step
                  ? "bg-primary scale-150"
                  : i < step
                  ? "bg-primary/50"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      {stepHints?.[step] && !isCompletion && (
        <div className="flex items-start gap-3 px-4 py-3 bg-black/40 border border-white/5 rounded-xl shadow-inner enter-fade text-sm">
          <div className="shrink-0 mt-0.5 w-4 h-4 text-primary/70">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M8 1.5C5.1 1.5 2.5 4 2.5 7c0 3.7 5.5 8 5.5 8s5.5-4.3 5.5-8c0-3-2.6-5.5-5.5-5.5z" />
              <circle cx="8" cy="7" r="1.5" />
            </svg>
          </div>
          <div className="text-muted-foreground leading-relaxed">{stepHints[step]}</div>
        </div>
      )}

      <div className="surface-card overflow-hidden">
        {isCompletion ? (
          /* ── Completion screen ───────────────────────────────────────────── */
          completionSlot ?? (
            <div className="p-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-4xl font-extrabold text-foreground">{completionTitle}</h2>
              {completionText && (
                <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                  {completionText}
                </p>
              )}
              <div className="pt-8 flex flex-wrap gap-4 justify-center">
                {nextModuleHref ? (
                  <>
                    <Link
                      href={nextModuleHref}
                      className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 min-h-[44px] rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(255,107,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {nextModuleLabel ?? "Next Module"}
                    </Link>
                    <Link
                      href="/"
                      className="inline-flex items-center justify-center bg-secondary hover:bg-secondary/80 text-foreground font-bold px-6 py-3 min-h-[44px] rounded-lg transition-colors border border-white/5"
                    >
                      Return to Ledger
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/"
                    className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 min-h-[44px] rounded-lg transition-all active:scale-95 shadow-[0_0_15px_rgba(255,107,0,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Return to Ledger
                  </Link>
                )}
              </div>
            </div>
          )
        ) : (
          /* ── Step content + error banner + nav ───────────────────────────── */
          <div key={step} className="p-5 sm:p-8 md:p-12 space-y-6 enter-fade relative">
            {children}

            {error && (
              <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-3 enter-fade">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="font-medium text-sm">{error}</p>
              </div>
            )}

            {hasNav && (
              <div className={`pt-8 flex ${onPrev ? "justify-between" : "justify-end"}`}>
                {onPrev && (
                  <button
                    onClick={onPrev}
                    className="text-muted-foreground hover:text-foreground font-bold px-4 py-2 min-h-[44px] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  >
                    Back
                  </button>
                )}
                {onSubmit ? (
                  <button
                    onClick={onSubmit}
                    disabled={primaryDisabled}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Grading…" : submitLabel}
                  </button>
                ) : onNext ? (
                  <button
                    onClick={onNext}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {nextLabel} <ChevronRight className="w-4 h-4" />
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
