import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { recordDrillAttempt } from "@workspace/api-client-react";
import type { DrillItemStats, DrillFrictionEntry } from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  Terminal,
  X,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useDrillStatus } from "@/hooks/use-drills";
import {
  checkCommandAnswer,
  drillBank,
  type CommandDrill,
  type ConceptDrill,
  type DrillItem,
} from "@/content/drills";

const SESSION_SIZE = 8;

// ── Weak-spot helpers ────────────────────────────────────────────────
/** Build a map of sourceId → sourceLabel from the drill bank. */
const sourceLabelMap: Map<string, string> = new Map(
  drillBank
    .filter((d) => d.sourceId)
    .map((d) => [d.sourceId as string, d.sourceLabel]),
);

/** Return the in-app link for a sourceId (lesson or crisis). */
function sourceLink(sourceId: string): string {
  if (sourceId.startsWith("crisis-")) return `/crisis/${sourceId}`;
  if (sourceId.startsWith("lesson-")) return `/test-center/${sourceId}`;
  return "/";
}

function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return days === 1 ? "yesterday" : `${days} days ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}m ago`;
}

/** Honest practice line: "seen 4 times · last answer correct". */
function honestStat(stats: DrillItemStats | undefined): string {
  if (!stats || stats.seenCount === 0) return "first time seeing this";
  const seen = `seen ${stats.seenCount} time${stats.seenCount === 1 ? "" : "s"}`;
  const last =
    stats.lastCorrect === null
      ? ""
      : stats.lastCorrect
        ? " · last answer correct"
        : " · last answer wrong";
  const when = timeAgo(stats.lastSeenAt);
  return `${seen}${last}${when ? ` · ${when}` : ""}`;
}

interface AttemptOutcome {
  item: DrillItem;
  correct: boolean;
}

export function WarmUp() {
  const { isLoading, eligible, stats, dueCount, friction, refetchDue } = useDrillStatus();

  useEffect(() => {
    document.title = "Warm Up | Git Dojo";
  }, []);

  // The session is snapshotted once when the learner starts, so answering
  // items doesn't reshuffle the deck under them.
  const [session, setSession] = useState<DrillItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<AttemptOutcome[]>([]);
  const statsById = useMemo(() => new Map(stats.map((s) => [s.id, s])), [stats]);
  // Stats frozen at session start so feedback shows pre-answer history.
  const sessionStatsRef = useRef<Map<string, DrillItemStats>>(new Map());

  const startSession = (onlyDue: boolean) => {
    const byId = new Map(eligible.map((i) => [i.id, i]));
    const ordered = stats
      .filter((s) => (onlyDue ? s.dueNow : true))
      .map((s) => byId.get(s.id))
      .filter((i): i is DrillItem => Boolean(i))
      .slice(0, SESSION_SIZE);
    sessionStatsRef.current = new Map(statsById);
    setSession(ordered);
    setIndex(0);
    setOutcomes([]);
  };

  const recordOutcome = (item: DrillItem, correct: boolean) => {
    setOutcomes((prev) => [...prev, { item, correct }]);
    // Fire-and-forget: the server reschedules the item; the UI already
    // knows the outcome. Refetch happens at session end.
    recordDrillAttempt({ itemId: item.id, correct, sourceId: item.sourceId ?? null }).catch(
      () => {},
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center flex-1 min-h-[300px]">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (eligible.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center space-y-6 enter-slide-up">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
          <Dumbbell className="w-10 h-10" />
        </div>
        <h1 className="text-4xl heading-tight text-foreground">Warm Up</h1>
        <p className="text-lg text-muted-foreground reading-text mx-auto">
          Recall drills are built from lessons you've already completed — finish your
          first module or Test Center lesson and this room opens up.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-bold hover:brightness-110 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to the Ledger
        </Link>
      </div>
    );
  }

  // ── Session finished: honest summary ────────────────────────────────
  if (session && index >= session.length) {
    const correct = outcomes.filter((o) => o.correct).length;
    return (
      <div className="max-w-2xl mx-auto space-y-8 enter-slide-up w-full">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl heading-tight text-foreground">Session done</h1>
          <p className="text-muted-foreground">
            {correct} of {outcomes.length} answered correctly. Wrong ones come back
            soon; right ones return later.
          </p>
        </div>
        <div className="surface-card divide-y divide-white/5">
          {outcomes.map(({ item, correct: ok }) => (
            <div key={item.id} className="flex items-start gap-3 p-4">
              <div
                className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  ok ? "bg-emerald-500/15 text-emerald-500" : "bg-destructive/15 text-destructive"
                }`}
              >
                {ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground">{item.prompt}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.sourceLabel}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              setSession(null);
              refetchDue();
            }}
            className="px-5 py-3 rounded-lg bg-secondary text-foreground font-bold hover:bg-secondary/70 active:scale-95 transition-all"
          >
            Back to Warm Up
          </button>
          <Link
            href="/"
            className="px-5 py-3 rounded-lg bg-primary text-primary-foreground font-bold text-center hover:brightness-110 active:scale-95 transition-all"
          >
            Back to the Ledger
          </Link>
        </div>
      </div>
    );
  }

  // ── Mid-session: one card at a time ─────────────────────────────────
  if (session) {
    const item = session[index]!;
    return (
      <div className="max-w-2xl mx-auto w-full space-y-6 enter-slide-up">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <button
            onClick={() => setSession(null)}
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Leave session
          </button>
          <span className="font-mono">
            {index + 1} / {session.length}
          </span>
        </div>
        <div className="h-1 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(index / session.length) * 100}%` }}
          />
        </div>
        <DrillCard
          key={item.id}
          item={item}
          stats={sessionStatsRef.current.get(item.id)}
          onAnswered={(correct) => recordOutcome(item, correct)}
          onNext={() => setIndex((i) => i + 1)}
          isLast={index === session.length - 1}
        />
      </div>
    );
  }

  // ── Lobby ────────────────────────────────────────────────────────────
  const startable = Math.min(dueCount, SESSION_SIZE);
  return (
    <div className="max-w-2xl mx-auto w-full space-y-8 enter-slide-up">
      <div className="space-y-3">
        <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
          <Dumbbell className="w-7 h-7" />
        </div>
        <h1 className="text-4xl heading-tight text-foreground">Warm Up</h1>
        <p className="text-lg text-muted-foreground reading-text">
          Two-minute recall drills built from what you've already learned. Entirely
          optional — nothing here gates anything.
        </p>
      </div>

      <div className="surface-card p-6 sm:p-8 space-y-5">
        {dueCount > 0 ? (
          <>
            <p className="text-foreground font-bold text-lg">
              {dueCount} item{dueCount === 1 ? "" : "s"} due for review
            </p>
            <p className="text-sm text-muted-foreground">
              Ordered by where you've actually struggled — grader retries and missed
              answers come first.
            </p>
            <button
              onClick={() => startSession(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold hover:brightness-110 active:scale-95 transition-all"
            >
              Start warm-up ({startable} card{startable === 1 ? "" : "s"})
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <p className="text-foreground font-bold text-lg">Nothing due right now</p>
            <p className="text-sm text-muted-foreground">
              Everything you've unlocked is scheduled for later. You can still run a
              practice round if you feel like it.
            </p>
            <button
              onClick={() => startSession(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-secondary text-foreground font-bold hover:bg-secondary/70 active:scale-95 transition-all"
            >
              Practice anyway <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <WeakSpotsPanel friction={friction} />

      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          {eligible.length} drill{eligible.length === 1 ? "" : "s"} unlocked from your
          completed lessons. New lessons unlock more.
        </p>
        <p>Correct answers push items further out; wrong ones bring them back soon.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
import { computeTrend, type Trend } from "@/lib/trend";

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend === "improving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
        <TrendingUp className="w-3.5 h-3.5" /> improving
      </span>
    );
  }
  if (trend === "regressing") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <TrendingDown className="w-3.5 h-3.5" /> still struggling
      </span>
    );
  }
  if (trend === "unknown") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/60">
        <Minus className="w-3.5 h-3.5" /> no recent data
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Minus className="w-3.5 h-3.5" /> mixed
    </span>
  );
}

function WeakSpotsPanel({ friction }: { friction: DrillFrictionEntry[] }) {
  const active = friction.filter((e) => !e.recovered);
  const recovered = friction.filter((e) => e.recovered);

  if (active.length === 0 && recovered.length === 0) return null;

  return (
    <div className="space-y-3">
      {active.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500/80" />
            <span>Where you've struggled</span>
          </div>
          <div className="surface-card divide-y divide-white/5">
            {active.map((entry) => {
              const label = sourceLabelMap.get(entry.sourceId) ?? entry.sourceId;
              const href = sourceLink(entry.sourceId);
              const totalRuns = entry.failures + entry.passes;
              const trend = computeTrend(entry);
              return (
                <div key={entry.sourceId} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Link
                      href={href}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate block"
                    >
                      {label}
                    </Link>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        {entry.windowFailures} failed check{entry.windowFailures === 1 ? "" : "s"}
                        {totalRuns > 0 && (
                          <> · {entry.passes} of {totalRuns} passed</>
                        )}
                      </p>
                      <TrendBadge trend={trend} />
                    </div>
                  </div>
                  <Link
                    href={href}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-secondary text-foreground hover:bg-secondary/70 transition-colors font-medium"
                    aria-label={`Review ${label}`}
                  >
                    Review
                  </Link>
                </div>
              );
            })}
          </div>
        </>
      )}

      {recovered.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Check className="w-4 h-4 shrink-0 text-emerald-500/80" />
            <span>Recently recovered</span>
          </div>
          <div className="surface-card divide-y divide-white/5 opacity-70">
            {recovered.map((entry) => {
              const label = sourceLabelMap.get(entry.sourceId) ?? entry.sourceId;
              const href = sourceLink(entry.sourceId);
              return (
                <div key={entry.sourceId} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Link
                      href={href}
                      className="text-sm font-medium text-emerald-400/80 hover:text-emerald-300 transition-colors truncate block"
                    >
                      {label}
                    </Link>
                    <p className="text-xs text-emerald-500/70 mt-0.5">
                      All recent checks passed
                    </p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-500/70 px-3 py-1.5">
                    <Check className="w-3.5 h-3.5" /> Recovered
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
function DrillCard({
  item,
  stats,
  onAnswered,
  onNext,
  isLast,
}: {
  item: DrillItem;
  stats: DrillItemStats | undefined;
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  return (
    <div className="surface-card p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium">
          {item.type === "command" ? (
            <>
              <Terminal className="w-3.5 h-3.5 text-primary" /> Type the command
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Recall
            </>
          )}
        </span>
        <span className="truncate">{honestStat(stats)}</span>
      </div>
      <p className="text-xl font-bold text-foreground leading-snug">{item.prompt}</p>
      {item.type === "concept" ? (
        <ConceptAnswer item={item} onAnswered={onAnswered} onNext={onNext} isLast={isLast} />
      ) : (
        <CommandAnswer item={item} onAnswered={onAnswered} onNext={onNext} isLast={isLast} />
      )}
    </div>
  );
}

function NextButton({ onNext, isLast }: { onNext: () => void; isLast: boolean }) {
  return (
    <button
      onClick={onNext}
      autoFocus
      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold hover:brightness-110 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {isLast ? "Finish session" : "Next card"} <ArrowRight className="w-4 h-4" />
    </button>
  );
}

function Feedback({ correct, explain }: { correct: boolean; explain: string }) {
  return (
    <div
      className={`rounded-lg border p-4 text-sm enter-fade ${
        correct
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-destructive/30 bg-destructive/10 text-red-200"
      }`}
    >
      <p className="font-bold mb-1 flex items-center gap-1.5">
        {correct ? (
          <>
            <Check className="w-4 h-4" /> Correct
          </>
        ) : (
          <>
            <X className="w-4 h-4" /> Not this time
          </>
        )}
      </p>
      <p className="text-foreground/90">{explain}</p>
    </div>
  );
}

function ConceptAnswer({
  item,
  onAnswered,
  onNext,
  isLast,
}: {
  item: ConceptDrill;
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {item.options.map((opt, i) => {
          const isAnswer = i === item.answerIndex;
          const isPicked = i === picked;
          let cls =
            "text-left w-full px-4 py-3 rounded-lg border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ";
          if (!answered) {
            cls +=
              "border-white/10 bg-secondary/40 text-foreground hover:border-primary/50 hover:bg-secondary active:scale-[0.99]";
          } else if (isAnswer) {
            cls += "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";
          } else if (isPicked) {
            cls += "border-destructive/50 bg-destructive/10 text-red-200";
          } else {
            cls += "border-white/5 bg-secondary/20 text-muted-foreground";
          }
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => {
                setPicked(i);
                onAnswered(i === item.answerIndex);
              }}
              className={cls}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <>
          <Feedback correct={picked === item.answerIndex} explain={item.explain} />
          <NextButton onNext={onNext} isLast={isLast} />
        </>
      )}
    </div>
  );
}

function CommandAnswer({
  item,
  onAnswered,
  onNext,
  isLast,
}: {
  item: CommandDrill;
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const answered = result !== null;

  const submit = () => {
    if (answered || value.trim() === "") return;
    const ok = checkCommandAnswer(value, item);
    setResult(ok);
    onAnswered(ok);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 font-mono text-sm focus-within:border-primary/60">
        <span className="text-primary select-none">$</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={answered}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="type the command…"
          className="flex-1 min-w-0 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 disabled:opacity-70"
          aria-label="Command answer"
        />
      </div>
      {!answered && (
        <button
          onClick={submit}
          disabled={value.trim() === ""}
          className="w-full px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          Check answer
        </button>
      )}
      {answered && (
        <>
          <Feedback
            correct={result === true}
            explain={
              result
                ? item.explain
                : `Expected: ${item.answers[0]!.replace(/<\w+>/g, (m) => m)} — ${item.explain}`
            }
          />
          <NextButton onNext={onNext} isLast={isLast} />
        </>
      )}
    </div>
  );
}
