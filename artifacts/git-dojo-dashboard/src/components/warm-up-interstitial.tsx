import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Dumbbell } from "lucide-react";
import { useDrillStatus } from "@/hooks/use-drills";

const SKIP_KEY = "dojo-warmup-interstitial-skipped";

/**
 * Optional pre-module warm-up offer. Zero-gating: it renders as a slim,
 * dismissible banner above the module — the lesson content is always
 * right there, never blocked. Dismissing hides it for the browser session.
 */
export function WarmUpInterstitial() {
  const { dueCount } = useDrillStatus();
  const [skipped, setSkipped] = useState(
    () => sessionStorage.getItem(SKIP_KEY) === "1",
  );

  if (skipped || dueCount === 0) return null;

  const dismiss = () => {
    sessionStorage.setItem(SKIP_KEY, "1");
    setSkipped(true);
  };

  return (
    <div className="max-w-4xl mx-auto mb-6 enter-fade">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Dumbbell className="w-4 h-4" />
          </div>
          <p className="text-sm text-foreground/90 min-w-0">
            <span className="font-bold">
              {dueCount} recall item{dueCount === 1 ? "" : "s"} due.
            </span>{" "}
            <span className="text-muted-foreground">
              A two-minute warm-up before you dive in? Totally optional.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/warm-up"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
          >
            Warm up <ArrowRight className="w-3 h-3" />
          </Link>
          <button
            onClick={dismiss}
            className="px-3 py-1.5 rounded-md text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
